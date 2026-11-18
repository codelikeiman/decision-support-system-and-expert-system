import type { EngineResult, McdmInput } from './types';
import { altLabel, critHeader, finishMcdm, matrixTable, prepareMcdm, vectorNormalize } from './mcdm-common';
import { column, ltx, sum } from './utils';

/**
 * TOPSIS — Technique for Order Preference by Similarity to Ideal Solution
 * (Hwang & Yoon, 1981).
 *   r_ij = x_ij / sqrt(Σ_i x_ij²)        y_ij = w_j r_ij
 *   A+ = max (benefit) / min (cost)       A− = kebalikannya
 *   D_i± = sqrt(Σ_j (y_ij − A±_j)²)       V_i = D_i− / (D_i− + D_i+)
 */
export function topsis(input: McdmInput): EngineResult {
  const ctx = prepareMcdm(input, 'TOPSIS');
  const { crits, w, alts } = ctx;
  const { R, akar } = vectorNormalize(ctx);

  ctx.steps.push({
    judul: 'Matriks keputusan ternormalisasi',
    deskripsi: 'Setiap nilai dibagi akar jumlah kuadrat kolomnya (normalisasi vektor).',
    rumus: ['r_{ij} = \\dfrac{x_{ij}}{\\sqrt{\\sum_{i=1}^{m} x_{ij}^{2}}}'],
    detail: [matrixTable(ctx, R, undefined, [], [{ label: 'Pembagi $\\sqrt{\\sum x_{ij}^2}$', values: akar }])],
  });

  const Y = R.map((row) => row.map((r, j) => w[j] * r));
  ctx.steps.push({
    judul: 'Matriks ternormalisasi terbobot',
    rumus: ['y_{ij} = w_j \\, r_{ij}'],
    detail: [matrixTable(ctx, Y, undefined, [], [{ label: 'Bobot $w_j$', values: w }])],
  });

  const plus = crits.map((c, j) => (c.tipe === 'benefit' ? Math.max(...column(Y, j)) : Math.min(...column(Y, j))));
  const minus = crits.map((c, j) => (c.tipe === 'benefit' ? Math.min(...column(Y, j)) : Math.max(...column(Y, j))));
  ctx.steps.push({
    judul: 'Solusi ideal positif dan negatif',
    deskripsi:
      'Solusi ideal positif $A^+$ memuat nilai terbaik tiap kriteria (maksimum untuk benefit, minimum untuk cost); solusi ideal negatif $A^-$ memuat nilai terburuknya.',
    rumus: [
      'A^+ = \\{ y_1^+, \\dots, y_n^+ \\}, \\quad y_j^+ = \\begin{cases} \\max_i y_{ij} & \\text{benefit} \\\\ \\min_i y_{ij} & \\text{cost} \\end{cases}',
      'A^- = \\{ y_1^-, \\dots, y_n^- \\}, \\quad y_j^- = \\begin{cases} \\min_i y_{ij} & \\text{benefit} \\\\ \\max_i y_{ij} & \\text{cost} \\end{cases}',
    ],
    detail: [
      {
        type: 'table',
        kolom: ['', ...crits.map(critHeader)],
        baris: [
          ['$A^+$', ...plus],
          ['$A^-$', ...minus],
        ],
      },
    ],
  });

  const dPlus = Y.map((row) => Math.sqrt(sum(row.map((y, j) => (y - plus[j]) ** 2))));
  const dMinus = Y.map((row) => Math.sqrt(sum(row.map((y, j) => (y - minus[j]) ** 2))));
  ctx.steps.push({
    judul: 'Jarak ke solusi ideal',
    rumus: [
      'D_i^+ = \\sqrt{\\sum_{j=1}^{n} \\left( y_{ij} - y_j^+ \\right)^2}',
      'D_i^- = \\sqrt{\\sum_{j=1}^{n} \\left( y_{ij} - y_j^- \\right)^2}',
    ],
    detail: [
      {
        type: 'table',
        kolom: ['Alternatif', '$D_i^+$', '$D_i^-$'],
        baris: alts.map((a, i) => [altLabel(a), dPlus[i], dMinus[i]]),
      },
    ],
  });

  // Bila D+ = D− = 0 (semua alternatif identik) kedekatan didefinisikan 0,5.
  const V = dPlus.map((dp, i) => (dp + dMinus[i] === 0 ? 0.5 : dMinus[i] / (dp + dMinus[i])));
  const best = V.indexOf(Math.max(...V));
  ctx.steps.push({
    judul: 'Nilai preferensi (kedekatan relatif)',
    deskripsi: 'Semakin dekat nilai $V_i$ ke 1, semakin dekat alternatif tersebut dengan solusi ideal positif.',
    rumus: ['V_i = \\dfrac{D_i^-}{D_i^- + D_i^+}'],
    detail: [
      {
        type: 'table',
        kolom: ['Alternatif', '$D_i^+$', '$D_i^-$', '$V_i$'],
        baris: alts.map((a, i) => [altLabel(a), dPlus[i], dMinus[i], V[i]]),
      },
      {
        type: 'formula',
        judul: `Contoh perhitungan ${alts[best].kode}`,
        latex: `V_{${best + 1}} = \\dfrac{${ltx(dMinus[best])}}{${ltx(dMinus[best])} + ${ltx(dPlus[best])}} = ${ltx(V[best])}`,
      },
    ],
  });

  return finishMcdm(ctx, V, { simbol: 'V_i', skorLabel: 'Nilai preferensi (V)', namaMetode: 'TOPSIS' });
}
