import path from 'node:path';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { flashMiddleware } from './middleware/flash.js';
import { contextMiddleware } from './middleware/context.js';
import { dashboardRouter } from './routes/dashboard.js';
import { employeesRouter } from './routes/employees.js';
import { criteriaRouter } from './routes/criteria.js';
import { weightsRouter } from './routes/weights.js';
import { periodsRouter } from './routes/periods.js';
import { assessmentsRouter } from './routes/assessments.js';
import { calculationsRouter } from './routes/calculations.js';
import { rankingsRouter } from './routes/rankings.js';
import { reportsRouter } from './routes/reports.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', path.join(projectRoot, 'views'));
  app.locals.projectRoot = projectRoot;

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; font-src 'self'; form-action 'self'; base-uri 'self'; frame-ancestors 'none'",
    );
    next();
  });

  app.use(
    express.static(path.join(projectRoot, 'public'), {
      maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(flashMiddleware);
  app.use(contextMiddleware(db));

  app.use('/', dashboardRouter(db));
  app.use('/pegawai', employeesRouter(db));
  app.use('/kriteria', criteriaRouter(db));
  app.use('/bobot', weightsRouter(db));
  app.use('/periode', periodsRouter(db));
  app.use('/penilaian', assessmentsRouter(db));
  app.use('/perhitungan', calculationsRouter(db));
  app.use('/peringkat', rankingsRouter(db));
  app.use('/laporan', reportsRouter(db));

  app.use((req, res) => {
    res.status(404).render('errors/404', {
      page: { title: 'Halaman tidak ditemukan', active: '', crumbs: [{ label: 'Tidak ditemukan' }] },
    });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    console.error(error);
    res.status(500).render('errors/500', {
      page: { title: 'Terjadi kesalahan', active: '', crumbs: [{ label: 'Kesalahan' }] },
    });
  });

  return app;
}
