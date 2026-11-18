/**
 * Data awal platform.
 *
 *   npm run db:seed
 *
 * - Selalu memastikan satu akun Super Admin tersedia (dari SEED_SUPERADMIN_*).
 * - Bila SEED_DEMO tidak diset "false", membuat dua client contoh dengan enam
 *   SPK Case (satu atau lebih per kategori metode), data uji validitas, dan
 *   beberapa riwayat konsultasi.
 *
 * PENTING: seluruh basis pengetahuan contoh di bawah ini hanya ILUSTRASI untuk
 * mendemonstrasikan fitur platform — bukan acuan medis. Ganti dengan
 * pengetahuan pakar yang sebenarnya sebelum dipakai.
 */
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db';
import { METHODS, type MethodKey } from '../lib/engines';
import { loadCaseConfig } from '../lib/spk/config';
import { hitungDanSimpan } from '../lib/spk/consultation';
import { computeConsultation } from '../lib/spk/compute';
import { describeInput, validateInput, type ConsultationInput } from '../lib/spk/input';
import { checkReadiness } from '../lib/spk/readiness';
import { tenantDb } from '../lib/tenant';

const hash = (password: string) => bcrypt.hash(password, 10);

async function pastikanSuperAdmin() {
  const email = (process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@spk.local').toLowerCase();
  const password = process.env.SEED_SUPERADMIN_PASSWORD || 'SuperAdmin#2026';
  const ada = await prisma.user.findFirst({ where: { role: 'super_admin' } });
  if (ada) {
    console.log(`• Super Admin sudah ada (${ada.email}) — dilewati.`);
    return;
  }
  await prisma.user.create({ data: { role: 'super_admin', nama: 'Super Admin', email, passwordHash: await hash(password) } });
  console.log(`✓ Super Admin dibuat: ${email}`);
}

interface CaseSeed {
  judul: string;
  slug: string;
  deskripsi: string;
  instruksi: string;
  methodKey: MethodKey;
  mcdmMode?: 'profil' | 'preferensi';
  requiresLogin?: boolean;
}

async function buatCase(clientId: number, s: CaseSeed) {
  return prisma.spkCase.create({
    data: {
      clientId,
      judul: s.judul,
      slug: s.slug,
      deskripsi: s.deskripsi,
      instruksi: s.instruksi,
      methodKey: s.methodKey,
      category: METHODS[s.methodKey].kategori,
      mcdmMode: s.mcdmMode ?? 'profil',
      requiresLogin: s.requiresLogin ?? false,
      isActive: true,
    },
  });
}

async function buatAlternatif(clientId: number, caseId: number, daftar: { nama: string; deskripsi: string; saran: string }[]) {
  const hasil: { id: number }[] = [];
  for (let i = 0; i < daftar.length; i++) {
    hasil.push(
      await prisma.alternative.create({
        data: { clientId, caseId, namaAlternatif: daftar[i].nama, deskripsiHasil: daftar[i].deskripsi, saranTindakan: daftar[i].saran, urutan: i },
      }),
    );
  }
  return hasil;
}

async function buatGejala(clientId: number, caseId: number, nama: string[]) {
  const hasil = [];
  for (let i = 0; i < nama.length; i++) {
    hasil.push(
      await prisma.symptom.create({
        data: { clientId, caseId, kodeGejala: `G${String(i + 1).padStart(2, '0')}`, namaGejala: nama[i], urutan: i },
      }),
    );
  }
  return hasil;
}

/** Jalankan beberapa konsultasi contoh melalui pipeline yang sama dengan end-user. */
async function konsultasiContoh(clientId: number, caseId: number, daftar: { nama: string; input: ConsultationInput }[]) {
  const db = tenantDb(clientId);
  const kasus = await db.spkCase.findFirstOrThrow({ where: { id: caseId } });
  const config = await loadCaseConfig(db, kasus);
  const kesiapan = checkReadiness(config);
  if (!kesiapan.siap) throw new Error(`Case "${kasus.judul}" belum siap: ${kesiapan.issues.map((i) => i.pesan).join('; ')}`);
  for (const d of daftar) {
    const cek = validateInput(config, d.input);
    if (!cek.ok) throw new Error(`Input contoh tidak valid untuk "${kasus.judul}": ${cek.error}`);
    await hitungDanSimpan(db, { config, input: cek.input, userId: null, sessionId: null, namaResponden: d.nama });
  }
  return config;
}

/** Buat dataset uji dan langsung jalankan pengujiannya. */
async function datasetUji(clientId: number, caseId: number, nama: string, daftar: { label: string; pakar: number; input: ConsultationInput }[]) {
  const db = tenantDb(clientId);
  const kasus = await db.spkCase.findFirstOrThrow({ where: { id: caseId } });
  const config = await loadCaseConfig(db, kasus);
  const test = await prisma.validationTest.create({
    data: { clientId, caseId, namaDatasetUji: nama, lastRunAt: new Date(), lastRunMethod: kasus.methodKey },
  });
  let cocok = 0;
  for (const d of daftar) {
    const cek = validateInput(config, d.input);
    if (!cek.ok) throw new Error(`Data uji tidak valid (${d.label}): ${cek.error}`);
    const r = computeConsultation(config, cek.input);
    const sama = r.hasil.alternativeId === d.pakar;
    if (sama) cocok += 1;
    await prisma.validationTestItem.create({
      data: {
        clientId,
        validationTestId: test.id,
        label: d.label,
        inputDataJson: { ...cek.input, ringkasan: describeInput(config, cek.input) } as unknown as Prisma.InputJsonValue,
        diagnosisPakarAlternativeId: d.pakar,
        hasilSistemAlternativeId: r.hasil.alternativeId,
        skor: r.hasil.skor,
        status: sama ? 'match' : 'mismatch',
        catatan: r.hasil.alternativeId === null ? r.hasil.ringkasan : null,
      },
    });
  }
  console.log(`  · dataset uji "${nama}": ${cocok}/${daftar.length} sesuai`);
}

const SKALA_FREKUENSI = [
  { label: 'Tidak pernah', nilai: 1 },
  { label: 'Jarang', nilai: 2 },
  { label: 'Kadang-kadang', nilai: 3 },
  { label: 'Sering', nilai: 4 },
  { label: 'Selalu', nilai: 5 },
];
const SKALA_KEPENTINGAN = [
  { label: 'Tidak penting', nilai: 1 },
  { label: 'Kurang penting', nilai: 2 },
  { label: 'Cukup penting', nilai: 3 },
  { label: 'Penting', nilai: 4 },
  { label: 'Sangat penting', nilai: 5 },
];

async function buatKriteria(
  clientId: number,
  caseId: number,
  daftar: { nama: string; pertanyaan: string; tipe?: 'benefit' | 'cost'; bobot: number; skala: { label: string; nilai: number }[] }[],
) {
  const hasil = [];
  for (let i = 0; i < daftar.length; i++) {
    const k = daftar[i];
    hasil.push(
      await prisma.criteriaMcdm.create({
        data: {
          clientId,
          caseId,
          namaKriteria: k.nama,
          pertanyaan: k.pertanyaan,
          tipe: k.tipe ?? 'benefit',
          bobot: k.bobot,
          urutan: i,
          scales: { create: k.skala.map((s, j) => ({ clientId, label: s.label, nilai: s.nilai, urutan: j })) },
        },
      }),
    );
  }
  return hasil;
}

async function isiMatriks(clientId: number, altIds: number[], critIds: number[], nilai: number[][]) {
  await prisma.alternativeValueMcdm.createMany({
    data: nilai.flatMap((row, i) => row.map((v, j) => ({ clientId, alternativeId: altIds[i], criteriaId: critIds[j], nilai: v }))),
  });
}

/* ========================================================================== */

async function demoKlinik() {
  const slug = 'klinik-sehat-bersama';
  if (await prisma.client.findUnique({ where: { slug } })) {
    console.log('• Client contoh "Klinik Sehat Bersama" sudah ada — dilewati.');
    return;
  }
  const client = await prisma.client.create({
    data: {
      namaClient: 'Klinik Sehat Bersama',
      slug,
      deskripsi: 'Layanan konsultasi awal berbasis sistem pakar. Hasil bersifat informasi pendukung dan tidak menggantikan pemeriksaan dokter.',
      warnaPrimary: '#0f766e',
      warnaSecondary: '#134e4a',
      warnaAccent: '#f59e0b',
    },
  });
  const cid = client.id;
  await prisma.user.create({
    data: { clientId: cid, role: 'admin', nama: 'Admin Klinik Sehat', email: 'admin@kliniksehat.test', passwordHash: await hash('AdminKlinik#2026') },
  });
  console.log('✓ Client "Klinik Sehat Bersama" + admin@kliniksehat.test');

  /* ---- Kategori A · SAW (mode kesesuaian profil) ---- */
  {
    const k = await buatCase(cid, {
      judul: 'Skrining Risiko Penyakit Jantung',
      slug: 'skrining-risiko-jantung',
      deskripsi:
        'Skrining mandiri untuk memperkirakan tingkat risiko penyakit jantung berdasarkan keluhan dan gaya hidup. Jawaban Anda dibandingkan dengan profil tiap tingkat risiko menggunakan metode Simple Additive Weighting (SAW).',
      instruksi: 'Jawab setiap pertanyaan sesuai kondisi Anda dalam tiga bulan terakhir. Tidak ada jawaban benar atau salah.',
      methodKey: 'saw',
      mcdmMode: 'profil',
    });
    const alts = await buatAlternatif(cid, k.id, [
      {
        nama: 'Risiko Rendah',
        deskripsi: 'Jawaban Anda paling sesuai dengan profil risiko rendah: keluhan jarang muncul dan gaya hidup relatif sehat.',
        saran: 'Pertahankan pola hidup sehat: aktivitas fisik teratur, tidak merokok, dan pemeriksaan kesehatan berkala setahun sekali.',
      },
      {
        nama: 'Risiko Sedang',
        deskripsi: 'Jawaban Anda paling sesuai dengan profil risiko sedang: terdapat beberapa keluhan atau faktor risiko yang perlu diperhatikan.',
        saran: 'Kurangi faktor risiko yang dapat diubah (rokok, kurang gerak) dan jadwalkan pemeriksaan tekanan darah, gula darah, serta kolesterol.',
      },
      {
        nama: 'Risiko Tinggi',
        deskripsi: 'Jawaban Anda paling sesuai dengan profil risiko tinggi: keluhan sering muncul disertai beberapa faktor risiko utama.',
        saran: 'Segera konsultasikan keluhan Anda ke dokter untuk pemeriksaan lebih lanjut. Bila nyeri dada berat atau menjalar, segera ke IGD.',
      },
    ]);
    const crits = await buatKriteria(cid, k.id, [
      { nama: 'Nyeri dada', pertanyaan: 'Seberapa sering Anda merasakan nyeri atau rasa tertekan di dada saat beraktivitas?', bobot: 5, skala: SKALA_FREKUENSI },
      { nama: 'Sesak napas', pertanyaan: 'Seberapa sering Anda sesak napas saat melakukan aktivitas ringan?', bobot: 4, skala: SKALA_FREKUENSI },
      {
        nama: 'Kebiasaan merokok',
        pertanyaan: 'Bagaimana kebiasaan merokok Anda?',
        bobot: 3,
        skala: [
          { label: 'Tidak pernah merokok', nilai: 1 },
          { label: 'Sudah berhenti', nilai: 2 },
          { label: 'Kadang-kadang', nilai: 3 },
          { label: 'Setiap hari, kurang dari 10 batang', nilai: 4 },
          { label: 'Setiap hari, 10 batang atau lebih', nilai: 5 },
        ],
      },
      {
        nama: 'Aktivitas fisik',
        pertanyaan: 'Seberapa sering Anda berolahraga minimal 30 menit?',
        bobot: 2,
        skala: [
          { label: 'Hampir setiap hari', nilai: 1 },
          { label: '3–4 kali seminggu', nilai: 2 },
          { label: '1–2 kali seminggu', nilai: 3 },
          { label: 'Jarang', nilai: 4 },
          { label: 'Tidak pernah', nilai: 5 },
        ],
      },
      {
        nama: 'Riwayat keluarga',
        pertanyaan: 'Apakah ada keluarga kandung yang menderita penyakit jantung?',
        bobot: 3,
        skala: [
          { label: 'Tidak ada', nilai: 1 },
          { label: 'Ada, pada usia lanjut', nilai: 3 },
          { label: 'Ada, pada usia di bawah 55 tahun', nilai: 5 },
        ],
      },
    ]);
    await isiMatriks(cid, alts.map((a) => a.id), crits.map((c) => c.id), [
      [1, 1, 1, 2, 1],
      [3, 3, 3, 3, 3],
      [5, 4, 5, 5, 5],
    ]);
    const jawab = (v: number[]): ConsultationInput => ({ kategori: 'A', jawaban: Object.fromEntries(crits.map((c, i) => [String(c.id), v[i]])) });
    await konsultasiContoh(cid, k.id, [
      { nama: 'Contoh — Budi', input: jawab([2, 1, 1, 3, 1]) },
      { nama: 'Contoh — Sari', input: jawab([4, 4, 5, 4, 3]) },
    ]);
    await datasetUji(cid, k.id, 'Data uji contoh', [
      { label: 'Kasus 1', pakar: alts[0].id, input: jawab([1, 1, 2, 2, 1]) },
      { label: 'Kasus 2', pakar: alts[0].id, input: jawab([2, 1, 1, 3, 1]) },
      { label: 'Kasus 3', pakar: alts[1].id, input: jawab([3, 2, 3, 4, 3]) },
      { label: 'Kasus 4', pakar: alts[1].id, input: jawab([2, 3, 4, 3, 3]) },
      { label: 'Kasus 5', pakar: alts[2].id, input: jawab([4, 4, 5, 4, 5]) },
      { label: 'Kasus 6', pakar: alts[2].id, input: jawab([5, 5, 4, 5, 3]) },
      { label: 'Kasus 7 (batas)', pakar: alts[1].id, input: jawab([4, 3, 2, 4, 5]) },
    ]);
    console.log('  ✓ Case SAW: Skrining Risiko Penyakit Jantung');
  }

  /* ---- Kategori B · Certainty Factor ---- */
  {
    const k = await buatCase(cid, {
      judul: 'Diagnosis Infeksi Saluran Pernapasan',
      slug: 'diagnosis-infeksi-saluran-pernapasan',
      deskripsi:
        'Konsultasi awal keluhan saluran pernapasan. Pilih gejala yang Anda alami beserta tingkat keyakinan Anda; sistem menghitung tingkat keyakinan tiap kemungkinan dengan metode Certainty Factor.',
      instruksi: 'Centang gejala yang Anda alami, lalu pilih seberapa yakin Anda mengalami gejala tersebut.',
      methodKey: 'certainty_factor',
    });
    const alts = await buatAlternatif(cid, k.id, [
      {
        nama: 'Influenza',
        deskripsi: 'Infeksi virus pada saluran pernapasan yang umumnya ditandai demam, pegal, pilek, dan batuk.',
        saran: 'Istirahat cukup, perbanyak minum, dan gunakan masker. Periksakan diri bila demam lebih dari 3 hari atau sesak napas.',
      },
      {
        nama: 'Faringitis',
        deskripsi: 'Peradangan pada tenggorokan yang menimbulkan nyeri tenggorokan dan nyeri saat menelan.',
        saran: 'Minum air hangat, hindari makanan pedas/berminyak, dan periksakan diri bila nyeri berat atau disertai demam tinggi.',
      },
      {
        nama: 'Bronkitis Akut',
        deskripsi: 'Peradangan saluran bronkus yang ditandai batuk berdahak, kadang disertai rasa berat di dada.',
        saran: 'Hindari asap rokok dan polusi, perbanyak minum, dan periksakan diri bila batuk lebih dari 3 minggu.',
      },
      {
        nama: 'Pneumonia',
        deskripsi: 'Infeksi pada jaringan paru yang dapat menimbulkan demam tinggi, sesak napas, dan nyeri dada.',
        saran: 'Segera periksakan diri ke dokter atau fasilitas kesehatan terdekat untuk pemeriksaan dan penanganan lebih lanjut.',
      },
    ]);
    const g = await buatGejala(cid, k.id, [
      'Demam',
      'Batuk kering',
      'Batuk berdahak',
      'Pilek atau hidung tersumbat',
      'Nyeri tenggorokan',
      'Nyeri saat menelan',
      'Sesak napas',
      'Nyeri dada saat bernapas atau batuk',
      'Nyeri otot dan badan pegal',
      'Sakit kepala',
      'Menggigil',
      'Suara serak',
    ]);
    // [indeks alternatif][kode gejala] = CF pakar
    const cf: Record<number, Record<string, number>> = {
      0: { G01: 0.6, G02: 0.4, G04: 0.8, G05: 0.4, G09: 0.8, G10: 0.6, G11: 0.4 },
      1: { G01: 0.4, G05: 0.8, G06: 0.8, G10: 0.2, G12: 0.6 },
      2: { G01: 0.2, G02: 0.4, G03: 0.8, G07: 0.4, G08: 0.4, G12: 0.2 },
      3: { G01: 0.8, G03: 0.6, G07: 0.8, G08: 0.8, G09: 0.2, G11: 0.6 },
    };
    const byKode = new Map(g.map((x) => [x.kodeGejala, x.id]));
    await prisma.alternativeSymptomWeight.createMany({
      data: Object.entries(cf).flatMap(([ai, peta]) =>
        Object.entries(peta).map(([kode, nilai]) => ({ clientId: cid, alternativeId: alts[Number(ai)].id, symptomId: byKode.get(kode) as number, nilaiPakar: nilai })),
      ),
    });
    const pilih = (kode: string[], keyakinan = 1): ConsultationInput => ({
      kategori: 'B',
      gejala: kode.map((x) => ({ id: byKode.get(x) as number, keyakinan })),
    });
    await konsultasiContoh(cid, k.id, [
      { nama: 'Contoh — Rina', input: pilih(['G01', 'G04', 'G09', 'G10'], 0.8) },
      { nama: 'Contoh — Andi', input: pilih(['G01', 'G03', 'G07', 'G08', 'G11']) },
    ]);
    await datasetUji(cid, k.id, 'Data uji contoh', [
      { label: 'Kasus 1', pakar: alts[0].id, input: pilih(['G01', 'G04', 'G09', 'G10']) },
      { label: 'Kasus 2', pakar: alts[0].id, input: pilih(['G02', 'G04', 'G09', 'G11']) },
      { label: 'Kasus 3', pakar: alts[1].id, input: pilih(['G05', 'G06', 'G12']) },
      { label: 'Kasus 4', pakar: alts[1].id, input: pilih(['G01', 'G05', 'G06']) },
      { label: 'Kasus 5', pakar: alts[2].id, input: pilih(['G02', 'G03', 'G12']) },
      { label: 'Kasus 6', pakar: alts[2].id, input: pilih(['G03', 'G07', 'G08']) },
      { label: 'Kasus 7', pakar: alts[3].id, input: pilih(['G01', 'G03', 'G07', 'G08', 'G11']) },
      { label: 'Kasus 8', pakar: alts[3].id, input: pilih(['G01', 'G07', 'G11']) },
    ]);
    console.log('  ✓ Case Certainty Factor: Diagnosis Infeksi Saluran Pernapasan');
  }

  /* ---- Kategori C · Fuzzy Mamdani ---- */
  {
    const k = await buatCase(cid, {
      judul: 'Tingkat Risiko Hipertensi',
      slug: 'tingkat-risiko-hipertensi',
      deskripsi:
        'Perkiraan tingkat risiko hipertensi dari tekanan darah sistolik, usia, dan indeks massa tubuh menggunakan logika fuzzy metode Mamdani (inferensi MAX–MIN, defuzzifikasi centroid).',
      instruksi: 'Masukkan hasil pengukuran terakhir Anda. Indeks massa tubuh = berat badan (kg) dibagi kuadrat tinggi badan (m).',
      methodKey: 'fuzzy_mamdani',
    });
    const alts = await buatAlternatif(cid, k.id, [
      { nama: 'Risiko Rendah', deskripsi: 'Nilai risiko berada pada kategori rendah.', saran: 'Pertahankan pola makan seimbang, batasi garam, dan periksa tekanan darah secara berkala.' },
      { nama: 'Risiko Sedang', deskripsi: 'Nilai risiko berada pada kategori sedang.', saran: 'Kurangi asupan garam, tingkatkan aktivitas fisik, dan periksa tekanan darah setidaknya sebulan sekali.' },
      { nama: 'Risiko Tinggi', deskripsi: 'Nilai risiko berada pada kategori tinggi.', saran: 'Konsultasikan hasil ini ke dokter untuk pemeriksaan dan penanganan lebih lanjut.' },
    ]);
    const variabel: { nama: string; tipe: 'input' | 'output'; satuan: string; min: number; max: number; sets: { nama: string; fungsi: 'linear_naik' | 'linear_turun' | 'segitiga'; p: number[] }[] }[] = [
      {
        nama: 'Tekanan Darah Sistolik',
        tipe: 'input',
        satuan: 'mmHg',
        min: 90,
        max: 200,
        sets: [
          { nama: 'Normal', fungsi: 'linear_turun', p: [115, 135] },
          { nama: 'Pra-hipertensi', fungsi: 'segitiga', p: [120, 140, 160] },
          { nama: 'Tinggi', fungsi: 'linear_naik', p: [145, 165] },
        ],
      },
      {
        nama: 'Usia',
        tipe: 'input',
        satuan: 'tahun',
        min: 18,
        max: 80,
        sets: [
          { nama: 'Muda', fungsi: 'linear_turun', p: [30, 45] },
          { nama: 'Paruh baya', fungsi: 'segitiga', p: [35, 50, 65] },
          { nama: 'Lanjut', fungsi: 'linear_naik', p: [55, 70] },
        ],
      },
      {
        nama: 'Indeks Massa Tubuh',
        tipe: 'input',
        satuan: 'kg/m²',
        min: 15,
        max: 40,
        sets: [
          { nama: 'Normal', fungsi: 'linear_turun', p: [23, 27] },
          { nama: 'Berlebih', fungsi: 'segitiga', p: [23, 27.5, 32] },
          { nama: 'Obesitas', fungsi: 'linear_naik', p: [28, 33] },
        ],
      },
      {
        nama: 'Tingkat Risiko',
        tipe: 'output',
        satuan: '%',
        min: 0,
        max: 100,
        sets: [
          { nama: 'Rendah', fungsi: 'linear_turun', p: [20, 45] },
          { nama: 'Sedang', fungsi: 'segitiga', p: [30, 50, 70] },
          { nama: 'Tinggi', fungsi: 'linear_naik', p: [55, 80] },
        ],
      },
    ];
    const kunci = ['a', 'b', 'c', 'd'];
    const dibuat = [];
    for (let i = 0; i < variabel.length; i++) {
      const v = variabel[i];
      dibuat.push(
        await prisma.fuzzyVariable.create({
          data: {
            clientId: cid,
            caseId: k.id,
            namaVariabel: v.nama,
            tipe: v.tipe,
            satuan: v.satuan,
            nilaiMin: v.min,
            nilaiMax: v.max,
            urutan: i,
            sets: {
              create: v.sets.map((s, j) => ({
                clientId: cid,
                namaHimpunan: s.nama,
                fungsiKeanggotaan: s.fungsi,
                parameterJson: Object.fromEntries(s.p.map((x, n) => [kunci[n], x])),
                urutan: j,
              })),
            },
          },
          include: { sets: { orderBy: { urutan: 'asc' } } },
        }),
      );
    }
    const [td, usia, imt, risiko] = dibuat;
    // 27 aturan: tingkat 0/1/2 tiap input; tekanan darah berbobot dua kali.
    let urutan = 0;
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        for (let c = 0; c < 3; c++) {
          const total = 2 * a + b + c;
          const tingkat = total <= 2 ? 0 : total <= 4 ? 1 : 2;
          const kondisi = [
            { variable_id: td.id, set_id: td.sets[a].id },
            { variable_id: usia.id, set_id: usia.sets[b].id },
            { variable_id: imt.id, set_id: imt.sets[c].id },
          ];
          await prisma.fuzzyRule.create({
            data: {
              clientId: cid,
              caseId: k.id,
              alternativeId: alts[tingkat].id,
              ruleText: `JIKA ${td.namaVariabel} ${td.sets[a].namaHimpunan} DAN ${usia.namaVariabel} ${usia.sets[b].namaHimpunan} DAN ${imt.namaVariabel} ${imt.sets[c].namaHimpunan} MAKA ${risiko.namaVariabel} ${risiko.sets[tingkat].namaHimpunan}`,
              antesedenJson: { operator: 'AND', kondisi },
              konsekuenJson: { variable_id: risiko.id, set_id: risiko.sets[tingkat].id },
              urutan: urutan++,
            },
          });
        }
      }
    }
    const ukur = (s: number, u: number, m: number): ConsultationInput => ({ kategori: 'C', nilai: { [String(td.id)]: s, [String(usia.id)]: u, [String(imt.id)]: m } });
    await konsultasiContoh(cid, k.id, [
      { nama: 'Contoh — Dewi', input: ukur(118, 29, 22) },
      { nama: 'Contoh — Hendra', input: ukur(152, 58, 29.5) },
    ]);
    console.log('  ✓ Case Fuzzy Mamdani: Tingkat Risiko Hipertensi');
  }

  /* ---- Kategori D · Forward Chaining ---- */
  {
    const k = await buatCase(cid, {
      judul: 'Diagnosis Penyakit Gigi dan Mulut',
      slug: 'diagnosis-penyakit-gigi',
      deskripsi: 'Konsultasi awal keluhan gigi dan mulut. Sistem mencocokkan gejala Anda dengan aturan pakar menggunakan penalaran maju (Forward Chaining).',
      instruksi: 'Centang semua gejala yang sedang Anda alami.',
      methodKey: 'forward_chaining',
    });
    const alts = await buatAlternatif(cid, k.id, [
      { nama: 'Karies Gigi', deskripsi: 'Kerusakan jaringan keras gigi (gigi berlubang).', saran: 'Periksakan ke dokter gigi untuk penambalan. Sikat gigi dua kali sehari dengan pasta gigi berfluorida.' },
      { nama: 'Pulpitis', deskripsi: 'Peradangan pada pulpa (saraf) gigi, biasanya lanjutan dari gigi berlubang.', saran: 'Segera periksakan ke dokter gigi; mungkin diperlukan perawatan saluran akar.' },
      { nama: 'Gingivitis', deskripsi: 'Peradangan gusi akibat penumpukan plak.', saran: 'Perbaiki kebersihan gigi dan mulut, gunakan benang gigi, dan lakukan pembersihan karang gigi.' },
      { nama: 'Periodontitis', deskripsi: 'Peradangan jaringan penyangga gigi yang dapat membuat gigi goyang.', saran: 'Periksakan ke dokter gigi untuk perawatan jaringan penyangga gigi sebelum kerusakan berlanjut.' },
      { nama: 'Abses Gigi', deskripsi: 'Kumpulan nanah akibat infeksi bakteri pada gigi atau gusi.', saran: 'Segera ke dokter gigi. Abses tidak sembuh sendiri dan infeksinya dapat menyebar.' },
    ]);
    const g = await buatGejala(cid, k.id, [
      'Gigi berlubang atau terdapat bintik hitam/cokelat pada gigi',
      'Gigi ngilu saat makan atau minum manis, panas, atau dingin',
      'Sakit gigi berdenyut yang muncul tiba-tiba, terutama malam hari',
      'Gusi merah dan bengkak',
      'Gusi mudah berdarah saat menyikat gigi',
      'Bau mulut yang menetap',
      'Gigi goyang',
      'Gusi turun sehingga gigi tampak lebih panjang',
      'Bengkak pada gusi atau pipi disertai nanah',
      'Demam',
      'Nyeri saat mengunyah atau menggigit',
    ]);
    const id = (kode: string) => g.find((x) => x.kodeGejala === kode)!.id;
    const aturan: { nama: string; alt: number; kondisi: [string, 'AND' | 'OR'][] }[] = [
      { nama: 'Karies — lubang dan ngilu', alt: 0, kondisi: [['G01', 'AND'], ['G02', 'AND']] },
      { nama: 'Karies — lubang dan nyeri kunyah', alt: 0, kondisi: [['G01', 'AND'], ['G11', 'AND']] },
      { nama: 'Pulpitis — ngilu dan nyeri berdenyut', alt: 1, kondisi: [['G02', 'AND'], ['G03', 'AND']] },
      { nama: 'Gingivitis — gusi bengkak dan berdarah', alt: 2, kondisi: [['G04', 'AND'], ['G05', 'AND']] },
      { nama: 'Gingivitis — gusi berdarah dan bau mulut', alt: 2, kondisi: [['G05', 'AND'], ['G06', 'AND']] },
      { nama: 'Periodontitis — gigi goyang dan gusi turun', alt: 3, kondisi: [['G07', 'AND'], ['G08', 'AND']] },
      { nama: 'Periodontitis — radang gusi dan gusi turun', alt: 3, kondisi: [['G04', 'AND'], ['G05', 'AND'], ['G08', 'AND']] },
      { nama: 'Abses — bengkak bernanah dan demam', alt: 4, kondisi: [['G09', 'AND'], ['G10', 'AND']] },
      { nama: 'Abses — bengkak bernanah dengan nyeri', alt: 4, kondisi: [['G09', 'AND'], ['G11', 'AND'], ['G03', 'OR'], ['G09', 'AND']] },
    ];
    for (let i = 0; i < aturan.length; i++) {
      const r = aturan[i];
      await prisma.ruleChaining.create({
        data: {
          clientId: cid,
          caseId: k.id,
          alternativeId: alts[r.alt].id,
          namaRule: r.nama,
          urutan: i,
          conditions: { create: r.kondisi.map(([kode, operator], j) => ({ clientId: cid, symptomId: id(kode), operator, urutan: j })) },
        },
      });
    }
    const pilih = (kode: string[]): ConsultationInput => ({ kategori: 'D', gejala: kode.map(id) });
    await konsultasiContoh(cid, k.id, [
      { nama: 'Contoh — Tono', input: pilih(['G01', 'G02', 'G11']) },
      { nama: 'Contoh — Maya', input: pilih(['G04', 'G05', 'G06']) },
    ]);
    await datasetUji(cid, k.id, 'Data uji contoh', [
      { label: 'Kasus 1', pakar: alts[0].id, input: pilih(['G01', 'G02']) },
      { label: 'Kasus 2', pakar: alts[1].id, input: pilih(['G02', 'G03']) },
      { label: 'Kasus 3', pakar: alts[2].id, input: pilih(['G04', 'G05', 'G06']) },
      { label: 'Kasus 4', pakar: alts[3].id, input: pilih(['G04', 'G05', 'G07', 'G08']) },
      { label: 'Kasus 5', pakar: alts[4].id, input: pilih(['G09', 'G10', 'G11']) },
      { label: 'Kasus 6 (gejala tidak lengkap)', pakar: alts[0].id, input: pilih(['G01']) },
    ]);
    console.log('  ✓ Case Forward Chaining: Diagnosis Penyakit Gigi dan Mulut');
  }
}

async function demoPuskesmas() {
  const slug = 'puskesmas-harapan-kita';
  if (await prisma.client.findUnique({ where: { slug } })) {
    console.log('• Client contoh "Puskesmas Harapan Kita" sudah ada — dilewati.');
    return;
  }
  const client = await prisma.client.create({
    data: {
      namaClient: 'Puskesmas Harapan Kita',
      slug,
      deskripsi: 'Layanan konsultasi mandiri untuk masyarakat. Gunakan hasilnya sebagai bahan diskusi dengan tenaga kesehatan.',
      warnaPrimary: '#1d4ed8',
      warnaSecondary: '#1e3a8a',
      warnaAccent: '#fde047',
    },
  });
  const cid = client.id;
  await prisma.user.createMany({
    data: [
      { clientId: cid, role: 'admin', nama: 'Admin Puskesmas', email: 'admin@puskesmasharapan.test', passwordHash: await hash('AdminPuskesmas#2026') },
      { clientId: cid, role: 'end_user', nama: 'Pasien Contoh', email: 'pasien@contoh.test', passwordHash: await hash('Pasien#2026') },
    ],
  });
  console.log('✓ Client "Puskesmas Harapan Kita" + admin@puskesmasharapan.test + pasien@contoh.test');

  /* ---- Kategori B · Dempster-Shafer (wajib login) ---- */
  {
    const k = await buatCase(cid, {
      judul: 'Diagnosis Penyakit Kulit',
      slug: 'diagnosis-penyakit-kulit',
      deskripsi: 'Konsultasi awal keluhan kulit. Setiap gejala menjadi bukti (evidence) yang digabungkan dengan aturan kombinasi Dempster-Shafer.',
      instruksi: 'Centang semua gejala yang Anda alami. Riwayat konsultasi tersimpan di akun Anda.',
      methodKey: 'dempster_shafer',
      requiresLogin: true,
    });
    const alts = await buatAlternatif(cid, k.id, [
      { nama: 'Dermatitis Atopik (Eksim)', deskripsi: 'Peradangan kulit menahun yang kering, gatal, dan sering kambuh.', saran: 'Gunakan pelembap secara teratur, hindari pemicu, dan konsultasikan ke dokter untuk terapi yang sesuai.' },
      { nama: 'Skabies (Kudis)', deskripsi: 'Infestasi tungau pada kulit yang sangat gatal terutama malam hari dan mudah menular.', saran: 'Periksakan diri dan anggota serumah ke puskesmas; cuci pakaian dan sprei dengan air panas.' },
      { nama: 'Tinea (Jamur Kulit)', deskripsi: 'Infeksi jamur pada kulit, biasanya berupa bercak melingkar dengan tepi kemerahan.', saran: 'Jaga kulit tetap kering dan bersih; konsultasikan penggunaan obat antijamur ke tenaga kesehatan.' },
      { nama: 'Urtikaria (Biduran)', deskripsi: 'Reaksi kulit berupa bentol kemerahan yang gatal dan dapat berpindah-pindah.', saran: 'Kenali dan hindari pemicu; segera ke IGD bila disertai sesak napas atau bengkak pada bibir/kelopak mata.' },
    ]);
    const g = await buatGejala(cid, k.id, [
      'Gatal yang memberat pada malam hari',
      'Kulit kering dan bersisik',
      'Ruam kemerahan',
      'Bercak berbentuk cincin dengan tepi lebih merah',
      'Bentol-bentol yang muncul dan hilang dalam beberapa jam',
      'Bintil kecil di sela jari, pergelangan, atau lipatan kulit',
      'Anggota keluarga atau teman sekamar mengalami gatal serupa',
      'Memiliki riwayat alergi atau asma',
      'Ruam muncul setelah makan atau terkena pemicu tertentu',
      'Kulit menebal karena sering digaruk',
    ]);
    // densitas per gejala → himpunan alternatif yang didukung (indeks alternatif)
    const densitas: [string, number[], number][] = [
      ['G01', [0, 1], 0.6],
      ['G02', [0, 2], 0.6],
      ['G03', [0, 2, 3], 0.4],
      ['G04', [2], 0.9],
      ['G05', [3], 0.9],
      ['G06', [1], 0.8],
      ['G07', [1], 0.7],
      ['G08', [0, 3], 0.6],
      ['G09', [3], 0.7],
      ['G10', [0], 0.7],
    ];
    const byKode = new Map(g.map((x) => [x.kodeGejala, x.id]));
    await prisma.alternativeSymptomWeight.createMany({
      data: densitas.flatMap(([kode, anggota, nilai]) =>
        anggota.map((ai) => ({ clientId: cid, alternativeId: alts[ai].id, symptomId: byKode.get(kode) as number, nilaiPakar: nilai })),
      ),
    });
    const pilih = (kode: string[]): ConsultationInput => ({ kategori: 'B', gejala: kode.map((x) => ({ id: byKode.get(x) as number })) });
    await konsultasiContoh(cid, k.id, [{ nama: 'Contoh — Lestari', input: pilih(['G01', 'G06', 'G07']) }]);
    await datasetUji(cid, k.id, 'Data uji contoh', [
      { label: 'Kasus 1', pakar: alts[1].id, input: pilih(['G01', 'G06', 'G07']) },
      { label: 'Kasus 2', pakar: alts[0].id, input: pilih(['G02', 'G08', 'G10']) },
      { label: 'Kasus 3', pakar: alts[2].id, input: pilih(['G02', 'G03', 'G04']) },
      { label: 'Kasus 4', pakar: alts[3].id, input: pilih(['G03', 'G05', 'G09']) },
      { label: 'Kasus 5', pakar: alts[0].id, input: pilih(['G01', 'G02', 'G08']) },
    ]);
    console.log('  ✓ Case Dempster-Shafer: Diagnosis Penyakit Kulit (wajib login)');
  }

  /* ---- Kategori A · TOPSIS (mode preferensi) ---- */
  {
    const k = await buatCase(cid, {
      judul: 'Rekomendasi Paket Medical Check-Up',
      slug: 'rekomendasi-paket-mcu',
      deskripsi:
        'Bantu memilih paket pemeriksaan kesehatan yang paling sesuai dengan prioritas Anda. Nilai tiap paket ditetapkan penyelenggara; jawaban Anda menentukan seberapa besar pengaruh tiap kriteria (metode TOPSIS).',
      instruksi: 'Nyatakan seberapa penting setiap pertimbangan bagi Anda.',
      methodKey: 'topsis',
      mcdmMode: 'preferensi',
    });
    const alts = await buatAlternatif(cid, k.id, [
      { nama: 'Paket Dasar', deskripsi: 'Pemeriksaan fisik, darah rutin, gula darah, dan urine.', saran: 'Cocok untuk pemeriksaan rutin tahunan pada usia muda tanpa keluhan.' },
      { nama: 'Paket Standar', deskripsi: 'Paket Dasar ditambah profil lemak, fungsi hati, fungsi ginjal, dan rontgen dada.', saran: 'Cocok untuk usia 30 tahun ke atas atau sebagai pemeriksaan berkala yang lebih lengkap.' },
      { nama: 'Paket Eksekutif', deskripsi: 'Pemeriksaan laboratorium lengkap, EKG, USG abdomen, dan konsultasi dokter spesialis.', saran: 'Cocok bagi yang menginginkan gambaran kesehatan menyeluruh.' },
      { nama: 'Paket Jantung Lengkap', deskripsi: 'Fokus pada kesehatan jantung: EKG, treadmill test, ekokardiografi, dan profil lemak.', saran: 'Cocok bagi yang memiliki faktor risiko atau riwayat keluarga penyakit jantung.' },
    ]);
    const crits = await buatKriteria(cid, k.id, [
      { nama: 'Kelengkapan pemeriksaan', pertanyaan: 'Seberapa penting kelengkapan jenis pemeriksaan bagi Anda?', tipe: 'benefit', bobot: 4, skala: SKALA_KEPENTINGAN },
      { nama: 'Biaya', pertanyaan: 'Seberapa penting biaya yang terjangkau bagi Anda?', tipe: 'cost', bobot: 4, skala: SKALA_KEPENTINGAN },
      { nama: 'Lama pemeriksaan', pertanyaan: 'Seberapa penting waktu pemeriksaan yang singkat bagi Anda?', tipe: 'cost', bobot: 2, skala: SKALA_KEPENTINGAN },
      { nama: 'Pemeriksaan jantung', pertanyaan: 'Seberapa penting pemeriksaan jantung yang mendalam bagi Anda?', tipe: 'benefit', bobot: 3, skala: SKALA_KEPENTINGAN },
      { nama: 'Konsultasi dokter', pertanyaan: 'Seberapa penting waktu konsultasi dengan dokter bagi Anda?', tipe: 'benefit', bobot: 2, skala: SKALA_KEPENTINGAN },
    ]);
    // kolom: jumlah jenis pemeriksaan, biaya (ribu rupiah), lama (jam), kedalaman pemeriksaan jantung (1–5), konsultasi (menit)
    await isiMatriks(cid, alts.map((a) => a.id), crits.map((c) => c.id), [
      [8, 350, 1, 1, 10],
      [15, 750, 2, 2, 15],
      [28, 1500, 4, 3, 30],
      [22, 2500, 5, 5, 45],
    ]);
    const jawab = (v: number[]): ConsultationInput => ({ kategori: 'A', jawaban: Object.fromEntries(crits.map((c, i) => [String(c.id), v[i]])) });
    await konsultasiContoh(cid, k.id, [
      { nama: 'Contoh — hemat biaya', input: jawab([2, 5, 4, 1, 2]) },
      { nama: 'Contoh — fokus jantung', input: jawab([4, 1, 1, 5, 4]) },
    ]);
    console.log('  ✓ Case TOPSIS: Rekomendasi Paket Medical Check-Up (mode preferensi)');
  }
}

async function main() {
  console.log('Menyiapkan data awal…');
  await pastikanSuperAdmin();
  if (process.env.SEED_DEMO === 'false') {
    console.log('SEED_DEMO=false — data contoh tidak dibuat.');
    return;
  }
  await demoKlinik();
  await demoPuskesmas();
  console.log('Selesai.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
