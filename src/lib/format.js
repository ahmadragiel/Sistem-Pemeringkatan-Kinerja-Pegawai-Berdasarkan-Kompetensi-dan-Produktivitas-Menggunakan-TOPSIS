const decimalFormatters = new Map();

function formatter(digits) {
  if (!decimalFormatters.has(digits)) {
    decimalFormatters.set(
      digits,
      new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }),
    );
  }
  return decimalFormatters.get(digits);
}

export function decimal(value, digits = 0) {
  if (value === null || value === undefined || value === '') return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return formatter(digits).format(numeric);
}

export function integer(value) {
  return decimal(value, 0);
}

export function percent(value, digits = 1) {
  if (value === null || value === undefined || value === '') return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return `${decimal(numeric, digits)}%`;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(`${text}T00:00:00`);
  }
  let normalized = text.includes('T') ? text : text.replace(' ', 'T');
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(normalized)) {
    normalized += 'Z';
  }
  const result = new Date(normalized);
  return Number.isNaN(result.getTime()) ? null : result;
}

export function dateLong(value) {
  const date = toDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function dateShort(value) {
  const date = toDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function dateTime(value) {
  const date = toDate(value);
  if (!date) return '-';
  const day = dateLong(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}, ${hours}.${minutes}`;
}

export function dateInput(value) {
  const date = toDate(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fileStamp(value = new Date()) {
  const date = toDate(value) ?? new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export const format = {
  decimal,
  integer,
  percent,
  dateLong,
  dateShort,
  dateTime,
  dateInput,
  fileStamp,
};
