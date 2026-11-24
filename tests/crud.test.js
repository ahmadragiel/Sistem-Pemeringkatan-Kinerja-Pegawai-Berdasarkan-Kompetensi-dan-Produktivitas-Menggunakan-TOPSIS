import test from 'node:test';
import assert from 'node:assert/strict';
import { getLatestRun, runIsStale } from '../src/services/calculation.js';
import { startServer, post, html } from './helpers.js';

test('validasi dan penyimpanan pegawai berjalan melalui HTTP', async (t) => {
  const { db, base } = await startServer(t);

  const invalid = await post(base, '/pegawai', {
    code: '',
    name: '',
    position: '',
    department: '',
    status: 'aktif',
  });
  assert.equal(invalid.status, 422);
  const invalidHtml = await invalid.text();
  assert.match(invalidHtml, /Data belum dapat disimpan/);
  assert.match(invalidHtml, /Kode pegawai wajib diisi/);

  const valid = await post(base, '/pegawai', {
    code: ' pg011 ',
    name: 'Karyawan Uji',
    gender: 'L',
    position: 'Staf Uji',
    department: 'Unit Uji',
    status: 'aktif',
    notes: 'Data uji',
  });
  assert.equal(valid.status, 302);
  assert.match(valid.headers.get('location'), /^\/pegawai\/\d+$/);

  const employee = db.prepare('SELECT * FROM employees WHERE code = ?').get('PG011');
  assert.equal(employee.name, 'Karyawan Uji');
  assert.equal(employee.department, 'Unit Uji');

  const detail = await html(base, `/pegawai/${employee.id}`);
  assert.equal(detail.response.status, 200);
  assert.match(detail.text, /Karyawan Uji/);
});

test('periode baru dapat dibuat, diaktifkan, dan nama duplikat ditolak', async (t) => {
  const { db, base } = await startServer(t);
  const oldPeriod = db.prepare('SELECT * FROM assessment_periods LIMIT 1').get();

  const created = await post(base, '/periode', {
    name: 'Periode Uji 2027',
    start_date: '2027-01-01',
    end_date: '2027-12-31',
    is_active: '1',
    notes: 'Periode untuk pengujian',
  });
  assert.equal(created.status, 302);

  const newPeriod = db.prepare('SELECT * FROM assessment_periods WHERE name = ?').get('Periode Uji 2027');
  assert.equal(newPeriod.is_active, 1);
  assert.equal(
    db.prepare('SELECT is_active FROM assessment_periods WHERE id = ?').get(oldPeriod.id).is_active,
    0,
  );

  const duplicate = await post(base, '/periode', {
    name: 'Periode Uji 2027',
    start_date: '2028-01-01',
    end_date: '2028-12-31',
  });
  assert.equal(duplicate.status, 422);
  assert.match(await duplicate.text(), /Nama periode sudah digunakan/);

  const page = await html(base, '/');
  assert.match(page.text, /Periode Uji 2027/);
});

test('pegawai dapat diubah, diarsipkan, dipulihkan, dan dihapus sesuai aturan riwayat', async (t) => {
  const { db, base } = await startServer(t);
  const period = db.prepare('SELECT * FROM assessment_periods LIMIT 1').get();
  const employee = db.prepare("SELECT * FROM employees WHERE code = 'PG010'").get();

  const updated = await post(base, `/pegawai/${employee.id}`, {
    code: employee.code,
    name: 'Nama Pegawai Diperbarui',
    gender: 'P',
    position: 'Analis Uji',
    department: 'Unit Pengujian',
    status: 'kontrak',
    notes: 'Perubahan untuk pengujian',
  });
  assert.equal(updated.status, 302);
  const changed = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee.id);
  assert.equal(changed.name, 'Nama Pegawai Diperbarui');
  assert.equal(changed.department, 'Unit Pengujian');
  assert.equal(changed.status, 'kontrak');

  const archived = await post(base, `/pegawai/${employee.id}/arsip`, {});
  assert.equal(archived.status, 302);
  assert.ok(db.prepare('SELECT archived_at FROM employees WHERE id = ?').get(employee.id).archived_at);
  assert.equal(runIsStale(db, getLatestRun(db, period.id)), true);

  const list = await html(base, '/pegawai?arsip=1');
  assert.match(list.text, /Nama Pegawai Diperbarui/);
  assert.match(list.text, /Pulihkan/);

  const restored = await post(base, `/pegawai/${employee.id}/pulihkan`, {});
  assert.equal(restored.status, 302);
  assert.equal(db.prepare('SELECT archived_at FROM employees WHERE id = ?').get(employee.id).archived_at, null);
  assert.equal(runIsStale(db, getLatestRun(db, period.id)), false);

  const blocked = await post(base, `/pegawai/${employee.id}/hapus`, {});
  assert.equal(blocked.status, 302);
  assert.ok(db.prepare('SELECT id FROM employees WHERE id = ?').get(employee.id));

  db.prepare(
    `INSERT INTO employees (code, name, gender, position, department, status)
     VALUES ('PG099', 'Pegawai Tanpa Riwayat', 'L', 'Staf', 'Unit Sementara', 'aktif')`,
  ).run();
  const temporary = db.prepare("SELECT * FROM employees WHERE code = 'PG099'").get();
  const removed = await post(base, `/pegawai/${temporary.id}/hapus`, {});
  assert.equal(removed.status, 302);
  assert.equal(db.prepare('SELECT id FROM employees WHERE id = ?').get(temporary.id), undefined);
});

test('kriteria baru divalidasi, dapat diubah, dinonaktifkan, dan dihapus bila belum dipakai', async (t) => {
  const { db, base } = await startServer(t);
  const seeded = db.prepare('SELECT * FROM criteria WHERE code = ?').get('C1');

  const duplicate = await post(base, '/kriteria', {
    code: 'C1',
    name: 'Kriteria Duplikat',
    category: 'kompetensi',
    description: '',
    weight: '10',
    attribute: 'benefit',
    scale_min: '1',
    scale_max: '5',
    unit: 'skor',
    rubric: '',
    is_active: '1',
    sort_order: '9',
  });
  assert.equal(duplicate.status, 422);
  assert.match(await duplicate.text(), /Kode kriteria sudah digunakan/);

  const created = await post(base, '/kriteria', {
    code: 'C7',
    name: 'Kriteria Uji',
    category: 'produktivitas',
    description: 'Kriteria untuk pengujian',
    weight: '10',
    attribute: 'benefit',
    scale_min: '1',
    scale_max: '5',
    unit: 'skor 1-5',
    rubric: 'Rubrik uji',
    is_active: '1',
    sort_order: '7',
  });
  assert.equal(created.status, 302);
  const criterion = db.prepare("SELECT * FROM criteria WHERE code = 'C7'").get();
  assert.equal(criterion.name, 'Kriteria Uji');
  assert.equal(criterion.weight, 10);

  const toggled = await post(base, `/kriteria/${criterion.id}/toggle`, {});
  assert.equal(toggled.status, 302);
  assert.equal(db.prepare('SELECT is_active FROM criteria WHERE id = ?').get(criterion.id).is_active, 0);

  const edited = await post(base, `/kriteria/${criterion.id}`, {
    code: 'C7',
    name: 'Kriteria Uji Diperbarui',
    category: 'kompetensi',
    description: 'Deskripsi baru',
    weight: '12',
    attribute: 'cost',
    scale_min: '1',
    scale_max: '5',
    unit: 'skor 1-5',
    rubric: 'Rubrik baru',
    is_active: '1',
    sort_order: '7',
  });
  assert.equal(edited.status, 302);
  const changed = db.prepare('SELECT * FROM criteria WHERE id = ?').get(criterion.id);
  assert.equal(changed.name, 'Kriteria Uji Diperbarui');
  assert.equal(changed.weight, 12);
  assert.equal(changed.attribute, 'cost');
  assert.equal(changed.is_active, 1);

  const blocked = await post(base, `/kriteria/${seeded.id}/hapus`, {});
  assert.equal(blocked.status, 302);
  assert.ok(db.prepare('SELECT id FROM criteria WHERE id = ?').get(seeded.id));

  const removed = await post(base, `/kriteria/${criterion.id}/hapus`, {});
  assert.equal(removed.status, 302);
  assert.equal(db.prepare('SELECT id FROM criteria WHERE id = ?').get(criterion.id), undefined);
});
