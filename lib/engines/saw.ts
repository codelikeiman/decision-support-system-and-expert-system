import type { EngineResult, McdmInput } from './types';
import { finishMcdm, linearNormalize, matrixTable, prepareMcdm } from './mcdm-common';
import { ltx, sum } from './utils';

/**
 * SAW — Simple Additive Weighting (Fishburn, 1967; MacCrimmon, 1968).
 *   r_ij = x_ij / max_i x_ij   (benefit)      r_ij = min_i x_ij / x_ij   (cost)
 *   V_i  = Σ_j w_j r_ij
 */
export function saw(input: McdmInput): EngineResult {
  const ctx = prepareMcdm(input, 'SAW');
  const { crits, w, X } = ctx;
  const { R, acuan } = linearNormalize(ctx);

  ctx.steps.push({
    judul: 'Proses normalisasi per kriteria',
    deskripsi:
      'Setiap kolom dinormalisasi sesuai tipe kriterianya: kriteria benefit dibagi nilai maksimum kolom, kriteria cost memakai nilai minimum kolom dibagi nilainya.',
    rumus: [
      'r_{ij} = \\begin{cases} \\dfrac{x_{ij}}{\\max_i x_{ij}} & \\text{jika } j \\text{ kriteria benefit} \\\\[2ex] \\dfrac{\\min_i x_{ij}}{x_{ij}} & \\text{jika } j \\text{ kriteria cost} \\end{cases}',
    ],
    detail: [
      {
        type: 'table',
        kolom: ['Kriteria', 'Tipe', 'Nilai acuan', 'Rumus yang dipakai', `Contoh: ${ctx.alts[0].kode}`],
        baris: crits.map((c, j) => [
          c.kode,
          c.tipe,
          `${c.tipe === 'benefit' ? 'max' : 'min'} = ${ltx(acuan[j])}`,
          c.tipe === 'benefit' ? `$r_{ij} = x_{ij} / ${ltx(acuan[j])}$` : `$r_{ij} = ${ltx(acuan[j])} / x_{ij}$`,
          c.tipe === 'benefit'
            ? `$${ltx(X[0][j])} / ${ltx(acuan[j])} = ${ltx(R[0][j])}$`
            : `$${ltx(acuan[j])} / ${ltx(X[0][j])} = ${ltx(R[0][j])}$`,
        ]),
      },
    ],
  });

  ctx.steps.push({
    judul: 'Matriks ternormalisasi',
    deskripsi: 'Hasil normalisasi seluruh elemen matriks keputusan.',
    rumus: ['R = \\left[ r_{ij} \\right]_{m \\times n}'],
    detail: [matrixTable(ctx, R)],
  });

  const WR = R.map((row) => row.map((r, j) => w[j] * r));
  ctx.steps.push({
    judul: 'Perkalian dengan bobot',
    deskripsi: 'Setiap elemen matriks ternormalisasi dikalikan bobot kriterianya.',
    rumus: ['w_j \\cdot r_{ij}'],
    detail: [matrixTable(ctx, WR, undefined, [], [{ label: 'Bobot $w_j$', values: w }])],
  });

  const V = WR.map((row) => sum(row));
  const best = V.indexOf(Math.max(...V));
  ctx.steps.push({
    judul: 'Penjumlahan skor per alternatif',
    deskripsi: 'Nilai preferensi tiap alternatif adalah jumlah seluruh nilai terbobotnya.',
    rumus: ['V_i = \\sum_{j=1}^{n} w_j \\, r_{ij}'],
    detail: [
      matrixTable(ctx, WR, undefined, [{ label: '$V_i$', values: V }]),
      {
        type: 'formula',
        judul: `Contoh perhitungan ${ctx.alts[best].kode}`,
        latex: `V_{${best + 1}} = ${WR[best].map((_, j) => `(${ltx(w[j])})(${ltx(R[best][j])})`).join(' + ')} = ${ltx(V[best])}`,
      },
    ],
  });

  return finishMcdm(ctx, V, { simbol: 'V_i', skorLabel: 'Nilai preferensi (V)', namaMetode: 'SAW' });
}
