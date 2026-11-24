import { getDb, closeDb } from './src/db/index.js';
import { seedIfEmpty } from './src/db/seed.js';
import { createApp } from './src/app.js';

const db = getDb();
const seedResult = seedIfEmpty(db);
const app = createApp(db);
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '127.0.0.1';

const server = app.listen(port, host, () => {
  console.log(`SPK Kinerja Pegawai berjalan di http://${host}:${port}`);
  if (seedResult.seeded) {
    console.log('Data simulasi dimuat otomatis. Semua angka berasal dari database SQLite.');
  } else if (seedResult.reason) {
    console.log(seedResult.reason);
  }
});

function shutdown() {
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
