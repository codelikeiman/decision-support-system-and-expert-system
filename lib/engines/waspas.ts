import { EngineError, type EngineResult, type McdmInput } from './types';
import { altLabel, finishMcdm, linearNormalize, matrixTable, prepareMcdm } from './mcdm-common';
import { ltx, sum } from './utils';

/**
 * WASPAS — Weighted Aggregated Sum Product Assessment
 * (Zavadskas, Turskis, Antucheviciene & Zakarevicius, 2012).
 *   r_ij = x_ij / max_i x_ij (benefit)     r_ij = min_i x_ij / x_ij (cost)
 *   Q_i  = λ Σ_j r_ij w_j + (1 − λ) Π_j r_ij^(w_j),   λ = 0,5
 */
export function waspas(input: McdmInput): EngineResult {
  const lambda = input.lambda ?? 0.5;
  if (!(lambda >= 0 && lambda <= 1)) throw new EngineError('Metode WASPAS: nilai λ harus berada di antara 0 dan 1.');
  const ctx = prepareMcdm(input, 'WASPAS', { nonNegatif: true });
  const { w, alts } = ctx;
  const { R, acuan } = linearNormalize(ctx);

  ctx.steps.push({
    judul: 'Matriks ternormalisasi',
    deskripsi: 'Kriteria benefit dibagi nilai maksimum kolom; kriteria cost memakai nilai minimum kolom dibagi nilainya.',
    rumus: [
      'r_{ij} = \\begin{cases} \\dfrac{x_{ij}}{\\max_i x_{ij}} & \\text{benefit} \\\\[2ex] \\dfrac{\\min_i x_{ij}}{x_{ij}} & \\text{cost} \\end{cases}',
    ],
    detail: [matrixTable(ctx, R, undefined, [], [{ label: 'Nilai acuan (maks/min)', values: acuan }])],
  });

  const WSM = R.map((row) => row.map((r, j) => r * w[j]));
  const Q1 = WSM.map((row) => sum(row));
  ctx.steps.push({
    judul: 'Komponen penjumlahan terbobot (WSM)',
    rumus: ['Q_i^{(1)} = \\sum_{j=1}^{n} r_{ij} \\, w_j'],
    detail: [matrixTable(ctx, WSM, 'Nilai $r_{ij} \\cdot w_j$', [{ label: '$Q_i^{(1)}$', values: Q1 }])],
  });

  const WPM = R.map((row) => row.map((r, j) => Math.pow(r, w[j])));
  const Q2 = WPM.map((row) => row.reduce((acc, v) => acc * v, 1));
  ctx.steps.push({
    judul: 'Komponen perkalian terbobot (WPM)',
    rumus: ['Q_i^{(2)} = \\prod_{j=1}^{n} r_{ij}^{\\,w_j}'],
    detail: [matrixTable(ctx, WPM, 'Nilai $r_{ij}^{w_j}$', [{ label: '$Q_i^{(2)}$', values: Q2 }])],
  });

  const Q = Q1.map((q1, i) => lambda * q1 + (1 - lambda) * Q2[i]);
  const best = Q.indexOf(Math.max(...Q));
  ctx.steps.push({
    judul: 'Nilai gabungan WASPAS',
    deskripsi: `Kedua komponen digabung dengan koefisien $\\lambda = ${ltx(lambda)}$.`,
    rumus: ['Q_i = \\lambda \\, Q_i^{(1)} + (1 - \\lambda) \\, Q_i^{(2)}'],
    detail: [
      {
        type: 'table',
        kolom: ['Alternatif', '$Q_i^{(1)}$', '$Q_i^{(2)}$', '$Q_i$'],
        baris: alts.map((a, i) => [altLabel(a), Q1[i], Q2[i], Q[i]]),
      },
      {
        type: 'formula',
        judul: `Contoh perhitungan ${alts[best].kode}`,
        latex: `Q_{${best + 1}} = (${ltx(lambda)})(${ltx(Q1[best])}) + (${ltx(1 - lambda)})(${ltx(Q2[best])}) = ${ltx(Q[best])}`,
      },
    ],
  });

  return finishMcdm(ctx, Q, { simbol: 'Q_i', skorLabel: 'Nilai gabungan (Q)', namaMetode: 'WASPAS' });
}
