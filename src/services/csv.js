import { decimal, dateTime, dateLong } from '../lib/format.js';
import { parseDetail } from './calculation.js';

const DISCLAIMER =
  'Data simulasi akademik. Hasil menunjukkan kedekatan terhadap solusi ideal, bukan penilaian mutlak kualitas pribadi.';

function safeCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function line(values) {
  return values.map(safeCell).join(';');
}

function numberCell(value, digits = 4) {
  return decimal(value, digits);
}

export function buildReportCsv({ run, criteria, details }) {
  const parsedDetails = details.map(parseDetail).sort((a, b) => a.rank - b.rank);
  const rows = [];
  rows.push(line(['Sistem Pemeringkatan Kinerja Pegawai Berdasarkan Kompetensi dan Produktivitas Menggunakan TOPSIS']));
  rows.push(line(['Metode', 'TOPSIS']));
  rows.push(line(['Periode penilaian', run.period_name]));
  rows.push(line(['Waktu perhitungan', dateTime(run.calculated_at)]));
  rows.push(line(['Jumlah alternatif', run.employee_count]));
  rows.push(line(['Jumlah kriteria', run.criteria_count]));
  rows.push(line(['Total bobot mentah', numberCell(run.weight_total, 2)]));
  rows.push(line(['Catatan', DISCLAIMER]));
  rows.push('');
  rows.push(line(['DAFTAR KRITERIA']));
  rows.push(line(['Kode', 'Kriteria', 'Kategori', 'Atribut', 'Bobot mentah (%)', 'Bobot ternormalisasi']));
  criteria.forEach((criterion) => {
    rows.push(
      line([
        criterion.code,
        criterion.name,
        criterion.category,
        criterion.attribute,
        numberCell(criterion.weight_raw, 2),
        numberCell(criterion.weight_normalized, 6),
      ]),
    );
  });
  rows.push('');
  rows.push(line(['MATRIKS PENILAIAN']));
  rows.push(line(['Kode', 'Nama', 'Departemen', ...criteria.map((criterion) => criterion.code)]));
  parsedDetails.forEach((detail) => {
    rows.push(
      line([
        detail.employee_code,
        detail.employee_name,
        detail.employee_department,
        ...detail.values.map((value) => numberCell(value, 2)),
      ]),
    );
  });
  rows.push('');
  rows.push(line(['HASIL PERHITUNGAN DAN PEMERINGKATAN']));
  rows.push(
    line([
      'Peringkat',
      'Kode',
      'Nama',
      'Departemen',
      'D+',
      'D-',
      'Nilai preferensi',
      'Kategori hasil',
    ]),
  );
  parsedDetails.forEach((detail) => {
    rows.push(
      line([
        detail.rank,
        detail.employee_code,
        detail.employee_name,
        detail.employee_department,
        numberCell(detail.d_plus, 6),
        numberCell(detail.d_minus, 6),
        numberCell(detail.preference, 4),
        `Peringkat ${detail.rank}`,
      ]),
    );
  });
  rows.push('');
  rows.push(line(['Catatan', DISCLAIMER]));
  rows.push(line(['Dicetak dari aplikasi pada', dateLong(new Date())]));
  return `\uFEFF${rows.join('\r\n')}\r\n`;
}

export function buildRankingCsv({ run, criteria, details }) {
  const parsedDetails = details.map(parseDetail).sort((a, b) => a.rank - b.rank);
  const rows = [];
  rows.push(line(['HASIL PEMERINGKATAN TOPSIS']));
  rows.push(line(['Periode', run.period_name]));
  rows.push(line(['Waktu perhitungan', dateTime(run.calculated_at)]));
  rows.push('');
  rows.push(line(['Peringkat', 'Kode pegawai', 'Nama pegawai', 'Departemen', 'Nilai preferensi', 'Kategori hasil']));
  parsedDetails.forEach((detail) => {
    rows.push(
      line([
        detail.rank,
        detail.employee_code,
        detail.employee_name,
        detail.employee_department,
        numberCell(detail.preference, 4),
        `Peringkat ${detail.rank}`,
      ]),
    );
  });
  rows.push('');
  rows.push(line(['Kriteria', criteria.map((criterion) => `${criterion.code} ${criterion.name}`).join('; ')]));
  rows.push(line(['Catatan', DISCLAIMER]));
  return `\uFEFF${rows.join('\r\n')}\r\n`;
}

export function csvFileName(prefix, periodName, stamp) {
  const slug = String(periodName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${prefix}-${slug || 'periode'}-${stamp}.csv`;
}
