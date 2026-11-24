const PROCESS_STEPS = [
  {
    key: 'matrix',
    code: '01',
    title: 'Matriks keputusan',
    formula: 'X = [xij]',
    explanation: 'Nilai penilaian setiap pegawai pada setiap kriteria.',
  },
  {
    key: 'weights',
    code: '02',
    title: 'Bobot ternormalisasi',
    formula: 'wj = bobot mentah j / total bobot',
    explanation: 'Bobot kriteria dibagi total bobot agar berjumlah 1.',
  },
  {
    key: 'normalization',
    code: '03',
    title: 'Normalisasi vektor',
    formula: 'rij = xij / akar(sum xij kuadrat)',
    explanation: 'Setiap kolom dibagi panjang vektor kolomnya.',
  },
  {
    key: 'weighted',
    code: '04',
    title: 'Matriks terbobot',
    formula: 'yij = wj x rij',
    explanation: 'Nilai ternormalisasi dikalikan bobot kriteria.',
  },
  {
    key: 'ideal',
    code: '05',
    title: 'Solusi ideal positif dan negatif',
    formula: 'A+ = max benefit / min cost; A- = min benefit / max cost',
    explanation: 'Batas terbaik dan terburuk setiap kriteria.',
  },
  {
    key: 'distance',
    code: '06',
    title: 'Jarak ke solusi ideal',
    formula: 'D+ = akar(sum (yij - A+j) kuadrat); D- = akar(sum (yij - A-j) kuadrat)',
    explanation: 'Jarak Euclidean setiap alternatif ke kedua solusi ideal.',
  },
  {
    key: 'preference',
    code: '07',
    title: 'Preferensi dan peringkat',
    formula: 'Vi = D- / (D+ + D-)',
    explanation: 'Nilai kedekatan relatif lalu diurutkan dengan urutan kompetisi.',
  },
];

function checkStatus(dataset, key) {
  const check = dataset?.checks.find((item) => item.key === key);
  return check ? check.ok : false;
}

function buildInputs(dataset, activePeriod) {
  return [
    {
      key: 'alternatives',
      title: 'Alternatif pegawai',
      value: dataset ? `${dataset.employees.length} pegawai aktif` : 'Belum tersedia',
      note: dataset
        ? 'Pegawai aktif menjadi baris matriks keputusan.'
        : 'Tetapkan periode dan tambahkan pegawai aktif.',
      ready: checkStatus(dataset, 'alternatives'),
      href: '/pegawai',
    },
    {
      key: 'criteria',
      title: 'Kriteria dan bobot',
      value: dataset ? `${dataset.criteria.length} kriteria, total ${dataset.totalWeight}%` : 'Belum tersedia',
      note: dataset
        ? 'Bobot akan dinormalisasi menjadi total 1 saat dihitung.'
        : 'Kriteria aktif dan bobot yang valid dibutuhkan.',
      ready: checkStatus(dataset, 'criteria') && checkStatus(dataset, 'weights'),
      href: '/bobot',
    },
    {
      key: 'period',
      title: 'Periode penilaian',
      value: activePeriod ? activePeriod.name : 'Belum ditetapkan',
      note: activePeriod
        ? 'Periode aktif menentukan kumpulan nilai yang dihitung.'
        : 'Satu periode harus aktif sebelum penilaian dijalankan.',
      ready: Boolean(activePeriod),
      href: activePeriod ? `/periode/${activePeriod.id}/ubah` : '/periode',
    },
    {
      key: 'assessments',
      title: 'Matriks penilaian',
      value: dataset
        ? `${dataset.filledCount} dari ${dataset.expectedCount} nilai`
        : 'Belum tersedia',
      note: dataset
        ? 'Seluruh sel harus terisi dan berada dalam skala kriteria.'
        : 'Nilai penilaian mengisi matriks keputusan.',
      ready:
        checkStatus(dataset, 'completeness') &&
        checkStatus(dataset, 'scale') &&
        checkStatus(dataset, 'normalization'),
      href: activePeriod ? `/penilaian?period=${activePeriod.id}` : '/penilaian',
    },
  ];
}

function stepDetail(step, latestRun, dataset) {
  if (latestRun) {
    switch (step.key) {
      case 'matrix':
        return `${latestRun.employee_count} alternatif x ${latestRun.criteria_count} kriteria dari snapshot.`;
      case 'weights':
        return `${latestRun.criteria_count} bobot, total ${latestRun.weight_total}% sebelum normalisasi.`;
      case 'normalization':
        return `${latestRun.criteria_count} penyebut kolom dihitung dari nilai snapshot.`;
      case 'weighted':
        return `${latestRun.employee_count} baris x ${latestRun.criteria_count} kolom terbobot.`;
      case 'ideal':
        return `${latestRun.criteria_count} pasangan A+ dan A- sesuai atribut benefit atau cost.`;
      case 'distance':
        return `${latestRun.employee_count} pasangan jarak D+ dan D- dihitung.`;
      case 'preference':
        return 'Nilai preferensi diurutkan menjadi peringkat final.';
      default:
        return '';
    }
  }

  if (dataset?.ready) {
    return 'Data input siap. Jalankan perhitungan untuk mengisi tahap ini.';
  }
  return 'Menunggu data input lengkap.';
}

export function buildProcessView({ dataset, activePeriod, latestRun, stale, outputTop }) {
  const inputs = buildInputs(dataset, activePeriod);
  const phaseStatus = latestRun
    ? stale
      ? 'stale'
      : 'done'
    : dataset?.ready
      ? 'ready'
      : 'blocked';

  const steps = PROCESS_STEPS.map((step, index) => ({
    ...step,
    id: `tahap-${index + 1}`,
    href: latestRun
      ? `/perhitungan/${latestRun.id}#tahap-${index + 1}`
      : activePeriod
        ? `/perhitungan?period=${activePeriod.id}`
        : '/perhitungan',
    status: latestRun ? (stale ? 'stale' : 'done') : dataset?.ready ? 'ready' : 'blocked',
    detail: stepDetail(step, latestRun, dataset),
  }));

  return {
    inputs,
    inputReady: Boolean(dataset?.ready),
    phaseStatus,
    steps,
    output: {
      available: Boolean(latestRun),
      stale,
      run: latestRun,
      top: outputTop ?? null,
    },
  };
}
