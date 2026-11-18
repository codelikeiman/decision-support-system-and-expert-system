import type { EngineResult, McdmInput } from './types';
import { altLabel, critHeader, finishMcdm, matrixTable, prepareMcdm } from './mcdm-common';
import { column, ltx, sum } from './utils';

/**
 * EDAS — Evaluation based on Distance from Average Solution
 * (Keshavarz Ghorabaee, Zavadskas, Olfat & Turskis, 2015).
 *   AV_j   = Σ_i x_ij / m
 *   PDA_ij = max(0, x_ij − AV_j)/AV_j (benefit)   max(0, AV_j − x_ij)/AV_j (cost)
 *   NDA_ij = max(0, AV_j − x_ij)/AV_j (benefit)   max(0, x_ij − AV_j)/AV_j (cost)
 *   SP_i = Σ w_j PDA_ij   SN_i = Σ w_j NDA_ij
 *   NSP_i = SP_i / max SP   NSN_i = 1 − SN_i / max SN   AS_i = (NSP_i + NSN_i)/2
 */
export function edas(input: McdmInput): EngineResult {
  const ctx = prepareMcdm(input, 'EDAS');
  const { crits, w, X, m, alts } = ctx;

  const AV = crits.map((_, j) => sum(column(X, j)) / m);
  ctx.steps.push({
    judul: 'Solusi rata-rata',
    rumus: ['AV_j = \\dfrac{\\sum_{i=1}^{m} x_{ij}}{m}'],
    detail: [{ type: 'table', kolom: ['', ...crits.map(critHeader)], baris: [['$AV_j$', ...AV]] }],
  });

  const bagi = (selisih: number, av: number) => (av === 0 ? 0 : Math.max(0, selisih) / av);
  const PDA = X.map((row) => row.map((x, j) => (crits[j].tipe === 'benefit' ? bagi(x - AV[j], AV[j]) : bagi(AV[j] - x, AV[j]))));
  const NDA = X.map((row) => row.map((x, j) => (crits[j].tipe === 'benefit' ? bagi(AV[j] - x, AV[j]) : bagi(x - AV[j], AV[j]))));
  ctx.steps.push({
    judul: 'Jarak positif dan negatif dari rata-rata',
    deskripsi: 'PDA mengukur seberapa jauh alternatif lebih baik dari rata-rata; NDA seberapa jauh lebih buruk.',
    rumus: [
      'PDA_{ij} = \\begin{cases} \\dfrac{\\max\\left(0,\; x_{ij} - AV_j\\right)}{AV_j} & \\text{benefit} \\\\[2ex] \\dfrac{\\max\\left(0,\; AV_j - x_{ij}\\right)}{AV_j} & \\text{cost} \\end{cases}',
      'NDA_{ij} = \\begin{cases} \\dfrac{\\max\\left(0,\; AV_j - x_{ij}\\right)}{AV_j} & \\text{benefit} \\\\[2ex] \\dfrac{\\max\\left(0,\; x_{ij} - AV_j\\right)}{AV_j} & \\text{cost} \\end{cases}',
    ],
    detail: [matrixTable(ctx, PDA, 'Matriks PDA'), matrixTable(ctx, NDA, 'Matriks NDA')],
  });

  const SP = PDA.map((row) => sum(row.map((v, j) => w[j] * v)));
  const SN = NDA.map((row) => sum(row.map((v, j) => w[j] * v)));
  ctx.steps.push({
    judul: 'Jumlah terbobot PDA dan NDA',
    rumus: ['SP_i = \\sum_{j=1}^{n} w_j \\, PDA_{ij}', 'SN_i = \\sum_{j=1}^{n} w_j \\, NDA_{ij}'],
    detail: [
      {
        type: 'table',
        kolom: ['Alternatif', '$SP_i$', '$SN_i$'],
        baris: alts.map((a, i) => [altLabel(a), SP[i], SN[i]]),
      },
    ],
  });

  const maxSP = Math.max(...SP);
  const maxSN = Math.max(...SN);
  const NSP = SP.map((v) => (maxSP === 0 ? 0 : v / maxSP));
  const NSN = SN.map((v) => (maxSN === 0 ? 1 : 1 - v / maxSN));
  const AS = NSP.map((v, i) => (v + NSN[i]) / 2);
  const best = AS.indexOf(Math.max(...AS));
  ctx.steps.push({
    judul: 'Normalisasi dan skor penilaian',
    rumus: [
      'NSP_i = \\dfrac{SP_i}{\\max_i SP_i}, \\qquad NSN_i = 1 - \\dfrac{SN_i}{\\max_i SN_i}',
      'AS_i = \\dfrac{1}{2} \\left( NSP_i + NSN_i \\right)',
    ],
    detail: [
      {
        type: 'table',
        kolom: ['Alternatif', '$NSP_i$', '$NSN_i$', '$AS_i$'],
        baris: alts.map((a, i) => [altLabel(a), NSP[i], NSN[i], AS[i]]),
        catatan: `$\\max SP = ${ltx(maxSP)}$, $\\max SN = ${ltx(maxSN)}$.`,
      },
      {
        type: 'formula',
        judul: `Contoh perhitungan ${alts[best].kode}`,
        latex: `AS_{${best + 1}} = \\dfrac{1}{2} \\left( ${ltx(NSP[best])} + ${ltx(NSN[best])} \\right) = ${ltx(AS[best])}`,
      },
    ],
  });

  return finishMcdm(ctx, AS, { simbol: 'AS_i', skorLabel: 'Skor penilaian (AS)', namaMetode: 'EDAS' });
}
