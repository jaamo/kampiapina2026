import { sql } from "../../../lib/ruska/db.js";
import { getVoterId } from "../../../lib/ruska/session.js";
import { jsonResponse, readBody, redirectBack, wantsJson } from "./_respond.js";

export const prerender = false;

export async function POST({ request, cookies }) {
  const voterId = getVoterId(cookies);
  const data = await readBody(request);
  const suggestionId = Number.parseInt(data.suggestion, 10);

  const fail = (error, status = 400) =>
    wantsJson(request)
      ? jsonResponse({ ok: false, error }, status)
      : redirectBack(request, "/ruska", { virhe: error });

  if (!Number.isInteger(suggestionId)) return fail("Tuntematon ehdotus.");

  // Ääniä voi antaa vain auki olevan kierroksen julkaistuille ehdotuksille.
  const rows = await sql`
    SELECT s.id FROM ruska_suggestions s
    JOIN ruska_rounds r ON r.id = s.round_id
    WHERE s.id = ${suggestionId} AND s.status = 'approved' AND r.status = 'open'
  `;
  if (rows.length === 0) return fail("Tämän kierroksen äänestys on suljettu.");

  // Peukku on vipukytkin: sama nappi antaa ja peruu äänen.
  const deleted = await sql`
    DELETE FROM ruska_votes
    WHERE suggestion_id = ${suggestionId} AND voter_id = ${voterId}
    RETURNING suggestion_id
  `;
  if (deleted.length === 0) {
    await sql`
      INSERT INTO ruska_votes (suggestion_id, voter_id) VALUES (${suggestionId}, ${voterId})
      ON CONFLICT DO NOTHING
    `;
  }

  const [{ votes }] = await sql`
    SELECT COUNT(*)::int AS votes FROM ruska_votes WHERE suggestion_id = ${suggestionId}
  `;

  return wantsJson(request)
    ? jsonResponse({ ok: true, votes, voted: deleted.length === 0 })
    : redirectBack(request, "/ruska", { virhe: null });
}
