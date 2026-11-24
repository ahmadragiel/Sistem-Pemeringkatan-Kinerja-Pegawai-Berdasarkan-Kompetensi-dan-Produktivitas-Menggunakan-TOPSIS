import { CRITERIA_CATEGORIES, CRITERIA_ATTRIBUTES, parseNumber } from '../lib/validation.js';

export function normalizeCriterionForm(body) {
  return {
    code: String(body.code ?? '').trim().toUpperCase(),
    name: String(body.name ?? '').trim(),
    category: String(body.category ?? '').trim(),
    description: String(body.description ?? '').trim(),
    weight: parseNumber(body.weight),
    attribute: String(body.attribute ?? '').trim(),
    scale_min: parseNumber(body.scale_min),
    scale_max: parseNumber(body.scale_max),
    unit: String(body.unit ?? '').trim(),
    rubric: String(body.rubric ?? '').trim(),
    is_active: body.is_active === 'on' || body.is_active === '1',
    sort_order: parseNumber(body.sort_order),
  };
}

export function validateCriterion(db, old, existingId = null) {
  const errors = {};

  if (!old.code) {
    errors.code = 'Kode kriteria wajib diisi.';
  } else if (old.code.length > 10) {
    errors.code = 'Kode kriteria maksimal 10 karakter.';
  } else if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(old.code)) {
    errors.code = 'Kode hanya boleh berisi huruf, angka, garis bawah, atau tanda hubung.';
  } else {
    const duplicate = db
      .prepare('SELECT id FROM criteria WHERE code = ? AND (? IS NULL OR id <> ?)')
      .get(old.code, existingId, existingId);
    if (duplicate) {
      errors.code = 'Kode kriteria sudah digunakan.';
    }
  }

  if (!old.name) {
    errors.name = 'Nama kriteria wajib diisi.';
  } else if (old.name.length > 120) {
    errors.name = 'Nama kriteria maksimal 120 karakter.';
  }

  if (!CRITERIA_CATEGORIES.some((item) => item.value === old.category)) {
    errors.category = 'Kategori kriteria tidak valid.';
  }

  if (old.description.length > 1000) {
    errors.description = 'Deskripsi maksimal 1.000 karakter.';
  }

  if (old.weight === null) {
    errors.weight = 'Bobot wajib berupa angka.';
  } else if (old.weight < 0 || old.weight > 100) {
    errors.weight = 'Bobot harus berada pada rentang 0 sampai 100 persen.';
  }

  if (!CRITERIA_ATTRIBUTES.some((item) => item.value === old.attribute)) {
    errors.attribute = 'Atribut kriteria tidak valid.';
  }

  if (old.scale_min === null || old.scale_max === null) {
    errors.scale_min = 'Batas skala wajib berupa angka.';
  } else if (old.scale_min >= old.scale_max) {
    errors.scale_min = 'Nilai skala minimum harus lebih kecil dari skala maksimum.';
  } else if (old.scale_max - old.scale_min > 1000) {
    errors.scale_min = 'Rentang skala terlalu besar.';
  }

  if (old.unit.length > 30) {
    errors.unit = 'Satuan maksimal 30 karakter.';
  }

  if (old.rubric.length > 3000) {
    errors.rubric = 'Rubrik maksimal 3.000 karakter.';
  }

  if (old.sort_order === null || old.sort_order < 0 || !Number.isInteger(old.sort_order)) {
    errors.sort_order = 'Urutan harus berupa bilangan bulat nol atau lebih.';
  }

  if (existingId && !errors.scale_min) {
    const range = db
      .prepare('SELECT MIN(value) AS minimum, MAX(value) AS maximum FROM assessments WHERE criterion_id = ?')
      .get(existingId);
    if (range.minimum !== null && (range.minimum < old.scale_min || range.maximum > old.scale_max)) {
      errors.scale_min = `Skala baru tidak mencakup nilai penilaian yang sudah tersimpan (${range.minimum} sampai ${range.maximum}).`;
    }
  }

  return errors;
}

export function nextSortOrder(db) {
  const row = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS total FROM criteria').get();
  return Number(row.total) + 1;
}
