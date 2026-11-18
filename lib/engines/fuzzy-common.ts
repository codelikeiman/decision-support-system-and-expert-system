import {
  EngineError,
  type AltRef,
  type CalcStep,
  type Cell,
  type EngineResult,
  type FuzzyInput,
  type FuzzyRuleDef,
  type FuzzySetDef,
  type FuzzyVariableDef,
  type MembershipFn,
  type RankingItem,
} from './types';
import { buildRanking, fmt, ltx, nearlyEqual, safe } from './utils';

export const JUMLAH_PARAMETER: Record<MembershipFn, number> = {
  linear_naik: 2,
  linear_turun: 2,
  segitiga: 3,
  trapesium: 4,
};

export const NAMA_FUNGSI: Record<MembershipFn, string> = {
  linear_naik: 'Linear naik',
  linear_turun: 'Linear turun',
  segitiga: 'Segitiga',
  trapesium: 'Trapesium',
};

/** Pesan kesalahan parameter fungsi keanggotaan, atau null bila valid. */
export function validateSetParams(fungsi: MembershipFn, params: number[]): string | null {
  const n = JUMLAH_PARAMETER[fungsi];
  if (!Array.isArray(params) || params.length !== n || params.some((p) => typeof p !== 'number' || !Number.isFinite(p))) {
    return `Fungsi ${NAMA_FUNGSI[fungsi]} membutuhkan ${n} parameter berupa angka.`;
  }
  for (let i = 1; i < n; i++) {
    if (params[i] < params[i - 1]) return 'Parameter harus berurutan naik (a ≤ b ≤ c ≤ d).';
  }
  if (params[n - 1] === params[0]) return 'Parameter pertama dan terakhir tidak boleh sama.';
  return null;
}

/** Derajat keanggotaan μ(x). */
export function membership(set: Pick<FuzzySetDef, 'fungsi' | 'params'>, x: number): number {
  const p = set.params;
  switch (set.fungsi) {
    case 'linear_naik': {
      const [a, b] = p;
      if (x <= a) return a === b && x === a ? 1 : 0;
      if (x >= b) return 1;
      return (x - a) / (b - a);
    }
    case 'linear_turun': {
      const [a, b] = p;
      if (x <= a) return 1;
      if (x >= b) return 0;
      return (b - x) / (b - a);
    }
    case 'segitiga': {
      const [a, b, c] = p;
      if (x === b) return 1;
      if (x <= a || x >= c) return 0;
      return x < b ? (x - a) / (b - a) : (c - x) / (c - b);
    }
    case 'trapesium': {
      const [a, b, c, d] = p;
      if (x >= b && x <= c) return 1;
      if (x <= a || x >= d) return 0;
      return x < b ? (x - a) / (b - a) : (d - x) / (d - c);
    }
  }
}

/** Rumus keanggotaan (LaTeX) untuk ditampilkan pada log langkah. */
export function membershipLatex(set: Pick<FuzzySetDef, 'fungsi' | 'params'>): string {
  const p = set.params.map((v) => ltx(v));
  switch (set.fungsi) {
    case 'linear_naik':
      return `\\mu(x) = \\begin{cases} 0 & x \\le ${p[0]} \\\\ \\dfrac{x - ${p[0]}}{${p[1]} - ${p[0]}} & ${p[0]} < x < ${p[1]} \\\\ 1 & x \\ge ${p[1]} \\end{cases}`;
    case 'linear_turun':
      return `\\mu(x) = \\begin{cases} 1 & x \\le ${p[0]} \\\\ \\dfrac{${p[1]} - x}{${p[1]} - ${p[0]}} & ${p[0]} < x < ${p[1]} \\\\ 0 & x \\ge ${p[1]} \\end{cases}`;
    case 'segitiga':
      return `\\mu(x) = \\begin{cases} 0 & x \\le ${p[0]} \\text{ atau } x \\ge ${p[2]} \\\\ \\dfrac{x - ${p[0]}}{${p[1]} - ${p[0]}} & ${p[0]} < x \\le ${p[1]} \\\\ \\dfrac{${p[2]} - x}{${p[2]} - ${p[1]}} & ${p[1]} < x < ${p[2]} \\end{cases}`;
    case 'trapesium':
      return `\\mu(x) = \\begin{cases} 0 & x \\le ${p[0]} \\text{ atau } x \\ge ${p[3]} \\\\ \\dfrac{x - ${p[0]}}{${p[1]} - ${p[0]}} & ${p[0]} < x < ${p[1]} \\\\ 1 & ${p[1]} \\le x \\le ${p[2]} \\\\ \\dfrac{${p[3]} - x}{${p[3]} - ${p[2]}} & ${p[2]} < x < ${p[3]} \\end{cases}`;
  }
}

/**
 * Titik z dengan μ(z) = α pada sisi naik dan/atau sisi turun himpunan.
 * Himpunan monoton (linear) memiliki tepat satu titik.
 */
export function alphaCut(set: Pick<FuzzySetDef, 'fungsi' | 'params'>, alpha: number): { naik?: number; turun?: number } {
  const p = set.params;
  switch (set.fungsi) {
    case 'linear_naik':
      return { naik: p[0] + alpha * (p[1] - p[0]) };
    case 'linear_turun':
      return { turun: p[1] - alpha * (p[1] - p[0]) };
    case 'segitiga':
      return { naik: p[0] + alpha * (p[1] - p[0]), turun: p[2] - alpha * (p[2] - p[1]) };
    case 'trapesium':
      return { naik: p[0] + alpha * (p[1] - p[0]), turun: p[3] - alpha * (p[3] - p[2]) };
  }
}

export interface RuleEval {
  rule: FuzzyRuleDef;
  nomor: number;
  teks: string;
  derajat: number[];
  alpha: number;
  outVar: FuzzyVariableDef;
  outSet: FuzzySetDef;
}

export interface FuzzyContext {
  inputs: FuzzyVariableDef[];
  outputs: FuzzyVariableDef[];
  alts: AltRef[];
  nilai: Record<number, number>;
  /** μ per himpunan: mu.get(setId) */
  mu: Map<number, number>;
  rules: RuleEval[];
  steps: CalcStep[];
}

export function ruleText(
  rule: FuzzyRuleDef,
  varById: Map<number, FuzzyVariableDef>,
  setById: Map<number, FuzzySetDef>,
): string {
  const bagian = rule.anteseden.map((a) => `${varById.get(a.variableId)?.nama ?? '?'} ${setById.get(a.setId)?.nama ?? '?'}`);
  const penghubung = rule.operator === 'OR' ? ' ATAU ' : ' DAN ';
  const k = rule.konsekuen;
  return `JIKA ${bagian.join(penghubung)} MAKA ${varById.get(k.variableId)?.nama ?? '?'} ${setById.get(k.setId)?.nama ?? '?'}`;
}

/** Validasi, fuzzifikasi dan evaluasi α-predikat — dipakai Tsukamoto & Mamdani. */
export function prepareFuzzy(input: FuzzyInput, namaMetode: string, labelImplikasi: string): FuzzyContext {
  const inputs = input.variables.filter((v) => v.tipe === 'input');
  const outputs = input.variables.filter((v) => v.tipe === 'output');
  if (inputs.length === 0) throw new EngineError(`${namaMetode}: belum ada variabel input.`);
  if (outputs.length === 0) throw new EngineError(`${namaMetode}: belum ada variabel output.`);
  if (input.rules.length === 0) throw new EngineError(`${namaMetode}: basis aturan (rule) masih kosong.`);

  const varById = new Map<number, FuzzyVariableDef>();
  const setById = new Map<number, FuzzySetDef>();
  const varOfSet = new Map<number, number>();
  for (const v of input.variables) {
    if (!(v.max > v.min)) throw new EngineError(`${namaMetode}: semesta pembicaraan variabel "${v.nama}" tidak valid (maks harus > min).`);
    if (v.sets.length === 0) throw new EngineError(`${namaMetode}: variabel "${v.nama}" belum memiliki himpunan fuzzy.`);
    varById.set(v.id, v);
    for (const s of v.sets) {
      const galat = validateSetParams(s.fungsi, s.params);
      if (galat) throw new EngineError(`${namaMetode}: himpunan "${s.nama}" pada variabel "${v.nama}" — ${galat}`);
      setById.set(s.id, s);
      varOfSet.set(s.id, v.id);
    }
  }

  for (const v of inputs) {
    const x = input.nilai[v.id];
    if (typeof x !== 'number' || !Number.isFinite(x)) {
      throw new EngineError(`Nilai untuk "${v.nama}" belum diisi dengan angka yang valid.`);
    }
    if (x < v.min || x > v.max) {
      throw new EngineError(`Nilai "${v.nama}" harus berada pada rentang ${fmt(v.min)} sampai ${fmt(v.max)}.`);
    }
  }

  const satuan = (v: FuzzyVariableDef) => (v.satuan ? ` ${safe(v.satuan)}` : '');
  const steps: CalcStep[] = [
    {
      judul: 'Nilai masukan (crisp)',
      deskripsi: 'Nilai tegas yang dimasukkan pengguna untuk setiap variabel input.',
      detail: [
        {
          type: 'table',
          kolom: ['Variabel', 'Nilai', 'Semesta pembicaraan'],
          baris: inputs.map((v) => [safe(v.nama), `${fmt(input.nilai[v.id])}${satuan(v)}`, `[${fmt(v.min)}, ${fmt(v.max)}]`]),
        },
      ],
    },
  ];

  const mu = new Map<number, number>();
  steps.push({
    judul: 'Fuzzifikasi',
    deskripsi: 'Nilai crisp tiap variabel input diubah menjadi derajat keanggotaan $\\mu$ pada setiap himpunan fuzzy-nya.',
    detail: inputs.flatMap((v) => {
      const x = input.nilai[v.id];
      for (const s of v.sets) mu.set(s.id, membership(s, x));
      return [
        {
          type: 'table' as const,
          judul: `${safe(v.nama)} = ${fmt(x)}${satuan(v)}`,
          kolom: ['Himpunan', 'Fungsi keanggotaan', 'Parameter', '$\\mu(x)$'],
          baris: v.sets.map((s): Cell[] => [safe(s.nama), NAMA_FUNGSI[s.fungsi], `[${s.params.map((p) => fmt(p)).join('; ')}]`, mu.get(s.id) as number]),
        },
        ...v.sets
          .filter((s) => {
            const d = mu.get(s.id) as number;
            return d > 0 && d < 1;
          })
          .map((s) => ({
            type: 'formula' as const,
            judul: `${safe(v.nama)} — ${safe(s.nama)}`,
            latex: `${membershipLatex(s)} \\quad\\Rightarrow\\quad \\mu(${ltx(x)}) = ${ltx(mu.get(s.id) as number)}`,
          })),
      ];
    }),
  });

  const rules: RuleEval[] = input.rules.map((rule, idx) => {
    const nomor = idx + 1;
    if (rule.anteseden.length === 0) throw new EngineError(`${namaMetode}: aturan R${nomor} belum memiliki anteseden.`);
    for (const a of rule.anteseden) {
      const v = varById.get(a.variableId);
      if (!v || v.tipe !== 'input' || varOfSet.get(a.setId) !== a.variableId) {
        throw new EngineError(`${namaMetode}: anteseden aturan R${nomor} merujuk variabel/himpunan input yang tidak valid.`);
      }
    }
    const outVar = varById.get(rule.konsekuen.variableId);
    const outSet = setById.get(rule.konsekuen.setId);
    if (!outVar || outVar.tipe !== 'output' || !outSet || varOfSet.get(outSet.id) !== outVar.id) {
      throw new EngineError(`${namaMetode}: konsekuen aturan R${nomor} merujuk variabel/himpunan output yang tidak valid.`);
    }
    const derajat = rule.anteseden.map((a) => mu.get(a.setId) as number);
    const alpha = rule.operator === 'OR' ? Math.max(...derajat) : Math.min(...derajat);
    return { rule, nomor, teks: ruleText(rule, varById, setById), derajat, alpha, outVar, outSet };
  });

  steps.push({
    judul: labelImplikasi,
    deskripsi:
      'Derajat keanggotaan pada anteseden digabung dengan operator MIN untuk DAN (AND) dan MAX untuk ATAU (OR), menghasilkan $\\alpha$-predikat tiap aturan.',
    rumus: [
      '\\alpha_r = \\min\\bigl(\\mu_{A_1}(x_1), \\dots, \\mu_{A_k}(x_k)\\bigr) \\quad \\text{(DAN)}',
      '\\alpha_r = \\max\\bigl(\\mu_{A_1}(x_1), \\dots, \\mu_{A_k}(x_k)\\bigr) \\quad \\text{(ATAU)}',
    ],
    detail: [
      {
        type: 'table',
        kolom: ['Aturan', 'Isi aturan', 'Derajat anteseden', 'Operator', '$\\alpha$-predikat', 'Status'],
        baris: rules.map((r) => [
          `R${r.nomor}`,
          safe(r.teks),
          r.derajat.map((d) => fmt(d)).join('; '),
          r.rule.operator === 'OR' ? 'MAX' : 'MIN',
          r.alpha,
          r.alpha > 0 ? 'Aktif' : 'Tidak aktif',
        ]),
        sorot: rules.map((r, i) => (r.alpha > 0 ? i : -1)).filter((i) => i >= 0),
      },
    ],
  });

  return { inputs, outputs, alts: input.alternatives, nilai: input.nilai, mu, rules, steps };
}

/**
 * Tentukan alternatif dari nilai crisp: skor alternatif = derajat keanggotaan
 * nilai crisp pada himpunan output yang menjadi konsekuen aturan-aturannya.
 */
export function finishFuzzy(
  ctx: FuzzyContext,
  crisp: Map<number, number | null>,
  namaMetode: string,
  peringatan: string[] = [],
): EngineResult {
  const { alts, rules, outputs, steps } = ctx;
  const satuan = (v: FuzzyVariableDef) => (v.satuan ? ` ${v.satuan}` : '');

  const skor = alts.map(() => 0);
  const alphaMaks = alts.map(() => 0);
  const dasar: (string | null)[] = alts.map(() => null);
  alts.forEach((a, i) => {
    for (const r of rules) {
      if (r.rule.alternativeId !== a.id) continue;
      alphaMaks[i] = Math.max(alphaMaks[i], r.alpha);
      const z = crisp.get(r.outVar.id);
      if (z === null || z === undefined) continue;
      const d = membership(r.outSet, z);
      if (dasar[i] === null || d > skor[i]) {
        skor[i] = d;
        dasar[i] = `${r.outVar.nama} ${r.outSet.nama}`;
      }
    }
  });

  const adaCrisp = [...crisp.values()].some((v) => v !== null);
  const ranking: RankingItem[] = buildRanking(alts, skor, {
    tieBreak: (a, b) => (nearlyEqual(alphaMaks[a], alphaMaks[b]) ? 0 : alphaMaks[b] - alphaMaks[a]),
    keterangan: (i) => (dasar[i] ? `Himpunan output: ${dasar[i]}` : 'Belum terhubung dengan aturan'),
  });

  steps.push({
    judul: 'Penentuan hasil (alternatif)',
    deskripsi:
      'Nilai crisp hasil defuzzifikasi dipetakan kembali ke himpunan output. Skor tiap alternatif adalah derajat keanggotaan nilai crisp pada himpunan output yang menjadi konsekuen aturan-aturannya; bila seri, alternatif dengan $\\alpha$-predikat terbesar didahulukan.',
    rumus: ['skor(A) = \\max_{r \\,\\in\\, \\text{aturan}(A)} \\mu_{C_r}(z^*)'],
    detail: [
      ...outputs.map((v) => {
        const z = crisp.get(v.id);
        return {
          type: 'table' as const,
          judul:
            z === null || z === undefined
              ? `${safe(v.nama)}: tidak ada nilai crisp`
              : `Keanggotaan $z^* = ${ltx(z)}$${safe(satuan(v))} pada himpunan ${safe(v.nama)}`,
          kolom: ['Himpunan output', '$\\mu(z^*)$'],
          baris: z === null || z === undefined ? [] : v.sets.map((s): Cell[] => [safe(s.nama), membership(s, z)]),
        };
      }),
      {
        type: 'table',
        judul: 'Peringkat alternatif',
        kolom: ['Peringkat', 'Alternatif', 'Himpunan output terkait', 'Skor $\\mu(z^*)$', '$\\alpha$ terbesar'],
        baris: ranking.map((r) => {
          const i = alts.findIndex((a) => a.id === r.alternativeId);
          return [r.peringkat, `${r.kode} — ${safe(r.nama)}`, dasar[i] ? safe(dasar[i] as string) : '–', r.skor, alphaMaks[i]];
        }),
        sorot: adaCrisp && ranking.length > 0 && ranking[0].skor > 0 ? [0] : [],
      },
    ],
  });

  const info = outputs.map((v) => {
    const z = crisp.get(v.id);
    return { label: `Nilai crisp ${v.nama}`, nilai: z === null || z === undefined ? 'tidak terdefinisi' : `${fmt(z)}${satuan(v)}` };
  });

  const top = ranking[0];
  const adaHasil = adaCrisp && top !== undefined && top.skor > 0;
  const ringkasanCrisp = outputs
    .map((v) => {
      const z = crisp.get(v.id);
      return z === null || z === undefined ? null : `${v.nama} = ${fmt(z, 2)}${satuan(v)}`;
    })
    .filter(Boolean)
    .join(', ');

  return {
    hasil: adaHasil
      ? {
          alternativeId: top.alternativeId,
          nama: top.nama,
          skor: top.skor,
          ringkasan: `Hasil defuzzifikasi ${namaMetode}: ${ringkasanCrisp}. Nilai tersebut paling sesuai dengan ${top.nama} (derajat keanggotaan ${fmt(top.skor)}).`,
        }
      : {
          alternativeId: null,
          nama: null,
          skor: null,
          ringkasan: adaCrisp
            ? `Hasil defuzzifikasi ${namaMetode}: ${ringkasanCrisp}, namun nilai tersebut tidak termasuk himpunan output alternatif mana pun.`
            : 'Tidak ada aturan fuzzy yang aktif untuk nilai masukan ini sehingga hasil tidak dapat ditentukan.',
        },
    ranking,
    steps,
    meta: {
      skorLabel: 'Derajat keanggotaan hasil',
      skorFormat: 'desimal',
      info,
      peringatan: peringatan.length > 0 ? peringatan : undefined,
    },
  };
}
