import type { EngineResult, McdmInput } from './types';
import { altLabel, finishMcdm, matrixTable, prepareMcdm } from './mcdm-common';
import { ltx, sum } from './utils';

/**
 * WP — Weighted Product (Bridgman, 1922; Yoon & Hwang, 1995).
 *   S_i = Π_j x_ij^(w_j)   dengan pangkat +w_j (benefit) atau −w_j (cost)
 *   V_i = S_i / Σ_i S_i
 */
export function wp(input: McdmInput): EngineResult {
  const ctx = prepareMcdm(input, 'WP', { nonNegatif: true, costPositif: true });
  const { crits, w, X, alts } = ctx;

  const pangkat = crits.map((c, j) => (c.tipe === 'benefit' ? w[j] : -w[j]));
  ctx.steps.push({
    judul: 'Pangkat bobot per kriteria',
    deskripsi: 'Bobot menjadi pangkat: bernilai positif untuk kriteria benefit dan negatif untuk kriteria cost.',
    rumus: ['p_j = \\begin{cases} +w_j & \\text{benefit} \\\\ -w_j & \\text{cost} \\end{cases}'],
    detail: [
      {
        type: 'table',
        kolom: ['Kriteria', 'Tipe', 'Bobot $w_j$', 'Pangkat $p_j$'],
        baris: crits.map((c, j) => [c.kode, c.tipe, w[j], pangkat[j]]),
      },
    ],
  });

  const P = X.map((row) => row.map((x, j) => Math.pow(x, pangkat[j])));
  const S = P.map((row) => row.reduce((acc, v) => acc * v, 1));
  const best = S.indexOf(Math.max(...S));
  ctx.steps.push({
    judul: 'Vektor S',
    deskripsi: 'Setiap nilai dipangkatkan dengan pangkat bobotnya, lalu dikalikan sepanjang baris.',
    rumus: ['S_i = \\prod_{j=1}^{n} x_{ij}^{\\,p_j}'],
    detail: [
      matrixTable(ctx, P, 'Nilai $x_{ij}^{p_j}$', [{ label: '$S_i$', values: S }]),
      {
        type: 'formula',
        judul: `Contoh perhitungan ${alts[best].kode}`,
        latex: `S_{${best + 1}} = ${X[best].map((x, j) => `(${ltx(x)})^{${ltx(pangkat[j])}}`).join(' \\cdot ')} = ${ltx(S[best])}`,
      },
    ],
  });

  const totalS = sum(S);
  const V = S.map((s) => (totalS === 0 ? 0 : s / totalS));
  ctx.steps.push({
    judul: 'Vektor V (preferensi relatif)',
    deskripsi: 'Vektor S dibagi jumlah seluruh S sehingga total nilai V sama dengan 1.',
    rumus: ['V_i = \\dfrac{S_i}{\\sum_{k=1}^{m} S_k}'],
    detail: [
      {
        type: 'table',
        kolom: ['Alternatif', '$S_i$', '$V_i$'],
        baris: [...alts.map((a, i) => [altLabel(a), S[i], V[i]]), ['Jumlah', totalS, sum(V)]],
      },
    ],
  });

  return finishMcdm(ctx, V, { simbol: 'V_i', skorLabel: 'Nilai preferensi (V)', namaMetode: 'Weighted Product' });
}
