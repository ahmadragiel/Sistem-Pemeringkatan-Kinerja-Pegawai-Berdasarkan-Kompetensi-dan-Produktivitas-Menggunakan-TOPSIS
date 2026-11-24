import fs from 'node:fs';
import { defaultDbPath } from './index.js';

const filename = defaultDbPath();
if (filename === ':memory:') {
  console.error('DB_PATH tidak menunjuk ke file. Reset dibatalkan.');
  process.exit(1);
}

for (const suffix of ['', '-wal', '-shm']) {
  const target = `${filename}${suffix}`;
  if (fs.existsSync(target)) {
    fs.rmSync(target);
    console.log(`Dihapus: ${target}`);
  }
}

console.log('Database telah direset. Jalankan npm run seed atau npm start untuk memuat data simulasi.');
