import type { EngineResult, McdmInput } from './types';
import { critHeader, finishMcdm, matrixTable, prepareMcdm } from './mcdm-common';
import { column, ltx, sum } from './utils';

/**
 * MABAC — Multi-Attributive Border Approximation area Comparison
 * (Pamučar & Ćirović, 2015).
 *   n_ij = (x_ij − x_j⁻)/(x_j⁺ − x_j⁻)  (benefit)    n_ij = (x_ij − x_j⁺)/(x_j⁻ − x_j⁺)  (cost)
 *   v_ij = w_j (n_ij + 1)      g_j = (Π_i v_ij)^(1/m)      q_ij = v_ij − g_j      S_i = Σ_j q_ij
 */
export function mabac(input: McdmInput): EngineResult {
  const ctx = prepareMcdm(input, 'MABAC');
  const { crits, w, X, m, alts } = ctx;

  const maks = crits.map((_, j) => Math.max(...column(X, j)));
  const min = crits.map((_, j) => Math.min(...column(X, j)));
  const N = X.map((row) =>
    row.map((x, j) => {
      const rentang = maks[j] - min[j];
      if (rentang === 0) return 0; // kolom seragam: tidak membedakan alternatif
      return crits[j].tipe === 'benefit' ? (x - min[j]) / rentang : (x - maks[j]) / (min[j] - maks[j]);
    }),
  );
  ctx.steps.push({
    judul: 'Matriks ternormalisasi',
    deskripsi:
      'Normalisasi min–maks: $x_j^+$ adalah nilai maksimum dan $x_j^-$ nilai minimum pada kriteria $j$. Kolom yang seluruh nilainya sama dinormalisasi menjadi 0.',
    rumus: [
      'n_{ij} = \\dfrac{x_{ij} - x_j^-}{x_j^+ - x_j^-} \\quad \\text{(benefit)}',
      'n_{ij} = \\dfrac{x_{ij} - x_j^+}{x_j^- - x_j^+} \\quad \\text{(cost)}',
    ],
    detail: [
      matrixTable(ctx, N, undefined, [], [
        { label: '$x_j^+$ (maks)', values: maks },
        { label: '$x_j^-$ (min)', values: min },
      ]),
    ],
  });

  const V = N.map((row) => row.map((v, j) => w[j] * (v + 1)));
  ctx.steps.push({
    judul: 'Matriks tertimbang',
    rumus: ['v_{ij} = w_j \\left( n_{ij} + 1 \\right)'],
    detail: [matrixTable(ctx, V, undefined, [], [{ label: 'Bobot $w_j$', values: w }])],
  });

  const G = crits.map((_, j) => Math.pow(column(V, j).reduce((acc, v) => acc * v, 1), 1 / m));
  ctx.steps.push({
    judul: 'Matriks area perkiraan batas',
    deskripsi: 'Area perkiraan batas tiap kriteria adalah rata-rata geometrik nilai tertimbang seluruh alternatif.',
    rumus: ['g_j = \\left( \\prod_{i=1}^{m} v_{ij} \\right)^{1/m}'],
    detail: [{ type: 'table', kolom: ['', ...crits.map(critHeader)], baris: [['$g_j$', ...G]] }],
  });

  const Q = V.map((row) => row.map((v, j) => v - G[j]));
  const S = Q.map((row) => sum(row));
  const best = S.indexOf(Math.max(...S));
  ctx.steps.push({
    judul: 'Jarak alternatif dari area perkiraan batas',
    deskripsi:
      '$q_{ij} > 0$ berarti alternatif berada di area perkiraan atas ($G^+$), $q_{ij} < 0$ di area perkiraan bawah ($G^-$), dan $q_{ij} = 0$ tepat di perbatasan ($G$).',
    rumus: ['q_{ij} = v_{ij} - g_j', 'S_i = \\sum_{j=1}^{n} q_{ij}'],
    detail: [
      matrixTable(ctx, Q, undefined, [{ label: '$S_i$', values: S }]),
      {
        type: 'formula',
        judul: `Contoh perhitungan ${alts[best].kode}`,
        latex: `S_{${best + 1}} = ${Q[best].map((q) => `(${ltx(q)})`).join(' + ')} = ${ltx(S[best])}`,
      },
    ],
  });

  return finishMcdm(ctx, S, { simbol: 'S_i', skorLabel: 'Nilai fungsi kriteria (S)', namaMetode: 'MABAC' });
}
