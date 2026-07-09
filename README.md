# Półka Tymka

Aplikacja czytelnicza dla dziecka. Dziecko dodaje przeczytane książki po potocznej nazwie (np. „Warrior Cats"), a system rozpoznaje właściwą serię, pobiera pełne metadane z okładkami i pozwala dodać całą serię jednym kliknięciem. Aplikacja poleca kolejne książki na podstawie zawartości półki. Półka jest wizualizowana jako drewniany regał.

## Stack

- **Frontend:** React + Vite + TypeScript, zwykły CSS
- **Backend:** Node.js + Express (TypeScript), na Vercel jako funkcja serverless (`api/index.ts`)
- **Baza danych:** SQLite (`@libsql/client`) — lokalnie zwykły plik, w produkcji [Turso](https://turso.tech)
- **Źródła danych o książkach:** Google Books API → Open Library (polskie wydania) → Claude API (wiedza własna, gdy obu brak)
- **AI:** Anthropic Claude API (`claude-opus-4-8`) — rozpoznawanie zapytań, porządkowanie serii, streszczenia, dogenerowywanie rekomendacji

## Wymagania

- Node.js 20+
- Klucz Anthropic API ([console.anthropic.com](https://console.anthropic.com/settings/keys))
- Klucz Google Books API ([console.cloud.google.com](https://console.cloud.google.com/apis/library/books.googleapis.com) — włącz „Books API", potem APIs & Services → Credentials → Create Credentials → API key)

## Instalacja i uruchomienie (lokalnie)

```bash
npm install   # w katalogu głównym — instaluje client/ i server/ (npm workspaces)
```

Skopiuj `server/.env` (na podstawie `.env.example` w katalogu głównym) i uzupełnij:

```
ANTHROPIC_API_KEY=twój_klucz
GOOGLE_BOOKS_API_KEY=twój_klucz
PORT=3001
```

`TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` zostaw puste — lokalnie baza to zwykły plik SQLite w `server/data/`.

Uruchom oba serwery w osobnych terminalach:

```bash
# terminal 1
cd server && npm run dev

# terminal 2
cd client && npm run dev
```

Aplikacja jest dostępna pod `http://localhost:5173` (backend na `http://localhost:3001`, proxowany przez Vite).

Przy pierwszym uruchomieniu backend zasila bazę startowym katalogiem, a następnie w tle dociąga prawdziwe okładki i generuje przyjazne dziecku streszczenia — może to potrwać kilkadziesiąt sekund.

## Wdrożenie produkcyjne (Vercel + Turso)

Cała apka (frontend + backend jako funkcja serverless) żyje w jednym projekcie Vercel. Backend potrzebuje bazy działającej bez trwałego dysku — stąd [Turso](https://turso.tech) (SQLite kompatybilne, darmowe, zrobione pod serverless).

1. **Baza — Turso**
   - Załóż darmowe konto na [turso.tech](https://turso.tech), zainstaluj `turso` CLI i zaloguj się.
   - `turso db create polka-tymka`
   - `turso db show polka-tymka --url` → to jest `TURSO_DATABASE_URL`
   - `turso db tokens create polka-tymka` → to jest `TURSO_AUTH_TOKEN`

2. **Projekt Vercel**
   - Zaimportuj to repozytorium GitHub jako nowy projekt na [vercel.com](https://vercel.com/new).
   - Framework Preset: „Other" (ustawienia builda są już w `vercel.json`).
   - W Project Settings → Environment Variables dodaj (dla środowiska Production, najlepiej też Preview):
     - `ANTHROPIC_API_KEY`
     - `GOOGLE_BOOKS_API_KEY`
     - `TURSO_DATABASE_URL`
     - `TURSO_AUTH_TOKEN`
   - Deploy. Kolejne wdrożenia dzieją się automatycznie przy każdym pushu do `main`.

Uwaga: funkcje serverless na Vercel mają limit czasu wykonania (ustawiony w `vercel.json` na 60s — maksimum na darmowym planie Hobby). Wyszukiwanie bardzo długich serii lub dogenerowywanie wielu rekomendacji naraz może się w rzadkich przypadkach o ten limit otrzeć — jeśli to problem w praktyce, plan Pro pozwala na dłuższy limit.

## Struktura katalogów

```
polka-tymka/
  prototype/    # statyczny prototyp HTML (referencja UI)
  client/       # React + Vite (frontend)
  server/       # Express + SQLite (logika backendu)
  api/          # cienki wrapper server/src/index.ts pod Vercel serverless
  vercel.json
  .env.example
  README.md
```
