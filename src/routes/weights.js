import { Router } from 'express';
import { nowIso, inTransaction } from '../db/index.js';
import { logActivity } from '../services/activity.js';
import { parseNumber } from '../lib/validation.js';

function loadWeights(db) {
  const criteria = db
    .prepare(
      `SELECT id, code, name, category, weight, attribute, is_active, sort_order
       FROM criteria
       WHERE is_active = 1
       ORDER BY sort_order ASC, code ASC`,
    )
    .all();
  const total = criteria.reduce((sum, criterion) => sum + Number(criterion.weight), 0);
  return criteria.map((criterion) => ({
    ...criterion,
    normalized: total > 0 ? Number(criterion.weight) / total : 0,
  }));
}

function renderPage(res, db, { criteria, errors = {}, old = null, status = 200 }) {
  const rows = old
    ? criteria.map((criterion) => ({
        ...criterion,
        weight: old[criterion.id] ?? criterion.weight,
      }))
    : criteria;
  const total = rows.reduce((sum, criterion) => sum + (Number(criterion.weight) || 0), 0);
  const normalized = rows.map((criterion) => ({
    ...criterion,
    normalized: total > 0 ? (Number(criterion.weight) || 0) / total : 0,
  }));

  res.status(status).render('weights', {
    page: {
      title: 'Bobot Kriteria',
      active: 'weights',
      crumbs: [{ label: 'Penilaian' }, { label: 'Bobot kriteria' }],
    },
    criteria: normalized,
    total,
    errors,
  });
}

export function weightsRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    renderPage(res, db, { criteria: loadWeights(db) });
  });

  router.post('/', (req, res) => {
    const criteria = loadWeights(db);
    if (criteria.length === 0) {
      res.setFlash('error', 'Belum ada kriteria aktif yang dapat diberi bobot.');
      res.redirect('/kriteria');
      return;
    }

    const old = {};
    const errors = {};
    const values = [];

    for (const criterion of criteria) {
      const raw = req.body[`weight_${criterion.id}`];
      const value = parseNumber(raw);
      if (value === null) {
        errors[`weight_${criterion.id}`] = 'Bobot wajib berupa angka.';
        old[criterion.id] = String(raw ?? '');
      } else if (value < 0) {
        errors[`weight_${criterion.id}`] = 'Bobot tidak boleh negatif.';
        old[criterion.id] = value;
      } else if (value > 100) {
        errors[`weight_${criterion.id}`] = 'Bobot maksimal 100 persen per kriteria.';
        old[criterion.id] = value;
      } else {
        old[criterion.id] = value;
        values.push({ id: criterion.id, weight: value });
      }
    }

    const total = values.reduce((sum, item) => sum + item.weight, 0);
    if (Object.keys(errors).length === 0 && total <= 0) {
      errors.total = 'Total bobot harus lebih dari nol.';
    }

    if (Object.keys(errors).length > 0) {
      renderPage(res, db, { criteria, errors, old, status: 422 });
      return;
    }

    inTransaction(db, () => {
      const update = db.prepare('UPDATE criteria SET weight = ?, updated_at = ? WHERE id = ?');
      for (const item of values) {
        update.run(item.weight, nowIso(), item.id);
      }
      logActivity(
        db,
        'weights',
        `Bobot ${values.length} kriteria diperbarui. Total bobot ${total}%.`,
      );
    });

    res.setFlash(
      'success',
      `Bobot kriteria disimpan. Total ${total}%. Nilai ini akan dinormalisasi menjadi 1 saat TOPSIS dihitung.`,
    );
    res.redirect('/bobot');
  });

  return router;
}
