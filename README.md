# Półka Tymka

Aplikacja czytelnicza dla dziecka. Dziecko dodaje przeczytane książki po potocznej nazwie (np. „Warrior Cats"), a system rozpoznaje właściwą serię, pobiera pełne metadane z okładkami i pozwala dodać całą serię jednym kliknięciem. Aplikacja poleca kolejne książki na podstawie zawartości półki. Półka jest wizualizowana jako drewniany regał.

## Stack

- **Frontend:** React + Vite + TypeScript, zwykły CSS
- **Backend:** Node.js + Express (TypeScript)
- **Baza danych:** SQLite (`better-sqlite3`)
- **Źródła danych o książkach:** Google Books API → Open Library (polskie wydania) → Claude API (wiedza własna, gdy obu brak)
- **AI:** Anthropic Claude API (`claude-opus-4-8`) — rozpoznawanie zapytań, porządkowanie serii, streszczenia

## Wymagania

- Node.js 20+
- Klucz Anthropic API ([console.anthropic.com](https://console.anthropic.com/settings/keys))
- Klucz Google Books API ([console.cloud.google.com](https://console.cloud.google.com/apis/library/books.googleapis.com) — włącz „Books API", potem APIs & Services → Credentials → Create Credentials → API key)

## Instalacja i uruchomienie

```bash
# klient
cd client
npm install

# serwer
cd ../server
npm install
```

Skopiuj `server/.env` (na podstawie `.env.example` w katalogu głównym) i uzupełnij:

```
ANTHROPIC_API_KEY=twój_klucz
GOOGLE_BOOKS_API_KEY=twój_klucz
PORT=3001
```

Uruchom oba serwery w osobnych terminalach:

```bash
# terminal 1
cd server && npm run dev

# terminal 2
cd client && npm run dev
```

Aplikacja jest dostępna pod `http://localhost:5173` (backend na `http://localhost:3001`, proxowany przez Vite).

Przy pierwszym uruchomieniu backend zasila bazę SQLite (`server/data/polka-tymka.sqlite`) startowym katalogiem, a następnie w tle dociąga prawdziwe okładki i generuje przyjazne dziecku streszczenia — może to potrwać kilkadziesiąt sekund.

## Struktura katalogów

```
polka-tymka/
  prototype/    # statyczny prototyp HTML (referencja UI)
  client/       # React + Vite
  server/       # Express + SQLite
  .env.example
  README.md
```
