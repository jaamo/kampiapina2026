import { neon, neonConfig } from "@neondatabase/serverless";

// Neonin ajuri on HTTP-pohjainen, joten yhteyttä ei tarvitse poolata
// Netlifyn funktioiden välillä.
let cached = null;

export function sql(...args) {
  if (!cached) {
    const url = process.env.DATABASE_URL ?? import.meta.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL puuttuu — lisää se Netlifyn ympäristömuuttujiin.");
    }
    // Paikallinen kehitys: NEON_HTTP_ENDPOINT osoittaa oman Postgresin edessä
    // pyörivään neon-proxyyn. Tuotannossa muuttujaa ei aseteta.
    const localEndpoint =
      process.env.NEON_HTTP_ENDPOINT ?? import.meta.env.NEON_HTTP_ENDPOINT;
    if (localEndpoint) {
      neonConfig.fetchEndpoint = localEndpoint;
      neonConfig.useSecureWebSocket = false;
      neonConfig.poolQueryViaFetch = true;
    }
    cached = neon(url);
  }
  return cached(...args);
}

/** Auki oleva kierros, tai null jos äänestys ei ole käynnissä. */
export async function getOpenRound() {
  const rows = await sql`
    SELECT id, title, subtitle, status, created_at, closed_at
    FROM ruska_rounds WHERE status = 'open' LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getRound(id) {
  const rows = await sql`
    SELECT id, title, subtitle, status, created_at, closed_at
    FROM ruska_rounds WHERE id = ${id} LIMIT 1
  `;
  return rows[0] ?? null;
}

/** Kaikki kierrokset uusin ensin, mukana hyväksyttyjen ehdotusten määrä. */
export async function listRounds() {
  return sql`
    SELECT r.id, r.title, r.subtitle, r.status, r.created_at, r.closed_at,
           COUNT(s.id)::int AS suggestion_count
    FROM ruska_rounds r
    LEFT JOIN ruska_suggestions s
      ON s.round_id = r.id AND s.status = 'approved'
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `;
}

/**
 * Kierroksen hyväksytyt ehdotukset äänimäärän mukaan.
 * `voterId` kertoo, mitkä tämä selain on jo peukuttanut.
 */
export async function listApprovedSuggestions(roundId, voterId = "") {
  return sql`
    SELECT s.id, s.body, s.author, s.created_at,
           COUNT(v.voter_id)::int AS votes,
           BOOL_OR(v.voter_id = ${voterId}) AS voted
    FROM ruska_suggestions s
    LEFT JOIN ruska_votes v ON v.suggestion_id = s.id
    WHERE s.round_id = ${roundId} AND s.status = 'approved'
    GROUP BY s.id
    ORDER BY votes DESC, s.created_at ASC
  `;
}

/** Moderointijonon sisältö adminille. */
export async function listSuggestionsForAdmin(roundId) {
  return sql`
    SELECT s.id, s.body, s.author, s.status, s.created_at,
           COUNT(v.voter_id)::int AS votes
    FROM ruska_suggestions s
    LEFT JOIN ruska_votes v ON v.suggestion_id = s.id
    WHERE s.round_id = ${roundId}
    GROUP BY s.id
    ORDER BY
      CASE s.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
      s.created_at DESC
  `;
}

export async function listEpisodes() {
  return sql`
    SELECT id, title, description, youtube_id, published_at, sort_order
    FROM ruska_episodes
    ORDER BY sort_order ASC, published_at ASC NULLS LAST, id ASC
  `;
}
