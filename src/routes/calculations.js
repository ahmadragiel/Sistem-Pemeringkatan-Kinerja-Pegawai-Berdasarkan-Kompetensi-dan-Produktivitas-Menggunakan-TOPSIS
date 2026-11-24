import { Router } from 'express';
import {
  getLatestRun,
  getRun,
  getRunCriteria,
  getRunDetails,
  listRuns,
  parseDetail,
  runIsStale,
  buildIdealSolutions,
  runCalculation,
} from '../services/calculation.js';
import { buildDataset, listPeriods, resolvePeriod } from '../services/dataset.js';
import { TopsisError } from '../services/topsis.js';

function parseId(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function notFound(res) {
  return res.status(404).render('errors/404', {
    page: {
      title: 'Perhitungan tidak ditemukan',
      active: 'calculations',
      crumbs: [{ label: 'Perhitungan TOPSIS', href: '/perhitungan' }, { label: 'Tidak ditemukan' }],
    },
  });
}

export function calculationsRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const periods = listPeriods(db);
    if (periods.length === 0) {
      res.render('calculations/index', {
        page: {
          title: 'Perhitungan TOPSIS',
          active: 'calculations',
          crumbs: [{ label: 'Analisis' }, { label: 'Perhitungan TOPSIS' }],
        },
        periods: [],
        period: null,
        dataset: null,
        latestRun: null,
        stale: false,
        runs: [],
      });
      return;
    }

    const { period } = resolvePeriod(db, req.query.period);
    const dataset = buildDataset(db, period.id);
    const latestRun = getLatestRun(db, period.id);
    const stale = latestRun ? runIsStale(db, latestRun) : false;
    const runs = listRuns(db, period.id, 12);

    res.render('calculations/index', {
      page: {
        title: 'Perhitungan TOPSIS',
        active: 'calculations',
        crumbs: [{ label: 'Analisis' }, { label: 'Perhitungan TOPSIS' }],
      },
      periods,
      period,
      dataset,
      latestRun,
      stale,
      runs,
    });
  });

  router.post('/', (req, res) => {
    const periodId = parseId(req.body.period_id);
    const period = periodId
      ? db.prepare('SELECT * FROM assessment_periods WHERE id = ?').get(periodId)
      : null;

    if (!period) {
      res.setFlash('error', 'Periode penilaian tidak ditemukan.');
      res.redirect('/perhitungan');
      return;
    }

    try {
      const runId = runCalculation(db, period.id, { notes: 'Dijalankan melalui halaman perhitungan.' });
      res.setFlash(
        'success',
        `Perhitungan TOPSIS untuk ${period.name} berhasil disimpan sebagai riwayat.`,
      );
      res.redirect(`/perhitungan/${runId}?period=${period.id}`);
    } catch (error) {
      if (error instanceof TopsisError) {
        res.setFlash('error', `Perhitungan belum dapat dijalankan. ${error.message}`);
        res.redirect(`/perhitungan?period=${period.id}`);
        return;
      }
      throw error;
    }
  });

  router.get('/:id', (req, res) => {
    const runId = parseId(req.params.id);
    if (!runId) return notFound(res);

    const run = getRun(db, runId);
    if (!run) return notFound(res);

    const criteria = getRunCriteria(db, run.id);
    const rawDetails = getRunDetails(db, run.id);
    const { positive, negative, parsed } = buildIdealSolutions(criteria, rawDetails);
    const matrixDetails = [...parsed].sort((a, b) =>
      a.employee_code.localeCompare(b.employee_code, 'id'),
    );
    const ranking = [...parsed].sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.employee_code.localeCompare(b.employee_code, 'id');
    });

    const denominators = criteria.map((_, criterionIndex) =>
      Math.sqrt(
        matrixDetails.reduce(
          (sum, detail) => sum + detail.values[criterionIndex] ** 2,
          0,
        ),
      ),
    );

    const stale = runIsStale(db, run);

    res.render('calculations/detail', {
      page: {
        title: `Perhitungan #${run.id}`,
        active: 'calculations',
        crumbs: [
          { label: 'Analisis' },
          { label: 'Perhitungan TOPSIS', href: `/perhitungan?period=${run.period_id}` },
          { label: `Run #${run.id}` },
        ],
      },
      run,
      criteria,
      matrixDetails,
      ranking,
      idealPositive: positive,
      idealNegative: negative,
      denominators,
      stale,
    });
  });

  return router;
}
