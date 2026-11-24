import { createHash } from 'node:crypto';

function parseId(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function listPeriods(db) {
  return db
    .prepare('SELECT * FROM assessment_periods ORDER BY is_active DESC, start_date DESC, id DESC')
    .all();
}

export function getPeriod(db, id) {
  return db.prepare('SELECT * FROM assessment_periods WHERE id = ?').get(id) ?? null;
}

export function getActivePeriod(db) {
  return db.prepare('SELECT * FROM assessment_periods WHERE is_active = 1').get() ?? null;
}

export function resolvePeriod(db, requestedId) {
  const requested = parseId(requestedId);
  if (requested) {
    const period = getPeriod(db, requested);
    if (period) return { period, requested: true };
  }
  const active = getActivePeriod(db);
  if (active) return { period: active, requested: false };
  const fallback = db
    .prepare('SELECT * FROM assessment_periods ORDER BY start_date DESC, id DESC LIMIT 1')
    .get();
  return { period: fallback ?? null, requested: false };
}

export function loadActiveCriteria(db) {
  return db
    .prepare(
      `SELECT * FROM criteria
       WHERE is_active = 1
       ORDER BY sort_order ASC, code ASC`,
    )
    .all();
}

export function loadActiveEmployees(db) {
  return db
    .prepare(
      `SELECT * FROM employees
       WHERE archived_at IS NULL
       ORDER BY code ASC`,
    )
    .all();
}

function buildSignature({ periodId, criteria, employees, valueMap }) {
  const payload = {
    periodId,
    criteria: criteria.map((criterion) => ({
      id: criterion.id,
      code: criterion.code,
      weight: criterion.weight,
      attribute: criterion.attribute,
      scaleMin: criterion.scale_min,
      scaleMax: criterion.scale_max,
      sortOrder: criterion.sort_order,
    })),
    employees: employees.map((employee) => ({ id: employee.id, code: employee.code })),
    values: employees.flatMap((employee) =>
      criteria.map((criterion) => [
        employee.id,
        criterion.id,
        valueMap.get(`${employee.id}:${criterion.id}`) ?? null,
      ]),
    ),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function buildDataset(db, periodId) {
  const criteria = loadActiveCriteria(db);
  const employees = loadActiveEmployees(db);
  const assessmentRows = db
    .prepare(
      `SELECT a.employee_id, a.criterion_id, a.value
       FROM assessments a
       JOIN criteria c ON c.id = a.criterion_id
       JOIN employees e ON e.id = a.employee_id
       WHERE a.period_id = ? AND c.is_active = 1 AND e.archived_at IS NULL`,
    )
    .all(periodId);

  const valueMap = new Map(
    assessmentRows.map((row) => [`${row.employee_id}:${row.criterion_id}`, row.value]),
  );

  const expectedCount = criteria.length * employees.length;
  const filledCount = assessmentRows.length;
  const missing = [];

  const alternatives = employees.map((employee) => {
    const values = criteria.map((criterion) => {
      const value = valueMap.get(`${employee.id}:${criterion.id}`);
      if (value === undefined || value === null) {
        missing.push({ employee, criterion });
        return null;
      }
      return value;
    });
    return {
      employeeId: employee.id,
      code: employee.code,
      name: employee.name,
      department: employee.department,
      position: employee.position,
      values,
    };
  });

  const totalWeight = criteria.reduce((sum, criterion) => sum + Number(criterion.weight), 0);
  const issues = [];
  const checks = [];

  checks.push({
    key: 'alternatives',
    ok: employees.length >= 2,
    label: 'Minimal dua alternatif pegawai',
    detail:
      employees.length >= 2
        ? `${employees.length} pegawai aktif menjadi alternatif.`
        : 'Tambahkan pegawai aktif sebelum menghitung.',
  });
  if (employees.length < 2) {
    issues.push({
      code: 'ALTERNATIVES',
      message: 'TOPSIS memerlukan minimal dua pegawai aktif.',
      href: '/pegawai/baru',
    });
  }

  checks.push({
    key: 'criteria',
    ok: criteria.length > 0,
    label: 'Kriteria aktif tersedia',
    detail:
      criteria.length > 0
        ? `${criteria.length} kriteria aktif digunakan.`
        : 'Aktifkan atau tambahkan kriteria terlebih dahulu.',
  });
  if (criteria.length === 0) {
    issues.push({
      code: 'CRITERIA',
      message: 'Kriteria aktif belum tersedia.',
      href: '/kriteria',
    });
  }

  const invalidWeights = criteria.filter(
    (criterion) => !Number.isFinite(Number(criterion.weight)) || Number(criterion.weight) < 0,
  );
  const weightsOk = invalidWeights.length === 0 && totalWeight > 0;
  checks.push({
    key: 'weights',
    ok: weightsOk,
    label: 'Bobot kriteria valid',
    detail: !weightsOk
      ? 'Total bobot harus lebih dari nol dan tidak boleh negatif.'
      : totalWeight === 100
        ? 'Total bobot 100%.'
        : `Total bobot ${totalWeight}%, akan dinormalisasi menjadi 1 pada perhitungan.`,
  });
  if (!weightsOk) {
    issues.push({
      code: 'WEIGHTS',
      message: 'Bobot kriteria belum valid. Total bobot harus lebih dari nol.',
      href: '/bobot',
    });
  }

  const completenessOk = criteria.length > 0 && employees.length > 0 && missing.length === 0;
  checks.push({
    key: 'completeness',
    ok: completenessOk,
    label: 'Seluruh nilai penilaian lengkap',
    detail: completenessOk
      ? `${filledCount} dari ${expectedCount} nilai terisi.`
      : `${missing.length} nilai belum diisi dari ${expectedCount} sel yang dibutuhkan.`,
  });
  if (!completenessOk && criteria.length > 0 && employees.length > 0) {
    issues.push({
      code: 'INCOMPLETE',
      message: missing.length > 0
        ? `${missing.length} nilai penilaian belum diisi.`
        : 'Nilai penilaian belum lengkap.',
      href: `/penilaian?period=${periodId}`,
    });
  }

  const outOfScale = [];
  for (const employee of employees) {
    for (const criterion of criteria) {
      const value = valueMap.get(`${employee.id}:${criterion.id}`);
      if (value === undefined || value === null) continue;
      if (value < criterion.scale_min || value > criterion.scale_max) {
        outOfScale.push({ employee, criterion, value });
      }
    }
  }
  const scaleOk = outOfScale.length === 0;
  checks.push({
    key: 'scale',
    ok: scaleOk,
    label: 'Nilai berada dalam skala kriteria',
    detail: scaleOk
      ? 'Semua nilai sesuai batas skala yang ditetapkan.'
      : `${outOfScale.length} nilai berada di luar batas skala.`,
  });
  if (!scaleOk) {
    issues.push({
      code: 'SCALE',
      message: `${outOfScale.length} nilai berada di luar skala kriteria.`,
      href: `/penilaian?period=${periodId}`,
    });
  }

  const zeroDenominators = criteria.filter((_, criterionIndex) => {
    const denominator = Math.sqrt(
      employees.reduce((sum, employee) => {
        const value = Number(valueMap.get(`${employee.id}:${criteria[criterionIndex].id}`) ?? 0);
        return sum + value * value;
      }, 0),
    );
    return denominator < 1e-12;
  });
  const normalizationOk = zeroDenominators.length === 0;
  checks.push({
    key: 'normalization',
    ok: normalizationOk,
    label: 'Penyebut normalisasi dapat dihitung',
    detail: normalizationOk
      ? 'Tidak ada kolom kriteria yang seluruh nilainya nol.'
      : `Kolom ${zeroDenominators.map((criterion) => criterion.code).join(', ')} seluruhnya bernilai nol.`,
  });
  if (!normalizationOk) {
    issues.push({
      code: 'NORMALIZATION',
      message: 'Normalisasi tidak dapat dihitung karena ada kolom kriteria yang seluruhnya nol.',
      href: `/penilaian?period=${periodId}`,
    });
  }

  return {
    periodId,
    criteria,
    employees,
    valueMap,
    alternatives,
    expectedCount,
    filledCount,
    missing,
    totalWeight,
    issues,
    checks,
    ready: issues.length === 0,
    signature: buildSignature({ periodId, criteria, employees, valueMap }),
  };
}
