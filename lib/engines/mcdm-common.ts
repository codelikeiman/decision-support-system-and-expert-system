import { EngineError, type CalcStep, type Cell, type EngineResult, type McdmCriterion, type McdmInput, type AltRef, type TableBlock } from './types';
import { buildRanking, column, fmt, kecilAwal, ltx, safe, sum, topHasil } from './utils';

export interface McdmContext {
  m: number;
  n: number;
  alts: AltRef[];
  crits: McdmCriterion[];
  X: number[][];
  /** bobot akhir (ternormalisasi, Σ = 1) */
  w: number[];
  steps: CalcStep[];
}

export interface PrepareOptions {
  /** bobot dasar pengganti `criteria.bobot` (dipakai AHP) */
  baseWeights?: number[];
  /** langkah yang disisipkan sebelum langkah bobot (dipakai AHP) */
  preSteps?: CalcStep[];
  /** semua nilai wajib ≥ 0 */
  nonNegatif?: boolean;
  /** nilai pada kriteria cost wajib > 0 (ada pembagian/pangkat negatif) */
  costPositif?: boolean;
  /** lewati langkah bobot (AHP menulis sendiri) */
  labelBobotDasar?: string;
}

export function altLabel(a: AltRef): string {
  return `${a.kode} — ${safe(a.nama)}`;
}

export function critHeader(c: McdmCriterion): string {
  return `${c.kode} (${c.tipe})`;
}

export function matrixTable(
  ctx: Pick<McdmContext, 'alts' | 'crits'>,
  M: number[][],
  judul?: string,
  extra: { label: string; values: Cell[] }[] = [],
  footer: { label: string; values: Cell[] }[] = [],
): TableBlock {
  const kolom = ['Alternatif', ...ctx.crits.map(critHeader), ...extra.map((e) => e.label)];
  const baris: Cell[][] = M.map((row, i) => [altLabel(ctx.alts[i]), ...row, ...extra.map((e) => e.values[i])]);
  for (const f of footer) baris.push([f.label, ...f.values, ...extra.map(() => null)]);
  return { type: 'table', judul, kolom, baris };
}

function validate(input: McdmInput, nama: string, opts: PrepareOptions) {
  const { criteria, alternatives, matrix } = input;
  if (criteria.length === 0) throw new EngineError(`Metode ${nama}: belum ada kriteria.`);
  if (alternatives.length === 0) throw new EngineError(`Metode ${nama}: belum ada alternatif.`);
  if (matrix.length !== alternatives.length) {
    throw new EngineError(`Metode ${nama}: jumlah baris matriks keputusan tidak sama dengan jumlah alternatif.`);
  }
  matrix.forEach((row, i) => {
    if (row.length !== criteria.length) {
      throw new EngineError(`Metode ${nama}: nilai alternatif "${alternatives[i].nama}" belum lengkap untuk semua kriteria.`);
    }
    row.forEach((x, j) => {
      if (typeof x !== 'number' || !Number.isFinite(x)) {
        throw new EngineError(
          `Metode ${nama}: nilai alternatif "${alternatives[i].nama}" pada kriteria "${criteria[j].nama}" bukan angka yang valid.`,
        );
      }
      if (opts.nonNegatif && x < 0) {
        throw new EngineError(
          `Metode ${nama} mensyaratkan nilai tidak negatif (alternatif "${alternatives[i].nama}", kriteria "${criteria[j].nama}").`,
        );
      }
      if (opts.costPositif && criteria[j].tipe === 'cost' && x <= 0) {
        throw new EngineError(
          `Metode ${nama} mensyaratkan nilai > 0 pada kriteria cost (alternatif "${alternatives[i].nama}", kriteria "${criteria[j].nama}").`,
        );
      }
    });
  });
}

/**
 * Validasi input, normalisasi bobot (Σw = 1), terapkan preferensi pengguna bila
 * ada, lalu tulis dua langkah awal: "Bobot kriteria" dan "Matriks keputusan".
 */
export function prepareMcdm(input: McdmInput, nama: string, opts: PrepareOptions = {}): McdmContext {
  validate(input, nama, opts);
  const crits = input.criteria;
  const alts = input.alternatives;
  const X = input.matrix.map((r) => [...r]);
  const n = crits.length;
  const m = alts.length;

  const dasar = opts.baseWeights ?? crits.map((c) => c.bobot);
  if (dasar.length !== n || dasar.some((b) => !Number.isFinite(b) || b < 0)) {
    throw new EngineError(`Metode ${nama}: bobot kriteria harus berupa angka ≥ 0.`);
  }
  const total = sum(dasar);
  if (total <= 0) throw new EngineError(`Metode ${nama}: jumlah bobot kriteria harus lebih besar dari 0.`);
  const wNorm = dasar.map((b) => b / total);

  let w = wNorm;
  const kolom = ['Kode', 'Kriteria', 'Tipe', opts.labelBobotDasar ?? 'Bobot awal $b_j$', 'Bobot ternormalisasi $w_j$'];
  const baris: Cell[][] = crits.map((c, j) => [c.kode, safe(c.nama), c.tipe, dasar[j], wNorm[j]]);
  const rumus = ['w_j = \\dfrac{b_j}{\\sum_{k=1}^{n} b_k}, \\qquad \\sum_{j=1}^{n} w_j = 1'];
  let deskripsi = 'Bobot setiap kriteria dinormalisasi sehingga jumlahnya sama dengan 1.';
  let catatan: string | undefined;

  const u = input.preferensi;
  if (u) {
    if (u.length !== n || u.some((v) => !Number.isFinite(v) || v < 0)) {
      throw new EngineError(`Metode ${nama}: tingkat kepentingan dari pengguna harus berupa angka ≥ 0 untuk setiap kriteria.`);
    }
    const wu = wNorm.map((v, j) => v * u[j]);
    const totalWu = sum(wu);
    kolom.push('Kepentingan pengguna $u_j$', '$w_j \\cdot u_j$', "Bobot akhir $w'_j$");
    if (totalWu > 0) {
      w = wu.map((v) => v / totalWu);
      catatan = `$\\sum w_j u_j = ${ltx(totalWu)}$. Bobot akhir $w'_j$ inilah yang dipakai pada langkah-langkah berikutnya.`;
    } else {
      catatan = 'Seluruh tingkat kepentingan bernilai 0 sehingga bobot pakar dipakai apa adanya.';
    }
    baris.forEach((row, j) => row.push(u[j], wu[j], w[j]));
    rumus.push("w'_j = \\dfrac{w_j \\, u_j}{\\sum_{k=1}^{n} w_k \\, u_k}");
    deskripsi =
      'Bobot pakar dinormalisasi, lalu disesuaikan dengan tingkat kepentingan tiap kriteria menurut jawaban pengguna (mode preferensi).';
  }
  baris.push(['', 'Jumlah', '', total, sum(wNorm), ...(u ? [null, sum(wNorm.map((v, j) => v * u[j])), sum(w)] : [])]);

  const steps: CalcStep[] = [...(opts.preSteps ?? [])];
  steps.push({
    judul: 'Bobot kriteria',
    deskripsi,
    rumus,
    detail: [{ type: 'table', kolom, baris, catatan }],
  });
  steps.push({
    judul: 'Matriks keputusan',
    deskripsi: `Matriks keputusan $X$ berukuran ${m} alternatif × ${n} kriteria; $x_{ij}$ adalah nilai alternatif ke-$i$ pada kriteria ke-$j$.`,
    rumus: ['X = \\left[ x_{ij} \\right]_{m \\times n}'],
    detail: [matrixTable({ alts, crits }, X)],
  });

  return { m, n, alts, crits, X, w, steps };
}

/** Normalisasi linear (SAW/WASPAS): benefit x/max, cost min/x. */
export function linearNormalize(ctx: McdmContext): { R: number[][]; acuan: number[] } {
  const acuan = ctx.crits.map((c, j) => {
    const col = column(ctx.X, j);
    return c.tipe === 'benefit' ? Math.max(...col) : Math.min(...col);
  });
  const R = ctx.X.map((row) =>
    row.map((x, j) => {
      if (ctx.crits[j].tipe === 'benefit') return acuan[j] === 0 ? 0 : x / acuan[j];
      // cost: min/x — bila x sama dengan nilai minimum (termasuk 0) hasilnya 1
      return x === acuan[j] ? 1 : acuan[j] / x;
    }),
  );
  return { R, acuan };
}

/** Normalisasi vektor (TOPSIS/MOORA): x / sqrt(Σ x²). */
export function vectorNormalize(ctx: McdmContext): { R: number[][]; akar: number[] } {
  const akar = ctx.crits.map((_, j) => Math.sqrt(sum(column(ctx.X, j).map((x) => x * x))));
  const R = ctx.X.map((row) => row.map((x, j) => (akar[j] === 0 ? 0 : x / akar[j])));
  return { R, akar };
}

/** Langkah peringkat akhir + susun EngineResult. */
export function finishMcdm(
  ctx: McdmContext,
  scores: number[],
  options: {
    simbol: string;
    skorLabel: string;
    namaMetode: string;
    info?: { label: string; nilai: string }[];
    peringatan?: string[];
  },
): EngineResult {
  const ranking = buildRanking(ctx.alts, scores);
  ctx.steps.push({
    judul: 'Peringkat akhir',
    deskripsi: `Alternatif diurutkan dari ${kecilAwal(options.skorLabel)} terbesar ke terkecil. Alternatif pada peringkat 1 menjadi hasil.`,
    detail: [
      {
        type: 'table',
        kolom: ['Peringkat', 'Alternatif', `$${options.simbol}$`],
        baris: ranking.map((r) => [r.peringkat, `${r.kode} — ${safe(r.nama)}`, r.skor]),
        sorot: [0],
      },
    ],
  });
  return {
    hasil: topHasil(
      ranking,
      (top) => `Berdasarkan metode ${options.namaMetode}, alternatif terbaik adalah ${top.nama} dengan ${kecilAwal(options.skorLabel)} ${fmt(top.skor)}.`,
      'Tidak ada alternatif untuk diperingkat.',
    ),
    ranking,
    steps: ctx.steps,
    meta: { skorLabel: options.skorLabel, skorFormat: 'desimal', info: options.info, peringatan: options.peringatan },
  };
}
