import { Router } from 'express';
import {
  getRun,
  getRunCriteria,
  getRunDetails,
  getLatestRun,
  listRuns,
  parseDetail,
  runIsStale,
} from '../services/calculation.js';
import { resolvePeriod, getPeriod, listPeriods } from '../services/dataset.js';
import { buildRankingCsv, csvFileName } from '../services/csv.js';
import { fileStamp } from '../lib/format.js';

function parseId(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function notFound(res, title = 'Hasil tidak ditemukan') {
  return res.status(404).render('errors/404', {
    page: {
      title,
      active: 'rankings',
      crumbs: [{ label: 'Hasil pemeringkatan', href: '/peringkat' }, { label: 'Tidak ditemukan' }],
    },
  });
}

export function rankingsRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const periods = listPeriods(db);
    if (periods.length === 0) {
      res.render('rankings/index', {
        page: {
          title: 'Hasil Pemeringkatan',
          active: 'rankings',
          crumbs: [{ label: 'Analisis' }, { label: 'Hasil pemeringkatan' }],
        },
        periods: [],
        period: null,
        run: null,
        rows: [],
        stale: false,
        q: '',
        totalRows: 0,
        runs: [],
      });
      return;
    }

    const resolved = resolvePeriod(db, req.query.period);
    let period = resolved.period;

    const requestedRunId = parseId(req.query.run);
    let run = requestedRunId ? getRun(db, requestedRunId) : null;
    if (run) {
      period = getPeriod(db, run.period_id);
    } else {
      run = getLatestRun(db, period.id);
    }

    const q = String(req.query.q ?? '').trim();
    let rows = [];
    let stale = false;

    if (run) {
      rows = getRunDetails(db, run.id).map(parseDetail);
      if (q) {
        const needle = q.toLowerCase();
        rows = rows.filter(
          (row) =>
            row.employee_code.toLowerCase().includes(needle) ||
            row.employee_name.toLowerCase().includes(needle) ||
            row.employee_department.toLowerCase().includes(needle),
        );
      }
      stale = runIsStale(db, run);
    }

    res.render('rankings/index', {
      page: {
        title: 'Hasil Pemeringkatan',
        active: 'rankings',
        crumbs: [{ label: 'Analisis' }, { label: 'Hasil pemeringkatan' }],
      },
      periods,
      period,
      run,
      rows,
      stale,
      q,
      totalRows: run ? getRunDetails(db, run.id).length : 0,
      runs: listRuns(db, period.id, 20),
    });
  });

  router.get('/export.csv', (req, res) => {
    const runId = parseId(req.query.run);
    if (!runId) {
      res.setFlash('error', 'Pilih hasil perhitungan yang akan diekspor.');
      res.redirect('/peringkat');
      return;
    }
    const run = getRun(db, runId);
    if (!run) return notFound(res, 'Hasil perhitungan tidak ditemukan');

    const criteria = getRunCriteria(db, run.id);
    const details = getRunDetails(db, run.id);
    const csv = buildRankingCsv({ run, criteria, details });
    const filename = csvFileName('peringkat-topsis', run.period_name, fileStamp());
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  });

  router.get('/:runId/detail/:detailId', (req, res) => {
    const runId = parseId(req.params.runId);
    const detailId = parseId(req.params.detailId);
    if (!runId || !detailId) return notFound(res);

    const run = getRun(db, runId);
    if (!run) return notFound(res);
    const detail = db
      .prepare('SELECT * FROM calculation_details WHERE id = ? AND run_id = ?')
      .get(detailId, runId);
    if (!detail) return notFound(res);

    const parsed = parseDetail(detail);
    const criteria = getRunCriteria(db, run.id);
    const stale = runIsStale(db, run);

    res.render('rankings/detail', {
      page: {
        title: `Detail ${parsed.employee_name}`,
        active: 'rankings',
        crumbs: [
          { label: 'Analisis' },
          { label: 'Hasil pemeringkatan', href: `/peringkat?period=${run.period_id}` },
          { label: parsed.employee_code },
        ],
      },
      run,
      detail: parsed,
      criteria,
      stale,
    });
  });

  return router;
}
