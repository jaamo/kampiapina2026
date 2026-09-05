-- Ruska-seurannan tietokanta.
-- Aja tämä kerran Neonin SQL-editorissa (tai `psql "$DATABASE_URL" -f db/ruska-schema.sql`).

-- Kierros = yksi äänestysjakso, tyypillisesti yksi tapahtumapäivä.
CREATE TABLE IF NOT EXISTS ruska_rounds (
  id          SERIAL PRIMARY KEY,
  title       TEXT        NOT NULL,
  subtitle    TEXT        NOT NULL DEFAULT '',
  status      TEXT        NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at   TIMESTAMPTZ
);

-- Vain yksi kierros voi olla auki kerrallaan.
CREATE UNIQUE INDEX IF NOT EXISTS ruska_rounds_one_open
  ON ruska_rounds ((status)) WHERE status = 'open';

-- Ehdotus = yleisön ehdottama päivän kohokohta. Julkaistaan vasta hyväksyttynä.
CREATE TABLE IF NOT EXISTS ruska_suggestions (
  id          SERIAL PRIMARY KEY,
  round_id    INTEGER     NOT NULL REFERENCES ruska_rounds(id) ON DELETE CASCADE,
  body        TEXT        NOT NULL,
  author      TEXT        NOT NULL DEFAULT '',
  status      TEXT        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'rejected')),
  submitter   TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ruska_suggestions_round
  ON ruska_suggestions (round_id, status);

-- Ääni = yksi peukku. voter_id tulee evästeestä, eli tämä on tahallaan kevyt.
CREATE TABLE IF NOT EXISTS ruska_votes (
  suggestion_id INTEGER     NOT NULL REFERENCES ruska_suggestions(id) ON DELETE CASCADE,
  voter_id      TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (suggestion_id, voter_id)
);

-- Jakso = päivittäinen seurantavideo.
CREATE TABLE IF NOT EXISTS ruska_episodes (
  id           SERIAL PRIMARY KEY,
  title        TEXT        NOT NULL,
  description  TEXT        NOT NULL DEFAULT '',
  youtube_id   TEXT        NOT NULL DEFAULT '',
  published_at DATE,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
