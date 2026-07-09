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
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system:
      `Uporządkuj pełną listę tomów serii "${seriesName}" (${author}) na podstawie swojej ` +
      "wiedzy — niezależnie od tego, czy poniższa lista pomocnicza z Google Books jest pełna, " +
      "niepełna czy pusta (może brakować wyników, np. z powodu awarii zewnętrznego API). " +
      "Wypisz WSZYSTKIE tomy głównej serii, uporządkuj je chronologicznie (kolejność " +
      "wydania/czytania), i przypisz każdemu seriesIndex (od 1) oraz arc — nazwę podcyklu, " +
      'jeśli seria jest podzielona na podcykle (np. "Seria 1 · ...") lub pusty string "" jeśli ' +
      'seria nie ma podcykli. Pole "title" podaj w polskim tłumaczeniu, jeśli takie istnieje ' +
      "(inaczej w oryginale). Lista pomocnicza poniżej służy tylko do ewentualnego dopasowania " +
      "pisowni tytułów — jej brak lub niekompletność NIE oznacza, że tomu nie ma w serii.\n\n" +
      "Lista pomocnicza z Google Books:",
    messages: [{ role: "user", content: candidateList || "(brak kandydatów z Google Books)" }],
    output_config: {
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
                  title: { type: "string" },
                  year: { type: "integer" },
                  seriesIndex: { type: "integer" },
                  arc: { type: "string" },
                },
                required: ["title", "year", "seriesIndex", "arc"],
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
  return volumes;
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
