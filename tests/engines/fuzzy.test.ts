import { describe, expect, it } from 'vitest';
import { fuzzyMamdani, fuzzyTsukamoto, EngineError, type FuzzyInput } from '@/lib/engines';
import { alphaCut, membership, validateSetParams } from '@/lib/engines/fuzzy-common';
import { aggregateMamdani, luasSegmen, momenSegmen } from '@/lib/engines/fuzzy-mamdani';

describe('Fungsi keanggotaan', () => {
  it('linear naik dan turun', () => {
    const naik = { fungsi: 'linear_naik' as const, params: [1000, 5000] };
    const turun = { fungsi: 'linear_turun' as const, params: [1000, 5000] };
    expect(membership(naik, 500)).toBe(0);
    expect(membership(naik, 4000)).toBeCloseTo(0.75, 12);
    expect(membership(naik, 6000)).toBe(1);
    expect(membership(turun, 4000)).toBeCloseTo(0.25, 12);
    expect(membership(turun, 1000)).toBe(1);
    expect(membership(turun, 5000)).toBe(0);
  });

  it('segitiga dan trapesium', () => {
    const segitiga = { fungsi: 'segitiga' as const, params: [10, 20, 40] };
    expect(membership(segitiga, 10)).toBe(0);
    expect(membership(segitiga, 15)).toBeCloseTo(0.5, 12);
    expect(membership(segitiga, 20)).toBe(1);
    expect(membership(segitiga, 30)).toBeCloseTo(0.5, 12);
    expect(membership(segitiga, 40)).toBe(0);
    const trapesium = { fungsi: 'trapesium' as const, params: [0, 10, 20, 40] };
    expect(membership(trapesium, 5)).toBeCloseTo(0.5, 12);
    expect(membership(trapesium, 15)).toBe(1);
    expect(membership(trapesium, 30)).toBeCloseTo(0.5, 12);
    expect(membership(trapesium, 45)).toBe(0);
  });

  it('potongan-α dan validasi parameter', () => {
    expect(alphaCut({ fungsi: 'segitiga', params: [10, 20, 40] }, 0.5)).toEqual({ naik: 15, turun: 30 });
    expect(validateSetParams('segitiga', [10, 20, 40])).toBeNull();
    expect(validateSetParams('segitiga', [10, 5, 40])).not.toBeNull();
    expect(validateSetParams('trapesium', [1, 2, 3])).not.toBeNull();
    expect(validateSetParams('linear_naik', [5, 5])).not.toBeNull();
  });
});

/**
 * Studi kasus produksi makanan kaleng (Kusumadewi & Purnomo, 2004):
 * permintaan 1000–5000, persediaan 100–600, produksi 2000–7000;
 * permintaan = 4000 dan persediaan = 300.
 */
const produksi: FuzzyInput = {
  alternatives: [
    { id: 1, kode: 'A1', nama: 'Produksi dikurangi' },
    { id: 2, kode: 'A2', nama: 'Produksi ditambah' },
  ],
  variables: [
    {
      id: 1,
      nama: 'Permintaan',
      tipe: 'input',
      satuan: 'kemasan',
      min: 0,
      max: 6000,
      sets: [
        { id: 11, nama: 'TURUN', fungsi: 'linear_turun', params: [1000, 5000] },
        { id: 12, nama: 'NAIK', fungsi: 'linear_naik', params: [1000, 5000] },
      ],
    },
    {
      id: 2,
      nama: 'Persediaan',
      tipe: 'input',
      satuan: 'kemasan',
      min: 0,
      max: 700,
      sets: [
        { id: 21, nama: 'SEDIKIT', fungsi: 'linear_turun', params: [100, 600] },
        { id: 22, nama: 'BANYAK', fungsi: 'linear_naik', params: [100, 600] },
      ],
    },
    {
      id: 3,
      nama: 'Produksi',
      tipe: 'output',
      satuan: 'kemasan',
      min: 0,
      max: 7000,
      sets: [
        { id: 31, nama: 'BERKURANG', fungsi: 'linear_turun', params: [2000, 7000] },
        { id: 32, nama: 'BERTAMBAH', fungsi: 'linear_naik', params: [2000, 7000] },
      ],
    },
  ],
  rules: [
    { id: 1, alternativeId: 1, operator: 'AND', anteseden: [{ variableId: 1, setId: 11 }, { variableId: 2, setId: 22 }], konsekuen: { variableId: 3, setId: 31 } },
    { id: 2, alternativeId: 1, operator: 'AND', anteseden: [{ variableId: 1, setId: 11 }, { variableId: 2, setId: 21 }], konsekuen: { variableId: 3, setId: 31 } },
    { id: 3, alternativeId: 2, operator: 'AND', anteseden: [{ variableId: 1, setId: 12 }, { variableId: 2, setId: 22 }], konsekuen: { variableId: 3, setId: 32 } },
    { id: 4, alternativeId: 2, operator: 'AND', anteseden: [{ variableId: 1, setId: 12 }, { variableId: 2, setId: 21 }], konsekuen: { variableId: 3, setId: 32 } },
  ],
  nilai: { 1: 4000, 2: 300 },
};

const crisp = (h: { meta: { info?: { label: string; nilai: string }[] } }) => Number(h.meta.info![0].nilai.split(' ')[0]);

describe('Fuzzy Tsukamoto', () => {
  it('studi kasus produksi: z* = 4983,33 (buku: 4983 kemasan)', () => {
    const h = fuzzyTsukamoto(produksi);
    expect(crisp(h)).toBeCloseTo(4983.3333, 3);
    // α: R1 = 0,25 ; R2 = 0,25 ; R3 = 0,4 ; R4 = 0,6
    const tabel = h.steps.find((s) => s.judul.startsWith('Evaluasi aturan'))!.detail[0];
    if (tabel.type !== 'table') throw new Error('bukan tabel');
    expect(tabel.baris.map((b) => b[4])).toEqual([0.25, 0.25, 0.4, 0.6]);
    // z: 5750 ; 5750 ; 4000 ; 5000
    const z = h.steps.find((s) => s.judul === 'Nilai z tiap aturan')!.detail[0];
    if (z.type !== 'table') throw new Error('bukan tabel');
    expect(z.baris.map((b) => b[4])).toEqual([5750, 5750, 4000, 5000]);
    expect(h.hasil.alternativeId).toBe(2);
  });

  it('himpunan output tidak monoton memakai titik tengah potongan-α dan memberi peringatan', () => {
    const input: FuzzyInput = {
      ...produksi,
      variables: produksi.variables.map((v) =>
        v.id === 3 ? { ...v, sets: [{ id: 31, nama: 'SEDANG', fungsi: 'segitiga' as const, params: [2000, 4000, 7000] }, v.sets[1]] } : v,
      ),
    };
    const h = fuzzyTsukamoto(input);
    expect(h.meta.peringatan?.[0]).toContain('monoton');
    expect(Number.isFinite(crisp(h))).toBe(true);
  });

  it('tidak ada aturan aktif → tidak ada hasil', () => {
    const h = fuzzyTsukamoto({
      ...produksi,
      rules: [produksi.rules[0]],
      nilai: { 1: 5500, 2: 300 }, // μ TURUN = 0
    });
    expect(h.hasil.alternativeId).toBeNull();
  });
});

describe('Fuzzy Mamdani', () => {
  it('daerah hasil komposisi studi kasus produksi', () => {
    const variable = produksi.variables[2];
    const segmen = aggregateMamdani(variable, new Map([[31, 0.25], [32, 0.6]]));
    expect(segmen).toHaveLength(3);
    expect(segmen[0]).toMatchObject({ z0: 0, z1: 3250 });
    expect(segmen[1].z1).toBeCloseTo(5000, 9);
    expect(segmen[2].z1).toBe(7000);
    expect(segmen.map(luasSegmen).map((v) => Number(v.toFixed(6)))).toEqual([812.5, 743.75, 1200]);
    const momen = segmen.map(momenSegmen);
    expect(momen[0]).toBeCloseTo(1320312.5, 4);
    expect(momen[1]).toBeCloseTo(3157291.6667, 3);
    expect(momen[2]).toBeCloseTo(7200000, 4);
  });

  it('centroid eksak z* = 4236,77', () => {
    // Catatan: buku menuliskan 4247,74 karena koefisien integral M2 (0,0000667)
    // dibulatkan menjadi 0,000067. Integral eksaknya M2 = 3.157.291,67 sehingga
    // z* = 11.677.604,17 / 2.756,25 = 4236,77.
    const h = fuzzyMamdani(produksi);
    expect(crisp(h)).toBeCloseTo(4236.7725, 3);
    // μ BERKURANG(4236,77) = 0,5526 > μ BERTAMBAH(4236,77) = 0,4474
    expect(h.hasil.alternativeId).toBe(1);
    expect(h.hasil.skor).toBeCloseTo((7000 - 4236.7725) / 5000, 4);
    expect(h.steps.map((s) => s.judul)).toEqual([
      'Nilai masukan (crisp)',
      'Fuzzifikasi',
      'Aplikasi fungsi implikasi (MIN)',
      'Komposisi aturan (MAX)',
      'Defuzzifikasi (centroid)',
      'Penentuan hasil (alternatif)',
    ]);
  });

  it('centroid himpunan segitiga simetris berada di puncaknya', () => {
    const input: FuzzyInput = {
      alternatives: [{ id: 1, kode: 'A1', nama: 'Sedang' }],
      variables: [
        { id: 1, nama: 'X', tipe: 'input', min: 0, max: 10, sets: [{ id: 11, nama: 'Ada', fungsi: 'trapesium', params: [0, 0, 10, 10] }] },
        { id: 2, nama: 'Y', tipe: 'output', min: 0, max: 100, sets: [{ id: 21, nama: 'Sedang', fungsi: 'segitiga', params: [20, 50, 80] }] },
      ],
      rules: [{ id: 1, alternativeId: 1, operator: 'AND', anteseden: [{ variableId: 1, setId: 11 }], konsekuen: { variableId: 2, setId: 21 } }],
      nilai: { 1: 5 },
    };
    const h = fuzzyMamdani(input);
    expect(crisp(h)).toBeCloseTo(50, 9);
    expect(h.hasil.skor).toBeCloseTo(1, 9);
  });

  it('dua himpunan yang berpotongan: titik potong MAX dihitung eksak', () => {
    // segitiga [0,5,10] dipotong 1 dan segitiga [5,10,15] dipotong 1 → berpotongan di z = 7,5 (μ = 0,5)
    const variable = {
      id: 9,
      nama: 'Z',
      tipe: 'output' as const,
      min: 0,
      max: 15,
      sets: [
        { id: 1, nama: 'A', fungsi: 'segitiga' as const, params: [0, 5, 10] },
        { id: 2, nama: 'B', fungsi: 'segitiga' as const, params: [5, 10, 15] },
      ],
    };
    const segmen = aggregateMamdani(variable, new Map([[1, 1], [2, 1]]));
    const titik = segmen.map((s) => [Number(s.z0.toFixed(6)), Number(s.mu0.toFixed(6))]);
    expect(titik).toEqual([
      [0, 0],
      [5, 1],
      [7.5, 0.5],
      [10, 1],
    ]);
    const luas = segmen.map(luasSegmen).reduce((a, b) => a + b, 0);
    expect(luas).toBeCloseTo(2.5 + 1.875 + 1.875 + 2.5, 9);
    const momen = segmen.map(momenSegmen).reduce((a, b) => a + b, 0);
    expect(momen / luas).toBeCloseTo(7.5, 9);
  });

  it('validasi masukan', () => {
    expect(() => fuzzyMamdani({ ...produksi, nilai: { 1: 4000 } })).toThrow(EngineError);
    expect(() => fuzzyMamdani({ ...produksi, nilai: { 1: 9999, 2: 300 } })).toThrow(EngineError);
    expect(() => fuzzyMamdani({ ...produksi, rules: [] })).toThrow(EngineError);
  });
});
