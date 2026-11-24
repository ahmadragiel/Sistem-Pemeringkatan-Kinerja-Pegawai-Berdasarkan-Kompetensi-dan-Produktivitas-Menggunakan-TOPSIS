import test from 'node:test';
import assert from 'node:assert/strict';
import { getLatestRun, runIsStale } from '../src/services/calculation.js';
import { startServer, post, html } from './helpers.js';

test('penilaian menolak nilai di luar skala dan menyimpan nilai valid tanpa duplikasi', async (t) => {
  const { db, base } = await startServer(t);
  const period = db.prepare('SELECT * FROM assessment_periods LIMIT 1').get();
  const criteria = db.prepare('SELECT * FROM criteria WHERE is_active = 1 ORDER BY id').all();
  const employee = db.prepare('SELECT * FROM employees ORDER BY id LIMIT 1').get();
  const original = db
    .prepare('SELECT value FROM assessments WHERE period_id = ? AND employee_id = ? AND criterion_id = ?')
    .get(period.id, employee.id, criteria[0].id).value;
  const countBefore = db.prepare('SELECT COUNT(*) AS total FROM assessments').get().total;

  const body = { period_id: String(period.id) };
  for (const criterion of criteria) {
    const stored = db
      .prepare('SELECT value FROM assessments WHERE period_id = ? AND employee_id = ? AND criterion_id = ?')
      .get(period.id, employee.id, criterion.id);
    body[`nilai_${criterion.id}`] = String(stored ? stored.value : criterion.scale_min);
  }
  body[`nilai_${criteria[0].id}`] = '99';

  const invalid = await post(base, `/penilaian/${employee.id}`, body);
  assert.equal(invalid.status, 422);
  assert.match(await invalid.text(), /rentang/);
  assert.equal(
    db
      .prepare('SELECT value FROM assessments WHERE period_id = ? AND employee_id = ? AND criterion_id = ?')
      .get(period.id, employee.id, criteria[0].id).value,
    original,
  );

  body[`nilai_${criteria[0].id}`] = String(criteria[0].scale_min);
  const valid = await post(base, `/penilaian/${employee.id}`, body);
  assert.equal(valid.status, 302);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM assessments').get().total, countBefore);
  assert.equal(
    db
      .prepare('SELECT value FROM assessments WHERE period_id = ? AND employee_id = ? AND criterion_id = ?')
      .get(period.id, employee.id, criteria[0].id).value,
    criteria[0].scale_min,
  );
});

test('perubahan bobot menandai snapshot lama dan perhitungan baru menyimpan snapshot baru', async (t) => {
  const { db, base } = await startServer(t);
  const period = db.prepare('SELECT * FROM assessment_periods LIMIT 1').get();
  const criteria = db.prepare('SELECT * FROM criteria WHERE is_active = 1 ORDER BY id').all();
  const fields = {};
  for (const criterion of criteria) {
    fields[`weight_${criterion.id}`] = String(criterion.weight);
  }
  fields[`weight_${criteria[0].id}`] = '25';

  const saved = await post(base, '/bobot', fields);
  assert.equal(saved.status, 302);

  const latestAfterEdit = getLatestRun(db, period.id);
  assert.equal(latestAfterEdit.id, 1);
  assert.equal(runIsStale(db, latestAfterEdit), true);
  assert.equal(
    db.prepare('SELECT weight FROM criteria WHERE id = ?').get(criteria[0].id).weight,
    25,
  );

  const dashboard = await html(base, '/');
  assert.match(dashboard.text, /Perlu hitung ulang/);

  const calculated = await post(base, '/perhitungan', { period_id: String(period.id) });
  assert.equal(calculated.status, 302);
  assert.match(calculated.headers.get('location'), /^\/perhitungan\/2/);

  const latest = getLatestRun(db, period.id);
  assert.equal(latest.id, 2);
  assert.equal(latest.weight_total, 110);
  assert.equal(runIsStale(db, latest), false);
  const snapshot = db
    .prepare('SELECT * FROM calculation_criteria WHERE run_id = ? AND criterion_id = ?')
    .get(latest.id, criteria[0].id);
  assert.equal(snapshot.weight_raw, 25);
  assert.ok(Math.abs(snapshot.weight_normalized - 25 / 110) < 1e-12);

  const detail = await html(base, '/perhitungan/2');
  assert.match(detail.text, /Run #2/);
});

test('perhitungan ditolak ketika nilai penilaian belum lengkap', async (t) => {
  const { db, base } = await startServer(t);
  const period = db.prepare('SELECT * FROM assessment_periods LIMIT 1').get();
  const runCountBefore = db.prepare('SELECT COUNT(*) AS total FROM calculation_runs').get().total;
  db.prepare('DELETE FROM assessments WHERE id = (SELECT MIN(id) FROM assessments)').run();

  const response = await post(base, '/perhitungan', { period_id: String(period.id) });
  assert.equal(response.status, 302);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM calculation_runs').get().total, runCountBefore);

  const page = await html(base, '/perhitungan');
  assert.match(page.text, /1 nilai belum diisi/);
});

test('ekspor CSV mengirim berkas dengan pemisah titik koma dan BOM', async (t) => {
  const { base } = await startServer(t);

  const ranking = await fetch(base + '/peringkat/export.csv?run=1');
  assert.equal(ranking.status, 200);
  assert.match(ranking.headers.get('content-type'), /text\/csv/);
  assert.match(ranking.headers.get('content-disposition'), /attachment/);
  const rankingBuffer = Buffer.from(await ranking.arrayBuffer());
  assert.deepEqual([...rankingBuffer.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const rankingCsv = rankingBuffer.toString('utf8');
  assert.ok(rankingCsv.startsWith('\uFEFF'));
  assert.match(rankingCsv, /"HASIL PEMERINGKATAN TOPSIS"/);
  assert.match(rankingCsv, /"Peringkat";"Kode pegawai"/);
  assert.match(rankingCsv, /"Fajar Ramadhan"/);

  const report = await fetch(base + '/laporan/export.csv?period=1');
  assert.equal(report.status, 200);
  const reportBuffer = Buffer.from(await report.arrayBuffer());
  assert.deepEqual([...reportBuffer.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const reportCsv = reportBuffer.toString('utf8');
  assert.ok(reportCsv.startsWith('\uFEFF'));
  assert.match(reportCsv, /"DAFTAR KRITERIA"/);
  assert.match(reportCsv, /"Bobot ternormalisasi"/);
  assert.doesNotMatch(reportCsv, /"Skala"/);
});

test('bobot tidak valid ditolak tanpa mengubah data yang tersimpan', async (t) => {
  const { db, base } = await startServer(t);
  const criteria = db.prepare('SELECT * FROM criteria ORDER BY id').all();
  const original = criteria.map((criterion) => criterion.weight);

  const fields = {};
  for (const criterion of criteria) {
    fields[`weight_${criterion.id}`] = String(criterion.weight);
  }
  fields[`weight_${criteria[0].id}`] = 'bukan angka';
  const invalid = await post(base, '/bobot', fields);
  assert.equal(invalid.status, 422);
  assert.match(await invalid.text(), /Bobot wajib berupa angka/);
  assert.deepEqual(
    db.prepare('SELECT weight FROM criteria ORDER BY id').all().map((row) => row.weight),
    original,
  );

  const zero = {};
  for (const criterion of criteria) {
    zero[`weight_${criterion.id}`] = '0';
  }
  const rejected = await post(base, '/bobot', zero);
  assert.equal(rejected.status, 422);
  assert.match(await rejected.text(), /Total bobot harus lebih dari nol/);
  assert.deepEqual(
    db.prepare('SELECT weight FROM criteria ORDER BY id').all().map((row) => row.weight),
    original,
  );
});

test('nilai penilaian dapat dikosongkan dan kelengkapan dihitung ulang', async (t) => {
  const { db, base } = await startServer(t);
  const period = db.prepare('SELECT * FROM assessment_periods LIMIT 1').get();
  const criteria = db.prepare('SELECT * FROM criteria WHERE is_active = 1 ORDER BY id').all();
  const employee = db.prepare('SELECT * FROM employees ORDER BY id LIMIT 1').get();

  const body = { period_id: String(period.id) };
  for (const criterion of criteria) {
    const stored = db
      .prepare('SELECT value FROM assessments WHERE period_id = ? AND employee_id = ? AND criterion_id = ?')
      .get(period.id, employee.id, criterion.id);
    body[`nilai_${criterion.id}`] = stored ? String(stored.value) : '';
  }
  body[`nilai_${criteria[criteria.length - 1].id}`] = '';

  const response = await post(base, `/penilaian/${employee.id}`, body);
  assert.equal(response.status, 302);
  assert.equal(
    db
      .prepare('SELECT id FROM assessments WHERE period_id = ? AND employee_id = ? AND criterion_id = ?')
      .get(period.id, employee.id, criteria[criteria.length - 1].id),
    undefined,
  );

  const page = await html(base, `/perhitungan?period=${period.id}`);
  assert.match(page.text, /1 nilai belum diisi/);
  assert.match(page.text, /Belum siap/);
});

test('snapshot perhitungan konsisten dengan rumus TOPSIS dan tersimpan utuh', async (t) => {
  const { db } = await startServer(t);
  const run = db.prepare('SELECT * FROM calculation_runs WHERE id = 1').get();
  const criteria = db
    .prepare('SELECT * FROM calculation_criteria WHERE run_id = ? ORDER BY sort_order')
    .all(run.id);
  const details = db
    .prepare('SELECT * FROM calculation_details WHERE run_id = ? ORDER BY rank, employee_code')
    .all(run.id);

  const normalizedTotal = criteria.reduce((sum, criterion) => sum + criterion.weight_normalized, 0);
  assert.ok(Math.abs(normalizedTotal - 1) < 1e-12);
  assert.equal(details.length, run.employee_count);

  const weightedByEmployee = details.map((detail) => JSON.parse(detail.weighted_json));
  const positive = criteria.map((criterion, index) => {
    const values = weightedByEmployee.map((row) => row[index]);
    return criterion.attribute === 'cost' ? Math.min(...values) : Math.max(...values);
  });
  const negative = criteria.map((criterion, index) => {
    const values = weightedByEmployee.map((row) => row[index]);
    return criterion.attribute === 'cost' ? Math.max(...values) : Math.min(...values);
  });

  for (const detail of details) {
    const weighted = JSON.parse(detail.weighted_json);
    const dPlus = Math.sqrt(
      weighted.reduce((sum, value, index) => sum + (value - positive[index]) ** 2, 0),
    );
    const dMinus = Math.sqrt(
      weighted.reduce((sum, value, index) => sum + (value - negative[index]) ** 2, 0),
    );
    assert.ok(Math.abs(dPlus - detail.d_plus) < 1e-12, detail.employee_code);
    assert.ok(Math.abs(dMinus - detail.d_minus) < 1e-12, detail.employee_code);
    assert.ok(
      Math.abs(detail.preference - dMinus / (dPlus + dMinus)) < 1e-12,
      detail.employee_code,
    );
  }

  const preferences = details.map((detail) => detail.preference);
  assert.deepEqual(preferences, [...preferences].sort((a, b) => b - a));
  assert.equal(details[0].employee_code, 'PG006');
  assert.equal(details[0].rank, 1);
});
