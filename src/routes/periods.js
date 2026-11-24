import { Router } from 'express';
import { nowIso, inTransaction } from '../db/index.js';
import { logActivity } from '../services/activity.js';
import {
  activatePeriod,
  normalizePeriodForm,
  validatePeriod,
} from '../services/period-form.js';

function parseId(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function notFound(res) {
  return res.status(404).render('errors/404', {
    page: {
      title: 'Periode tidak ditemukan',
      active: 'periods',
      crumbs: [{ label: 'Periode penilaian', href: '/periode' }, { label: 'Tidak ditemukan' }],
    },
  });
}

export function periodsRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const periods = db
      .prepare(
        `SELECT p.*,
          (SELECT COUNT(*) FROM assessments a WHERE a.period_id = p.id) AS assessment_count,
          (SELECT COUNT(*) FROM calculation_runs r WHERE r.period_id = p.id) AS run_count
         FROM assessment_periods p
         ORDER BY p.is_active DESC, p.start_date DESC, p.id DESC`,
      )
      .all();

    res.render('periods/index', {
      page: {
        title: 'Periode Penilaian',
        active: 'periods',
        crumbs: [{ label: 'Data master' }, { label: 'Periode penilaian' }],
      },
      periods,
    });
  });

  router.get('/baru', (req, res) => {
    const hasPeriods = db.prepare('SELECT COUNT(*) AS total FROM assessment_periods').get().total > 0;
    res.render('periods/form', {
      page: {
        title: 'Tambah Periode',
        active: 'periods',
        crumbs: [
          { label: 'Data master' },
          { label: 'Periode penilaian', href: '/periode' },
          { label: 'Tambah periode' },
        ],
      },
      mode: 'create',
      period: {
        name: '',
        start_date: '',
        end_date: '',
        notes: '',
        is_active: hasPeriods ? 0 : 1,
      },
      errors: {},
      hasPeriods,
    });
  });

  router.post('/', (req, res) => {
    const old = normalizePeriodForm(req.body);
    const hasPeriods = db.prepare('SELECT COUNT(*) AS total FROM assessment_periods').get().total > 0;
    if (!hasPeriods) old.is_active = true;
    const errors = validatePeriod(db, old);

    if (Object.keys(errors).length > 0) {
      res.status(422).render('periods/form', {
        page: {
          title: 'Tambah Periode',
          active: 'periods',
          crumbs: [
            { label: 'Data master' },
            { label: 'Periode penilaian', href: '/periode' },
            { label: 'Tambah periode' },
          ],
        },
        mode: 'create',
        period: { ...old, is_active: old.is_active ? 1 : 0 },
        errors,
        hasPeriods,
      });
      return;
    }

    const id = inTransaction(db, () => {
      if (old.is_active) {
        db.prepare(
          'UPDATE assessment_periods SET is_active = 0, updated_at = ? WHERE is_active = 1',
        ).run(nowIso());
      }
      const result = db
        .prepare(
          `INSERT INTO assessment_periods (name, start_date, end_date, is_active, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          old.name,
          old.start_date || null,
          old.end_date || null,
          old.is_active ? 1 : 0,
          old.notes || null,
          nowIso(),
          nowIso(),
        );
      logActivity(
        db,
        'period',
        `Periode ${old.name} ditambahkan${old.is_active ? ' dan ditetapkan aktif' : ''}.`,
      );
      return Number(result.lastInsertRowid);
    });

    res.setFlash('success', `Periode ${old.name} berhasil ditambahkan.`);
    res.redirect('/periode');
  });

  router.get('/:id/ubah', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const period = db.prepare('SELECT * FROM assessment_periods WHERE id = ?').get(id);
    if (!period) return notFound(res);

    res.render('periods/form', {
      page: {
        title: 'Ubah Periode',
        active: 'periods',
        crumbs: [
          { label: 'Data master' },
          { label: 'Periode penilaian', href: '/periode' },
          { label: period.name },
          { label: 'Ubah' },
        ],
      },
      mode: 'edit',
      period,
      errors: {},
      hasPeriods: true,
    });
  });

  router.post('/:id', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const existing = db.prepare('SELECT * FROM assessment_periods WHERE id = ?').get(id);
    if (!existing) return notFound(res);

    const old = normalizePeriodForm(req.body);
    const errors = validatePeriod(db, old, id, existing);

    if (Object.keys(errors).length > 0) {
      res.status(422).render('periods/form', {
        page: {
          title: 'Ubah Periode',
          active: 'periods',
          crumbs: [
            { label: 'Data master' },
            { label: 'Periode penilaian', href: '/periode' },
            { label: existing.name },
            { label: 'Ubah' },
          ],
        },
        mode: 'edit',
        period: { ...old, id, is_active: old.is_active ? 1 : 0 },
        errors,
        hasPeriods: true,
      });
      return;
    }

    inTransaction(db, () => {
      if (old.is_active) {
        db.prepare(
          'UPDATE assessment_periods SET is_active = 0, updated_at = ? WHERE is_active = 1 AND id <> ?',
        ).run(nowIso(), id);
      }
      db.prepare(
        `UPDATE assessment_periods
         SET name = ?, start_date = ?, end_date = ?, is_active = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        old.name,
        old.start_date || null,
        old.end_date || null,
        old.is_active ? 1 : 0,
        old.notes || null,
        nowIso(),
        id,
      );
      logActivity(db, 'period', `Periode ${old.name} diperbarui.`);
    });

    res.setFlash('success', `Periode ${old.name} berhasil diperbarui.`);
    res.redirect('/periode');
  });

  router.post('/:id/aktifkan', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const period = db.prepare('SELECT * FROM assessment_periods WHERE id = ?').get(id);
    if (!period) return notFound(res);

    inTransaction(db, () => {
      activatePeriod(db, id);
      logActivity(db, 'period', `Periode ${period.name} ditetapkan sebagai periode aktif.`);
    });

    res.setFlash('success', `${period.name} sekarang menjadi periode aktif.`);
    res.redirect('/periode');
  });

  router.post('/:id/hapus', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const period = db.prepare('SELECT * FROM assessment_periods WHERE id = ?').get(id);
    if (!period) return notFound(res);

    const assessmentCount = db
      .prepare('SELECT COUNT(*) AS total FROM assessments WHERE period_id = ?')
      .get(id).total;
    const runCount = db
      .prepare('SELECT COUNT(*) AS total FROM calculation_runs WHERE period_id = ?')
      .get(id).total;

    if (assessmentCount > 0 || runCount > 0) {
      res.setFlash(
        'error',
        `Periode ${period.name} memiliki penilaian atau hasil perhitungan. Periode tidak dapat dihapus.`,
      );
      res.redirect('/periode');
      return;
    }

    inTransaction(db, () => {
      db.prepare('DELETE FROM assessment_periods WHERE id = ?').run(id);
      if (period.is_active) {
        const fallback = db
          .prepare('SELECT id FROM assessment_periods ORDER BY start_date DESC, id DESC LIMIT 1')
          .get();
        if (fallback) {
          db.prepare('UPDATE assessment_periods SET is_active = 1 WHERE id = ?').run(fallback.id);
        }
      }
      logActivity(db, 'period', `Periode ${period.name} dihapus.`);
    });

    res.setFlash('success', `Periode ${period.name} dihapus.`);
    res.redirect('/periode');
  });

  return router;
}
