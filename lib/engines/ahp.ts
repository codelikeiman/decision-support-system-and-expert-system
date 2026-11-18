import { EngineError, type CalcStep, type Cell, type EngineResult, type McdmInput } from './types';
import { finishMcdm, matrixTable, prepareMcdm } from './mcdm-common';
import { column, fmt, ltx, safe, sum } from './utils';

/** Random Index (Saaty, 1980) untuk n = 1..15. */
export const RANDOM_INDEX = [0, 0, 0.58, 0.9, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49, 1.51, 1.48, 1.56, 1.57, 1.59];

export function randomIndex(n: number): number {
  if (n <= 0) return 0;
  return RANDOM_INDEX[Math.min(n, RANDOM_INDEX.length) - 1];
}

export interface AhpWeights {
  /** vektor prioritas (bobot) kriteria, Σ = 1 */
  weights: number[];
  colSums: number[];
  normalized: number[][];
  /** A·w */
  weightedSum: number[];
  lambdaMax: number;
  ci: number;
  ri: number;
  cr: number;
  konsisten: boolean;
}

/**
 * Hitung bobot prioritas dari matriks perbandingan berpasangan dengan metode
 * rata-rata kolom ternormalisasi, beserta uji konsistensi (Saaty, 1980).
 */
export function ahpWeights(pairwise: number[][]): AhpWeights {
  const n = pairwise.length;
  if (n === 0) throw new EngineError('Metode AHP: matriks perbandingan berpasangan kosong.');
  pairwise.forEach((row) => {
    if (row.length !== n) throw new EngineError('Metode AHP: matriks perbandingan berpasangan harus bujur sangkar.');
    row.forEach((v) => {
      if (!Number.isFinite(v) || v <= 0) {
        throw new EngineError('Metode AHP: setiap nilai perbandingan berpasangan harus lebih besar dari 0.');
      }
    });
  });
  const colSums = pairwise[0].map((_, j) => sum(column(pairwise, j)));
  const normalized = pairwise.map((row) => row.map((v, j) => v / colSums[j]));
  const weights = normalized.map((row) => sum(row) / n);
  const weightedSum = pairwise.map((row) => sum(row.map((v, j) => v * weights[j])));
  // λmaks = Σ_j (jumlah kolom j × bobot j) = Σ_i (A·w)_i
  const lambdaMax = sum(colSums.map((c, j) => c * weights[j]));
  const ci = n > 1 ? (lambdaMax - n) / (n - 1) : 0;
  const ri = randomIndex(n);
  const cr = ri === 0 ? 0 : ci / ri;
  return { weights, colSums, normalized, weightedSum, lambdaMax, ci, ri, cr, konsisten: cr <= 0.1 + 1e-12 };
}

/**
 * AHP — Analytical Hierarchy Process (Saaty, 1980).
 * Bobot kriteria berasal dari perbandingan berpasangan (uji CR ≤ 0,1); nilai
 * alternatif disintesis dengan normalisasi distributif:
 *   p_ij = x_ij / Σ_i x_ij (benefit)    p_ij = (1/x_ij) / Σ_i (1/x_ij) (cost)
 *   V_i  = Σ_j w_j p_ij
 */
export function ahp(input: McdmInput): EngineResult {
  const n = input.criteria.length;
  if (n === 0) throw new EngineError('Metode AHP: belum ada kriteria.');

  // Bila matriks berpasangan tidak diberikan, bentuk matriks konsisten dari rasio bobot.
  let pairwise = input.pairwise;
  let dariBobot = false;
  if (!pairwise) {
    const b = input.criteria.map((c) => c.bobot);
    if (b.some((v) => !Number.isFinite(v) || v <= 0)) {
      throw new EngineError('Metode AHP: matriks perbandingan berpasangan belum diisi.');
    }
    pairwise = b.map((bi) => b.map((bj) => bi / bj));
    dariBobot = true;
  }
  if (pairwise.length !== n) {
    throw new EngineError('Metode AHP: ukuran matriks perbandingan berpasangan tidak sama dengan jumlah kriteria.');
  }

  const a = ahpWeights(pairwise);
  const kode = input.criteria.map((c) => c.kode);
  const preSteps: CalcStep[] = [];

  preSteps.push({
    judul: 'Matriks perbandingan berpasangan kriteria',
    deskripsi:
      (dariBobot ? 'Matriks dibentuk dari rasio bobot kriteria karena perbandingan berpasangan belum diisi. ' : '') +
      'Elemen $a_{ij}$ menyatakan tingkat kepentingan kriteria $i$ dibanding kriteria $j$ pada skala Saaty 1–9, dengan $a_{ji} = 1/a_{ij}$.',
    rumus: ['A = \\left[ a_{ij} \\right]_{n \\times n}, \\qquad a_{ii} = 1, \\qquad a_{ji} = \\dfrac{1}{a_{ij}}'],
    detail: [
      {
        type: 'table',
        kolom: ['Kriteria', ...kode],
        baris: [
          ...pairwise.map((row, i): Cell[] => [`${kode[i]} — ${safe(input.criteria[i].nama)}`, ...row]),
          ['Jumlah kolom', ...a.colSums],
        ],
      },
    ],
  });

  preSteps.push({
    judul: 'Normalisasi matriks dan vektor prioritas',
    deskripsi:
      'Setiap elemen dibagi jumlah kolomnya; bobot prioritas kriteria adalah rata-rata tiap baris matriks ternormalisasi.',
    rumus: ['n_{ij} = \\dfrac{a_{ij}}{\\sum_{k=1}^{n} a_{kj}}', 'w_i = \\dfrac{1}{n} \\sum_{j=1}^{n} n_{ij}'],
    detail: [
      {
        type: 'table',
        kolom: ['Kriteria', ...kode, 'Jumlah baris', 'Prioritas $w_i$'],
        baris: a.normalized.map((row, i): Cell[] => [kode[i], ...row, sum(row), a.weights[i]]),
      },
    ],
  });

  preSteps.push({
    judul: 'Uji konsistensi (Consistency Ratio)',
    deskripsi:
      'Perbandingan berpasangan dianggap konsisten bila $CR \\le 0{,}1$. $RI$ adalah Random Index Saaty sesuai jumlah kriteria.',
    rumus: [
      '\\lambda_{maks} = \\sum_{j=1}^{n} \\left( \\sum_{i=1}^{n} a_{ij} \\right) w_j',
      'CI = \\dfrac{\\lambda_{maks} - n}{n - 1}, \\qquad CR = \\dfrac{CI}{RI}',
    ],
    detail: [
      {
        type: 'table',
        kolom: ['Kriteria', 'Jumlah kolom', 'Prioritas $w_j$', 'Jumlah kolom × $w_j$', '$(A w)_j$'],
        baris: [
          ...kode.map((k, j): Cell[] => [k, a.colSums[j], a.weights[j], a.colSums[j] * a.weights[j], a.weightedSum[j]]),
          ['$\\lambda_{maks}$', null, null, a.lambdaMax, sum(a.weightedSum)],
        ],
      },
      {
        type: 'formula',
        latex: `CI = \\dfrac{${ltx(a.lambdaMax)} - ${n}}{${n} - 1} = ${ltx(a.ci)}, \\qquad RI_{(n=${n})} = ${ltx(a.ri, 2)}, \\qquad CR = ${a.ri === 0 ? '0' : `\\dfrac{${ltx(a.ci)}}{${ltx(a.ri, 2)}} = ${ltx(a.cr)}`}`,
      },
      {
        type: 'text',
        teks: a.konsisten
          ? `$CR = ${ltx(a.cr)} \\le 0{,}1$ — perbandingan berpasangan **konsisten**, bobot dapat dipakai.`
          : `$CR = ${ltx(a.cr)} > 0{,}1$ — perbandingan berpasangan **tidak konsisten**; bobot perlu ditinjau ulang oleh pakar.`,
      },
    ],
  });

  const ctx = prepareMcdm(input, 'AHP', {
    baseWeights: a.weights,
    preSteps,
    nonNegatif: true,
    costPositif: true,
    labelBobotDasar: 'Prioritas AHP $b_j$',
  });
  const { crits, w, X, alts } = ctx;

  const pembagi = crits.map((c, j) => {
    const col = column(X, j);
    return c.tipe === 'benefit' ? sum(col) : sum(col.map((x) => 1 / x));
  });
  const P = X.map((row) =>
    row.map((x, j) => {
      if (pembagi[j] === 0) return 0;
      return crits[j].tipe === 'benefit' ? x / pembagi[j] : 1 / x / pembagi[j];
    }),
  );
  ctx.steps.push({
    judul: 'Prioritas lokal alternatif per kriteria',
    deskripsi:
      'Nilai alternatif pada tiap kriteria dinormalisasi terhadap jumlah kolomnya (kriteria cost memakai kebalikan nilainya) sehingga jumlah tiap kolom sama dengan 1.',
    rumus: [
      'p_{ij} = \\begin{cases} \\dfrac{x_{ij}}{\\sum_{k=1}^{m} x_{kj}} & \\text{benefit} \\\\[2ex] \\dfrac{1 / x_{ij}}{\\sum_{k=1}^{m} 1 / x_{kj}} & \\text{cost} \\end{cases}',
    ],
    detail: [matrixTable(ctx, P, undefined, [], [{ label: 'Pembagi', values: pembagi }])],
  });

  const WP = P.map((row) => row.map((p, j) => w[j] * p));
  const V = WP.map((row) => sum(row));
  const best = V.indexOf(Math.max(...V));
  ctx.steps.push({
    judul: 'Sintesis prioritas global',
    deskripsi: 'Prioritas global alternatif adalah jumlah prioritas lokal yang dikalikan bobot kriterianya.',
    rumus: ['V_i = \\sum_{j=1}^{n} w_j \\, p_{ij}'],
    detail: [
      matrixTable(ctx, WP, 'Nilai $w_j \\cdot p_{ij}$', [{ label: '$V_i$', values: V }]),
      {
        type: 'formula',
        judul: `Contoh perhitungan ${alts[best].kode}`,
        latex: `V_{${best + 1}} = ${P[best].map((p, j) => `(${ltx(w[j])})(${ltx(p)})`).join(' + ')} = ${ltx(V[best])}`,
      },
    ],
  });

  return finishMcdm(ctx, V, {
    simbol: 'V_i',
    skorLabel: 'Prioritas global (V)',
    namaMetode: 'AHP',
    info: [
      { label: 'λ maks', nilai: fmt(a.lambdaMax) },
      { label: 'Consistency Index (CI)', nilai: fmt(a.ci) },
      { label: 'Consistency Ratio (CR)', nilai: `${fmt(a.cr)} (${a.konsisten ? 'konsisten' : 'tidak konsisten'})` },
    ],
    peringatan: a.konsisten
      ? undefined
      : [`Consistency Ratio ${fmt(a.cr)} melebihi 0,1 — perbandingan berpasangan kriteria tidak konsisten.`],
  });
}
