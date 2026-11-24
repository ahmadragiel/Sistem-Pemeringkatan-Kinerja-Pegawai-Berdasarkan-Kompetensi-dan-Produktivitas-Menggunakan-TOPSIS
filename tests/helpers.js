import { once } from 'node:events';
import { createDatabase } from '../src/db/index.js';
import { seedSimulationData } from '../src/db/seed.js';
import { createApp } from '../src/app.js';

export async function startServer(t, { seed = true } = {}) {
  const db = createDatabase(':memory:');
  const seedResult = seed ? seedSimulationData(db) : { seeded: false };
  const app = createApp(db);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });

  return { db, base, seedResult };
}

export async function post(base, path, fields) {
  return fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
    redirect: 'manual',
  });
}

export async function html(base, path) {
  const response = await fetch(base + path);
  return { response, text: await response.text() };
}
