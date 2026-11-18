import { z } from 'zod';

const angka = (pesan = 'Harus berupa angka.') => z.number({ message: pesan }).finite(pesan);

/* ------------------------------ Umum ------------------------------ */

export const alternativeSchema = z.object({
  namaAlternatif: z.string().trim().min(1, 'Nama wajib diisi.').max(150, 'Nama terlalu panjang.'),
  deskripsiHasil: z.string().trim().max(5000, 'Deskripsi terlalu panjang.'),
  saranTindakan: z.string().trim().max(5000, 'Saran terlalu panjang.'),
  prior: angka().gt(0, 'Prior harus lebih besar dari 0.').max(1, 'Prior maksimal 1.').nullable(),
});
export type AlternativeValues = z.infer<typeof alternativeSchema>;

export const tampilanSchema = z.object({
  judul: z.string().trim().min(3, 'Judul minimal 3 karakter.').max(150, 'Judul terlalu panjang.'),
  deskripsi: z.string().trim().max(5000, 'Deskripsi terlalu panjang.'),
  instruksi: z.string().trim().max(5000, 'Instruksi terlalu panjang.'),
  gambarUrl: z.string().max(500).nullable(),
});
export type TampilanValues = z.infer<typeof tampilanSchema>;

/* --------------------------- Kategori A --------------------------- */

export const criterionSchema = z.object({
  namaKriteria: z.string().trim().min(1, 'Nama kriteria wajib diisi.').max(150, 'Nama terlalu panjang.'),
  pertanyaan: z.string().trim().max(500, 'Pertanyaan terlalu panjang.'),
  tipe: z.enum(['benefit', 'cost']),
  bobot: angka('Bobot harus berupa angka.').min(0, 'Bobot tidak boleh negatif.'),
  scales: z
    .array(
      z.object({
        label: z.string().trim().min(1, 'Label wajib diisi.').max(100, 'Label terlalu panjang.'),
        nilai: angka('Nilai harus berupa angka.'),
      }),
    )
    .min(2, 'Minimal 2 pilihan skala.')
    .max(20, 'Maksimal 20 pilihan skala.')
    .refine((s) => new Set(s.map((x) => x.nilai)).size === s.length, 'Nilai skala tidak boleh ada yang sama.'),
});
export type CriterionValues = z.infer<typeof criterionSchema>;

export const matrixSchema = z
  .array(z.object({ alternativeId: z.number().int(), criteriaId: z.number().int(), nilai: angka().nullable() }))
  .max(10000);
export type MatrixValues = z.infer<typeof matrixSchema>;

export const pairwiseSchema = z
  .array(
    z.object({
      a: z.number().int(),
      b: z.number().int(),
      nilai: angka().gt(0, 'Nilai perbandingan harus > 0.').max(9, 'Nilai perbandingan maksimal 9.'),
    }),
  )
  .max(5000);
export type PairwiseValues = z.infer<typeof pairwiseSchema>;

/* ------------------------ Kategori B dan D ------------------------ */

export const symptomSchema = z.object({
  kodeGejala: z
    .string()
    .trim()
    .min(1, 'Kode wajib diisi.')
    .max(20, 'Kode maksimal 20 karakter.')
    .regex(/^[A-Za-z0-9._-]+$/, 'Kode hanya boleh huruf, angka, titik, garis bawah, dan tanda hubung.'),
  namaGejala: z.string().trim().min(1, 'Nama gejala wajib diisi.').max(500, 'Nama gejala terlalu panjang.'),
});
export type SymptomValues = z.infer<typeof symptomSchema>;

export const weightsSchema = z
  .array(z.object({ alternativeId: z.number().int(), symptomId: z.number().int(), nilai: angka().nullable() }))
  .max(20000);
export type WeightsValues = z.infer<typeof weightsSchema>;

export const dependencySchema = z
  .object({
    childId: z.number({ message: 'Pilih gejala anak.' }).int().positive('Pilih gejala anak.'),
    parentId: z.number({ message: 'Pilih gejala induk.' }).int().positive('Pilih gejala induk.'),
    probabilitas: angka().min(0, 'Minimal 0.').max(1, 'Maksimal 1.'),
  })
  .refine((v) => v.childId !== v.parentId, { path: ['parentId'], message: 'Gejala induk harus berbeda dari gejala anak.' });
export type DependencyValues = z.infer<typeof dependencySchema>;

export const chainRuleSchema = z.object({
  namaRule: z.string().trim().min(1, 'Nama aturan wajib diisi.').max(150, 'Nama terlalu panjang.'),
  alternativeId: z.number({ message: 'Pilih alternatif hasil.' }).int().positive('Pilih alternatif hasil.'),
  conditions: z
    .array(z.object({ symptomId: z.number().int().positive('Pilih gejala.'), operator: z.enum(['AND', 'OR']) }))
    .min(1, 'Minimal satu kondisi.')
    .max(100, 'Maksimal 100 kondisi.'),
});
export type ChainRuleValues = z.infer<typeof chainRuleSchema>;

/* --------------------------- Kategori C --------------------------- */

export const fuzzySetSchema = z.object({
  /** id himpunan yang sudah ada; null untuk himpunan baru */
  id: z.number().int().nullable(),
  namaHimpunan: z.string().trim().min(1, 'Nama himpunan wajib diisi.').max(100, 'Nama terlalu panjang.'),
  fungsiKeanggotaan: z.enum(['linear_naik', 'linear_turun', 'segitiga', 'trapesium']),
  params: z.array(angka('Parameter harus berupa angka.')).min(2).max(4),
});

export const fuzzyVariableSchema = z
  .object({
    namaVariabel: z.string().trim().min(1, 'Nama variabel wajib diisi.').max(150, 'Nama terlalu panjang.'),
    tipe: z.enum(['input', 'output']),
    satuan: z.string().trim().max(50, 'Satuan terlalu panjang.'),
    nilaiMin: angka('Batas bawah harus berupa angka.'),
    nilaiMax: angka('Batas atas harus berupa angka.'),
    sets: z.array(fuzzySetSchema).min(1, 'Minimal satu himpunan fuzzy.').max(15, 'Maksimal 15 himpunan.'),
  })
  .refine((v) => v.nilaiMax > v.nilaiMin, { path: ['nilaiMax'], message: 'Batas atas harus lebih besar dari batas bawah.' });
export type FuzzyVariableValues = z.infer<typeof fuzzyVariableSchema>;

export const fuzzyRuleSchema = z.object({
  alternativeId: z.number({ message: 'Pilih alternatif hasil.' }).int().positive('Pilih alternatif hasil.'),
  operator: z.enum(['AND', 'OR']),
  kondisi: z
    .array(z.object({ variableId: z.number().int().positive(), setId: z.number().int().positive('Pilih himpunan.') }))
    .min(1, 'Minimal satu kondisi.')
    .max(30, 'Maksimal 30 kondisi.'),
  konsekuen: z.object({ variableId: z.number().int().positive('Pilih variabel output.'), setId: z.number().int().positive('Pilih himpunan output.') }),
});
export type FuzzyRuleValues = z.infer<typeof fuzzyRuleSchema>;

/* -------------------------- Uji validitas ------------------------- */

export const validationTestSchema = z.object({
  namaDatasetUji: z.string().trim().min(2, 'Nama dataset minimal 2 karakter.').max(150, 'Nama terlalu panjang.'),
});

export const validationItemSchema = z.object({
  label: z.string().trim().max(150, 'Label terlalu panjang.'),
  diagnosisPakarAlternativeId: z.number({ message: 'Pilih diagnosis pakar.' }).int().positive('Pilih diagnosis pakar.'),
});
