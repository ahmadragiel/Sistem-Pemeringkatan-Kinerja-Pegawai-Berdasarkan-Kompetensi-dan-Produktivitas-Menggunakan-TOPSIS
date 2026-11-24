import { nowIso, inTransaction } from '../db/index.js';
import { calculateTopsis, TopsisError } from './topsis.js';
import { buildDataset } from './dataset.js';
import { logActivity } from './activity.js';

export function runCalculation(db, periodId, { notes = null } = {}) {
  const period = db.prepare('SELECT * FROM assessment_periods WHERE id = ?').get(periodId);
  if (!period) {
    throw new TopsisError('Periode penilaian tidak ditemukan.');
  }

  const dataset = buildDataset(db, periodId);
  if (!dataset.ready) {
    throw new TopsisError(
      dataset.issues[0]?.message ?? 'Data belum memenuhi syarat perhitungan.',
      dataset.issues.map((issue) => issue.message),
    );
  }

  const result = calculateTopsis({
    criteria: dataset.criteria.map((criterion) => ({
      id: criterion.id,
      code: criterion.code,
      name: criterion.name,
      category: criterion.category,
      attribute: criterion.attribute,
      weight: criterion.weight,
      scaleMin: criterion.scale_min,
      scaleMax: criterion.scale_max,
      unit: criterion.unit,
      sortOrder: criterion.sort_order,
    })),
    alternatives: dataset.alternatives,
  });

  return inTransaction(db, () => {
    const runInsert = db
      .prepare(
        `INSERT INTO calculation_runs
          (period_id, period_name, method, data_signature, employee_count, criteria_count, weight_total, notes, calculated_at)
         VALUES (?, ?, 'TOPSIS', ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        periodId,
        period.name,
        dataset.signature,
        dataset.employees.length,
        dataset.criteria.length,
        result.weights.total,
        notes,
        nowIso(),
      );

    const runId = Number(runInsert.lastInsertRowid);

    const insertCriterion = db.prepare(
      `INSERT INTO calculation_criteria
        (run_id, criterion_id, code, name, category, attribute, weight_raw, weight_normalized, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    result.criteria.forEach((criterion, index) => {
      insertCriterion.run(
        runId,
        criterion.id,
        criterion.code,
        criterion.name,
        criterion.category,
        criterion.attribute,
        criterion.weight,
        result.weights.normalized[index],
        index + 1,
      );
    });

    const insertDetail = db.prepare(
      `INSERT INTO calculation_details
        (run_id, employee_id, employee_code, employee_name, employee_department, employee_position,
         rank, preference, d_plus, d_minus, values_json, normalized_json, weighted_json, contributions_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const row of result.rows) {
      insertDetail.run(
        runId,
        row.employeeId,
        row.code,
        row.name,
        row.department,
        row.position,
        row.rank,
        row.preference,
        row.dPlus,
        row.dMinus,
        JSON.stringify(row.values),
        JSON.stringify(row.normalized),
        JSON.stringify(row.weighted),
        JSON.stringify(row.contributions),
      );
    }

    logActivity(
      db,
      'calculation',
      `Perhitungan TOPSIS untuk ${period.name} dijalankan: ${dataset.employees.length} pegawai, ${dataset.criteria.length} kriteria.`,
    );

    return runId;
  });
}

export function getRun(db, runId) {
  return db.prepare('SELECT * FROM calculation_runs WHERE id = ?').get(runId) ?? null;
}

export function getLatestRun(db, periodId) {
  return (
    db
      .prepare(
        'SELECT * FROM calculation_runs WHERE period_id = ? ORDER BY id DESC LIMIT 1',
      )
      .get(periodId) ?? null
  );
}

export function listRuns(db, periodId, limit = 20) {
  return db
    .prepare(
      `SELECT * FROM calculation_runs
       WHERE period_id = ?
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(periodId, limit);
}

export function getRunCriteria(db, runId) {
  return db
    .prepare(
      `SELECT * FROM calculation_criteria
       WHERE run_id = ?
       ORDER BY sort_order ASC, code ASC`,
    )
    .all(runId);
}

export function getRunDetails(db, runId) {
  return db
    .prepare(
      `SELECT * FROM calculation_details
       WHERE run_id = ?
       ORDER BY rank ASC, employee_code ASC`,
    )
    .all(runId);
}

export function getRunDetailForEmployee(db, runId, employeeId) {
  return (
    db
      .prepare(
        'SELECT * FROM calculation_details WHERE run_id = ? AND employee_id = ?',
      )
      .get(runId, employeeId) ?? null
  );
}

export function parseDetail(detail) {
  if (!detail) return null;
  return {
    ...detail,
    values: JSON.parse(detail.values_json),
    normalized: JSON.parse(detail.normalized_json),
    weighted: JSON.parse(detail.weighted_json),
    contributions: JSON.parse(detail.contributions_json),
  };
}

export function runIsStale(db, run) {
  if (!run) return false;
  const dataset = buildDataset(db, run.period_id);
  return dataset.signature !== run.data_signature;
}

export function buildIdealSolutions(criteria, details) {
  const parsed = details.map(parseDetail);
  const positive = criteria.map((criterion, index) => {
    const values = parsed.map((detail) => detail.weighted[index]);
    return criterion.attribute === 'cost' ? Math.min(...values) : Math.max(...values);
  });
  const negative = criteria.map((criterion, index) => {
    const values = parsed.map((detail) => detail.weighted[index]);
    return criterion.attribute === 'cost' ? Math.max(...values) : Math.min(...values);
  });
  return { positive, negative, parsed };
}
