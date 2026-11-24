import { Router } from 'express';
import { nowIso } from '../db/index.js';
import { logActivity } from '../services/activity.js';
import {
  nextSortOrder,
  normalizeCriterionForm,
  validateCriterion,
} from '../services/criteria-form.js';

function parseId(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function notFound(res) {
  return res.status(404).render('errors/404', {
    page: {
      title: 'Kriteria tidak ditemukan',
      active: 'criteria',
      crumbs: [{ label: 'Data kriteria', href: '/kriteria' }, { label: 'Tidak ditemukan' }],
    },
  });
}

function formLocals({ mode, title, crumbs, criterion, errors = {} }) {
  return {
    page: { title, active: 'criteria', crumbs },
    mode,
    criterion,
    errors,
  };
}

const createCrumbs = [
  { label: 'Data master' },
  { label: 'Data kriteria', href: '/kriteria' },
  { label: 'Tambah kriteria' },
];

export function criteriaRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const category = String(req.query.kategori ?? '').trim();
    const status = String(req.query.status ?? '').trim();

    const conditions = ['1 = 1'];
    const params = [];
    if (q) {
      conditions.push('(c.code LIKE ? OR c.name LIKE ? OR c.description LIKE ?)');
      const pattern = `%${q}%`;
      params.push(pattern, pattern, pattern);
    }
    if (category) {
      conditions.push('c.category = ?');
      params.push(category);
    }
    if (status === 'aktif') {
      conditions.push('c.is_active = 1');
    } else if (status === 'nonaktif') {
      conditions.push('c.is_active = 0');
    }

    const criteria = db
      .prepare(
        `SELECT c.*,
          (SELECT COUNT(*) FROM assessments a WHERE a.criterion_id = c.id) AS assessment_count,
          (SELECT COUNT(*) FROM calculation_criteria cc WHERE cc.criterion_id = c.id) AS run_count
         FROM criteria c
         WHERE ${conditions.join(' AND ')}
         ORDER BY c.sort_order ASC, c.code ASC`,
      )
      .all(...params);

    const summary = db
      .prepare(
        `SELECT
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_count,
          SUM(CASE WHEN is_active = 1 THEN weight ELSE 0 END) AS active_weight,
          COUNT(*) AS total_count
         FROM criteria`,
      )
      .get();

    res.render('criteria/index', {
      page: {
        title: 'Data Kriteria',
        active: 'criteria',
        crumbs: [{ label: 'Data master' }, { label: 'Data kriteria' }],
      },
      criteria,
      summary,
      filters: { q, category, status },
    });
  });

  router.get('/baru', (req, res) => {
    res.render(
      'criteria/form',
      formLocals({
        mode: 'create',
        title: 'Tambah Kriteria',
        crumbs: createCrumbs,
        criterion: {
          code: '',
          name: '',
          category: 'kompetensi',
          description: '',
          weight: 10,
          attribute: 'benefit',
          scale_min: 1,
          scale_max: 5,
          unit: 'skor 1-5',
          rubric: '',
          is_active: 1,
          sort_order: nextSortOrder(db),
        },
      }),
    );
  });

  router.post('/', (req, res) => {
    const old = normalizeCriterionForm(req.body);
    const errors = validateCriterion(db, old);

    if (Object.keys(errors).length > 0) {
      res.status(422).render(
        'criteria/form',
        formLocals({
          mode: 'create',
          title: 'Tambah Kriteria',
          crumbs: createCrumbs,
          criterion: { ...old, is_active: old.is_active ? 1 : 0 },
          errors,
        }),
      );
      return;
    }

    db.prepare(
      `INSERT INTO criteria
        (code, name, category, description, weight, attribute, scale_min, scale_max, unit, rubric, is_active, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      old.code,
      old.name,
      old.category,
      old.description || null,
      old.weight,
      old.attribute,
      old.scale_min,
      old.scale_max,
      old.unit || null,
      old.rubric || null,
      old.is_active ? 1 : 0,
      old.sort_order,
      nowIso(),
      nowIso(),
    );

    logActivity(
      db,
      'criteria',
      `Kriteria ${old.code} ${old.name} ditambahkan dengan bobot ${old.weight}%.`,
    );
    res.setFlash('success', `Kriteria ${old.code} berhasil ditambahkan.`);
    res.redirect('/kriteria');
  });

  router.get('/:id/ubah', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const criterion = db.prepare('SELECT * FROM criteria WHERE id = ?').get(id);
    if (!criterion) return notFound(res);

    res.render(
      'criteria/form',
      formLocals({
        mode: 'edit',
        title: 'Ubah Kriteria',
        crumbs: [
          { label: 'Data master' },
          { label: 'Data kriteria', href: '/kriteria' },
          { label: criterion.code },
          { label: 'Ubah' },
        ],
        criterion,
      }),
    );
  });

  router.post('/:id', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const existing = db.prepare('SELECT * FROM criteria WHERE id = ?').get(id);
    if (!existing) return notFound(res);

    const old = normalizeCriterionForm(req.body);
    const errors = validateCriterion(db, old, id);

    if (Object.keys(errors).length > 0) {
      res.status(422).render(
        'criteria/form',
        formLocals({
          mode: 'edit',
          title: 'Ubah Kriteria',
          crumbs: [
            { label: 'Data master' },
            { label: 'Data kriteria', href: '/kriteria' },
            { label: existing.code },
            { label: 'Ubah' },
          ],
          criterion: { ...old, id, is_active: old.is_active ? 1 : 0 },
          errors,
        }),
      );
      return;
    }

    db.prepare(
      `UPDATE criteria
       SET code = ?, name = ?, category = ?, description = ?, weight = ?, attribute = ?,
           scale_min = ?, scale_max = ?, unit = ?, rubric = ?, is_active = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      old.code,
      old.name,
      old.category,
      old.description || null,
      old.weight,
      old.attribute,
      old.scale_min,
      old.scale_max,
      old.unit || null,
      old.rubric || null,
      old.is_active ? 1 : 0,
      old.sort_order,
      nowIso(),
      id,
    );

    logActivity(db, 'criteria', `Kriteria ${old.code} ${old.name} diperbarui.`);
    res.setFlash('success', `Kriteria ${old.code} berhasil diperbarui.`);
    res.redirect('/kriteria');
  });

  router.post('/:id/toggle', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const criterion = db.prepare('SELECT * FROM criteria WHERE id = ?').get(id);
    if (!criterion) return notFound(res);

    const nextStatus = criterion.is_active ? 0 : 1;
    db.prepare('UPDATE criteria SET is_active = ?, updated_at = ? WHERE id = ?').run(
      nextStatus,
      nowIso(),
      id,
    );
    logActivity(
      db,
      'criteria',
      `Kriteria ${criterion.code} ${criterion.name} ${nextStatus ? 'diaktifkan' : 'dinonaktifkan'}.`,
    );
    res.setFlash(
      'success',
      `Kriteria ${criterion.code} ${nextStatus ? 'diaktifkan' : 'dinonaktifkan'}. Nilai historis tetap tersimpan.`,
    );
    res.redirect('/kriteria');
  });

  router.post('/:id/hapus', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const criterion = db.prepare('SELECT * FROM criteria WHERE id = ?').get(id);
    if (!criterion) return notFound(res);

    const assessmentCount = db
      .prepare('SELECT COUNT(*) AS total FROM assessments WHERE criterion_id = ?')
      .get(id).total;
    const runCount = db
      .prepare('SELECT COUNT(*) AS total FROM calculation_criteria WHERE criterion_id = ?')
      .get(id).total;

    if (assessmentCount > 0 || runCount > 0) {
      res.setFlash(
        'error',
        `Kriteria ${criterion.code} sudah dipakai dalam penilaian atau perhitungan. Nonaktifkan kriteria agar riwayat tetap utuh.`,
      );
      res.redirect('/kriteria');
      return;
    }

    db.prepare('DELETE FROM criteria WHERE id = ?').run(id);
    logActivity(db, 'criteria', `Kriteria ${criterion.code} ${criterion.name} dihapus permanen.`);
    res.setFlash('success', `Kriteria ${criterion.code} dihapus permanen.`);
    res.redirect('/kriteria');
  });

  return router;
}
