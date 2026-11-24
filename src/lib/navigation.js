export const NAVIGATION = [
  {
    label: 'Ringkasan',
    items: [{ key: 'dashboard', label: 'Dashboard', href: '/' }],
  },
  {
    label: 'Data master',
    items: [
      { key: 'employees', label: 'Data pegawai', href: '/pegawai' },
      { key: 'criteria', label: 'Data kriteria', href: '/kriteria' },
      { key: 'periods', label: 'Periode penilaian', href: '/periode' },
    ],
  },
  {
    label: 'Penilaian',
    items: [
      { key: 'weights', label: 'Bobot kriteria', href: '/bobot' },
      { key: 'assessments', label: 'Penilaian pegawai', href: '/penilaian' },
    ],
  },
  {
    label: 'Analisis',
    items: [
      { key: 'calculations', label: 'Perhitungan TOPSIS', href: '/perhitungan' },
      { key: 'rankings', label: 'Hasil pemeringkatan', href: '/peringkat' },
      { key: 'reports', label: 'Laporan', href: '/laporan' },
    ],
  },
];
