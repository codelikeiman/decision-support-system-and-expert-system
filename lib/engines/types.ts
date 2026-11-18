/**
 * Tipe bersama untuk seluruh engine perhitungan.
 *
 * Setiap engine adalah pure function: menerima input terstruktur sesuai kategori
 * metode dan mengembalikan `{ hasil, ranking, steps }`. Engine tidak menyentuh
 * database, sesi, maupun waktu — sehingga mudah diuji unit dan diaudit.
 */

export const METHOD_KEYS = [
  'saw',
  'wp',
  'topsis',
  'ahp',
  'moora',
  'mabac',
  'edas',
  'waspas',
  'certainty_factor',
  'dempster_shafer',
  'naive_bayes',
  'bayesian_network',
  'fuzzy_tsukamoto',
  'fuzzy_mamdani',
  'forward_chaining',
] as const;

export type MethodKey = (typeof METHOD_KEYS)[number];
export type Category = 'A' | 'B' | 'C' | 'D';

/** Kesalahan konfigurasi/masukan yang pesannya aman ditampilkan ke pengguna. */
export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}

/* ------------------------------------------------------------------ */
/* Log langkah perhitungan (trust layer)                               */
/* ------------------------------------------------------------------ */

export type Cell = string | number | null;

export interface TableBlock {
  type: 'table';
  judul?: string;
  kolom: string[];
  baris: Cell[][];
  /** indeks baris yang disorot (mis. peringkat 1) */
  sorot?: number[];
  catatan?: string;
}
export interface TextBlock {
  type: 'text';
  teks: string;
}
export interface ListBlock {
  type: 'list';
  judul?: string;
  item: string[];
}
export interface FormulaBlock {
  type: 'formula';
  judul?: string;
  /** LaTeX (dirender KaTeX) */
  latex: string;
}
export type StepBlock = TableBlock | TextBlock | ListBlock | FormulaBlock;

/**
 * Satu tahap perhitungan. String pada `deskripsi`, sel tabel, teks dan item
 * daftar boleh memuat matematika inline di antara tanda `$...$`.
 */
export interface CalcStep {
  judul: string;
  deskripsi?: string;
  /** rumus umum tahap ini dalam LaTeX */
  rumus?: string[];
  detail: StepBlock[];
}

/* ------------------------------------------------------------------ */
/* Keluaran engine                                                     */
/* ------------------------------------------------------------------ */

export interface RankingItem {
  alternativeId: number;
  kode: string;
  nama: string;
  skor: number;
  peringkat: number;
  keterangan?: string;
}

export type SkorFormat = 'desimal' | 'persen' | 'bulat';

export interface EngineHasil {
  alternativeId: number | null;
  nama: string | null;
  skor: number | null;
  ringkasan: string;
}

export interface EngineMeta {
  /** nama besaran skor, mis. "Nilai preferensi (V)" */
  skorLabel: string;
  skorFormat: SkorFormat;
  /** informasi tambahan khas metode (CR pada AHP, nilai crisp pada fuzzy, dst.) */
  info?: { label: string; nilai: string }[];
  peringatan?: string[];
}

export interface EngineResult {
  hasil: EngineHasil;
  ranking: RankingItem[];
  steps: CalcStep[];
  meta: EngineMeta;
}

/* ------------------------------------------------------------------ */
/* Input Kategori A — MCDM                                             */
/* ------------------------------------------------------------------ */

export interface AltRef {
  id: number;
  kode: string;
  nama: string;
}

export interface McdmCriterion {
  id: number;
  kode: string;
  nama: string;
  tipe: 'benefit' | 'cost';
  bobot: number;
}

export interface McdmInput {
  criteria: McdmCriterion[];
  alternatives: AltRef[];
  /** matriks keputusan: matrix[i][j] = nilai alternatif i pada kriteria j */
  matrix: number[][];
  /** khusus AHP: matriks perbandingan berpasangan antar-kriteria (n×n) */
  pairwise?: number[][];
  /**
   * opsional: tingkat kepentingan tiap kriteria menurut pengguna (mode
   * "preferensi"). Bila diisi, bobot akhir w'_j = w_j·u_j / Σ(w_k·u_k).
   */
  preferensi?: number[];
  /** khusus WASPAS: koefisien λ (default 0,5) */
  lambda?: number;
}

/* ------------------------------------------------------------------ */
/* Input Kategori B — Probabilistik                                    */
/* ------------------------------------------------------------------ */

export interface SymptomRef {
  id: number;
  kode: string;
  nama: string;
}

export interface SymptomWeight {
  alternativeId: number;
  symptomId: number;
  /** maknanya mengikuti metode: CF pakar, densitas, atau P(gejala|penyakit) */
  nilai: number;
}

export interface SelectedSymptom {
  symptomId: number;
  /** tingkat keyakinan pengguna 0..1 (dipakai CF; default 1) */
  keyakinan?: number;
}

export interface SymptomDependency {
  childId: number;
  parentId: number;
  /** P(gejala anak muncul | gejala induk muncul) */
  probabilitas: number;
}

export interface ProbInput {
  symptoms: SymptomRef[];
  alternatives: (AltRef & { prior?: number | null })[];
  weights: SymptomWeight[];
  selected: SelectedSymptom[];
  /** khusus Bayesian Network */
  dependencies?: SymptomDependency[];
}

/* ------------------------------------------------------------------ */
/* Input Kategori C — Fuzzy                                            */
/* ------------------------------------------------------------------ */

export type MembershipFn = 'linear_naik' | 'linear_turun' | 'segitiga' | 'trapesium';

export interface FuzzySetDef {
  id: number;
  nama: string;
  fungsi: MembershipFn;
  /** [a,b] untuk linear; [a,b,c] segitiga; [a,b,c,d] trapesium */
  params: number[];
}

export interface FuzzyVariableDef {
  id: number;
  nama: string;
  tipe: 'input' | 'output';
  satuan?: string | null;
  min: number;
  max: number;
  sets: FuzzySetDef[];
}

export interface FuzzyRuleDef {
  id: number;
  alternativeId: number | null;
  operator: 'AND' | 'OR';
  anteseden: { variableId: number; setId: number }[];
  konsekuen: { variableId: number; setId: number };
}

export interface FuzzyInput {
  variables: FuzzyVariableDef[];
  rules: FuzzyRuleDef[];
  alternatives: AltRef[];
  /** nilai crisp per variabel input: variableId -> nilai */
  nilai: Record<number, number>;
}

/* ------------------------------------------------------------------ */
/* Input Kategori D — Rule-based                                       */
/* ------------------------------------------------------------------ */

export interface ChainCondition {
  symptomId: number;
  /** penghubung dengan kondisi sebelumnya (diabaikan untuk kondisi pertama) */
  operator: 'AND' | 'OR';
}

export interface ChainRule {
  id: number;
  nama: string;
  alternativeId: number;
  conditions: ChainCondition[];
}

export interface ChainingInput {
  symptoms: SymptomRef[];
  alternatives: AltRef[];
  rules: ChainRule[];
  /** id gejala yang dialami pengguna */
  selected: number[];
}
