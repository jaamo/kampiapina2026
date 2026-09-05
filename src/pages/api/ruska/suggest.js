import { sql, getOpenRound } from "../../../lib/ruska/db.js";
import { getVoterId } from "../../../lib/ruska/session.js";
import { cleanAuthor, cleanBody, MIN_BODY } from "../../../lib/ruska/suggestion.js";
import { jsonResponse, readBody, redirectBack, wantsJson } from "./_respond.js";

export const prerender = false;

// Yksi selain saa jättää kierrosta kohti tämän verran ehdotuksia.
const MAX_PER_ROUND = 5;

export async function POST({ request, cookies }) {
  const voterId = getVoterId(cookies);
  const data = await readBody(request);

  const body = cleanBody(data.body);
  const author = cleanAuthor(data.author);

  const fail = (error) =>
    wantsJson(request)
      ? jsonResponse({ ok: false, error }, 400)
      : redirectBack(request, "/ruska", { virhe: error, kiitos: null });

  if (body.length < MIN_BODY) return fail("Kirjoita vähän pidempi ehdotus.");

  const round = await getOpenRound();
  if (!round) return fail("Äänestys ei ole juuri nyt auki.");

  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM ruska_suggestions
    WHERE round_id = ${round.id} AND submitter = ${voterId}
  `;
  if (count >= MAX_PER_ROUND) return fail("Olet jo ehdottanut tämän kierroksen verran. Kiitos innosta!");

  await sql`
    INSERT INTO ruska_suggestions (round_id, body, author, submitter)
    VALUES (${round.id}, ${body}, ${author}, ${voterId})
  `;

  return wantsJson(request)
    ? jsonResponse({ ok: true })
    : redirectBack(request, "/ruska", { kiitos: "1", virhe: null });
}
