import { getDb, closeDb, defaultDbPath } from './index.js';
import { seedIfEmpty } from './seed.js';

const db = getDb();
const result = seedIfEmpty(db);

if (result.seeded) {
  console.log(`Seeder selesai. Database: ${defaultDbPath()}`);
  console.log(`Periode simulasi ID: ${result.periodId}. Calculation run ID: ${result.runId ?? 'tidak tersedia'}.`);
} else {
  console.log(result.reason);
}

closeDb();
