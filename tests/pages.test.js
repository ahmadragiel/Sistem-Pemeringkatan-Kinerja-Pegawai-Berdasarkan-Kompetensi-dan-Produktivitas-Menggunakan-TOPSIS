import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, html } from './helpers.js';

test('seluruh halaman utama dapat dirender dari data simulasi', async (t) => {
  const { base } = await startServer(t);

  const paths = [
    '/',
    '/pegawai',
    '/pegawai/1',
    '/pegawai/baru',
    '/kriteria',
    '/kriteria/baru',
    '/bobot',
    '/periode',
    '/periode/baru',
    '/penilaian',
    '/penilaian/1',
    '/perhitungan',
    '/perhitungan/1',
    '/peringkat',
    '/peringkat/1/detail/1',
    '/laporan',
  ];

  for (const path of paths) {
    const { response, text } = await html(base, path);
    assert.equal(response.status, 200, path);
    assert.ok(!text.includes('NaN'), `NaN ditemukan pada ${path}`);
    assert.ok(!text.includes('Infinity'), `Infinity ditemukan pada ${path}`);
    assert.ok(!text.includes('undefined'), `undefined ditemukan pada ${path}`);
  }

  const dashboard = await html(base, '/');
  assert.match(dashboard.text, /Fajar Ramadhan/);
  assert.match(dashboard.text, /0,8446/);
  assert.match(dashboard.text, /Sudah dihitung/);
  assert.match(dashboard.text, /Kelengkapan penilaian/);
  assert.match(dashboard.text, /100%/);
  assert.match(dashboard.text, /60 dari 60 sel terisi/);
  assert.match(dashboard.text, /Input, proses TOPSIS, dan output/);
  assert.match(dashboard.text, /Matriks keputusan/);
  assert.match(dashboard.text, /Preferensi dan peringkat/);

  const detail = await html(base, '/perhitungan/1');
  for (const title of [
    'Matriks keputusan',
    'Bobot kriteria ternormalisasi',
    'Normalisasi vektor',
    'Matriks terbobot',
    'Solusi ideal positif dan negatif',
    'Jarak, nilai preferensi, dan peringkat',
    'Tabel jarak ke solusi ideal',
  ]) {
    assert.match(detail.text, new RegExp(title));
  }

  const report = await html(base, '/laporan');
  assert.match(report.text, /Laporan Hasil Pemeringkatan Pegawai/);

  const missing = await html(base, '/halaman-tidak-ada');
  assert.equal(missing.response.status, 404);
  assert.match(missing.text, /Halaman tidak ditemukan/);
});

test('database kosong menampilkan panduan tanpa hasil palsu', async (t) => {
  const { base } = await startServer(t, { seed: false });

  const dashboard = await html(base, '/');
  assert.equal(dashboard.response.status, 200);
  assert.match(dashboard.text, /Belum ada periode aktif/);
  assert.match(dashboard.text, /Kelengkapan penilaian/);
  assert.match(dashboard.text, /Output belum tersedia/);
  assert.match(dashboard.text, /Input belum lengkap/);
  assert.doesNotMatch(dashboard.text, /NaN/);
  assert.doesNotMatch(dashboard.text, /Infinity/);

  const ranking = await html(base, '/peringkat');
  assert.equal(ranking.response.status, 200);
  assert.match(ranking.text, /Belum ada periode penilaian/);

  const calculation = await html(base, '/perhitungan');
  assert.equal(calculation.response.status, 200);
  assert.match(calculation.text, /Belum ada periode penilaian/);
});

test('peringkat tidak ditampilkan sebelum ada perhitungan tersimpan', async (t) => {
  const { db, base } = await startServer(t);
  db.exec('DELETE FROM calculation_runs');

  const ranking = await html(base, '/peringkat');
  assert.equal(ranking.response.status, 200);
  assert.match(ranking.text, /Belum ada hasil perhitungan/);
  assert.doesNotMatch(ranking.text, /Fajar Ramadhan/);

  const dashboard = await html(base, '/');
  assert.doesNotMatch(dashboard.text, /Fajar Ramadhan/);
  assert.match(dashboard.text, /Belum dihitung/);
  assert.match(dashboard.text, /Output belum tersedia/);

  const calculation = await html(base, '/perhitungan');
  assert.match(calculation.text, /Siap dihitung/);
});
