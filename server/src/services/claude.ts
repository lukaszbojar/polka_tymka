import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

const MODEL = "claude-opus-4-8";

export interface RecognizedQuery {
  type: "series" | "book";
  canonicalTitle: string;
  author: string;
  searchQuery: string;
  year: number;
}

function extractJson<T>(response: Anthropic.Message): T {
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude nie zwrócił tekstu z JSON-em");
  }
  return JSON.parse(block.text) as T;
}

// Rozpoznaje potoczne/angielskie/błędnie zapisane zapytanie i zwraca kanoniczny
// tytuł/autora oraz frazę do przeszukania Google Books.
export async function recognizeQuery(query: string): Promise<RecognizedQuery> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system:
      'Użytkownik szuka książki lub serii dla dzieci w polskiej bibliotece domowej. ' +
      'Rozpoznaj, o jaki tytuł/serię/autora chodzi — nawet jeśli nazwa jest potoczna, ' +
      'angielska, skrócona lub zawiera literówkę (np. "Warrior Cats" → seria "Wojownicy" ' +
      "Erin Hunter, polskie wydanie). searchQuery powinno być frazą najlepszą do wyszukania " +
      "w Google Books (zwykle: tytuł/seria + autor, w oryginalnym lub polskim brzmieniu, " +
      "które da najlepsze trafienia). year to rok pierwszego wydania (jeśli type='book') " +
      "lub rok wydania pierwszego tomu (jeśli type='series'), na podstawie Twojej wiedzy.",
    messages: [{ role: "user", content: query }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["series", "book"] },
            canonicalTitle: { type: "string" },
            author: { type: "string" },
            searchQuery: { type: "string" },
            year: { type: "integer" },
          },
          required: ["type", "canonicalTitle", "author", "searchQuery", "year"],
          additionalProperties: false,
        },
      },
    },
  });

  return extractJson<RecognizedQuery>(response);
}

export interface OrderedVolume {
  originalTitle: string;
  title: string;
  year: number;
  seriesIndex: number;
  arc: string;
}

interface CandidateBook {
  title: string;
  authors: string[];
  year: number | null;
}

// Prosi Claude o uporządkowanie kandydatów z Google Books w chronologię serii,
// odfiltrowanie duplikatów/wydań i przypisanie podcykli (arc).
export async function orderSeriesVolumes(
  seriesName: string,
  author: string,
  candidates: CandidateBook[]
): Promise<OrderedVolume[]> {
  const candidateList = candidates
    .map((c) => `- "${c.title}" — ${c.authors.join(", ") || "?"} (${c.year ?? "?"})`)
    .join("\n");

  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system:
      `Uporządkuj listę tomów serii "${seriesName}" (${author}) na podstawie swojej wiedzy — ` +
      "niezależnie od tego, czy poniższa lista pomocnicza z Google Books jest pełna, niepełna " +
      "czy pusta (może brakować wyników, np. z powodu awarii zewnętrznego API). To częsty błąd: " +
      "wymienienie tylko pierwszych/najbardziej znanych tomów i pominięcie nowszych kontynuacji, " +
      "dodatkowych podcykli (np. prequeli, spin-offów wydawanych pod tą samą marką) wydanych w " +
      'kolejnych latach — jeśli seria ma kilkanaście-kilkadziesiąt tomów, nie ograniczaj się do ' +
      'jednego, "głównego" podcyklu. LIMIT: maksymalnie 25 tomów w odpowiedzi. Jeśli marka ma ' +
      "ich więcej (typowe dla bardzo długich serii dla dzieci, np. z kilkoma podcyklami po 6 " +
      "tomów każdy), wybierz PIERWSZE chronologicznie 25 — w całości pokryj tyle kolejnych " +
      "podcykli, ile zmieści się w tym limicie, zamiast urywać w połowie ostatniego z nich " +
      "(czyli np. 24 tomy z 4 pełnych podcykli po 6, zamiast 25 z urwanym piątym). Uporządkuj " +
      "tomy chronologicznie (kolejność wydania/czytania), i przypisz każdemu seriesIndex (od 1, " +
      'arc — nazwę podcyklu (np. "Seria główna", "Wczesne lata"/prequele, itp.) lub pusty ' +
      'string "" jeśli seria nie ma podcykli. Pole "originalTitle" to tytuł oryginalny (w ' +
      "języku, w jakim książka została pierwotnie wydana) — to pole musi być precyzyjne, będzie " +
      "użyte do wyszukania prawdziwego wydania w katalogach księgarskich. Pole \"title\" to " +
      "NAJLEPIEJ ZNANY CI oficjalny tytuł polskiego wydania (dokładnie taki, jaki nadał polski " +
      "wydawca) — NIE twórz własnego dosłownego tłumaczenia z angielskiego, to częsty błąd " +
      '(np. błędne "Bitwa pod Hackham Heath" zamiast prawdziwego polskiego tytułu wydania ' +
      '"Pojedynek w Araluenie"). Jeśli nie jesteś pewien dokładnego, oficjalnie wydanego ' +
      'polskiego tytułu, ustaw "title" na tę samą wartość co "originalTitle" zamiast zgadywać ' +
      "— zostanie i tak podmienione prawdziwym tytułem znalezionym w katalogu, jeśli polskie " +
      "wydanie istnieje. Lista pomocnicza poniżej (jeśli niepusta) pochodzi z prawdziwego " +
      "katalogu księgarskiego — jej tytuły są wiarygodniejsze niż Twoja pamięć, więc jeśli " +
      "któryś kandydat wyraźnie odpowiada tomowi, którego szukasz, wolej jego pisownię tytułu " +
      "(oryginalnego) od własnej rekonstrukcji z pamięci. Jej brak lub niekompletność NIE " +
      "oznacza, że tomu nie ma w serii, ale jeśli lista pomocnicza zawiera tytuły, których nie " +
      "uwzględniłeś z pamięci, prawdopodobnie należą do serii i też powinny się znaleźć w " +
      "odpowiedzi.\n\nLista pomocnicza z Google Books:",
    messages: [{ role: "user", content: candidateList || "(brak kandydatów z Google Books)" }],
    output_config: {
      // Niższy poziom "effort" — na dłuższych seriach domyślne (wyższe)
      // myślenie adaptacyjne potrafiło trwać kilkadziesiąt sekund, co
      // przekraczało limit czasu funkcji serverless. Trochę kosztuje
      // kompletność, ale wyszukiwanie musi w ogóle zdążyć się wykonać.
      effort: "medium",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            volumes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  originalTitle: { type: "string" },
                  title: { type: "string" },
                  year: { type: "integer" },
                  seriesIndex: { type: "integer" },
                  arc: { type: "string" },
                },
                required: ["originalTitle", "title", "year", "seriesIndex", "arc"],
                additionalProperties: false,
              },
            },
          },
          required: ["volumes"],
          additionalProperties: false,
        },
      },
    },
  });

  const response = await stream.finalMessage();
  const { volumes } = extractJson<{ volumes: OrderedVolume[] }>(response);
  // Twardy limit niezależny od tego, czy model dokładnie zastosował się do
  // instrukcji w promptcie — bez tego bardzo długie serie (np. kilkadziesiąt
  // tomów) potrafiły przekroczyć limit czasu funkcji serverless.
  return volumes.slice(0, 25);
}

// Generuje krótkie (1-2 zdania), przyjazne dziecku (8-12 lat) streszczenie bez
// spoilerów. Gdy brak oryginalnego opisu z Google Books, Claude opiera się na
// własnej wiedzy o książce — świadomy fallback opisany w brief.md.
export async function generateSummary(
  title: string,
  author: string,
  originalDescription: string | null
): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 300,
    thinking: { type: "adaptive" },
    system:
      "Napisz proste, przyjazne dziecku (8-12 lat) streszczenie tej książki w 1-2 zdaniach, " +
      "po polsku, bez spoilerów zakończenia. Zwróć wyłącznie sam tekst streszczenia — bez " +
      "cudzysłowów, bez tytułu, bez dodatkowego komentarza.",
    messages: [
      {
        role: "user",
        content:
          `Tytuł: ${title}\nAutor: ${author}\n` +
          (originalDescription
            ? `Oryginalny opis: ${originalDescription}`
            : "Oryginalny opis: brak — oprzyj się na własnej wiedzy o tej książce."),
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude nie zwrócił streszczenia");
  }
  return block.text.trim();
}

export interface BookSuggestion {
  title: string;
  author: string;
  year: number;
  genres: string[];
}

// Prosi Claude o nowe propozycje książek na podstawie półki dziecka (gatunki/autorzy
// lubiani z "przeczytane"/"do przeczytania", unikać cech z "nie interesuje mnie").
// excludeTitles = wszystko, co już jest na półce lub było już zaproponowane —
// żeby kolejne kliknięcia "Pokaż więcej" dawały naprawdę nowe, unikalne pozycje.
export async function suggestMoreBooks(
  shelfSummary: string,
  excludeTitles: string[],
  count: number
): Promise<BookSuggestion[]> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2000,
    thinking: { type: "adaptive" },
    system:
      "Na podstawie półki dziecka (8-12 lat) zaproponuj NOWE, prawdziwe, istniejące książki " +
      "lub serie (jeśli seria — podaj pierwszy tom), które prawdopodobnie mu się spodobają. " +
      "Kieruj się gatunkami i autorami z pozycji oznaczonych jako przeczytane/do przeczytania, " +
      "a unikaj cech pozycji oznaczonych jako 'nie interesuje mnie'. Najlepiej książki mające " +
      "polskie wydanie. Nigdy nie proponuj tytułu z listy 'excludeTitles' — to książki, które " +
      "dziecko już ma, odrzuciło albo już mu zaproponowano.",
    messages: [
      {
        role: "user",
        content:
          `Półka:\n${shelfSummary || "(pusta)"}\n\n` +
          `Pomiń te tytuły (już znane):\n${excludeTitles.join("; ") || "(brak)"}\n\n` +
          `Zaproponuj ${count} nowych, różnorodnych tytułów.`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  author: { type: "string" },
                  year: { type: "integer" },
                  genres: { type: "array", items: { type: "string" } },
                },
                required: ["title", "author", "year", "genres"],
                additionalProperties: false,
              },
            },
          },
          required: ["suggestions"],
          additionalProperties: false,
        },
      },
    },
  });

  const { suggestions } = extractJson<{ suggestions: BookSuggestion[] }>(response);
  return suggestions;
}

// Krótki opis całej serii (1-2 zdania) — o czym jest, nie tylko pierwszy tom.
export async function generateSeriesSummary(series: string, author: string): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 300,
    thinking: { type: "adaptive" },
    system:
      "Napisz proste, przyjazne dziecku (8-12 lat) streszczenie CAŁEJ serii książek w 1-2 " +
      "zdaniach, po polsku, bez spoilerów. Opisz ogólny pomysł/świat serii, nie fabułę " +
      "jednego tomu. Zwróć wyłącznie sam tekst — bez cudzysłowów, bez tytułu.",
    messages: [{ role: "user", content: `Seria: ${series}\nAutor: ${author}` }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude nie zwrócił streszczenia serii");
  }
  return block.text.trim();
}
