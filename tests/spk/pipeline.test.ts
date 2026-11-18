import { describe, expect, it } from 'vitest';
import { METHOD_KEYS, type MethodKey } from '@/lib/engines';
import { computeConsultation } from '@/lib/spk/compute';
import type { CaseConfig } from '@/lib/spk/config';
import { describeInput, validateInput } from '@/lib/spk/input';
import { buildMcdmInput, pairwiseMatrix, profileMatrix } from '@/lib/spk/mcdm-prepare';
import { checkReadiness } from '@/lib/spk/readiness';

const kosong: Omit<CaseConfig, 'methodKey' | 'category'> = {
  caseId: 1,
  clientId: 1,
  mcdmMode: 'profil',
  alternatives: [],
  criteria: [],
  values: {},
  pairwise: {},
  symptoms: [],
  weights: [],
  dependencies: [],
  variables: [],
  fuzzyRules: [],
  fuzzyRulesRusak: [],
  chainRules: [],
};

const skala = [
  { id: 1, label: 'Tidak pernah', nilai: 1 },
  { id: 2, label: 'Jarang', nilai: 2 },
  { id: 3, label: 'Kadang', nilai: 3 },
  { id: 4, label: 'Sering', nilai: 4 },
  { id: 5, label: 'Selalu', nilai: 5 },
];

function configA(methodKey: MethodKey, mcdmMode: 'profil' | 'preferensi' = 'profil'): CaseConfig {
  return {
    ...kosong,
    methodKey,
    category: 'A',
    mcdmMode,
    alternatives: [
      { id: 1, kode: 'A1', nama: 'Risiko Rendah', deskripsiHasil: null, saranTindakan: null, prior: null },
      { id: 2, kode: 'A2', nama: 'Risiko Sedang', deskripsiHasil: null, saranTindakan: null, prior: null },
      { id: 3, kode: 'A3', nama: 'Risiko Tinggi', deskripsiHasil: null, saranTindakan: null, prior: null },
    ],
    criteria: [
      { id: 10, kode: 'C1', nama: 'Nyeri dada', pertanyaan: null, tipe: 'benefit', bobot: 5, scales: skala },
      { id: 20, kode: 'C2', nama: 'Sesak napas', pertanyaan: null, tipe: 'benefit', bobot: 3, scales: skala },
      { id: 30, kode: 'C3', nama: 'Mudah lelah', pertanyaan: null, tipe: 'cost', bobot: 2, scales: skala },
    ],
    values: {
      '1:10': 1, '1:20': 1, '1:30': 2,
      '2:10': 3, '2:20': 3, '2:30': 3,
      '3:10': 5, '3:20': 4, '3:30': 5,
    },
    pairwise: { '10:20': 2, '10:30': 3, '20:30': 2 },
  };
}

describe('Penyiapan matriks MCDM', () => {
  it('matriks kesesuaian profil: x_ij = s_maks − |u_j − a_ij|', () => {
    expect(profileMatrix([[1, 1, 2], [3, 3, 3], [5, 4, 5]], [3, 3, 3], [5, 5, 5])).toEqual([
      [3, 3, 4],
      [5, 5, 5],
      [3, 4, 3],
    ]);
  });

  it('mode profil: alternatif yang profilnya sama dengan jawaban menjadi peringkat 1 pada semua metode MCDM', () => {
    const kasus: [Record<string, number>, number][] = [
      [{ '10': 1, '20': 1, '30': 2 }, 1],
      [{ '10': 3, '20': 3, '30': 3 }, 2],
      [{ '10': 5, '20': 4, '30': 5 }, 3],
    ];
    for (const key of ['saw', 'wp', 'topsis', 'ahp', 'moora', 'mabac', 'edas', 'waspas'] as MethodKey[]) {
      for (const [jawaban, harapan] of kasus) {
        const h = computeConsultation(configA(key), { kategori: 'A', jawaban });
        expect(h.hasil.alternativeId, `${key} ${JSON.stringify(jawaban)}`).toBe(harapan);
      }
    }
  });

  it('mode profil memperlakukan semua kriteria sebagai benefit dan menulis langkah pembentukan matriks', () => {
    const siap = buildMcdmInput(configA('saw'), { '10': 3, '20': 3, '30': 3 });
    expect(siap.input.criteria.every((c) => c.tipe === 'benefit')).toBe(true);
    expect(siap.input.preferensi).toBeUndefined();
    expect(siap.steps.map((s) => s.judul)).toEqual(['Jawaban pengguna', 'Pembentukan matriks keputusan (kesesuaian profil)']);
  });

  it('mode preferensi: matriks pakar dipakai apa adanya dan jawaban menjadi pengali bobot', () => {
    const siap = buildMcdmInput(configA('saw', 'preferensi'), { '10': 5, '20': 1, '30': 1 });
    expect(siap.input.matrix).toEqual([[1, 1, 2], [3, 3, 3], [5, 4, 5]]);
    expect(siap.input.criteria.map((c) => c.tipe)).toEqual(['benefit', 'benefit', 'cost']);
    expect(siap.input.preferensi).toEqual([5, 1, 1]);
    const h = computeConsultation(configA('saw', 'preferensi'), { kategori: 'A', jawaban: { '10': 5, '20': 1, '30': 1 } });
    expect(h.hasil.alternativeId).toBe(3);
  });

  it('matriks berpasangan AHP dibentuk dari segitiga tersimpan', () => {
    const { matrix, kosong: belum } = pairwiseMatrix(configA('ahp'));
    expect(belum).toBe(0);
    expect(matrix[0]).toEqual([1, 2, 3]);
    expect(matrix[1][0]).toBeCloseTo(0.5, 12);
    expect(matrix[2][1]).toBeCloseTo(0.5, 12);
    expect(pairwiseMatrix({ ...configA('ahp'), pairwise: {} }).kosong).toBe(3);
  });
});

describe('Validasi masukan', () => {
  it('kategori A: semua kriteria wajib dijawab sesuai skala', () => {
    const c = configA('saw');
    expect(validateInput(c, { kategori: 'A', jawaban: { '10': 3, '20': 3 } }).ok).toBe(false);
    expect(validateInput(c, { kategori: 'A', jawaban: { '10': 3, '20': 3, '30': 2.5 } }).ok).toBe(false);
    const sah = validateInput(c, { kategori: 'A', jawaban: { '10': 3, '20': 3, '30': 2, '999': 4 } });
    expect(sah.ok).toBe(true);
    if (sah.ok && sah.input.kategori === 'A') expect(Object.keys(sah.input.jawaban)).toEqual(['10', '20', '30']);
    expect(validateInput(c, { kategori: 'B', gejala: [{ id: 1 }] }).ok).toBe(false);
    expect(validateInput(c, 'bukan objek').ok).toBe(false);
  });

  it('ringkasan masukan memakai label skala', () => {
    const c = configA('saw');
    const r = describeInput(c, { kategori: 'A', jawaban: { '10': 4, '20': 1, '30': 5 } });
    expect(r.baris[0]).toEqual(['C1 — Nyeri dada', 'Sering', 4]);
  });
});

describe('Cek kesiapan Case', () => {
  it('Case lengkap dinyatakan siap', () => {
    expect(checkReadiness(configA('saw')).siap).toBe(true);
    expect(checkReadiness(configA('ahp')).siap).toBe(true);
  });

  it('mendeteksi matriks kosong, skala kurang, dan AHP tidak konsisten', () => {
    const c = configA('saw');
    delete c.values['3:30'];
    c.criteria[0] = { ...c.criteria[0], scales: [] };
    const r = checkReadiness(c);
    expect(r.siap).toBe(false);
    expect(r.issues.map((i) => i.bagian)).toEqual(expect.arrayContaining(['matriks', 'kriteria']));

    const ahp = { ...configA('ahp'), pairwise: { '10:20': 9, '10:30': 1 / 9, '20:30': 9 } };
    const ra = checkReadiness(ahp);
    expect(ra.siap).toBe(false);
    expect(ra.issues.some((i) => i.bagian === 'ahp' && i.pesan.includes('Consistency Ratio'))).toBe(true);
  });

  it('Case kosong tidak siap untuk semua metode', () => {
    for (const key of METHOD_KEYS) {
      const category = (['saw', 'wp', 'topsis', 'ahp', 'moora', 'mabac', 'edas', 'waspas'].includes(key)
        ? 'A'
        : ['fuzzy_tsukamoto', 'fuzzy_mamdani'].includes(key)
          ? 'C'
          : key === 'forward_chaining'
            ? 'D'
            : 'B') as CaseConfig['category'];
      expect(checkReadiness({ ...kosong, methodKey: key, category }).siap, key).toBe(false);
    }
  });
});
