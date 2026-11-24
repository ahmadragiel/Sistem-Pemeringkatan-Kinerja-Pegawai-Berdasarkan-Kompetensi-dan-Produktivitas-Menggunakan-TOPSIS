import { Router } from 'express';
import { buildDataset } from '../services/dataset.js';
import {
  getLatestRun,
  getRunDetails,
  parseDetail,
  runIsStale,
} from '../services/calculation.js';
import { recentActivities } from '../services/activity.js';
import { buildProcessView } from '../services/process-view.js';

export function dashboardRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const activePeriod = res.locals.activePeriod;
    const employeeCount = db
      .prepare('SELECT COUNT(*) AS total FROM employees WHERE archived_at IS NULL')
      .get().total;
    const archivedCount = db
      .prepare('SELECT COUNT(*) AS total FROM employees WHERE archived_at IS NOT NULL')
      .get().total;
    const criteriaCount = db
      .prepare('SELECT COUNT(*) AS total FROM criteria WHERE is_active = 1')
      .get().total;
    const periodCount = db
      .prepare('SELECT COUNT(*) AS total FROM assessment_periods')
      .get().total;

    let dataset = null;
    let latestRun = null;
    let top = null;
    let chartRows = [];
    let stale = false;
    let assessmentPercent = 0;

    if (activePeriod) {
      dataset = buildDataset(db, activePeriod.id);
      assessmentPercent = dataset.expectedCount > 0
        ? (dataset.filledCount / dataset.expectedCount) * 100
        : 0;

      latestRun = getLatestRun(db, activePeriod.id);
      if (latestRun) {
        const rows = getRunDetails(db, latestRun.id).map(parseDetail);
        chartRows = rows.slice(0, 8);
        top = chartRows[0] ?? null;
        stale = runIsStale(db, latestRun);
      }
    }

    let calculationStatus = 'no-period';
    if (activePeriod) {
      calculationStatus = latestRun ? (stale ? 'stale' : 'calculated') : 'not-calculated';
    }

    const activities = recentActivities(db, 7);
    const maxPreference = chartRows.length > 0
      ? Math.max(...chartRows.map((row) => row.preference), 0.0001)
      : 1;
    const processView = buildProcessView({
      dataset,
      activePeriod,
      latestRun,
      stale,
      outputTop: top,
    });

    res.render('dashboard', {
      page: {
        title: 'Dashboard',
        active: 'dashboard',
        crumbs: [{ label: 'Dashboard' }],
      },
      employeeCount,
      archivedCount,
      criteriaCount,
      periodCount,
      assessmentPercent,
      dataset,
      latestRun,
      top,
      chartRows,
      maxPreference,
      stale,
      calculationStatus,
      activities,
      processView,
    });
  });

  return router;
}
