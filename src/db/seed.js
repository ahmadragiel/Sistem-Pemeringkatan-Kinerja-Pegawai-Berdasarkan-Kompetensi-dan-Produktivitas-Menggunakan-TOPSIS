import { inTransaction } from './index.js';
import { runCalculation } from '../services/calculation.js';
import { logActivity } from '../services/activity.js';

const CRITERIA = [
  {
    code: 'C1',
    name: 'Pengetahuan Kerja',
    category: 'kompetensi',
    description:
      'Pemahaman terhadap prosedur kerja, kebijakan, dan pengetahuan teknis yang dibutuhkan jabatan.',
    weight: 15,
    attribute: 'benefit',
    scale_min: 1,
    scale_max: 5,
    unit: 'skor 1-5',
    rubric:
      '1 = belum memahami prosedur dasar; 2 = memahami sebagian dengan bimbingan; 3 = memahami prosedur utama; 4 = memahami prosedur dan penerapannya; 5 = menguasai prosedur serta mampu menjelaskan kepada rekan kerja.',
    sort_order: 1,
  },
  {
    code: 'C2',
    name: 'Keterampilan Teknis',
    category: 'kompetensi',
    description:
      'Kemampuan menerapkan alat, metode, dan keterampilan teknis yang relevan dengan tugas jabatan.',
    weight: 15,
    attribute: 'benefit',
    scale_min: 1,
    scale_max: 5,
    unit: 'skor 1-5',
    rubric:
      '1 = belum mampu menggunakan alat kerja; 2 = mampu dengan pendampingan penuh; 3 = mampu menyelesaikan tugas rutin; 4 = mampu menangani tugas yang lebih kompleks; 5 = mampu menyelesaikan tugas kompleks dan membimbing rekan.',
    sort_order: 2,
  },
  {
    code: 'C3',
    name: 'Kemampuan Pemecahan Masalah',
    category: 'kompetensi',
    description:
      'Kemampuan mengidentifikasi masalah, menyusun alternatif, dan memilih penyelesaian yang sesuai.',
    weight: 15,
    attribute: 'benefit',
    scale_min: 1,
    scale_max: 5,
    unit: 'skor 1-5',
    rubric:
      '1 = masalah dibiarkan tanpa analisis; 2 = analisis terbatas dan bergantung pada arahan; 3 = mampu menyelesaikan masalah rutin; 4 = mampu menganalisis penyebab dan memilih solusi; 5 = mampu menyelesaikan masalah kompleks serta mencegah pengulangan.',
    sort_order: 3,
  },
  {
    code: 'C4',
    name: 'Kuantitas Hasil Kerja',
    category: 'produktivitas',
    description:
      'Volume pekerjaan yang diselesaikan dibandingkan dengan target atau beban kerja yang ditetapkan.',
    weight: 20,
    attribute: 'benefit',
    scale_min: 1,
    scale_max: 5,
    unit: 'skor 1-5',
    rubric:
      '1 = jauh di bawah target; 2 = di bawah target; 3 = memenuhi target dasar; 4 = melebihi target; 5 = jauh melebihi target secara konsisten.',
    sort_order: 4,
  },
  {
    code: 'C5',
    name: 'Kualitas Hasil Kerja',
    category: 'produktivitas',
    description:
      'Tingkat ketepatan, kelengkapan, dan kesesuaian hasil kerja dengan standar mutu yang berlaku.',
    weight: 20,
    attribute: 'benefit',
    scale_min: 1,
    scale_max: 5,
    unit: 'skor 1-5',
    rubric:
      '1 = banyak kesalahan yang memerlukan perbaikan menyeluruh; 2 = masih memerlukan perbaikan besar; 3 = sesuai standar dasar; 4 = rapi dan sesuai standar; 5 = sangat rapi dan konsisten tanpa perbaikan berarti.',
    sort_order: 5,
  },
  {
    code: 'C6',
    name: 'Ketepatan Waktu Penyelesaian Tugas',
    category: 'produktivitas',
    description:
      'Kesesuaian waktu penyelesaian tugas dengan tenggat yang disepakati.',
    weight: 15,
    attribute: 'benefit',
    scale_min: 1,
    scale_max: 5,
    unit: 'skor 1-5',
    rubric:
      '1 = sering terlambat tanpa pemberitahuan; 2 = beberapa kali terlambat; 3 = sebagian besar tepat waktu; 4 = tepat waktu dan melaporkan kendala; 5 = selalu tepat waktu atau selesai lebih awal dengan kualitas terjaga.',
    sort_order: 6,
  },
];

const EMPLOYEES = [
  { code: 'PG001', name: 'Andi Pratama', gender: 'L', position: 'Staf Administrasi', department: 'Operasional', status: 'aktif' },
  { code: 'PG002', name: 'Budi Santoso', gender: 'L', position: 'Analis Keuangan', department: 'Keuangan', status: 'aktif' },
  { code: 'PG003', name: 'Citra Lestari', gender: 'P', position: 'Staf Pemasaran', department: 'Pemasaran', status: 'aktif' },
  { code: 'PG004', name: 'Dewi Anggraini', gender: 'P', position: 'Staf Sumber Daya Manusia', department: 'SDM', status: 'aktif' },
  { code: 'PG005', name: 'Eko Nugroho', gender: 'L', position: 'Staf Operasional', department: 'Operasional', status: 'kontrak' },
  { code: 'PG006', name: 'Fajar Ramadhan', gender: 'L', position: 'Staf Teknologi Informasi', department: 'Teknologi Informasi', status: 'aktif' },
  { code: 'PG007', name: 'Gita Maharani', gender: 'P', position: 'Staf Keuangan', department: 'Keuangan', status: 'aktif' },
  { code: 'PG008', name: 'Hendra Wijaya', gender: 'L', position: 'Staf Logistik', department: 'Operasional', status: 'kontrak' },
  { code: 'PG009', name: 'Intan Permatasari', gender: 'P', position: 'Analis Pemasaran', department: 'Pemasaran', status: 'aktif' },
  { code: 'PG010', name: 'Joko Susilo', gender: 'L', position: 'Staf Teknologi Informasi', department: 'Teknologi Informasi', status: 'magang' },
];

const ASSESSMENTS = {
  PG001: [4, 5, 4, 4, 5, 4],
  PG002: [3, 4, 5, 3, 4, 4],
  PG003: [5, 4, 4, 5, 4, 5],
  PG004: [4, 3, 4, 4, 3, 3],
  PG005: [2, 3, 3, 2, 3, 3],
  PG006: [5, 5, 4, 5, 5, 4],
  PG007: [4, 4, 5, 4, 4, 5],
  PG008: [3, 2, 3, 3, 2, 3],
  PG009: [5, 4, 5, 5, 4, 4],
  PG010: [3, 3, 2, 3, 3, 2],
};

export function isDatabaseEmpty(db) {
  const employeeCount = db.prepare('SELECT COUNT(*) AS total FROM employees').get().total;
  const criteriaCount = db.prepare('SELECT COUNT(*) AS total FROM criteria').get().total;
  const periodCount = db.prepare('SELECT COUNT(*) AS total FROM assessment_periods').get().total;
  return employeeCount === 0 && criteriaCount === 0 && periodCount === 0;
}

export function seedSimulationData(db) {
  if (!isDatabaseEmpty(db)) {
    return { seeded: false, reason: 'Database sudah berisi data master. Seeder tidak mengubah data yang ada.' };
  }

  const periodId = inTransaction(db, () => {
    const insertCriterion = db.prepare(
      `INSERT INTO criteria
        (code, name, category, description, weight, attribute, scale_min, scale_max, unit, rubric, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    );
    for (const criterion of CRITERIA) {
      insertCriterion.run(
        criterion.code,
        criterion.name,
        criterion.category,
        criterion.description,
        criterion.weight,
        criterion.attribute,
        criterion.scale_min,
        criterion.scale_max,
        criterion.unit,
        criterion.rubric,
        criterion.sort_order,
      );
    }

    const insertEmployee = db.prepare(
      `INSERT INTO employees
        (code, name, gender, position, department, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const employee of EMPLOYEES) {
      insertEmployee.run(
        employee.code,
        employee.name,
        employee.gender,
        employee.position,
        employee.department,
        employee.status,
        'Data simulasi akademik.',
      );
    }

    const periodResult = db
      .prepare(
        `INSERT INTO assessment_periods (name, start_date, end_date, is_active, notes)
         VALUES (?, ?, ?, 1, ?)`,
      )
      .run(
        'Penilaian Tahunan 2026',
        '2026-01-01',
        '2026-12-31',
        'Periode simulasi akademik. Bukan data instansi nyata.',
      );

    const newPeriodId = Number(periodResult.lastInsertRowid);

    const criteriaRows = db.prepare('SELECT id, code FROM criteria ORDER BY sort_order').all();
    const employeeRows = db.prepare('SELECT id, code FROM employees ORDER BY code').all();
    const insertAssessment = db.prepare(
      'INSERT INTO assessments (period_id, employee_id, criterion_id, value) VALUES (?, ?, ?, ?)',
    );

    for (const employee of employeeRows) {
      const values = ASSESSMENTS[employee.code];
      criteriaRows.forEach((criterion, index) => {
        insertAssessment.run(newPeriodId, employee.id, criterion.id, values[index]);
      });
    }

    logActivity(
      db,
      'seed',
      'Data simulasi dimuat: 10 pegawai, 6 kriteria, dan 1 periode penilaian.',
    );

    return newPeriodId;
  });

  let runId = null;
  try {
    runId = runCalculation(db, periodId, { notes: 'Perhitungan awal data simulasi.' });
  } catch (error) {
    console.error('Data simulasi berhasil dimuat, tetapi perhitungan awal gagal:', error.message);
  }

  return { seeded: true, periodId, runId };
}

export function seedIfEmpty(db) {
  if (process.env.SEED_ON_START === 'false') {
    return { seeded: false, reason: 'Seed otomatis dimatikan melalui SEED_ON_START.' };
  }
  return seedSimulationData(db);
}
