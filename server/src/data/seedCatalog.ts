export interface SeedBook {
  id: string;
  title: string;
  author: string;
  series: string | null;
  arc: string | null;
  seriesIndex: number;
  year: number;
  genres: string[];
  onShelf: boolean;
}

// Sztywne dane 1:1 z prototypu (prototype/polka-tymka.html) — do wyświetlenia
// regału zanim podłączymy Google Books + SQLite w kolejnych krokach.
const onShelfIds = new Set([
  "w1", "w2", "w3",
  "z1", "z2", "z3", "z4", "z5", "z6", "z7", "z8", "z9",
  "z10", "z11", "z12", "z13", "z14", "z15", "z16", "z17", "z18",
]);

export const seedCatalog: SeedBook[] = [
  { id: "w1", title: "Ucieczka w dzicz", author: "Erin Hunter", series: "Wojownicy", arc: "Seria 1 · Wojownicy", seriesIndex: 1, year: 2003, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "w2", title: "Ogień i lód", author: "Erin Hunter", series: "Wojownicy", arc: "Seria 1 · Wojownicy", seriesIndex: 2, year: 2003, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "w3", title: "Las tajemnic", author: "Erin Hunter", series: "Wojownicy", arc: "Seria 1 · Wojownicy", seriesIndex: 3, year: 2003, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "w4", title: "Cisza przed burzą", author: "Erin Hunter", series: "Wojownicy", arc: "Seria 1 · Wojownicy", seriesIndex: 4, year: 2004, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "w5", title: "Niebezpieczna ścieżka", author: "Erin Hunter", series: "Wojownicy", arc: "Seria 1 · Wojownicy", seriesIndex: 5, year: 2004, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "w6", title: "Czarna godzina", author: "Erin Hunter", series: "Wojownicy", arc: "Seria 1 · Wojownicy", seriesIndex: 6, year: 2004, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "w7", title: "Północ", author: "Erin Hunter", series: "Wojownicy", arc: "Seria 2 · Nowa przepowiednia", seriesIndex: 7, year: 2005, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "w8", title: "Wschód księżyca", author: "Erin Hunter", series: "Wojownicy", arc: "Seria 2 · Nowa przepowiednia", seriesIndex: 8, year: 2005, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "w9", title: "Świt", author: "Erin Hunter", series: "Wojownicy", arc: "Seria 2 · Nowa przepowiednia", seriesIndex: 9, year: 2005, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "w10", title: "Blask gwiazd", author: "Erin Hunter", series: "Wojownicy", arc: "Seria 2 · Nowa przepowiednia", seriesIndex: 10, year: 2005, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "w11", title: "Zmierzch", author: "Erin Hunter", series: "Wojownicy", arc: "Seria 2 · Nowa przepowiednia", seriesIndex: 11, year: 2006, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "w12", title: "Zachód słońca", author: "Erin Hunter", series: "Wojownicy", arc: "Seria 2 · Nowa przepowiednia", seriesIndex: 12, year: 2006, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "w13", title: "Widzenie", author: "Erin Hunter", series: "Wojownicy", arc: "Seria 3 · Potęga trójki", seriesIndex: 13, year: 2007, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "w14", title: "Mroczna rzeka", author: "Erin Hunter", series: "Wojownicy", arc: "Seria 3 · Potęga trójki", seriesIndex: 14, year: 2007, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "w15", title: "Wyrzutek", author: "Erin Hunter", series: "Wojownicy", arc: "Seria 3 · Potęga trójki", seriesIndex: 15, year: 2008, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "w16", title: "Zaćmienie", author: "Erin Hunter", series: "Wojownicy", arc: "Seria 3 · Potęga trójki", seriesIndex: 16, year: 2008, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "w17", title: "Długie cienie", author: "Erin Hunter", series: "Wojownicy", arc: "Seria 3 · Potęga trójki", seriesIndex: 17, year: 2008, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "w18", title: "Wschód Słońca", author: "Erin Hunter", series: "Wojownicy", arc: "Seria 3 · Potęga trójki", seriesIndex: 18, year: 2009, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "z1", title: "Ruiny Gorlanu", author: "John Flanagan", series: "Zwiadowcy", arc: "Will i Halt", seriesIndex: 1, year: 2004, genres: ["przygoda", "fantastyka"] },
  { id: "z2", title: "Płonący most", author: "John Flanagan", series: "Zwiadowcy", arc: "Will i Halt", seriesIndex: 2, year: 2005, genres: ["przygoda", "fantastyka"] },
  { id: "z3", title: "Ziemia skuta lodem", author: "John Flanagan", series: "Zwiadowcy", arc: "Will i Halt", seriesIndex: 3, year: 2006, genres: ["przygoda", "fantastyka"] },
  { id: "z4", title: "Bitwa o Skandię", author: "John Flanagan", series: "Zwiadowcy", arc: "Will i Halt", seriesIndex: 4, year: 2006, genres: ["przygoda", "fantastyka"] },
  { id: "z5", title: "Czarnoksiężnik z Północy", author: "John Flanagan", series: "Zwiadowcy", arc: "Will i Halt", seriesIndex: 5, year: 2006, genres: ["przygoda", "fantastyka"] },
  { id: "z6", title: "Oblężenie Macindaw", author: "John Flanagan", series: "Zwiadowcy", arc: "Will i Halt", seriesIndex: 6, year: 2006, genres: ["przygoda", "fantastyka"] },
  { id: "z7", title: "Okup za Eraka", author: "John Flanagan", series: "Zwiadowcy", arc: "Will i Halt", seriesIndex: 7, year: 2007, genres: ["przygoda", "fantastyka"] },
  { id: "z8", title: "Królowie Clonmelu", author: "John Flanagan", series: "Zwiadowcy", arc: "Will i Halt", seriesIndex: 8, year: 2008, genres: ["przygoda", "fantastyka"] },
  { id: "z9", title: "Halt w niebezpieczeństwie", author: "John Flanagan", series: "Zwiadowcy", arc: "Will i Halt", seriesIndex: 9, year: 2009, genres: ["przygoda", "fantastyka"] },
  { id: "z10", title: "Cesarz Nihon-Ja", author: "John Flanagan", series: "Zwiadowcy", arc: "Will i Halt", seriesIndex: 10, year: 2010, genres: ["przygoda", "fantastyka"] },
  { id: "z11", title: "Zaginione historie", author: "John Flanagan", series: "Zwiadowcy", arc: "Will i Halt", seriesIndex: 11, year: 2011, genres: ["przygoda", "fantastyka"] },
  { id: "z12", title: "Królewski zwiadowca", author: "John Flanagan", series: "Zwiadowcy", arc: "Nowe pokolenie · Will i Maddie", seriesIndex: 12, year: 2017, genres: ["przygoda", "fantastyka"] },
  { id: "z13", title: "Klan Czerwonego Lisa", author: "John Flanagan", series: "Zwiadowcy", arc: "Nowe pokolenie · Will i Maddie", seriesIndex: 13, year: 2018, genres: ["przygoda", "fantastyka"] },
  { id: "z14", title: "Pojedynek w Araluenie", author: "John Flanagan", series: "Zwiadowcy", arc: "Nowe pokolenie · Will i Maddie", seriesIndex: 14, year: 2018, genres: ["przygoda", "fantastyka"] },
  { id: "z15", title: "Zaginiony książę", author: "John Flanagan", series: "Zwiadowcy", arc: "Nowe pokolenie · Will i Maddie", seriesIndex: 15, year: 2019, genres: ["przygoda", "fantastyka"] },
  { id: "z16", title: "Ucieczka z zamku Falaise", author: "John Flanagan", series: "Zwiadowcy", arc: "Nowe pokolenie · Will i Maddie", seriesIndex: 16, year: 2020, genres: ["przygoda", "fantastyka"] },
  { id: "z17", title: "Wilki Arazan", author: "John Flanagan", series: "Zwiadowcy", arc: "Nowe pokolenie · Will i Maddie", seriesIndex: 17, year: 2022, genres: ["przygoda", "fantastyka"] },
  { id: "z18", title: "Zasadzka w Sorato", author: "John Flanagan", series: "Zwiadowcy", arc: "Nowe pokolenie · Will i Maddie", seriesIndex: 18, year: 2024, genres: ["przygoda", "fantastyka"] },
  { id: "wof1", title: "The Dragonet Prophecy", author: "Tui T. Sutherland", series: "Wings of Fire", arc: null, seriesIndex: 1, year: 2012, genres: ["zwierzęta", "przygoda", "fantastyka"] },
  { id: "rw1", title: "Redwall", author: "Brian Jacques", series: "Redwall", arc: null, seriesIndex: 1, year: 1986, genres: ["zwierzęta", "przygoda"] },
  { id: "sv1", title: "The Empty City", author: "Erin Hunter", series: "Survivors", arc: null, seriesIndex: 1, year: 2012, genres: ["zwierzęta", "przygoda"] },
  { id: "pj1", title: "The Lightning Thief", author: "Rick Riordan", series: "Percy Jackson", arc: null, seriesIndex: 1, year: 2005, genres: ["mitologia", "przygoda", "fantastyka"] },
  { id: "hp1", title: "Harry Potter i Kamień Filozoficzny", author: "J.K. Rowling", series: "Harry Potter", arc: null, seriesIndex: 1, year: 1997, genres: ["magia", "przygoda", "fantastyka"] },
].map((b) => ({ ...b, onShelf: onShelfIds.has(b.id) }));
