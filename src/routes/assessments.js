import { Router } from 'express';
import { nowIso, inTransaction } from '../db/index.js';
import { logActivity } from '../services/activity.js';
import { listPeriods, resolvePeriod, getPeriod } from '../services/dataset.js';
import { buildPagination } from '../lib/pagination.js';
import { countFilledValues, prepareAssessmentValues } from '../services/assessment-values.js';

const PAGE_SIZE = 12;

function parseId(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function notFound(res, title = 'Data tidak ditemukan') {
  return res.status(404).render('errors/404', {
    page: {
      title,
      active: 'assessments',
      crumbs: [{ label: 'Penilaian pegawai', href: '/penilaian' }, { label: 'Tidak ditemukan' }],
    },
  });
}

export function assessmentsRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const periods = listPeriods(db);
    if (periods.length === 0) {
      res.render('assessments/index', {
        page: {
          title: 'Penilaian Pegawai',
          active: 'assessments',
          crumbs: [{ label: 'Penilaian' }, { label: 'Penilaian pegawai' }],
        },
        periods: [],
        period: null,
        criteria: [],
        employees: [],
        pagination: null,
        summary: null,
        filters: { q: '' },
        archivedCount: 0,
      });
      return;
    }

    const resolved = resolvePeriod(db, req.query.period);
    const period = resolved.period;
    const q = String(req.query.q ?? '').trim();
    const requestedPage = Math.max(1, Number(req.query.hal) || 1);

    const criteria = db
      .prepare('SELECT * FROM criteria WHERE is_active = 1 ORDER BY sort_order ASC, code ASC')
      .all();

    const conditions = ['e.archived_at IS NULL'];
    const params = [];
    if (q) {
      conditions.push('(e.name LIKE ? OR e.code LIKE ? OR e.position LIKE ?)');
      const pattern = `%${q}%`;
      params.push(pattern, pattern, pattern);
    }

    const totalEmployees = db
      .prepare(
        `SELECT COUNT(*) AS total FROM employees e
         WHERE e.archived_at IS NULL`,
      )
      .get().total;

    const filteredTotal = db
      .prepare(`SELECT COUNT(*) AS total FROM employees e WHERE ${conditions.join(' AND ')}`)
      .get(...params).total;

    const pagination = buildPagination({
      total: filteredTotal,
      page: requestedPage,
      pageSize: PAGE_SIZE,
      basePath: '/penilaian',
      query: { period: period.id, q },
    });

    const employees = db
      .prepare(
        `SELECT e.* FROM employees e
         WHERE ${conditions.join(' AND ')}
         ORDER BY e.code ASC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, PAGE_SIZE, (pagination.page - 1) * PAGE_SIZE);

    const assessmentRows = db
      .prepare(
        `SELECT a.employee_id, a.criterion_id, a.value
         FROM assessments a
         JOIN criteria c ON c.id = a.criterion_id
         JOIN employees e ON e.id = a.employee_id
         WHERE a.period_id = ? AND c.is_active = 1 AND e.archived_at IS NULL`,
      )
      .all(period.id);

    const valueMap = new Map(
      assessmentRows.map((row) => [`${row.employee_id}:${row.criterion_id}`, row.value]),
    );

    const rows = employees.map((employee) => {
      const values = criteria.map((criterion) => ({
        criterionId: criterion.id,
        value: valueMap.get(`${employee.id}:${criterion.id}`) ?? null,
      }));
      const filled = values.filter((item) => item.value !== null).length;
      return { ...employee, values, filled };
    });

    const filledTotal = assessmentRows.length;
    const expectedTotal = totalEmployees * criteria.length;
    const archivedCount = db
      .prepare('SELECT COUNT(*) AS total FROM employees WHERE archived_at IS NOT NULL')
      .get().total;

    res.render('assessments/index', {
      page: {
        title: 'Penilaian Pegawai',
        active: 'assessments',
        crumbs: [{ label: 'Penilaian' }, { label: 'Penilaian pegawai' }],
      },
      periods,
      period,
      criteria,
      employees: rows,
      pagination,
      summary: {
        totalEmployees,
        expectedTotal,
        filledTotal,
        missingTotal: expectedTotal - filledTotal,
      },
      filters: { q },
      archivedCount,
    });
  });

  router.get('/:id', (req, res) => {
    const employeeId = parseId(req.params.id);
    if (!employeeId) return notFound(res, 'Pegawai tidak ditemukan');

    const resolved = resolvePeriod(db, req.query.period);
    if (!resolved.period) {
      res.setFlash('error', 'Periode penilaian belum tersedia. Buat periode terlebih dahulu.');
      res.redirect('/periode/baru');
      return;
    }
    const period = resolved.period;
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
    if (!employee) return notFound(res, 'Pegawai tidak ditemukan');
    if (employee.archived_at) {
      res.setFlash('error', 'Pegawai yang diarsipkan tidak dapat diubah nilai penilaiannya.');
      res.redirect(`/penilaian?period=${period.id}`);
      return;
    }

    const criteria = db
      .prepare('SELECT * FROM criteria WHERE is_active = 1 ORDER BY sort_order ASC, code ASC')
      .all();

    const existing = db
      .prepare(
        `SELECT a.employee_id, a.criterion_id, a.value
         FROM assessments a
         JOIN criteria c ON c.id = a.criterion_id
         JOIN employees e ON e.id = a.employee_id
         WHERE a.period_id = ? AND a.employee_id = ? AND c.is_active = 1 AND e.archived_at IS NULL`,
      )
      .all(period.id, employeeId);

    const values = new Map(existing.map((row) => [row.criterion_id, row.value]));
    const filled = existing.length;

    res.render('assessments/form', {
      page: {
        title: `Nilai ${employee.name}`,
        active: 'assessments',
        crumbs: [
          { label: 'Penilaian' },
          { label: 'Penilaian pegawai', href: `/penilaian?period=${period.id}` },
          { label: employee.code },
        ],
      },
      employee,
      period,
      criteria,
      values,
      filled,
      errors: {},
    });
  });

  router.post('/:id', (req, res) => {
    const employeeId = parseId(req.params.id);
    if (!employeeId) return notFound(res, 'Pegawai tidak ditemukan');

    const periodId = parseId(req.body.period_id);
    const period = periodId ? getPeriod(db, periodId) : null;
    if (!period) {
      res.setFlash('error', 'Periode penilaian tidak ditemukan.');
      res.redirect('/penilaian');
      return;
    }

    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
    if (!employee) return notFound(res, 'Pegawai tidak ditemukan');
    if (employee.archived_at) {
      res.setFlash('error', 'Pegawai yang diarsipkan tidak dapat diberi nilai.');
      res.redirect(`/penilaian?period=${period.id}`);
      return;
    }

    const criteria = db
      .prepare('SELECT * FROM criteria WHERE is_active = 1 ORDER BY sort_order ASC, code ASC')
      .all();

    const { prepared, errors, oldValues } = prepareAssessmentValues(criteria, req.body);

    if (Object.keys(errors).length > 0) {
      const filled = countFilledValues(oldValues);
      res.status(422).render('assessments/form', {
        page: {
          title: `Nilai ${employee.name}`,
          active: 'assessments',
          crumbs: [
            { label: 'Penilaian' },
            { label: 'Penilaian pegawai', href: `/penilaian?period=${period.id}` },
            { label: employee.code },
          ],
        },
        employee,
        period,
        criteria,
        values: oldValues,
        filled,
        errors,
      });
      return;
    }

    let filledCount = 0;
    inTransaction(db, () => {
      const upsert = db.prepare(
        `INSERT INTO assessments (period_id, employee_id, criterion_id, value, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (period_id, employee_id, criterion_id)
         DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      );
      const remove = db.prepare(
        'DELETE FROM assessments WHERE period_id = ? AND employee_id = ? AND criterion_id = ?',
      );
      for (const item of prepared) {
        if (item.value === null) {
          remove.run(period.id, employeeId, item.criterion.id);
        } else {
          filledCount += 1;
          upsert.run(period.id, employeeId, item.criterion.id, item.value, nowIso(), nowIso());
        }
      }
      logActivity(
        db,
        'assessment',
        `Nilai ${employee.code} ${employee.name} untuk ${period.name} disimpan (${filledCount} dari ${criteria.length} terisi).`,
      );
    });

    const missing = criteria.length - filledCount;
    if (missing > 0) {
      res.setFlash(
        'info',
        `Nilai ${employee.name} disimpan. Masih ada ${missing} kriteria belum diisi, sehingga TOPSIS belum dapat dihitung.`,
      );
    } else {
      res.setFlash('success', `Nilai ${employee.name} lengkap untuk seluruh kriteria aktif.`);
    }
    res.redirect(`/penilaian?period=${period.id}`);
  });

  return router;
}
