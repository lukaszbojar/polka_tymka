import { useState } from "react";
import { ShelfTab } from "./tabs/ShelfTab";
import { SearchTab } from "./tabs/SearchTab";
import { ToReadTab } from "./tabs/ToReadTab";
import { RecommendTab } from "./tabs/RecommendTab";

type Tab = "shelf" | "search" | "toread" | "recommend";

const TABS: { id: Tab; label: string }[] = [
  { id: "shelf", label: "Półka" },
  { id: "search", label: "Wyszukiwanie" },
  { id: "toread", label: "Do przeczytania" },
  { id: "recommend", label: "Poleć mi" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("shelf");

  return (
    <div className="app-shell">
      <nav className="tab-nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="tab-content">
        {tab === "shelf" && <ShelfTab />}
        {tab === "search" && <SearchTab />}
        {tab === "toread" && <ToReadTab />}
        {tab === "recommend" && <RecommendTab />}
      </div>
    </div>
  );
}
