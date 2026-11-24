import { nowIso } from '../db/index.js';
import { isValidDate } from '../lib/validation.js';

export function normalizePeriodForm(body) {
  return {
    name: String(body.name ?? '').trim(),
    start_date: String(body.start_date ?? '').trim(),
    end_date: String(body.end_date ?? '').trim(),
    notes: String(body.notes ?? '').trim(),
    is_active: body.is_active === 'on' || body.is_active === '1',
  };
}

export function validatePeriod(db, old, existingId = null, existing = null) {
  const errors = {};
  if (!old.name) {
    errors.name = 'Nama periode wajib diisi.';
  } else if (old.name.length > 120) {
    errors.name = 'Nama periode maksimal 120 karakter.';
  } else {
    const duplicate = db
      .prepare('SELECT id FROM assessment_periods WHERE name = ? AND (? IS NULL OR id <> ?)')
      .get(old.name, existingId, existingId);
    if (duplicate) {
      errors.name = 'Nama periode sudah digunakan.';
    }
  }

  if (!isValidDate(old.start_date)) {
    errors.start_date = 'Tanggal mulai tidak valid.';
  }
  if (!isValidDate(old.end_date)) {
    errors.end_date = 'Tanggal selesai tidak valid.';
  }
  if (
    old.start_date &&
    old.end_date &&
    isValidDate(old.start_date) &&
    isValidDate(old.end_date) &&
    old.start_date > old.end_date
  ) {
    errors.end_date = 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.';
  }

  if (old.notes.length > 1000) {
    errors.notes = 'Catatan maksimal 1.000 karakter.';
  }

  if (existing && existing.is_active && !old.is_active) {
    errors.is_active = 'Tetapkan periode lain sebagai aktif sebelum menonaktifkan periode ini.';
  }

  return errors;
}

export function activatePeriod(db, id) {
  db.prepare('UPDATE assessment_periods SET is_active = 0, updated_at = ? WHERE is_active = 1').run(
    nowIso(),
  );
  db.prepare('UPDATE assessment_periods SET is_active = 1, updated_at = ? WHERE id = ?').run(
    nowIso(),
    id,
  );
}
