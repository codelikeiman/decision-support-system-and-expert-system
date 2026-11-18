import type { Cell, EngineResult, ProbInput } from './types';
import { altLabel } from './mcdm-common';
import { gejalaLabel, prepareProb } from './prob-common';
import { buildRanking, fmt, ltx, safe } from './utils';

/** Kombinasi dua nilai CF (Shortliffe & Buchanan, 1975). */
export function combineCf(cf1: number, cf2: number): number {
  if (cf1 >= 0 && cf2 >= 0) return cf1 + cf2 * (1 - cf1);
  if (cf1 < 0 && cf2 < 0) return cf1 + cf2 * (1 + cf1);
  const penyebut = 1 - Math.min(Math.abs(cf1), Math.abs(cf2));
  // CF = +1 bertemu CF = −1: bukti saling meniadakan sepenuhnya
  return penyebut === 0 ? 0 : (cf1 + cf2) / penyebut;
}

export function interpretasiCf(cf: number): string {
  const a = Math.abs(cf);
  const negatif = cf < 0;
  if (a < 0.3) return 'Tidak tahu / tidak yakin';
  if (a < 0.5) return negatif ? 'Mungkin tidak' : 'Mungkin';
  if (a < 0.7) return negatif ? 'Kemungkinan besar tidak' : 'Kemungkinan besar';
  if (a < 0.9) return negatif ? 'Hampir pasti tidak' : 'Hampir pasti';
  return negatif ? 'Pasti tidak' : 'Pasti';
}

/**
 * Certainty Factor (Shortliffe & Buchanan, 1975 — MYCIN).
 *   CF[H,E] = CF_pakar × CF_pengguna
 *   CF_kombinasi = CF1 + CF2 (1 − CF1)                     keduanya ≥ 0
 *                = CF1 + CF2 (1 + CF1)                     keduanya < 0
 *                = (CF1 + CF2) / (1 − min(|CF1|, |CF2|))   berlainan tanda
 */
export function certaintyFactor(input: ProbInput): EngineResult {
  const ctx = prepareProb(input, 'Certainty Factor', { min: -1, max: 1, namaNilai: 'nilai CF pakar', pakaiKeyakinan: true });
  const { alts, dipilih, steps } = ctx;

  // CF[H,E] untuk setiap pasangan (alternatif, gejala terpilih) yang memiliki CF pakar
  const cfHE = alts.map((a) =>
    dipilih
      .map((d) => {
        const pakar = ctx.nilai(a.id, d.gejala.id);
        if (pakar === undefined || pakar === 0) return null;
        return { gejala: d.gejala, pakar, user: d.keyakinan, cf: pakar * d.keyakinan };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null),
  );

  steps.push({
    judul: 'Nilai CF gejala terhadap tiap alternatif',
    deskripsi:
      'CF pakar dikalikan tingkat keyakinan pengguna. Tanda “–” berarti gejala tersebut tidak berkaitan dengan alternatif (tidak ada CF pakar).',
    rumus: ['CF[H,E] = CF_{pakar}[H,E] \\times CF_{pengguna}[E]'],
    detail: [
      {
        type: 'table',
        judul: 'CF pakar',
        kolom: ['Gejala', ...alts.map((a) => a.kode)],
        baris: dipilih.map((d): Cell[] => [gejalaLabel(d.gejala), ...alts.map((a) => ctx.nilai(a.id, d.gejala.id) ?? '–')]),
      },
      {
        type: 'table',
        judul: 'CF[H,E] = CF pakar × CF pengguna',
        kolom: ['Gejala', 'CF pengguna', ...alts.map((a) => a.kode)],
        baris: dipilih.map((d): Cell[] => [
          gejalaLabel(d.gejala),
          d.keyakinan,
          ...alts.map((a) => {
            const pakar = ctx.nilai(a.id, d.gejala.id);
            return pakar === undefined || pakar === 0 ? '–' : pakar * d.keyakinan;
          }),
        ]),
      },
    ],
  });

  const hasilCf: number[] = [];
  const detailKombinasi = alts.map((a, i) => {
    const daftar = cfHE[i];
    const baris: Cell[][] = [];
    let cf = 0;
    daftar.forEach((item, k) => {
      if (k === 0) {
        cf = item.cf;
        baris.push([1, safe(item.gejala.kode), null, item.cf, '$CF_1 = CF[H,E_1]$', cf]);
        return;
      }
      const lama = cf;
      let rumus: string;
      if (lama >= 0 && item.cf >= 0) rumus = `$${ltx(lama)} + ${ltx(item.cf)} \\times (1 - ${ltx(lama)})$`;
      else if (lama < 0 && item.cf < 0) rumus = `$${ltx(lama)} + (${ltx(item.cf)}) \\times (1 + (${ltx(lama)}))$`;
      else rumus = `$\\dfrac{${ltx(lama)} + (${ltx(item.cf)})}{1 - \\min(${ltx(Math.abs(lama))},\\, ${ltx(Math.abs(item.cf))})}$`;
      cf = combineCf(lama, item.cf);
      baris.push([k + 1, safe(item.gejala.kode), lama, item.cf, rumus, cf]);
    });
    hasilCf.push(cf);
    return {
      type: 'table' as const,
      judul: `${altLabel(a)}${daftar.length === 0 ? ' — tidak ada gejala terpilih yang berkaitan (CF = 0)' : ''}`,
      kolom: ['Ke-', 'Gejala', 'CF lama', 'CF gejala', 'Perhitungan', 'CF kombinasi'],
      baris,
    };
  });

  steps.push({
    judul: 'Kombinasi CF per alternatif',
    deskripsi: 'Nilai CF tiap gejala digabungkan satu per satu; rumus yang dipakai bergantung pada tanda kedua nilai CF.',
    rumus: [
      'CF_{kombinasi} = \\begin{cases} CF_1 + CF_2 \\, (1 - CF_1) & CF_1 \\ge 0,\; CF_2 \\ge 0 \\\\[1ex] CF_1 + CF_2 \\, (1 + CF_1) & CF_1 < 0,\; CF_2 < 0 \\\\[1ex] \\dfrac{CF_1 + CF_2}{1 - \\min\\left(|CF_1|,\\, |CF_2|\\right)} & \\text{berlainan tanda} \\end{cases}',
    ],
    detail: detailKombinasi.filter((t) => t.baris.length > 0 || alts.length <= 12),
  });

  const ranking = buildRanking(alts, hasilCf, { keterangan: (i) => interpretasiCf(hasilCf[i]) });
  steps.push({
    judul: 'Peringkat akhir',
    deskripsi: 'Alternatif diurutkan dari nilai CF terbesar. Persentase keyakinan = CF × 100%.',
    rumus: ['\\text{Persentase} = CF_{kombinasi} \\times 100\\%'],
    detail: [
      {
        type: 'table',
        kolom: ['Peringkat', 'Alternatif', 'CF', 'Persentase', 'Interpretasi'],
        baris: ranking.map((r) => [r.peringkat, `${r.kode} — ${safe(r.nama)}`, r.skor, `${fmt(r.skor * 100, 2)}%`, r.keterangan ?? '']),
        sorot: ranking.length > 0 && ranking[0].skor > 0 ? [0] : [],
      },
    ],
  });

  const top = ranking[0];
  const adaHasil = top !== undefined && top.skor > 0;
  return {
    hasil: adaHasil
      ? {
          alternativeId: top.alternativeId,
          nama: top.nama,
          skor: top.skor,
          ringkasan: `Hasil dengan tingkat keyakinan tertinggi adalah ${top.nama} (CF = ${fmt(top.skor)} atau ${fmt(top.skor * 100, 2)}% — ${interpretasiCf(top.skor)}).`,
        }
      : {
          alternativeId: null,
          nama: null,
          skor: null,
          ringkasan: 'Gejala yang dipilih tidak memberikan keyakinan positif pada alternatif mana pun.',
        },
    ranking,
    steps,
    meta: { skorLabel: 'Certainty Factor (CF)', skorFormat: 'persen' },
  };
}
