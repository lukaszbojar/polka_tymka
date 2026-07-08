function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Zewnętrzne API książkowe czasem wpadają w kilkusekundowe serie błędów 5xx —
// rosnący odstęp między próbami (do ~4s) daje czas, żeby seria minęła.
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  attempts = 5
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    if (res.status < 500 || attempt === attempts) {
      throw new Error(`HTTP error ${res.status} (${url})`);
    }
    lastError = new Error(`HTTP error ${res.status} (${url})`);
    await sleep(Math.min(500 * 2 ** (attempt - 1), 4000));
  }
  throw lastError ?? new Error("HTTP error");
}
