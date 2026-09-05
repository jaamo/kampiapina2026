# Ruska-seuranta (/ruska)

Julkinen sivu Ruska-seurantavideoille sekä yleisöäänestys päivän kohokohdasta.

| Osoite | Mitä |
| --- | --- |
| `/ruska` | Hero, jaksot, tärkeät linkit, käynnissä oleva äänestys |
| `/ruska/kierros/<id>` | Yksittäisen kierroksen tulokset, myös suljetut |
| `/ruska/admin` | Kierrosten avaus/sulku, ehdotusten hyväksyntä, jaksojen ylläpito |

Sivusto on edelleen staattinen. Vain nämä kolme sivua ja `/api/ruska/*` ajetaan
Netlify-funktiona (`export const prerender = false`); loput rakennetaan
buildissa kuten ennenkin.

## Käyttöönotto

1. **Tietokanta.** Luo projekti osoitteessa [neon.tech](https://neon.tech)
   (ilmainen taso riittää tälle). Alueeksi `aws-eu-central-1`. Kopioi
   *pooled* connection string.

   Netlifyn oma vanha Neon-lisäosa (`@netlify/neon`) ei enää luo uusia
   tietokantoja, ja sen tilalle tullut natiivi **Netlify Database** on vain
   credit-pohjaisissa paketeissa. Siksi tässä käytetään omaa Neon-projektia.
   Jos joskus siirryt Netlify Databaseen, se tarjoaa yhteysmerkkijonon
   muuttujassa `NETLIFY_DB_URL` — mappaa se `DATABASE_URL`:ksi.
2. **Ympäristömuuttujat.** Netlify → *Site configuration → Environment
   variables*:
   - `DATABASE_URL` = Neonin pooled connection string
   - `RUSKA_ADMIN_PASSWORD` = oma pitkä salasana. Ilman sitä `/ruska/admin`
     ei päästä kirjautumaan sisään.
3. **Taulut.** Aja `db/ruska-schema.sql` kerran Neonin SQL-editorissa tai
   `psql "$DATABASE_URL" -f db/ruska-schema.sql`.
4. **Funktioiden alue.** Jos tili on maksullisella paketilla: *Site
   configuration → Functions → Region* → Frankfurt, sama kuin tietokannalla.
   Ilmaisella paketilla funktiot ajetaan us-east-1:ssä, jolloin jokaiseen
   kyselyyn tulee ~100 ms lisää — toimii silti.
5. **Deploy.** Normaali push. Ensimmäisellä kerralla Netlify huomaa uuden
   adapterin (`@astrojs/netlify`) ja alkaa julkaista `/ruska`-reitit funktioina;
   `netlify.toml` kertoo build-komennon ja `dist/`-hakemiston.

## Tärkeät linkit

Säännöt, virallinen seuranta ja SportRec ovat toistaiseksi `example.com`
-placeholdereita. Ne ovat `importantLinks`-taulukossa tiedoston
`src/pages/ruska/index.astro` alussa.

## Miten äänestys toimii

- Yksi kierros kerrallaan on auki (tietokanta pakottaa tämän uniikilla
  indeksillä). Uuden kierroksen avaaminen sulkee edellisen.
- Ehdotukset menevät jonoon ja näkyvät sivulla vasta hyväksyttyinä.
- Peukku on vipukytkin: sama nappi antaa ja peruu äänen. Ehdotusten määrää,
  joita yksi ihminen voi peukuttaa, ei ole rajoitettu.
- Äänestäjä tunnistetaan `ka_ruska_voter`-evästeellä. Se estää vahingossa
  tulevat tuplaäänet, ei tahallista huijaamista — eikä ole tarkoituskaan.
- Yksi selain saa jättää viisi ehdotusta kierrosta kohti.
- Kaikki toiminnot ovat tavallisia lomakepostauksia, joten sivu toimii myös
  ilman JavaScriptiä. JS vain päivittää peukun ilman sivulatausta.

## Paikallinen kehitys

Neonin ajuri puhuu HTTP:tä, joten paikallinen Postgres tarvitsee eteensä
neon-proxyn:

```bash
docker run -d --name ruska-pg -e POSTGRES_PASSWORD=ruska -p 55432:5432 postgres:16-alpine
docker run -d --name ruska-neon-proxy --network host \
  -e PG_CONNECTION_STRING=postgres://postgres:ruska@localhost:55432/postgres \
  ghcr.io/timowilhelm/local-neon-http-proxy:main
psql postgres://postgres:ruska@localhost:55432/postgres -f db/ruska-schema.sql

# Proxyn mock-control-plane etsii endpointit tästä taulusta. Ilman sitä
# jokainen kysely kaatuu virheeseen "Control plane request failed".
psql postgres://postgres:ruska@localhost:55432/postgres -c \
  'CREATE SCHEMA IF NOT EXISTS neon_control_plane;
   CREATE TABLE IF NOT EXISTS neon_control_plane.endpoints (
     endpoint_id VARCHAR(255) PRIMARY KEY, allowed_ips VARCHAR(255));'
```

Kopioi sitten `.env.example` → `.env` ja ota `NEON_HTTP_ENDPOINT` käyttöön.
Paikallinen `DATABASE_URL` on:

```
DATABASE_URL=postgres://postgres:ruska@db.localtest.me:55432/postgres
```

Isäntänimen pitää olla `db.localtest.me` eikä `localhost`: proxy lukee
endpointin nimen sen ensimmäisestä osasta. `localtest.me` osoittaa
127.0.0.1:een, joten mitään ei tarvitse lisätä hosts-tiedostoon.

Lopuksi `docker rm -f ruska-pg ruska-neon-proxy` siivoaa molemmat.
