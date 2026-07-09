const BOOK_COLORS = ["#5b8a4e", "#c9a24b", "#a5443f", "#3f6ea5", "#8a5aa5", "#c76b3f", "#456b3b", "#2f6f7a"];

function ShelfRow({ y, width, seed }: { y: number; width: number; seed: number }) {
  const books: { x: number; w: number; h: number; color: string }[] = [];
  let x = 0;
  let i = 0;
  while (x < width) {
    const w = 9 + ((i * 7 + seed) % 7);
    const h = 30 + ((i * 13 + seed) % 26);
    books.push({ x, w: w - 1.5, h, color: BOOK_COLORS[(i + seed) % BOOK_COLORS.length] });
    x += w;
    i += 1;
  }
  return (
    <g>
      {books.map((b, idx) => (
        <rect key={idx} x={b.x} y={y - b.h} width={b.w} height={b.h} rx={1.5} fill={b.color} opacity={0.92} />
      ))}
    </g>
  );
}

export function SearchLoader({ text = "Szukam w bibliotece…" }: { text?: string }) {
  return (
    <div className="search-loader">
      <svg viewBox="0 0 640 220" className="search-loader-svg" role="img" aria-label={text}>
        <defs>
          <linearGradient id="loaderBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1c2016" />
            <stop offset="100%" stopColor="#2a2f26" />
          </linearGradient>
          <radialGradient id="beamGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffe9a8" stopOpacity="0.9" />
            <stop offset="55%" stopColor="#ffdf8a" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffdf8a" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="640" height="220" rx="18" fill="url(#loaderBg)" />

        <rect x="0" y="88" width="640" height="7" fill="var(--shelf-face)" />
        <rect x="0" y="94" width="640" height="4" fill="var(--shelf-shadow)" />
        <g clipPath="url(#shelfClip)">
          <ShelfRow y={88} width={640} seed={3} />
        </g>
        <clipPath id="shelfClip">
          <rect x="0" y="0" width="640" height="88" />
        </clipPath>

        <rect x="0" y="198" width="640" height="22" fill="#14170f" />
        <rect x="0" y="196" width="640" height="3" fill="var(--sidebar-line)" />

        <g className="search-loader-walker">
          <g className="search-loader-bob">
            <ellipse cx="38" cy="70" rx="52" ry="40" fill="url(#beamGlow)" className="search-loader-beam" />

            <rect x="-6" y="164" width="6" height="24" rx="2.5" fill="#2b2f26" className="search-loader-leg-l" />
            <rect x="4" y="164" width="6" height="24" rx="2.5" fill="#2b2f26" className="search-loader-leg-r" />

            <rect x="-9" y="130" width="20" height="38" rx="7" fill="var(--moss)" />

            <rect x="7" y="132" width="28" height="7" rx="3.5" fill="#e7c9a0" className="search-loader-arm" />
            <rect x="31" y="127" width="12" height="8" rx="2" fill="var(--gold)" />

            <circle cx="1" cy="116" r="14" fill="#e7c9a0" />
            <path d="M -12 110 Q 1 96 14 110 L 14 115 Q 1 103 -12 115 Z" fill="#5b4327" />
          </g>
        </g>
      </svg>
      <p className="search-loader-text">{text}</p>
    </div>
  );
}
