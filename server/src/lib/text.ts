export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb)) return true;
  // "b krótszy niż a" (np. wydanie bez przedrostka serii, "The Arctic
  // Incident" zamiast "Artemis Fowl: The Arctic Incident") dopuszczamy TYLKO
  // gdy krótszy człon stanowi istotną część dłuższego, a nie tylko wspólny
  // prefiks nazwy serii/marki — inaczej np. samo "Artemis Fowl" (tom 1)
  // dopasowywałoby się do szukanego "Artemis Fowl: The Arctic Incident"
  // (tom 2), bo jest jego prefiksem, mimo że to zupełnie inna książka.
  if (nb.includes(na) && na.length >= nb.length * 0.5) return true;
  return false;
}
