export function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (raw === '') return null;
  const normalized = raw.replace(/\s/g, '').replace(',', '.');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

export function isValidDate(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

export function addError(errors, field, message) {
  if (!errors[field]) errors[field] = message;
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

export const EMPLOYEE_STATUSES = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'kontrak', label: 'Kontrak' },
  { value: 'magang', label: 'Magang' },
  { value: 'nonaktif', label: 'Nonaktif' },
];

export const CRITERIA_CATEGORIES = [
  { value: 'kompetensi', label: 'Kompetensi' },
  { value: 'produktivitas', label: 'Produktivitas' },
];

export const CRITERIA_ATTRIBUTES = [
  { value: 'benefit', label: 'Benefit' },
  { value: 'cost', label: 'Cost' },
];

export function statusLabel(value) {
  return EMPLOYEE_STATUSES.find((item) => item.value === value)?.label ?? value;
}

export function categoryLabel(value) {
  return CRITERIA_CATEGORIES.find((item) => item.value === value)?.label ?? value;
}

export function attributeLabel(value) {
  return value === 'cost' ? 'Cost' : 'Benefit';
}
