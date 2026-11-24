# Sistem Pemeringkatan Kinerja Pegawai Berdasarkan Kompetensi dan Produktivitas Menggunakan TOPSIS

Aplikasi web untuk menilai dan memeringkat kinerja pegawai dengan metode TOPSIS. Data kompetensi dan produktivitas diisi per periode, dihitung di server, lalu disimpan sebagai snapshot hasil. Aplikasi berjalan tanpa login dan tanpa proses registrasi.

## Latar Belakang

Penilaian kinerja pegawai melibatkan beberapa kriteria kompetensi dan produktivitas dengan skala, bobot, dan arah kepentingan yang berbeda. Perhitungan manual dengan banyak alternatif rawan kesalahan, sulit diperiksa ulang, dan tidak menyimpan bukti nilai yang dipakai pada saat keputusan dibuat. Metode TOPSIS dipilih karena dapat memeringkat alternatif berdasarkan kedekatan terhadap solusi ideal positif dan jarak dari solusi ideal negatif secara terukur.

## Tujuan

Aplikasi ini bertujuan menyediakan satu alur kerja yang dapat dipertanggungjawabkan secara akademik:

1. Mencatat data pegawai, kriteria, bobot, periode, dan nilai penilaian sebagai input yang eksplisit.
2. Menghitung enam tahap matematis TOPSIS di server, bukan di tampilan atau angka yang ditulis langsung.
3. Menyimpan snapshot kriteria, bobot, nilai, jarak, preferensi, dan peringkat agar hasil historis tetap dapat diaudit.
4. Menyajikan input, proses, dan output secara terpisah sehingga pengguna dapat menelusuri asal setiap angka.

## Deskripsi Sistem

Sistem ini memisahkan tiga bagian yang mudah diperiksa:

1. **Input**: pegawai, kriteria, bobot, periode, dan nilai penilaian.
2. **Proses**: perhitungan TOPSIS enam tahap matematis yang ditampilkan sebagai tujuh langkah proses pada dashboard.
3. **Output**: nilai preferensi, peringkat, laporan, dan ekspor CSV yang hanya muncul setelah perhitungan tersimpan.

Seluruh angka peringkat berasal dari tabel hasil perhitungan di SQLite. Tidak ada peringkat contoh yang ditulis langsung di tampilan.

## Fitur

- Dashboard dengan ringkasan data, status kelengkapan input, tujuh langkah proses TOPSIS, dan output peringkat.
- CRUD pegawai dengan arsip, pemulihan, dan aturan hapus yang menjaga riwayat.
- CRUD kriteria dengan kategori kompetensi atau produktivitas, atribut benefit atau cost, skala, dan rubrik.
- Pengaturan bobot kriteria dengan normalisasi otomatis saat perhitungan.
- CRUD periode penilaian dan penetapan satu periode aktif.
- Formulir penilaian per pegawai dengan validasi skala dan penyimpanan tanpa duplikasi.
- Perhitungan TOPSIS di backend dengan snapshot kriteria, bobot, nilai, jarak, dan preferensi.
- Deteksi snapshot lama melalui tanda tangan data (SHA-256) dan ajakan hitung ulang.
- Riwayat perhitungan per periode, halaman rincian enam tahap, serta peringkat historis.
- Pencarian dan filter pada daftar pegawai, kriteria, penilaian, dan peringkat.
- Ekspor CSV dengan BOM UTF-8, pemisah titik koma, dan desimal koma.
- Halaman laporan siap cetak dengan tombol cetak dan ekspor.
- Dialog konfirmasi untuk tindakan yang menghapus, mengarsipkan, atau menonaktifkan data.
- Navigasi mobile, fokus keyboard, atribut ARIA, dan tautan lewati ke konten utama.

## Teknologi

| Bagian | Teknologi |
| --- | --- |
| Runtime | Node.js 24, modul ES |
| Web | Express 5 |
| Tampilan | EJS server-side rendering |
| Database | `node:sqlite` bawaan Node.js |
| Gaya | CSS modular tanpa build step |
| Interaksi | JavaScript modular tanpa framework |
| Pengujian | `node:test` dan `node:assert/strict` |

Dependensi runtime hanya `express` dan `ejs`. Tidak ada bundler, transpiler, atau proses build.

## Persyaratan Sistem

- Node.js 22.5 atau lebih baru. Node.js 24 disarankan karena modul `node:sqlite` sudah memadai untuk kebutuhan aplikasi ini.
- npm untuk memasang dependensi.
- Browser modern yang mendukung ES modules, CSS grid, dan elemen `<dialog>`.
- Ruang disk untuk berkas SQLite dan cadangannya. Tidak diperlukan server database terpisah.

## Instalasi

Pasang dependensi lalu jalankan server:

```bash
npm install
npm start
```

Untuk instalasi yang mengikuti lockfile secara ketat, gunakan `npm ci` sebelum `npm start`. Buka `http://127.0.0.1:3000`. Saat database masih kosong, data simulasi dimuat otomatis.

Perintah lain:

```bash
npm run dev       # server dengan watch mode
npm run seed      # memuat data simulasi bila database kosong
npm run db:reset  # menghapus database lokal dan berkas WAL/SHM
npm test          # menjalankan seluruh pengujian
```

## Konfigurasi Aplikasi dan Database

Konfigurasi dibaca dari variabel lingkungan.

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `PORT` | `3000` | Port HTTP |
| `HOST` | `127.0.0.1` | Alamat bind server |
| `DB_PATH` | `data/spk-kinerja.sqlite` | Lokasi berkas SQLite |
| `SEED_ON_START` | aktif | Isi `false` untuk menonaktifkan seed otomatis |
| `NODE_ENV` | tidak diset | `production` mengaktifkan cache aset statis selama 1 jam |

Contoh di PowerShell:

```powershell
$env:PORT = 4000
$env:DB_PATH = "D:\data\spk-uji.sqlite"
npm start
```

## Data Simulasi

Seed hanya berjalan bila tabel pegawai, kriteria, dan periode sama-sama kosong. Data yang sudah ada tidak ditimpa.

Isi seed data simulasi:

- 10 pegawai fiktif dengan kode `PG001` sampai `PG010`.
- 6 kriteria: C1 Pengetahuan Kerja, C2 Keterampilan Teknis, C3 Kemampuan Pemecahan Masalah, C4 Kuantitas Hasil Kerja, C5 Kualitas Hasil Kerja, dan C6 Ketepatan Waktu Penyelesaian Tugas.
- Bobot C1 sampai C3 masing-masing 15%, C4 dan C5 masing-masing 20%, C6 15%, sehingga total 100%.
- Satu periode aktif bernama `Penilaian Tahunan 2026`.
- 60 nilai penilaian lengkap, yaitu 10 pegawai kali 6 kriteria.
- Satu perhitungan awal yang dibuat oleh layanan TOPSIS yang sama dengan perhitungan manual di aplikasi.

Berkas database yang disertakan dalam paket final sudah berisi data simulasi dengan 11 pegawai (10 pegawai seed ditambah `RR20` Antonius), 66 nilai penilaian, dan 3 run perhitungan. Run #3 dibuat sebelum `RR20` ditambahkan, sehingga aplikasi menandainya sebagai snapshot lama. Seed hanya mengisi database kosong dan tidak menimpa database tersebut.

Data ini adalah simulasi akademik. Nama, jabatan, dan nilai tidak mewakili instansi nyata.

## Alur Pemakaian

1. Buka **Periode Penilaian** dan pastikan satu periode aktif.
2. Lengkapi **Data Pegawai** yang akan menjadi alternatif.
3. Atur **Data Kriteria** dan **Bobot Kriteria**. Total bobot tidak wajib 100% karena akan dinormalisasi, tetapi harus lebih dari nol.
4. Isi **Penilaian Pegawai** untuk periode aktif. Semua sel harus terisi dan berada dalam skala kriteria.
5. Buka **Perhitungan TOPSIS**, periksa syarat, lalu jalankan perhitungan. Sistem menyimpan snapshot dan mengarahkan ke halaman rincian.
6. Buka **Hasil Pemeringkatan** untuk melihat peringkat terbaru atau riwayat run tertentu.
7. Buka **Laporan** untuk mencetak atau mengunduh CSV.

## Input, Proses, dan Output

Dashboard menampilkan bagian **Input, proses TOPSIS, dan output** dengan status yang mengikuti database.

Strip metrik di atas alur menampilkan jumlah pegawai aktif, kriteria aktif, persentase kelengkapan penilaian, periode aktif, dan status TOPSIS. Persentase dihitung dari jumlah nilai terisi dibagi jumlah sel yang dibutuhkan pada periode aktif.

| Bagian | Isi | Sumber status |
| --- | --- | --- |
| Input | Alternatif pegawai, kriteria dan bobot, periode, matriks penilaian | Pemeriksaan `buildDataset` |
| Proses | Tujuh langkah: matriks keputusan, bobot, normalisasi, matriks terbobot, solusi ideal, jarak, preferensi dan peringkat | Snapshot run terbaru |
| Output | Peringkat 1, nilai preferensi, tautan peringkat, rincian, laporan, CSV | Ada atau tidaknya run tersimpan |

Status yang dipakai:

- **Siap** untuk input yang memenuhi syarat.
- **Belum** untuk input yang belum lengkap.
- **Selesai** untuk langkah proses yang sudah memiliki snapshot.
- **Snapshot lama** bila data berubah setelah run dibuat.
- **Siap dihitung** bila input lengkap tetapi belum ada run.
- **Output belum tersedia** bila belum ada perhitungan tersimpan.

## Tahapan TOPSIS

Enam tahap matematis dihitung oleh `src/services/topsis.js` dan disimpan oleh `src/services/calculation.js`.

### 1. Matriks keputusan

`X = [xij]`, dengan `i` adalah alternatif dan `j` adalah kriteria.

### 2. Bobot ternormalisasi

`wj = bobot mentah j / total bobot mentah`

Bobot mentah diambil dari kriteria aktif saat perhitungan dijalankan. Hasil normalisasi disimpan di `calculation_criteria`.

### 3. Normalisasi vektor

`rij = xij / akar(sum xij^2)`

Penyebut dihitung per kolom kriteria. Bila seluruh nilai kolom nol, perhitungan ditolak dengan pesan yang dapat ditindaklanjuti.

### 4. Matriks terbobot

`yij = wj x rij`

### 5. Solusi ideal positif dan negatif

- Benefit: `A+j = max(yij)`, `A-j = min(yij)`.
- Cost: `A+j = min(yij)`, `A-j = max(yij)`.

### 6. Jarak, preferensi, dan peringkat

`D+i = akar(sum (yij - A+j)^2)`

`D-i = akar(sum (yij - A-j)^2)`

`Vi = D-i / (D+i + D-i)`

Nilai preferensi yang lebih tinggi menunjukkan alternatif yang lebih dekat ke solusi ideal positif. Perhitungan internal memakai presisi penuh. Tampilan ringkas memakai empat angka desimal, sedangkan halaman rincian dan laporan memakai enam angka desimal untuk bobot, jarak, dan nilai antara.

Aturan peringkat:

- Urutan kompetisi dipakai, misalnya 1, 2, 2, 4.
- Nilai preferensi yang sama diurutkan berdasarkan kode pegawai naik.
- Bila seluruh alternatif identik, semua memperoleh preferensi 0,5 dan peringkat 1.

Dashboard menampilkan tujuh langkah proses, yaitu tahap jarak dan tahap preferensi dipisah. Halaman rincian perhitungan memakai enam tahap matematis dan menyajikan tabel jarak serta tabel preferensi secara terpisah di dalam tahap keenam.

## Struktur Proyek

```text
.
├── server.js
├── package.json
├── package-lock.json
├── README.md
├── DESIGN.md
├── .gitignore
├── data/                         # database SQLite lokal
├── public/
│   ├── css/
│   │   ├── base.css
│   │   ├── layout.css
│   │   ├── utilities.css
│   │   ├── responsive.css
│   │   ├── touch.css
│   │   ├── print.css
│   │   ├── components/
│   │   └── pages/
│   └── js/
│       ├── app.js
│       ├── core/
│       ├── components/
│       └── pages/
├── src/
│   ├── app.js
│   ├── db/
│   │   ├── index.js
│   │   ├── schema.sql
│   │   ├── seed.js
│   │   ├── seed-cli.js
│   │   └── reset.js
│   ├── lib/
│   │   ├── format.js
│   │   ├── navigation.js
│   │   ├── pagination.js
│   │   └── validation.js
│   ├── middleware/
│   │   ├── context.js
│   │   └── flash.js
│   ├── routes/
│   │   ├── dashboard.js
│   │   ├── employees.js
│   │   ├── criteria.js
│   │   ├── weights.js
│   │   ├── periods.js
│   │   ├── assessments.js
│   │   ├── calculations.js
│   │   ├── rankings.js
│   │   └── reports.js
│   └── services/
│       ├── activity.js
│       ├── assessment-values.js
│       ├── calculation.js
│       ├── criteria-form.js
│       ├── csv.js
│       ├── dataset.js
│       ├── employee-data.js
│       ├── period-form.js
│       ├── process-view.js
│       └── topsis.js
├── tests/
│   ├── helpers.js
│   ├── topsis.test.js
│   ├── pages.test.js
│   ├── crud.test.js
│   └── calculations.test.js
└── views/
    ├── partials/
    ├── employees/
    ├── criteria/
    ├── assessments/
    ├── calculations/
    ├── rankings/
    ├── reports/
    └── errors/
```

## Skema Data

| Tabel | Kegunaan |
| --- | --- |
| `employees` | Pegawai, status kepegawaian, dan waktu arsip |
| `criteria` | Kriteria, bobot mentah, atribut, skala, dan status aktif |
| `assessment_periods` | Periode penilaian dan penanda periode aktif |
| `assessments` | Nilai per periode, pegawai, dan kriteria |
| `calculation_runs` | Header snapshot, tanda tangan data, dan waktu hitung |
| `calculation_criteria` | Snapshot kriteria dan bobot ternormalisasi per run |
| `calculation_details` | Snapshot nilai, normalisasi, matriks terbobot, jarak, preferensi, dan peringkat |
| `activities` | Catatan perubahan data dan perhitungan |

Batasan penting:

- Kombinasi periode, pegawai, dan kriteria pada `assessments` unik.
- Pegawai yang diarsipkan tidak dipakai pada perhitungan baru, tetapi snapshot lama tetap utuh.
- Menghapus pegawai atau kriteria ditolak bila sudah memiliki riwayat penilaian atau perhitungan.
- Riwayat perhitungan tidak dihapus saat data master berubah. Sistem hanya menandai run sebagai snapshot lama.

## Penyimpanan Riwayat dan Snapshot

Setiap perhitungan membuat satu baris `calculation_runs`, salinan kriteria dan bobot pada `calculation_criteria`, serta salinan nilai, normalisasi, jarak, preferensi, dan peringkat pada `calculation_details`. Tanda tangan SHA-256 dari data sumber disimpan bersama run. Jika pegawai, kriteria, bobot, atau nilai berubah setelah run dibuat, dashboard dan halaman perhitungan menampilkan status snapshot lama, tetapi run lama tidak diubah dan tetap dapat dibuka melalui pemilih riwayat.

Pegawai yang diarsipkan dikeluarkan dari perhitungan baru. Nilainya pada run historis tetap tersedia karena halaman riwayat membaca tabel snapshot, bukan data master yang berlaku sekarang. Menghapus run historis tidak disediakan melalui antarmuka.

## Validasi dan Keamanan

- Validasi form dilakukan di browser dan diulang di server.
- Kode pegawai dan kriteria diperiksa panjang, format, dan keunikannya.
- Bobot harus berupa angka 0 sampai 100 dan totalnya lebih dari nol.
- Nilai penilaian harus berada dalam rentang skala kriteria.
- Perubahan skala ditolak bila tidak lagi mencakup nilai yang sudah tersimpan.
- Perhitungan ditolak bila alternatif kurang dari dua, kriteria kosong, bobot tidak valid, nilai belum lengkap, atau ada kolom normalisasi bernilai nol.
- Respons memakai `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, dan `X-Frame-Options`.
- Output EJS di-escape secara default. Atribut dinamis yang memuat tanda kutip memakai fragmen yang dikendalikan server.

Tidak ada autentikasi, otorisasi, atau manajemen pengguna. Aplikasi dirancang untuk penggunaan lokal atau lingkungan akademik yang tepercaya.

## Pengujian

```bash
npm test
```

Cakupan pengujian:

- Perhitungan TOPSIS, normalisasi vektor, atribut benefit dan cost, peringkat kompetisi, alternatif identik, dan penolakan penyebut nol.
- Validasi input dan bobot.
- Render seluruh halaman utama tanpa `NaN`, `Infinity`, atau `undefined`.
- Larangan menampilkan peringkat sebelum ada run tersimpan.
- Database kosong menampilkan panduan, bukan hasil palsu.
- CRUD pegawai, arsip, pemulihan, dan aturan hapus.
- CRUD kriteria, toggle aktif, dan aturan hapus.
- CRUD periode dan penolakan nama duplikat.
- Validasi dan pengosongan nilai penilaian.
- Snapshot bobot, deteksi snapshot lama, dan penolakan perhitungan yang belum lengkap.
- Ekspor CSV dengan BOM dan pemisah titik koma.
- Konsistensi snapshot dengan rumus TOPSIS.

`npm test` memakai database sementara sehingga data simulasi utama tidak berubah. Pemeriksaan akhir juga mencakup penelusuran seluruh route melalui HTTP, pengujian CRUD dan perhitungan melalui browser pada database sementara, matriks responsif 360 sampai 1440 piksel, navigasi keyboard, audit aksesibilitas, ekspor CSV, serta emulasi media cetak. Pemeriksaan tersebut tidak dijalankan otomatis oleh `npm test`.

## Aksesibilitas dan Responsif

- Navigasi memakai elemen `nav`, `aria-label`, dan `aria-current` yang valid.
- Formulir memiliki label, pesan kesalahan, dan atribut `aria-invalid` serta `aria-describedby`.
- Fokus keyboard terlihat pada tautan, tombol, dan kontrol formulir.
- Target interaksi untuk layar sentuh memakai ukuran minimum 44 piksel pada kontrol utama dan tautan aksi.
- Menu mobile dapat dibuka dan ditutup dengan keyboard, termasuk tombol Escape dan penahanan fokus.
- Tabel lebar dapat digulir horizontal tanpa memotong halaman.
- Halaman laporan memiliki aturan cetak khusus.
- Gerak dikurangi otomatis bila pengguna mengaktifkan `prefers-reduced-motion`.

## Ekspor dan Cetak

- CSV peringkat: `/peringkat/export.csv?run=1`
- CSV laporan: `/laporan/export.csv?period=1`
- Berkas CSV memakai BOM UTF-8, pemisah titik koma, dan koma desimal agar cocok untuk Excel versi Indonesia.
- Tombol cetak memanggil `window.print()` dan menyembunyikan navigasi melalui `print.css`.

## Catatan Pengembangan

- Tidak ada build step. CSS dimuat sebagai modul berurutan dari `views/partials/layout-top.ejs`, sedangkan JavaScript memakai ES modules dengan `public/js/app.js` sebagai titik masuk.
- Perhitungan matematis murni berada di `src/services/topsis.js`. Penyimpanan snapshot dan validasi kelengkapan berada di `src/services/calculation.js` dan `src/services/dataset.js`, sehingga rumus tidak tercampur dengan akses database atau tampilan.
- EJS meng-escape output secara default. Fragmen atribut dinamis yang memuat tanda kutip ditulis dengan `<%- ... %>` dan nilai yang sudah dikendalikan server, bukan dengan mematikan escaping global.
- Saat mengubah skema, perbarui `src/db/schema.sql`, seeder, layanan terkait, dan pengujian. Gunakan `npm run db:reset` hanya pada database simulasi karena perintah itu menghapus data lokal.
- Pertahankan panjang berkas pada kisaran 200 sampai 300 baris bila memungkinkan, dan pecah berkas berdasarkan tanggung jawab sebelum melampaui 400 baris.
- Jalankan `npm test` setelah perubahan pada rumus, validasi, route, atau tampilan. Untuk perubahan UI, periksa juga viewport mobile, fokus keyboard, dan media cetak.

## Catatan Simulasi dan Batasan

- Aplikasi ini adalah simulasi akademik, bukan alat penilaian resmi.
- Hasil TOPSIS menunjukkan kedekatan terhadap solusi ideal, bukan kualitas pribadi secara mutlak.
- Tidak ada login, jadi jangan menjalankan aplikasi ini di internet terbuka tanpa lapisan keamanan tambahan.
- Database memakai satu berkas SQLite lokal. Pencadangan cukup dilakukan dengan menyalin berkas database saat server berhenti.
- Perhitungan berjalan sinkron di proses Node.js. Untuk data yang jauh lebih besar, perhitungan perlu dipindahkan ke worker atau antrean.
