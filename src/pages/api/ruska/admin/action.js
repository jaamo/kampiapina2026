import { sql } from "../../../../lib/ruska/db.js";
import { isAdmin } from "../../../../lib/ruska/session.js";
import { cleanAuthor, cleanBody, MIN_BODY } from "../../../../lib/ruska/suggestion.js";
import { readBody, redirectBack } from "../_respond.js";

export const prerender = false;

/** Hyväksyy sekä pelkän videotunnisteen että kokonaisen YouTube-osoitteen. */
function parseYoutubeId(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([\w-]{6,})/);
  return (match ? match[1] : raw).slice(0, 32);
}

const asInt = (value) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) ? n : null;
};

export async function POST({ request, cookies }) {
  if (!(await isAdmin(cookies))) {
    return redirectBack(request, "/ruska/admin", { virhe: "Kirjaudu ensin sisään." });
  }

  const data = await readBody(request);
  const action = String(data.action ?? "");
  const back = (params = {}) => redirectBack(request, "/ruska/admin", { virhe: null, ...params });

  switch (action) {
    case "round.create": {
      const title = String(data.title ?? "").trim().slice(0, 120);
      if (!title) return back({ virhe: "Kierrokselle tarvitaan otsikko." });
      // Vain yksi kierros voi olla auki, joten edellinen suljetaan samalla.
      await sql`UPDATE ruska_rounds SET status = 'closed', closed_at = now() WHERE status = 'open'`;
      await sql`
        INSERT INTO ruska_rounds (title, subtitle)
        VALUES (${title}, ${String(data.subtitle ?? "").trim().slice(0, 200)})
      `;
      return back();
    }

    case "round.close": {
      const id = asInt(data.id);
      if (id) await sql`UPDATE ruska_rounds SET status = 'closed', closed_at = now() WHERE id = ${id}`;
      return back();
    }

    case "round.reopen": {
      const id = asInt(data.id);
      if (!id) return back();
      await sql`UPDATE ruska_rounds SET status = 'closed', closed_at = now() WHERE status = 'open'`;
      await sql`UPDATE ruska_rounds SET status = 'open', closed_at = NULL WHERE id = ${id}`;
      return back();
    }

    case "round.delete": {
      const id = asInt(data.id);
      if (id) await sql`DELETE FROM ruska_rounds WHERE id = ${id}`;
      return back();
    }

    case "suggestion.approve":
    case "suggestion.reject": {
      const id = asInt(data.id);
      const status = action === "suggestion.approve" ? "approved" : "rejected";
      if (id) {
        await sql`
          UPDATE ruska_suggestions SET status = ${status}, decided_at = now() WHERE id = ${id}
        `;
      }
      return back();
    }

    // Kirjoitusvirheiden korjaus. Status ja äänet säilyvät: peukut annettiin
    // idealle, ei kirjoitusasulle.
    case "suggestion.save": {
      const id = asInt(data.id);
      if (!id) return back();
      const body = cleanBody(data.body);
      if (body.length < MIN_BODY) return back({ virhe: "Ehdotus jäi liian lyhyeksi." });
      await sql`
        UPDATE ruska_suggestions
        SET body = ${body}, author = ${cleanAuthor(data.author)}
        WHERE id = ${id}
      `;
      return back();
    }

    case "suggestion.delete": {
      const id = asInt(data.id);
      if (id) await sql`DELETE FROM ruska_suggestions WHERE id = ${id}`;
      return back();
    }

    case "episode.save": {
      const id = asInt(data.id);
      const title = String(data.title ?? "").trim().slice(0, 160);
      if (!title) return back({ virhe: "Jaksolle tarvitaan otsikko." });
      const description = String(data.description ?? "").trim().slice(0, 600);
      const youtubeId = parseYoutubeId(data.youtube_id);
      const publishedAt = String(data.published_at ?? "").trim() || null;
      const sortOrder = asInt(data.sort_order) ?? 0;

      if (id) {
        await sql`
          UPDATE ruska_episodes
          SET title = ${title}, description = ${description}, youtube_id = ${youtubeId},
              published_at = ${publishedAt}, sort_order = ${sortOrder}
          WHERE id = ${id}
        `;
      } else {
        await sql`
          INSERT INTO ruska_episodes (title, description, youtube_id, published_at, sort_order)
          VALUES (${title}, ${description}, ${youtubeId}, ${publishedAt}, ${sortOrder})
        `;
      }
      return back();
    }

    case "episode.delete": {
      const id = asInt(data.id);
      if (id) await sql`DELETE FROM ruska_episodes WHERE id = ${id}`;
      return back();
    }

    default:
      return back({ virhe: "Tuntematon toiminto." });
  }
}
