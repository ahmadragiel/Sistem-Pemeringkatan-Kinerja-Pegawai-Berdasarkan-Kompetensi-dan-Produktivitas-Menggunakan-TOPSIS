import { Router } from 'express';
import {
  getLatestRun,
  getRunCriteria,
  getRunDetails,
  parseDetail,
  runIsStale,
} from '../services/calculation.js';
import { listPeriods, resolvePeriod } from '../services/dataset.js';
import { buildReportCsv, csvFileName } from '../services/csv.js';
import { fileStamp } from '../lib/format.js';

export function reportsRouter(db) {
  const router = Router();

  function reportData(periodId) {
    const run = getLatestRun(db, periodId);
    if (!run) {
      return { run: null, criteria: [], details: [], stale: false };
    }
    return {
      run,
      criteria: getRunCriteria(db, run.id),
      details: getRunDetails(db, run.id).map(parseDetail),
      stale: runIsStale(db, run),
    };
  }

  router.get('/', (req, res) => {
    const periods = listPeriods(db);
    if (periods.length === 0) {
      res.render('reports/index', {
        page: {
          title: 'Laporan',
          active: 'reports',
          crumbs: [{ label: 'Analisis' }, { label: 'Laporan' }],
        },
        periods: [],
        period: null,
        run: null,
        criteria: [],
        details: [],
        stale: false,
        generatedAt: new Date(),
      });
      return;
    }

    const { period } = resolvePeriod(db, req.query.period);
    const data = reportData(period.id);

    res.render('reports/index', {
      page: {
        title: 'Laporan',
        active: 'reports',
        crumbs: [{ label: 'Analisis' }, { label: 'Laporan' }],
      },
      periods,
      period,
      run: data.run,
      criteria: data.criteria,
      details: data.details,
      stale: data.stale,
      generatedAt: new Date(),
    });
  });

  router.get('/export.csv', (req, res) => {
    const resolved = resolvePeriod(db, req.query.period);
    if (!resolved.period) {
      res.setFlash('error', 'Periode penilaian belum tersedia.');
      res.redirect('/laporan');
      return;
    }
    const data = reportData(resolved.period.id);
    if (!data.run) {
      res.setFlash('error', `Belum ada hasil perhitungan untuk ${resolved.period.name}.`);
      res.redirect(`/laporan?period=${resolved.period.id}`);
      return;
    }

    const csv = buildReportCsv({
      run: data.run,
      criteria: data.criteria,
      details: getRunDetails(db, data.run.id),
    });
    const filename = csvFileName('laporan-topsis', data.run.period_name, fileStamp());
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  });

  return router;
}
