import { EMPLOYEE_STATUSES } from '../lib/validation.js';

export function listDepartments(db) {
  return db
    .prepare(
      `SELECT DISTINCT department FROM employees
       WHERE department <> ''
       ORDER BY department ASC`,
    )
    .all()
    .map((row) => row.department);
}

export function queryEmployees(db, { q, department, status, archived, page, pageSize }) {
  const conditions = [archived ? 'e.archived_at IS NOT NULL' : 'e.archived_at IS NULL'];
  const params = [];
  if (q) {
    conditions.push('(e.name LIKE ? OR e.code LIKE ? OR e.position LIKE ?)');
    const pattern = `%${q}%`;
    params.push(pattern, pattern, pattern);
  }
  if (department) {
    conditions.push('e.department = ?');
    params.push(department);
  }
  if (status) {
    conditions.push('e.status = ?');
    params.push(status);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;

  const total = db
    .prepare(`SELECT COUNT(*) AS total FROM employees e ${where}`)
    .get(...params).total;

  const employees = db
    .prepare(
      `SELECT e.*,
        (SELECT COUNT(*) FROM assessments a WHERE a.employee_id = e.id) AS assessment_count,
        (SELECT COUNT(*) FROM calculation_details d WHERE d.employee_id = e.id) AS run_count
       FROM employees e
       ${where}
       ORDER BY e.code ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize);

  return { employees, total };
}

export function normalizeEmployeeForm(body) {
  return {
    code: String(body.code ?? '').trim().toUpperCase(),
    name: String(body.name ?? '').trim(),
    gender: String(body.gender ?? '').trim(),
    position: String(body.position ?? '').trim(),
    department: String(body.department ?? '').trim(),
    status: String(body.status ?? 'aktif').trim(),
    notes: String(body.notes ?? '').trim(),
  };
}

export function validateEmployee(db, old, existingId = null) {
  const errors = {};
  if (!old.code) {
    errors.code = 'Kode pegawai wajib diisi.';
  } else if (old.code.length > 20) {
    errors.code = 'Kode pegawai maksimal 20 karakter.';
  } else if (!/^[A-Z0-9][A-Z0-9._/-]*$/.test(old.code)) {
    errors.code = 'Kode hanya boleh berisi huruf, angka, titik, garis miring, garis bawah, atau tanda hubung.';
  } else {
    const duplicate = db
      .prepare('SELECT id FROM employees WHERE code = ? AND (? IS NULL OR id <> ?)')
      .get(old.code, existingId, existingId);
    if (duplicate) {
      errors.code = 'Kode pegawai sudah digunakan.';
    }
  }

  if (!old.name) {
    errors.name = 'Nama lengkap wajib diisi.';
  } else if (old.name.length > 100) {
    errors.name = 'Nama maksimal 100 karakter.';
  }

  if (old.gender && !['L', 'P'].includes(old.gender)) {
    errors.gender = 'Jenis kelamin tidak valid.';
  }

  if (!old.position) {
    errors.position = 'Jabatan wajib diisi.';
  } else if (old.position.length > 100) {
    errors.position = 'Jabatan maksimal 100 karakter.';
  }

  if (!old.department) {
    errors.department = 'Departemen atau divisi wajib diisi.';
  } else if (old.department.length > 100) {
    errors.department = 'Departemen maksimal 100 karakter.';
  }

  if (!EMPLOYEE_STATUSES.some((item) => item.value === old.status)) {
    errors.status = 'Status pegawai tidak valid.';
  }

  if (old.notes.length > 500) {
    errors.notes = 'Keterangan maksimal 500 karakter.';
  }

  return errors;
}

export function loadEmployeeProfile(db, employeeId, activePeriod) {
  const assessmentCount = db
    .prepare('SELECT COUNT(*) AS total FROM assessments WHERE employee_id = ?')
    .get(employeeId).total;
  const runCount = db
    .prepare('SELECT COUNT(*) AS total FROM calculation_details WHERE employee_id = ?')
    .get(employeeId).total;

  let currentValues = [];
  if (activePeriod) {
    currentValues = db
      .prepare(
        `SELECT c.code, c.name, c.unit, a.value
         FROM assessments a
         JOIN criteria c ON c.id = a.criterion_id
         WHERE a.period_id = ? AND a.employee_id = ? AND c.is_active = 1
         ORDER BY c.sort_order ASC`,
      )
      .all(activePeriod.id, employeeId);
  }

  const periodHistory = db
    .prepare(
      `SELECT p.id, p.name, p.start_date, p.end_date, p.is_active,
         COUNT(c.id) AS filled
       FROM assessment_periods p
       LEFT JOIN assessments a ON a.period_id = p.id AND a.employee_id = ?
       LEFT JOIN criteria c ON c.id = a.criterion_id AND c.is_active = 1
       GROUP BY p.id
       ORDER BY p.start_date DESC, p.id DESC`,
    )
    .all(employeeId);

  const rankHistory = db
    .prepare(
      `SELECT r.id AS run_id, r.period_id, r.period_name, r.calculated_at,
         d.id AS detail_id, d.rank, d.preference
       FROM calculation_details d
       JOIN calculation_runs r ON r.id = d.run_id
       WHERE d.employee_id = ?
         AND r.id = (SELECT MAX(id) FROM calculation_runs WHERE period_id = r.period_id)
       ORDER BY r.calculated_at DESC`,
    )
    .all(employeeId);

  const activeCriteriaCount = db
    .prepare('SELECT COUNT(*) AS total FROM criteria WHERE is_active = 1')
    .get().total;

  return {
    assessmentCount,
    runCount,
    currentValues,
    periodHistory,
    rankHistory,
    activeCriteriaCount,
  };
}
