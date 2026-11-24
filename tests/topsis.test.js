import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTopsis,
  validateTopsisInput,
  TopsisError,
} from '../src/services/topsis.js';

function criteria(overrides = {}) {
  return [
    {
      id: 1,
      code: 'C1',
      name: 'Kriteria satu',
      category: 'kompetensi',
      weight: 60,
      attribute: 'benefit',
      scaleMin: 0,
      scaleMax: 10,
      sortOrder: 1,
      ...overrides,
    },
    {
      id: 2,
      code: 'C2',
      name: 'Kriteria dua',
      category: 'produktivitas',
      weight: 40,
      attribute: 'benefit',
      scaleMin: 0,
      scaleMax: 10,
      sortOrder: 2,
    },
  ];
}

function alternatives() {
  return [
    {
      employeeId: 1,
      code: 'A1',
      name: 'Alternatif satu',
      department: 'Unit satu',
      position: 'Staf',
      values: [4, 3],
    },
    {
      employeeId: 2,
      code: 'A2',
      name: 'Alternatif dua',
      department: 'Unit dua',
      position: 'Staf',
      values: [2, 5],
    },
  ];
}

test('TOPSIS menghasilkan normalisasi vektor, jarak, preferensi, dan peringkat yang benar', () => {
  const result = calculateTopsis({
    criteria: criteria(),
    alternatives: alternatives(),
  });

  assert.deepEqual(result.weights.normalized, [0.6, 0.4]);
  assert.equal(result.weights.total, 100);
  assert.ok(Math.abs(result.denominators[0] - Math.sqrt(20)) < 1e-12);
  assert.ok(Math.abs(result.denominators[1] - Math.sqrt(34)) < 1e-12);
  assert.ok(Math.abs(result.normalized[0][0] - 4 / Math.sqrt(20)) < 1e-12);
  assert.ok(Math.abs(result.normalized[1][1] - 5 / Math.sqrt(34)) < 1e-12);
  assert.ok(Math.abs(result.weighted[0][0] - 0.6 * (4 / Math.sqrt(20))) < 1e-12);

  assert.ok(Math.abs(result.idealPositive[0] - 0.5366563145999494) < 1e-12);
  assert.ok(Math.abs(result.idealPositive[1] - 0.34299717028501764) < 1e-12);
  assert.ok(Math.abs(result.idealNegative[0] - 0.2683281572999747) < 1e-12);
  assert.ok(Math.abs(result.idealNegative[1] - 0.20579830217101058) < 1e-12);

  const rowA1 = result.rows.find((row) => row.code === 'A1');
  const rowA2 = result.rows.find((row) => row.code === 'A2');
  assert.ok(Math.abs(rowA1.dPlus - 0.13719886811400706) < 1e-12);
  assert.ok(Math.abs(rowA1.dMinus - 0.2683281572999747) < 1e-12);
  assert.ok(Math.abs(rowA1.preference - 0.6616776206864444) < 1e-12);
  assert.ok(Math.abs(rowA2.dPlus - 0.2683281572999747) < 1e-12);
  assert.ok(Math.abs(rowA2.dMinus - 0.13719886811400706) < 1e-12);
  assert.ok(Math.abs(rowA2.preference - 0.33832237931355563) < 1e-12);

  assert.deepEqual(
    result.ranking.map((row) => [row.code, row.rank]),
    [
      ['A1', 1],
      ['A2', 2],
    ],
  );
  assert.equal(result.degenerate, false);
});

test('atribut cost membalik arah solusi ideal dan dapat mengubah peringkat', () => {
  const costCriteria = criteria();
  costCriteria[1].attribute = 'cost';
  const result = calculateTopsis({
    criteria: costCriteria,
    alternatives: alternatives(),
  });

  assert.ok(Math.abs(result.idealPositive[1] - 0.20579830217101058) < 1e-12);
  assert.ok(Math.abs(result.idealNegative[1] - 0.34299717028501764) < 1e-12);

  const rowA1 = result.rows.find((row) => row.code === 'A1');
  const rowA2 = result.rows.find((row) => row.code === 'A2');
  assert.equal(rowA1.dPlus, 0);
  assert.equal(rowA2.dMinus, 0);
  assert.ok(Math.abs(rowA1.preference - 1) < 1e-12);
  assert.ok(Math.abs(rowA2.preference - 0) < 1e-12);
  assert.deepEqual(
    result.ranking.map((row) => [row.code, row.rank]),
    [
      ['A1', 1],
      ['A2', 2],
    ],
  );
});

test('peringkat memakai urutan kompetisi dan alternatif identik memperoleh peringkat sama', () => {
  const result = calculateTopsis({
    criteria: [
      {
        id: 1,
        code: 'C1',
        name: 'Satu kriteria',
        weight: 100,
        attribute: 'benefit',
        scaleMin: 0,
        scaleMax: 10,
      },
    ],
    alternatives: [
      { employeeId: 1, code: 'A1', name: 'Satu', values: [5] },
      { employeeId: 2, code: 'A2', name: 'Dua', values: [5] },
      { employeeId: 3, code: 'A3', name: 'Tiga', values: [1] },
    ],
  });

  assert.deepEqual(
    result.ranking.map((row) => [row.code, row.rank]),
    [
      ['A1', 1],
      ['A2', 1],
      ['A3', 3],
    ],
  );
  assert.ok(Math.abs(result.ranking[0].preference - 1) < 1e-12);
  assert.ok(Math.abs(result.ranking[2].preference - 0) < 1e-12);
});

test('seluruh alternatif identik menghasilkan preferensi 0,5 dan penanda degenerate', () => {
  const identical = [2, 2];
  const result = calculateTopsis({
    criteria: criteria(),
    alternatives: [
      { employeeId: 1, code: 'A1', name: 'Satu', values: identical },
      { employeeId: 2, code: 'A2', name: 'Dua', values: identical },
    ],
  });

  assert.equal(result.degenerate, true);
  for (const row of result.rows) {
    assert.equal(row.preference, 0.5);
    assert.equal(row.dPlus, 0);
    assert.equal(row.dMinus, 0);
    assert.equal(row.rank, 1);
  }
});

test('kontribusi kriteria menjumlah menjadi satu untuk baris non-degenerate', () => {
  const result = calculateTopsis({
    criteria: criteria(),
    alternatives: alternatives(),
  });

  for (const row of result.rows) {
    const total = row.contributions.reduce((sum, item) => sum + item.share, 0);
    assert.ok(Math.abs(total - 1) < 1e-12);
    assert.deepEqual(
      row.contributions.map((item) => item.code),
      ['C1', 'C2'],
    );
  }
});

test('normalisasi menolak kolom yang seluruh nilainya nol', () => {
  assert.throws(
    () =>
      calculateTopsis({
        criteria: criteria(),
        alternatives: [
          { employeeId: 1, code: 'A1', name: 'Satu', values: [0, 3] },
          { employeeId: 2, code: 'A2', name: 'Dua', values: [0, 4] },
        ],
      }),
    (error) =>
      error instanceof TopsisError &&
      error.issues.some((issue) => issue.includes('Penyebut normalisasi C1')),
  );
});

test('input tidak lengkap ditolak dengan pesan yang dapat ditindaklanjuti', () => {
  const issues = validateTopsisInput({
    criteria: criteria(),
    alternatives: [
      { employeeId: 1, code: 'A1', name: 'Satu', values: [4, null] },
      { employeeId: 2, code: 'A2', name: 'Dua', values: [2, 5] },
    ],
  });

  assert.ok(issues.some((issue) => issue.includes('A1') && issue.includes('C2')));
  assert.throws(
    () =>
      calculateTopsis({
        criteria: criteria(),
        alternatives: [{ employeeId: 1, code: 'A1', name: 'Satu', values: [4, 3] }],
      }),
    (error) =>
      error instanceof TopsisError &&
      error.issues.includes('TOPSIS memerlukan minimal dua alternatif pegawai.'),
  );
});

test('bobot negatif dan total bobot nol ditolak', () => {
  assert.throws(
    () =>
      calculateTopsis({
        criteria: [
          { id: 1, code: 'C1', name: 'Satu', weight: -1, attribute: 'benefit' },
        ],
        alternatives: alternatives(),
      }),
    (error) => error instanceof TopsisError,
  );

  assert.throws(
    () =>
      calculateTopsis({
        criteria: [
          { id: 1, code: 'C1', name: 'Satu', weight: 0, attribute: 'benefit' },
          { id: 2, code: 'C2', name: 'Dua', weight: 0, attribute: 'benefit' },
        ],
        alternatives: alternatives(),
      }),
    (error) =>
      error instanceof TopsisError &&
      error.issues.includes('Total bobot kriteria harus lebih dari nol.'),
  );
});
