import type { Cell, EngineResult, FuzzyInput } from './types';
import { alphaCut, finishFuzzy, prepareFuzzy, type RuleEval } from './fuzzy-common';
import { ltx, safe, sum } from './utils';

/** Nilai z suatu aturan: invers fungsi keanggotaan konsekuen pada α-predikatnya. */
export function tsukamotoZ(r: Pick<RuleEval, 'outSet' | 'alpha'>): { z: number; monoton: boolean; uraian: string } {
  const p = r.outSet.params;
  const cut = alphaCut(r.outSet, r.alpha);
  const a = ltx(r.alpha);
  switch (r.outSet.fungsi) {
    case 'linear_naik':
      return {
        z: cut.naik as number,
        monoton: true,
        uraian: `$z = ${ltx(p[0])} + ${a} \\times (${ltx(p[1])} - ${ltx(p[0])})$`,
      };
    case 'linear_turun':
      return {
        z: cut.turun as number,
        monoton: true,
        uraian: `$z = ${ltx(p[1])} - ${a} \\times (${ltx(p[1])} - ${ltx(p[0])})$`,
      };
    default: {
      const z1 = cut.naik as number;
      const z2 = cut.turun as number;
      return {
        z: (z1 + z2) / 2,
        monoton: false,
        uraian: `$z = \\dfrac{${ltx(z1)} + ${ltx(z2)}}{2}$ (titik tengah potongan-$\\alpha$)`,
      };
    }
  }
}

/**
 * Fuzzy Tsukamoto (Tsukamoto, 1979).
 * Setiap aturan menghasilkan nilai tegas z_r dari invers fungsi keanggotaan
 * konsekuen (yang monoton) pada α-predikatnya; keluaran akhir adalah rata-rata
 * terbobot:  z* = Σ α_r z_r / Σ α_r.
 */
export function fuzzyTsukamoto(input: FuzzyInput): EngineResult {
  const ctx = prepareFuzzy(input, 'Fuzzy Tsukamoto', 'Evaluasi aturan (α-predikat)');
  const { rules, outputs, steps } = ctx;
  const peringatan: string[] = [];

  const z = rules.map((r) => tsukamotoZ(r));
  const tidakMonoton = rules.filter((r, i) => r.alpha > 0 && !z[i].monoton);
  if (tidakMonoton.length > 0) {
    peringatan.push(
      'Metode Tsukamoto mensyaratkan himpunan output yang monoton (linear naik/turun). Untuk himpunan segitiga/trapesium, nilai z diambil dari titik tengah potongan-α.',
    );
  }

  steps.push({
    judul: 'Nilai z tiap aturan',
    deskripsi:
      'Untuk setiap aturan yang aktif, nilai $z_r$ diperoleh dengan mencari titik pada himpunan konsekuen yang derajat keanggotaannya sama dengan $\\alpha_r$.',
    rumus: [
      '\\mu_{C_r}(z_r) = \\alpha_r',
      'z_r = a + \\alpha_r (b - a) \\quad \\text{(linear naik)}, \\qquad z_r = b - \\alpha_r (b - a) \\quad \\text{(linear turun)}',
    ],
    detail: [
      {
        type: 'table',
        kolom: ['Aturan', '$\\alpha_r$', 'Himpunan konsekuen', 'Perhitungan', '$z_r$', '$\\alpha_r \\cdot z_r$'],
        baris: rules.map((r, i): Cell[] =>
          r.alpha > 0
            ? [`R${r.nomor}`, r.alpha, `${safe(r.outVar.nama)} ${safe(r.outSet.nama)}`, z[i].uraian, z[i].z, r.alpha * z[i].z]
            : [`R${r.nomor}`, 0, `${safe(r.outVar.nama)} ${safe(r.outSet.nama)}`, 'aturan tidak aktif', '–', 0],
        ),
        catatan: peringatan[0],
      },
    ],
  });

  const crisp = new Map<number, number | null>();
  steps.push({
    judul: 'Defuzzifikasi (rata-rata terbobot)',
    deskripsi: 'Nilai tegas keluaran adalah rata-rata $z_r$ yang dibobot dengan $\\alpha$-predikat masing-masing aturan.',
    rumus: ['z^* = \\dfrac{\\sum_{r} \\alpha_r \\, z_r}{\\sum_{r} \\alpha_r}'],
    detail: outputs.map((v) => {
      const idx = rules.map((r, i) => (r.outVar.id === v.id && r.alpha > 0 ? i : -1)).filter((i) => i >= 0);
      const pembilang = sum(idx.map((i) => rules[i].alpha * z[i].z));
      const penyebut = sum(idx.map((i) => rules[i].alpha));
      if (penyebut === 0) {
        crisp.set(v.id, null);
        return { type: 'text' as const, teks: `${safe(v.nama)}: tidak ada aturan yang aktif sehingga nilai crisp tidak terdefinisi.` };
      }
      const hasil = pembilang / penyebut;
      crisp.set(v.id, hasil);
      return {
        type: 'formula' as const,
        judul: safe(v.nama),
        latex: `z^* = \\dfrac{${idx.map((i) => `(${ltx(rules[i].alpha)})(${ltx(z[i].z)})`).join(' + ')}}{${idx
          .map((i) => ltx(rules[i].alpha))
          .join(' + ')}} = \\dfrac{${ltx(pembilang)}}{${ltx(penyebut)}} = ${ltx(hasil)}`,
      };
    }),
  });

  return finishFuzzy(ctx, crisp, 'Tsukamoto', peringatan);
}
