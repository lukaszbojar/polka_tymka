import { app } from "./index";
import { ensureSchema } from "./db";
import { seedIfEmpty } from "./db/seed";
import { enrichMissingCovers } from "./services/enrichCovers";
import { enrichSummaries } from "./services/enrichSummaries";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

async function main() {
  await ensureSchema();
  await seedIfEmpty();
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
  await enrichMissingCovers();
  await enrichSummaries();
}

main();
