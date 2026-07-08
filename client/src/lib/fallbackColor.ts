// Deterministyczny kolor zastępczy dla okładek bez cover_url (przed integracją
// z Google Books w kroku 3) — te same serie zawsze dostają ten sam odcień.
export function fallbackColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 38%, 32%)`;
}
