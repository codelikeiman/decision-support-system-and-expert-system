# Platform SPK / Sistem Pakar Multi-Tenant

Satu instalasi (1 aplikasi Next.js + 1 database Supabase/PostgreSQL) untuk melayani banyak client
(klinik, puskesmas, instansi). Setiap client dapat menjalankan banyak **SPK Case**
sekaligus, masing-masing dengan salah satu dari **15 metode**. Metode, kriteria/gejala,
bobot, aturan, alternatif, teks, logo, dan warna diatur dari dashboard — tanpa mengubah
kode dan tanpa redeploy.

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Database**: Supabase (PostgreSQL) + Prisma ORM · **Berkas**: Supabase Storage
- **Hosting**: Vercel (serverless) — lihat [bagian 9](#9-deploy-ke-supabase--vercel)
- **Auth**: NextAuth.js (Credentials + bcrypt), sesi JWT, middleware berbasis peran
- **UI**: Tailwind CSS v4 + komponen bergaya shadcn/ui, tema warna per client lewat CSS variable
- **Rumus**: KaTeX · **PDF**: puppeteer-core + Chromium serverless · **Form**: Zod + react-hook-form · **Uji**: Vitest

> **Penting.** Basis pengetahuan pada data contoh (`npm run db:seed`) hanyalah ilustrasi
> untuk mendemonstrasikan fitur. Itu **bukan acuan medis**. Isi dengan pengetahuan pakar
> yang sebenarnya sebelum dipakai, dan lakukan Uji Validitas.

---

## 1. Menjalankan di komputer lokal

Prasyarat: **Node.js ≥ 22.17**, sebuah database **PostgreSQL** (proyek Supabase, atau
PostgreSQL lokal untuk pengembangan), dan **Google Chrome** (untuk ekspor PDF lokal).

```bash
npm install                 # memasang dependensi + prisma generate
cp .env.example .env        # lalu isi DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET
npm run db:deploy           # membuat seluruh tabel + mengaktifkan RLS
npm run db:seed             # Super Admin + data contoh
npm run dev                 # http://localhost:3000
```

Pengembangan lokal tidak wajib memakai Supabase: PostgreSQL biasa cukup (isi `DATABASE_URL`
dan `DIRECT_URL` dengan URL yang sama, kosongkan `SUPABASE_*` sehingga berkas unggahan
disimpan di `UPLOAD_DIR`).

Variabel lingkungan (lihat `.env.example`):

| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | Supabase **transaction pooler** (port 6543) + `?pgbouncer=true&connection_limit=5&pool_timeout=20` — dipakai aplikasi |
| `DIRECT_URL` | Supabase **session pooler** (port 5432) — dipakai `prisma migrate` |
| `SUPABASE_URL` | `https://PROJECT_REF.supabase.co` — untuk Supabase Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | Kunci *service role* / *secret key*. **Rahasia**, hanya di server |
| `SUPABASE_STORAGE_BUCKET` | Nama bucket (bawaan `spk-uploads`, privat, dibuat otomatis) |
| `NEXTAUTH_SECRET` | Kunci rahasia sesi. **Wajib diganti** (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | URL aplikasi. Di Vercel isi dengan domain produksi |
| `NEXT_PUBLIC_SITE_URL` | URL publik untuk tag Open Graph (gambar pratinjau tautan) |
| `NEXT_PUBLIC_APP_TIMEZONE` | Zona waktu tampilan (bawaan `Asia/Jakarta`) |
| `UPLOAD_DIR` | Folder unggahan lokal — hanya dipakai bila `SUPABASE_*` kosong |
| `PUPPETEER_EXECUTABLE_PATH` | Opsional, lokal saja: lokasi Chrome/Chromium untuk PDF |
| `SEED_SUPERADMIN_EMAIL`, `SEED_SUPERADMIN_PASSWORD` | Akun Super Admin awal |
| `SEED_DEMO` | `false` agar seed hanya membuat Super Admin |

### Akun contoh (dibuat oleh seed)

| Peran | Email | Kata sandi | Masuk di |
|---|---|---|---|
| Super Admin | `superadmin@spk.local` | `SuperAdmin#2026` | `/login` |
| Admin — Klinik Sehat Bersama | `admin@kliniksehat.test` | `AdminKlinik#2026` | `/login` |
| Admin — Puskesmas Harapan Kita | `admin@puskesmasharapan.test` | `AdminPuskesmas#2026` | `/login` |
| End-user — Puskesmas Harapan Kita | `pasien@contoh.test` | `Pasien#2026` | `/c/puskesmas-harapan-kita/masuk` |

**Ganti semua kata sandi ini** sebelum aplikasi dapat diakses orang lain.

Enam Case contoh:

| Client | Case | Metode | Kategori |
|---|---|---|---|
| Klinik Sehat Bersama | Skrining Risiko Penyakit Jantung | SAW (mode kesesuaian profil) | A |
| Klinik Sehat Bersama | Diagnosis Infeksi Saluran Pernapasan | Certainty Factor | B |
| Klinik Sehat Bersama | Tingkat Risiko Hipertensi | Fuzzy Mamdani | C |
| Klinik Sehat Bersama | Diagnosis Penyakit Gigi dan Mulut | Forward Chaining | D |
| Puskesmas Harapan Kita | Diagnosis Penyakit Kulit (wajib login) | Dempster-Shafer | B |
| Puskesmas Harapan Kita | Rekomendasi Paket Medical Check-Up | TOPSIS (mode preferensi) | A |

### Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` / `build` / `start` | Pengembangan / build / produksi |
| `npm test` | Unit test seluruh engine & pipeline (Vitest) |
| `npm run test:integration` | Uji integrasi dengan database: isolasi tenant & ke-15 metode lewat pipeline penuh |
| `npm run typecheck` | Pemeriksaan tipe TypeScript |
| `npm run db:deploy` | Menerapkan migrasi ke database (memakai `DIRECT_URL`) |
| `npm run vercel-build` | Perintah build di Vercel: generate Prisma → migrasi → `next build` |
| `npm run db:migrate` | Membuat migrasi baru saat skema diubah (pengembangan) |
| `npm run db:seed` | Mengisi data awal (aman dijalankan ulang) |
| `npm run db:studio` | Prisma Studio |

---

## 2. Peran dan alur

```
Platform
 └─ Client (tenant)                  → /c/[client-slug]
     └─ SPK Case (satu metode)       → /c/[client-slug]/[case-slug]
         ├─ Alternatif / hasil diagnosis
         ├─ Basis pengetahuan (bentuknya mengikuti kategori metode)
         ├─ Riwayat konsultasi + langkah perhitungan
         └─ Dataset uji validitas
```

| Peran | Area | Kewenangan |
|---|---|---|
| **Super Admin** | `/super-admin` | Client (CRUD, logo, warna), Case (buat/hapus, **metode**, slug, wajib-login, aktif), akun, pengaturan global, pemantauan lintas client. Dapat membuka basis pengetahuan Case mana pun. |
| **Admin** | `/admin` | Hanya client-nya: alternatif, kriteria/gejala/variabel/aturan, tampilan, riwayat, uji validitas. Tidak dapat mengganti metode, membuat client, atau melihat client lain. |
| **End-user** | `/c/...` | Mengisi form, melihat hasil & rincian perhitungan, mengunduh PDF. Bila Case `requires_login`, wajib punya akun (terikat pada client) dan riwayatnya tersimpan. |

Alur menambah layanan baru: Super Admin membuat Client → membuat Case dan memilih metode →
Admin mengisi basis pengetahuan mengikuti **daftar periksa kesiapan** di halaman Ringkasan
Case → layanan langsung dapat dipakai di halaman publik.

---

## 3. Lima belas metode

Setiap metode adalah *pure function* di `lib/engines/` yang menerima input terstruktur dan
mengembalikan `{ hasil, ranking, steps }`. Tidak ada akses database di dalam engine.

| Kat. | Metode | Berkas | Rujukan rumus |
|---|---|---|---|
| A | SAW | `saw.ts` | Fishburn (1967); MacCrimmon (1968) |
| A | WP | `wp.ts` | Bridgman (1922); Yoon & Hwang (1995) |
| A | TOPSIS | `topsis.ts` | Hwang & Yoon (1981) |
| A | AHP | `ahp.ts` | Saaty (1980) |
| A | MOORA | `moora.ts` | Brauers & Zavadskas (2006) |
| A | MABAC | `mabac.ts` | Pamučar & Ćirović (2015) |
| A | EDAS | `edas.ts` | Keshavarz Ghorabaee dkk. (2015) |
| A | WASPAS | `waspas.ts` | Zavadskas dkk. (2012) |
| B | Certainty Factor | `certainty-factor.ts` | Shortliffe & Buchanan (1975) |
| B | Dempster-Shafer | `dempster-shafer.ts` | Dempster (1967); Shafer (1976) |
| B | Naive Bayes | `naive-bayes.ts` | Teorema Bayes |
| B | Bayesian Network (sederhana) | `bayesian-network.ts` | Pearl (1988) |
| C | Fuzzy Tsukamoto | `fuzzy-tsukamoto.ts` | Tsukamoto (1979) |
| C | Fuzzy Mamdani | `fuzzy-mamdani.ts` | Mamdani & Assilian (1975) |
| D | Forward Chaining | `forward-chaining.ts` | Giarratano & Riley (2005) |

Kategori menentukan skema data, form basis pengetahuan di dashboard, dan form konsultasi
end-user. Mengganti metode **dalam kategori yang sama** (mis. SAW → TOPSIS) langsung memakai
basis pengetahuan yang sama. Mengganti ke kategori lain membuat basis pengetahuan lama tidak
terpakai (datanya tetap tersimpan).

### Keputusan rancangan yang perlu diketahui

Spesifikasi tidak merinci beberapa hal; berikut pilihan yang diambil dan alasannya.
Semua pilihan ini tampil secara eksplisit di rincian langkah perhitungan.

**Kategori A — bagaimana jawaban pengguna dipakai (`mcdm_mode`, diatur Super Admin per Case)**

- **Kesesuaian profil** (bawaan, untuk diagnosis/skrining). Pakar mengisi *profil acuan* tiap
  alternatif pada skala yang sama dengan jawaban pengguna. Matriks keputusan berisi nilai
  kesesuaian `x_ij = s_j(maks) − |u_j − a_ij|` (jawaban pengguna `u_j`, profil `a_ij`), lalu
  metode yang dipilih dijalankan seperti biasa. Karena yang dihitung adalah kesesuaian, semua
  kriteria diperlakukan sebagai benefit.
- **Preferensi** (untuk pemilihan/rekomendasi). Matriks pakar dipakai apa adanya dan tipe
  benefit/cost berlaku. Jawaban pengguna adalah tingkat kepentingan kriteria yang menyesuaikan
  bobot: `w'_j = w_j·u_j / Σ w_k·u_k`.

  Alasan tidak memakai satu cara saja: bila jawaban hanya dijadikan pengali bobot, alternatif
  yang "mendominasi" matriks selalu menang apa pun jawaban pengguna — keliru untuk diagnosis.

**AHP** — bobot kriteria dihitung dari matriks perbandingan berpasangan (rata-rata kolom
ternormalisasi), `λ maks = Σ (jumlah kolom × bobot)`. Perbandingan dengan **CR > 0,1 ditolak
saat disimpan**. Nilai alternatif disintesis dengan normalisasi distributif.

**Dempster-Shafer** — nilai pakar yang sama pada satu gejala membentuk satu himpunan
penyakit (bentuk tabel densitas yang lazim). Bila satu gejala diberi nilai berbeda untuk
penyakit berbeda, tiap nilai menjadi evidence tersendiri. Skor alternatif = densitas
tertinggi dari himpunan yang memuatnya; Belief dan Plausibility ikut ditampilkan.

**Naive Bayes** — perkalian atas gejala yang dipilih pengguna. Nilai kosong berarti
probabilitas 0. Prior per alternatif opsional (bila tidak lengkap, dipakai prior seragam).

**Bayesian Network** — tiap gejala bergantung pada penyakit dan boleh bergantung pada gejala
lain. Tabel probabilitas bersyaratnya memakai model *noisy-OR*:
`P(e|H, induk) = 1 − (1 − P(e|H))·Π(1 − P(e|induk))` untuk induk yang juga dipilih pengguna.
Tanpa dependensi hasilnya identik dengan Naive Bayes. Dependensi yang membentuk siklus ditolak.

**Fuzzy** — defuzzifikasi menghasilkan nilai crisp; alternatif ditentukan dari derajat
keanggotaan nilai crisp itu pada himpunan output yang menjadi konsekuen aturan tiap alternatif.
Centroid Mamdani dihitung **eksak** (integral garis lurus sepotong-sepotong), bukan sampling.
Tsukamoto mensyaratkan himpunan output monoton; untuk segitiga/trapesium dipakai titik tengah
potongan-α dan diberi peringatan.

> Catatan uji: contoh produksi makanan kaleng (Kusumadewi & Purnomo) menuliskan hasil Mamdani
> 4247,74. Angka itu muncul karena koefisien integral 0,0000667 dibulatkan menjadi 0,000067;
> integral eksaknya memberi **4236,77** — nilai inilah yang dihasilkan engine. Hasil
> Tsukamoto (4983,33) sama dengan buku.

**Forward Chaining** — operator DAN dievaluasi lebih dulu daripada ATAU. Hasil diurutkan
menurut jumlah aturan yang terpenuhi; bila tidak ada aturan terpenuhi, tidak ada diagnosis
(kecocokan parsial tetap ditampilkan sebagai informasi).

---

## 4. Transparansi perhitungan

1. **Log langkah.** Semua engine menulis setiap tahap (tabel + rumus LaTeX + contoh
   substitusi angka) ke tabel `calculation_steps` untuk setiap konsultasi.
2. **Halaman hasil.** Rincian dirender sebagai tabel dan rumus KaTeX, ringkas secara bawaan
   dan dapat dibuka ("Lihat detail perhitungan").
3. **Laporan PDF.** Tombol "Unduh Laporan" memanggil `/api/consultations/[kode]/pdf`
   (Puppeteer). Dokumen memuat identitas, input, hasil, peringkat, dan seluruh langkah.
4. **Uji validitas.** Admin membuat dataset uji (input + diagnosis pakar), menjalankannya
   lewat jalur perhitungan yang sama dengan konsultasi, lalu melihat akurasi, tabel kecocokan
   (confusion table), serta recall/presisi per alternatif.

Halaman web dan PDF memakai perender yang sama (`lib/report/render.ts`), sehingga isinya
selalu identik.

### Ekspor PDF

- **Di Vercel**: memakai `puppeteer-core` + `@sparticuz/chromium` (Chromium versi serverless,
  sudah ikut terkemas ke fungsi `/api/consultations/[kode]/pdf`). Tidak perlu pengaturan.
- **Di komputer lokal**: memakai Google Chrome/Edge yang terpasang (dicari otomatis), atau
  arahkan `PUPPETEER_EXECUTABLE_PATH` ke lokasinya.

Versi keduanya dipasangkan: `puppeteer-core@25.11.0` ↔ Chromium 153. Bila salah satu diperbarui,
perbarui pasangannya. Bila browser tidak tersedia, tombol unduh otomatis membuka versi cetak
(HTML) sehingga pengguna tetap dapat memilih "Simpan sebagai PDF".

## 5. Isolasi data dan keamanan

- Setiap tabel domain memiliki `client_id` (dan `case_id` bila relevan).
- Kode Admin/End-user **tidak pernah** memakai Prisma client mentah, melainkan
  `tenantDb(clientId)` (`lib/tenant.ts`): ekstensi Prisma yang menambahkan `client_id` pada
  setiap `where` dan menimpa `client_id` pada setiap `create`. Filter berlaku di lapisan
  query, bukan hanya di UI.
- `requireCaseAccess()` (`lib/guards.ts`) mencari Case melalui `tenantDb` milik admin; Case
  client lain menghasilkan 404.
- `middleware.ts` memeriksa peran dari token; guard di server memeriksa ulang pengguna ke
  database pada setiap request, sehingga akun yang dinonaktifkan langsung kehilangan akses.
- Hasil konsultasi memakai kode acak (`KS-…`) dan hanya dapat dibuka oleh pembuatnya (akun
  atau cookie sesi), pengelola client tersebut, atau Super Admin.
- **Supabase Data API ditutup.** Aplikasi tidak memakai Data API (PostgREST); semua akses lewat
  Prisma. Migrasi `supabase_rls` mengaktifkan Row Level Security di **semua** tabel tanpa policy
  dan mencabut hak peran `anon`/`authenticated`, sehingga anon key tidak dapat membaca data
  apa pun. Uji integrasi memeriksa hal ini. **Setiap tabel baru di migrasi berikutnya wajib
  diberi `ALTER TABLE … ENABLE ROW LEVEL SECURITY`** (uji integrasi akan gagal bila lupa).
- Kata sandi di-hash dengan bcrypt; percobaan login, pendaftaran, dan konsultasi dibatasi per
  jendela waktu. Hitungannya disimpan di tabel `rate_limits`, sehingga berlaku di semua instance
  serverless.
- Unggahan dibatasi 2 MB, hanya PNG/JPG/WEBP/GIF (diperiksa dari *magic bytes*), disimpan di
  bucket Supabase Storage **privat** dan disajikan lewat `/api/files/…`. Kunci *service role*
  hanya dipakai di server.
- Warna tema divalidasi sebagai `#RRGGBB`; seluruh teks pada rincian perhitungan di-escape dan
  rumus dirender KaTeX dengan `trust: false`.

---

## 6. Struktur proyek

```
app/
  (super-admin)/super-admin/...    dashboard Super Admin
  (admin)/admin/...                dashboard Admin (per Case)
  c/[clientSlug]/[caseSlug]/...    halaman publik end-user
  api/                             auth, PDF, unggah & berkas
components/
  ui/                              komponen dasar bergaya shadcn/ui
  admin/, super-admin/, public/    editor & form tiap area
  consultation-fields.tsx          form generator konsultasi (satu per kategori)
  result-view.tsx                  tampilan hasil (publik & admin)
lib/
  engines/                         15 metode (pure function) + registry
  spk/                             pemuat konfigurasi, validasi input, pipeline, kesiapan
  report/                          perender langkah, dokumen laporan, PDF (Chromium)
  storage.ts, uploads.ts           Supabase Storage / folder lokal
  og.tsx, site.ts                  gambar pratinjau tautan (Open Graph) & URL situs
  actions/                         server action (dengan guard & validasi Zod)
  schemas/                         skema Zod bersama untuk form dan server
  tenant.ts, guards.ts, auth.ts    isolasi tenant, guard peran, NextAuth
prisma/
  schema.prisma, migrations/, seed.ts
tests/                             unit test engine & pipeline
```

### Menambah metode baru

1. Tulis engine di `lib/engines/<nama>.ts` yang mengembalikan `EngineResult` (lihat `types.ts`).
2. Daftarkan kuncinya di `METHOD_KEYS` (`types.ts`) serta `METHODS` dan peta engine
   (`index.ts`).
3. Tambahkan unit test di `tests/engines/`.

Bila metode memakai skema kategori yang sudah ada (mis. Backward Chaining memakai skema
Kategori D), tidak ada perubahan database maupun UI yang diperlukan.

---

## 7. Pengujian

```bash
npm test
```

Unit test (`tests/engines`, `tests/spk`) mencakup seluruh engine (nilai acuan dihitung dengan
implementasi terpisah dan contoh buku teks, mis. contoh Weighted Product lokasi gudang
Kusumadewi dkk. dengan `V = 0,3669; 0,3682; 0,2649`), kasus tepi (kolom seragam, nilai nol,
konflik total), serta pipeline konsultasi (pembentukan matriks, validasi input, cek kesiapan).
Unit test tidak membutuhkan database.

```bash
npm run test:integration
```

Uji integrasi (`tests/integration`) membutuhkan database pada `DATABASE_URL` yang skemanya
sudah diterapkan. Uji ini membuat datanya sendiri lalu menghapusnya, dan memeriksa:

- **isolasi tenant** — melalui `tenantDb`, client A tidak dapat membaca, mengubah, menghapus,
  atau menyisipkan data ke client B, termasuk di dalam transaksi;
- **ke-15 metode** — konfigurasi dimuat dari database, dihitung, disimpan beserta langkahnya,
  dibaca kembali, lalu dirender ke HTML halaman hasil dan dokumen laporan PDF.
- **keamanan Supabase** — RLS aktif di semua tabel `public` dan peran `anon`/`authenticated`
  tidak punya hak akses;
- **pembatas percobaan** — batas dipatuhi, termasuk saat banyak permintaan bersamaan;
- **Supabase Storage** — unggah, unduh, hapus, dan hapus-per-client terhadap server tiruan
  API Storage (bucket privat dibuat otomatis, service role key dikirim).

Jalankan uji integrasi terhadap database pengembangan atau proyek Supabase khusus pengujian,
bukan database produksi.

---

## 8. Pratinjau tautan (Open Graph)

Saat tautan dibagikan di WhatsApp, Telegram, LinkedIn, X, atau Facebook, aplikasi menyediakan
judul, deskripsi, dan gambar pratinjau 1200×630 PNG (±50–80 KB) yang dibuat otomatis:

| Tautan | Judul & deskripsi | Gambar |
|---|---|---|
| `/` | Nama & deskripsi platform (Pengaturan global) | Kartu platform |
| `/c/[client]` | Nama & deskripsi client | Warna, logo, dan nama client |
| `/c/[client]/[case]` dan semua halaman di bawahnya | Judul & deskripsi Case | Judul Case, metode, warna & logo client |

Tag yang dihasilkan: `og:title`, `og:description`, `og:url`, `og:type`, `og:locale`,
`og:site_name`, `og:image` (+ `width`, `height`, `type`, `alt`), serta `twitter:card`
(`summary_large_image`), `twitter:title`, `twitter:description`, `twitter:image`.

- Semua isi berasal dari dashboard: mengubah judul/deskripsi Case, nama client, warna, atau
  logo langsung memperbarui pratinjau. Logo PNG/JPG ikut tampil; WEBP/GIF diganti inisial.
- Halaman hasil konsultasi memakai pratinjau Case-nya, **tidak pernah** data konsultasi.
- Case nonaktif atau tidak ada menampilkan pratinjau client/platform.
- Isi `NEXT_PUBLIC_SITE_URL` dengan domain produksi agar URL gambar mutlak dan benar.
- WhatsApp, LinkedIn, dan Facebook menyimpan pratinjau lama di cache. Setelah mengubah
  tampilan, segarkan lewat [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)
  atau [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) (WhatsApp
  memakai cache yang sama dengan Facebook).
- URL pratinjau Vercel (`*.vercel.app` untuk preview) biasanya dilindungi *Deployment
  Protection*, sehingga crawler tidak dapat membacanya — uji pratinjau di domain produksi.

---

## 9. Deploy ke Supabase + Vercel

### a. Siapkan Supabase

1. Buat proyek di [supabase.com](https://supabase.com/dashboard). Pilih region
   **Southeast Asia (Singapore)** agar dekat dengan fungsi Vercel. Simpan kata sandi database.
2. Klik **Connect** di bagian atas proyek, lalu salin:
   - **Transaction pooler** (port 6543) → `DATABASE_URL`, tambahkan
     `?pgbouncer=true&connection_limit=5&pool_timeout=20` di akhir.
   - **Session pooler** (port 5432) → `DIRECT_URL`.
3. **Project Settings → API Keys**: salin URL proyek (`SUPABASE_URL`) dan kunci *service role* /
   *secret key* (`SUPABASE_SERVICE_ROLE_KEY`).
4. Buat tabel dan data awal dari komputer Anda (sekali saja):

   ```bash
   npm run db:deploy
   npm run db:seed
   ```

   Pastikan `.env` berisi kredensial Supabase. Bucket Storage dibuat otomatis saat unggahan
   pertama. Setelah itu, buka **Advisors → Security** di dashboard Supabase: tidak boleh ada
   peringatan "RLS disabled".

### b. Siapkan Vercel

1. Push kode ke GitHub/GitLab, lalu **Add New → Project** di Vercel dan impor repositorinya.
   Framework terdeteksi otomatis; `vercel.json` sudah mengatur build command dan region
   `sin1` (Singapura).
2. Isi **Environment Variables** (Production, dan Preview bila perlu):

   | Variabel | Nilai |
   |---|---|
   | `DATABASE_URL` | transaction pooler + `?pgbouncer=true&connection_limit=5&pool_timeout=20` |
   | `DIRECT_URL` | session pooler |
   | `SUPABASE_URL` | URL proyek Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | kunci service role (tandai *Sensitive*) |
   | `NEXTAUTH_SECRET` | hasil `openssl rand -base64 32` (tandai *Sensitive*) |
   | `NEXTAUTH_URL` | `https://domain-anda` (Production saja) |
   | `NEXT_PUBLIC_SITE_URL` | `https://domain-anda` |
   | `NEXT_PUBLIC_APP_TIMEZONE` | `Asia/Jakarta` |

3. **Deploy.** Build menjalankan `prisma generate` → `prisma migrate deploy` → `next build`,
   sehingga migrasi baru diterapkan otomatis setiap deploy.
4. Tambahkan domain sendiri di **Settings → Domains**, lalu perbarui `NEXTAUTH_URL` dan
   `NEXT_PUBLIC_SITE_URL` dan deploy ulang.

Setelah itu, setiap `git push` ke branch utama otomatis membangun, memigrasi, dan merilis.
Branch lain menghasilkan deployment *preview*.

> **Preview memakai database yang sama** bila variabel Preview diisi dengan kredensial
> produksi, dan migrasinya ikut dijalankan. Untuk perubahan skema yang berisiko, pakai proyek
> Supabase terpisah untuk Preview.

### c. Batasan yang perlu diketahui

- **Paket Vercel Hobby** hanya untuk penggunaan non-komersial; untuk layanan klinik/instansi
  gunakan paket Pro. Fungsi PDF diberi batas waktu 60 detik (biasanya selesai dalam beberapa
  detik; permintaan pertama setelah lama tidak dipakai sedikit lebih lambat karena Chromium
  harus diekstrak).
- **Supabase Free** menjeda proyek yang tidak aktif selama seminggu. Untuk produksi gunakan
  paket berbayar.
- Ukuran fungsi PDF ±95 MB (batas Vercel 250 MB).

---

## 10. Catatan penerapan

- Cadangkan database lewat fitur backup Supabase; berkas unggahan berada di Supabase Storage
  (bucket `spk-uploads`).
- Ganti semua kata sandi akun contoh sebelum aplikasi dapat diakses orang lain.
- Hasil sistem adalah alat bantu keputusan. Tampilkan dan pertahankan teks catatan (diatur di
  Pengaturan global) pada halaman hasil.
