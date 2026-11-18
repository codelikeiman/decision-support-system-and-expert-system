import type { EngineResult, McdmInput } from './types';
import { altLabel, finishMcdm, matrixTable, prepareMcdm, vectorNormalize } from './mcdm-common';
import { ltx, sum } from './utils';

/**
 * MOORA — Multi-Objective Optimization on the basis of Ratio Analysis
 * (Brauers & Zavadskas, 2006), pendekatan ratio system.
 *   x*_ij = x_ij / sqrt(Σ_i x_ij²)
 *   y_i   = Σ_{j∈benefit} w_j x*_ij − Σ_{j∈cost} w_j x*_ij
 */
export function moora(input: McdmInput): EngineResult {
  const ctx = prepareMcdm(input, 'MOORA');
  const { crits, w, alts } = ctx;
  const { R, akar } = vectorNormalize(ctx);

  ctx.steps.push({
    judul: 'Matriks ternormalisasi',
    deskripsi: 'Setiap nilai dibagi akar jumlah kuadrat kolomnya sehingga menjadi rasio tanpa satuan.',
    rumus: ['x^{*}_{ij} = \\dfrac{x_{ij}}{\\sqrt{\\sum_{i=1}^{m} x_{ij}^{2}}}'],
    detail: [matrixTable(ctx, R, undefined, [], [{ label: 'Pembagi $\\sqrt{\\sum x_{ij}^2}$', values: akar }])],
  });

  const WR = R.map((row) => row.map((r, j) => w[j] * r));
  ctx.steps.push({
    judul: 'Matriks ternormalisasi terbobot',
    rumus: ['v_{ij} = w_j \\, x^{*}_{ij}'],
    detail: [matrixTable(ctx, WR, undefined, [], [{ label: 'Bobot $w_j$', values: w }])],
  });

  const benefit = WR.map((row) => sum(row.filter((_, j) => crits[j].tipe === 'benefit')));
  const cost = WR.map((row) => sum(row.filter((_, j) => crits[j].tipe === 'cost')));
  const Y = benefit.map((b, i) => b - cost[i]);
  const best = Y.indexOf(Math.max(...Y));
  ctx.steps.push({
    judul: 'Nilai optimasi',
    deskripsi: 'Jumlah nilai terbobot kriteria benefit dikurangi jumlah nilai terbobot kriteria cost.',
    rumus: ['y_i = \\sum_{j \\in \\text{benefit}} w_j \\, x^{*}_{ij} \; - \\sum_{j \\in \\text{cost}} w_j \\, x^{*}_{ij}'],
    detail: [
      {
        type: 'table',
        kolom: ['Alternatif', '$\\sum$ benefit', '$\\sum$ cost', '$y_i$'],
        baris: alts.map((a, i) => [altLabel(a), benefit[i], cost[i], Y[i]]),
      },
      {
        type: 'formula',
        judul: `Contoh perhitungan ${alts[best].kode}`,
        latex: `y_{${best + 1}} = ${ltx(benefit[best])} - ${ltx(cost[best])} = ${ltx(Y[best])}`,
      },
    ],
  });

  return finishMcdm(ctx, Y, { simbol: 'y_i', skorLabel: 'Nilai optimasi (y)', namaMetode: 'MOORA' });
}
