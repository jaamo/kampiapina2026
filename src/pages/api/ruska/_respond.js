/**
 * Äänestys toimii myös ilman JavaScriptiä: selain postaa lomakkeen ja
 * ohjataan takaisin sivulle. JS-kutsut pyytävät saman vastauksen JSONina.
 */
export function wantsJson(request) {
  return (request.headers.get("accept") ?? "").includes("application/json");
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function redirectBack(request, fallback, params = {}) {
  const referer = request.headers.get("referer");
  let target;
  try {
    target = new URL(referer ?? fallback, new URL(request.url).origin);
    // Älä seuraa ulkopuolelta tulevaa refereriä.
    if (target.origin !== new URL(request.url).origin) target = new URL(fallback, request.url);
  } catch {
    target = new URL(fallback, request.url);
  }
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) target.searchParams.delete(key);
    else target.searchParams.set(key, String(value));
  }
  return new Response(null, { status: 303, headers: { location: target.pathname + target.search + target.hash } });
}

/** Lomake tai JSON — molemmista saadaan sama olio. */
export async function readBody(request) {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return await request.json();
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}
