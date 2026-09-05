// Ehdotusten siivous on sama sekä yleisön lomakkeelle että adminin
// korjauksille, jottei kenttien pituus pääse eroamaan kahdessa paikassa.
export const MAX_BODY = 240;
export const MAX_AUTHOR = 40;
export const MIN_BODY = 4;

/** Trimmaa, litistää rivinvaihdot ja katkaisee pituuteen. */
export function cleanBody(input) {
  return String(input ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_BODY);
}

export function cleanAuthor(input) {
  return String(input ?? "").trim().slice(0, MAX_AUTHOR);
}
