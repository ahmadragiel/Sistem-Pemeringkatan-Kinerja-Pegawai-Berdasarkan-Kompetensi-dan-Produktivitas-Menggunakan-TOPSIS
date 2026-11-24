import { parseNumber } from '../lib/validation.js';

export function prepareAssessmentValues(criteria, body) {
  const oldValues = new Map();
  const errors = {};
  const prepared = [];

  for (const criterion of criteria) {
    const raw = body[`nilai_${criterion.id}`];
    const parsed = parseNumber(raw);
    if (parsed === null) {
      oldValues.set(criterion.id, String(raw ?? '').trim());
      if (String(raw ?? '').trim() !== '') {
        errors[`nilai_${criterion.id}`] = 'Nilai harus berupa angka.';
      }
      prepared.push({ criterion, value: null });
      continue;
    }

    oldValues.set(criterion.id, parsed);
    if (parsed < criterion.scale_min || parsed > criterion.scale_max) {
      errors[`nilai_${criterion.id}`] =
        `Nilai harus berada pada rentang ${criterion.scale_min} sampai ${criterion.scale_max}.`;
    }
    prepared.push({ criterion, value: parsed });
  }

  return { prepared, errors, oldValues };
}

export function countFilledValues(values) {
  return [...values.values()].filter(
    (value) => value !== '' && value !== null && value !== undefined,
  ).length;
}
