const VOTER_COOKIE = "ka_ruska_voter";
const ADMIN_COOKIE = "ka_ruska_admin";
const YEAR = 60 * 60 * 24 * 365;

const baseCookie = {
  path: "/",
  sameSite: "lax",
  secure: import.meta.env.PROD,
};

/**
 * Kevyt äänestäjätunniste. Tämä ei ole tunnistautumista vaan pelkkä
 * kohteliaisuus: eväste estää vahingossa tulevat tuplapeukut, ei huijaamista.
 */
export function getVoterId(cookies) {
  const existing = cookies.get(VOTER_COOKIE)?.value;
  if (existing && /^[a-z0-9]{8,64}$/i.test(existing)) return existing;

  const id = crypto.randomUUID().replace(/-/g, "");
  cookies.set(VOTER_COOKIE, id, { ...baseCookie, httpOnly: false, maxAge: YEAR });
  return id;
}

async function adminToken() {
  const password = process.env.RUSKA_ADMIN_PASSWORD ?? import.meta.env.RUSKA_ADMIN_PASSWORD;
  if (!password) return null;
  const data = new TextEncoder().encode(`ruska-admin:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Vertailu, joka ei vuoda tietoa ajoituksen kautta. */
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isAdmin(cookies) {
  const expected = await adminToken();
  if (!expected) return false;
  return timingSafeEqual(cookies.get(ADMIN_COOKIE)?.value ?? "", expected);
}

/** Palauttaa true jos salasana täsmäsi ja istuntoeväste asetettiin. */
export async function signInAdmin(cookies, password) {
  const configured = process.env.RUSKA_ADMIN_PASSWORD ?? import.meta.env.RUSKA_ADMIN_PASSWORD;
  if (!configured || !timingSafeEqual(String(password ?? ""), configured)) return false;
  cookies.set(ADMIN_COOKIE, await adminToken(), {
    ...baseCookie,
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
  });
  return true;
}

export function signOutAdmin(cookies) {
  cookies.delete(ADMIN_COOKIE, { path: "/" });
}
