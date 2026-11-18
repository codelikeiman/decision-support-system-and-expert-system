import { describe, expect, it } from 'vitest';
import { bayesianNetwork, certaintyFactor, dempsterShafer, naiveBayes, EngineError, type ProbInput } from '@/lib/engines';
import { combineCf, interpretasiCf } from '@/lib/engines/certainty-factor';
import { findDependencyCycle } from '@/lib/engines/bayesian-network';

const gejala = [
  { id: 1, kode: 'G1', nama: 'Gejala 1' },
  { id: 2, kode: 'G2', nama: 'Gejala 2' },
  { id: 3, kode: 'G3', nama: 'Gejala 3' },
  { id: 4, kode: 'G4', nama: 'Gejala 4' },
];
const penyakit = [
  { id: 10, kode: 'P1', nama: 'Penyakit 1' },
  { id: 20, kode: 'P2', nama: 'Penyakit 2' },
  { id: 30, kode: 'P3', nama: 'Penyakit 3' },
];
const skorOf = (h: { ranking: { alternativeId: number; skor: number }[] }, id: number) =>
  h.ranking.find((r) => r.alternativeId === id)!.skor;

describe('Certainty Factor', () => {
  it('rumus kombinasi untuk tiga kombinasi tanda', () => {
    expect(combineCf(0.8, 0.6)).toBeCloseTo(0.92, 12);
    expect(combineCf(-0.5, -0.4)).toBeCloseTo(-0.7, 12);
    expect(combineCf(0.8, -0.4)).toBeCloseTo(0.4 / 0.6, 12);
    expect(combineCf(1, -1)).toBe(0);
  });

  it('kombinasi berurutan: 0,8 ⊕ 0,6 ⊕ 0,4 = 0,952', () => {
    const input: ProbInput = {
      symptoms: gejala,
      alternatives: penyakit,
      weights: [
        { alternativeId: 10, symptomId: 1, nilai: 0.8 },
        { alternativeId: 10, symptomId: 2, nilai: 0.6 },
        { alternativeId: 10, symptomId: 3, nilai: 0.4 },
        { alternativeId: 20, symptomId: 1, nilai: 0.3 },
      ],
      selected: [{ symptomId: 1 }, { symptomId: 2 }, { symptomId: 3 }],
    };
    const h = certaintyFactor(input);
    expect(skorOf(h, 10)).toBeCloseTo(0.952, 12);
    expect(skorOf(h, 20)).toBeCloseTo(0.3, 12);
    expect(skorOf(h, 30)).toBe(0);
    expect(h.hasil.alternativeId).toBe(10);
    expect(h.meta.skorFormat).toBe('persen');
  });

  it('CF pakar dikalikan keyakinan pengguna', () => {
    const h = certaintyFactor({
      symptoms: gejala,
      alternatives: penyakit,
      weights: [
        { alternativeId: 10, symptomId: 1, nilai: 0.8 },
        { alternativeId: 10, symptomId: 2, nilai: 0.6 },
      ],
      selected: [
        { symptomId: 1, keyakinan: 0.5 },
        { symptomId: 2, keyakinan: 1 },
      ],
    });
    // 0,8×0,5 = 0,4 ; 0,6×1 = 0,6 ; 0,4 + 0,6(1 − 0,4) = 0,76
    expect(skorOf(h, 10)).toBeCloseTo(0.76, 12);
  });

  it('tidak ada hasil bila tidak ada keyakinan positif', () => {
    const h = certaintyFactor({
      symptoms: gejala,
      alternatives: penyakit,
      weights: [{ alternativeId: 10, symptomId: 1, nilai: -0.6 }],
      selected: [{ symptomId: 1 }],
    });
    expect(h.hasil.alternativeId).toBeNull();
  });

  it('interpretasi dan validasi', () => {
    expect(interpretasiCf(0.95)).toBe('Pasti');
    expect(interpretasiCf(0.6)).toBe('Kemungkinan besar');
    expect(interpretasiCf(-0.8)).toBe('Hampir pasti tidak');
    expect(() =>
      certaintyFactor({ symptoms: gejala, alternatives: penyakit, weights: [{ alternativeId: 10, symptomId: 1, nilai: 1.5 }], selected: [{ symptomId: 1 }] }),
    ).toThrow(EngineError);
    expect(() => certaintyFactor({ symptoms: gejala, alternatives: penyakit, weights: [], selected: [] })).toThrow(EngineError);
  });
});

describe('Dempster-Shafer', () => {
  // G1 → {P1,P2} 0,8 ; G2 → {P2,P3} 0,6 ; G3 → {P2} 0,7 ; G4 → {P1} 0,6 / {P2} 0,5
  const weights = [
    { alternativeId: 10, symptomId: 1, nilai: 0.8 },
    { alternativeId: 20, symptomId: 1, nilai: 0.8 },
    { alternativeId: 20, symptomId: 2, nilai: 0.6 },
    { alternativeId: 30, symptomId: 2, nilai: 0.6 },
    { alternativeId: 20, symptomId: 3, nilai: 0.7 },
  ];

  it('satu gejala: densitas himpunan dan Θ', () => {
    const h = dempsterShafer({ symptoms: gejala, alternatives: penyakit, weights, selected: [{ symptomId: 1 }] });
    expect(skorOf(h, 10)).toBeCloseTo(0.8, 12);
    expect(skorOf(h, 20)).toBeCloseTo(0.8, 12);
    expect(skorOf(h, 30)).toBe(0);
  });

  it('kombinasi tiga gejala (perhitungan manual): m{P2} = 0,844', () => {
    const h = dempsterShafer({
      symptoms: gejala,
      alternatives: penyakit,
      weights,
      selected: [{ symptomId: 1 }, { symptomId: 2 }, { symptomId: 3 }],
    });
    expect(skorOf(h, 20)).toBeCloseTo(0.844, 12);
    expect(h.hasil.alternativeId).toBe(20);
    // m{P1,P2} = 0,096 → skor P1 ; m{P2,P3} = 0,036 → skor P3
    expect(skorOf(h, 10)).toBeCloseTo(0.096, 12);
    expect(skorOf(h, 30)).toBeCloseTo(0.036, 12);
    const p2 = h.ranking.find((r) => r.alternativeId === 20)!;
    expect(p2.keterangan).toBe('Bel = 0.844, Pl = 1');
  });

  it('evidence yang bertentangan dinormalisasi dengan 1 − K', () => {
    const h = dempsterShafer({
      symptoms: gejala,
      alternatives: penyakit,
      weights: [
        { alternativeId: 10, symptomId: 1, nilai: 0.6 },
        { alternativeId: 20, symptomId: 2, nilai: 0.5 },
      ],
      selected: [{ symptomId: 1 }, { symptomId: 2 }],
    });
    // K = 0,3 → m{P1} = 0,3/0,7 ; m{P2} = 0,2/0,7
    expect(skorOf(h, 10)).toBeCloseTo(0.3 / 0.7, 12);
    expect(skorOf(h, 20)).toBeCloseTo(0.2 / 0.7, 12);
  });

  it('konflik total tidak menghasilkan kesimpulan', () => {
    const h = dempsterShafer({
      symptoms: gejala,
      alternatives: penyakit,
      weights: [
        { alternativeId: 10, symptomId: 1, nilai: 1 },
        { alternativeId: 20, symptomId: 2, nilai: 1 },
      ],
      selected: [{ symptomId: 1 }, { symptomId: 2 }],
    });
    expect(h.hasil.alternativeId).toBeNull();
    expect(h.meta.peringatan?.[0]).toContain('Konflik total');
  });

  it('densitas berbeda dalam satu gejala menjadi evidence terpisah', () => {
    const h = dempsterShafer({
      symptoms: gejala,
      alternatives: penyakit,
      weights: [
        { alternativeId: 10, symptomId: 4, nilai: 0.6 },
        { alternativeId: 20, symptomId: 4, nilai: 0.5 },
      ],
      selected: [{ symptomId: 4 }],
    });
    expect(skorOf(h, 10)).toBeCloseTo(0.3 / 0.7, 12);
    expect(skorOf(h, 20)).toBeCloseTo(0.2 / 0.7, 12);
  });
});

describe('Naive Bayes', () => {
  const dua = penyakit.slice(0, 2);
  const weights = [
    { alternativeId: 10, symptomId: 1, nilai: 0.8 },
    { alternativeId: 10, symptomId: 2, nilai: 0.5 },
    { alternativeId: 20, symptomId: 1, nilai: 0.2 },
    { alternativeId: 20, symptomId: 2, nilai: 0.9 },
  ];
  const selected = [{ symptomId: 1 }, { symptomId: 2 }];

  it('prior seragam', () => {
    const h = naiveBayes({ symptoms: gejala, alternatives: dua, weights, selected });
    expect(skorOf(h, 10)).toBeCloseTo(0.2 / 0.29, 12);
    expect(skorOf(h, 20)).toBeCloseTo(0.09 / 0.29, 12);
    expect(h.hasil.alternativeId).toBe(10);
  });

  it('prior dari pakar', () => {
    const h = naiveBayes({
      symptoms: gejala,
      alternatives: [
        { ...dua[0], prior: 0.3 },
        { ...dua[1], prior: 0.7 },
      ],
      weights,
      selected,
    });
    expect(skorOf(h, 10)).toBeCloseTo(0.12 / 0.246, 12);
    expect(h.hasil.alternativeId).toBe(20);
  });

  it('semua probabilitas nol → tidak ada hasil', () => {
    const h = naiveBayes({ symptoms: gejala, alternatives: dua, weights, selected: [{ symptomId: 3 }] });
    expect(h.hasil.alternativeId).toBeNull();
    h.ranking.forEach((r) => expect(r.skor).toBe(0));
  });
});

describe('Bayesian Network', () => {
  const dua = penyakit.slice(0, 2);
  const weights = [
    { alternativeId: 10, symptomId: 1, nilai: 0.8 },
    { alternativeId: 10, symptomId: 2, nilai: 0.5 },
    { alternativeId: 20, symptomId: 1, nilai: 0.2 },
    { alternativeId: 20, symptomId: 2, nilai: 0.9 },
  ];
  const selected = [{ symptomId: 1 }, { symptomId: 2 }];

  it('tanpa dependensi identik dengan Naive Bayes', () => {
    const nb = naiveBayes({ symptoms: gejala, alternatives: dua, weights, selected });
    const bn = bayesianNetwork({ symptoms: gejala, alternatives: dua, weights, selected, dependencies: [] });
    expect(skorOf(bn, 10)).toBeCloseTo(skorOf(nb, 10), 12);
    expect(skorOf(bn, 20)).toBeCloseTo(skorOf(nb, 20), 12);
  });

  it('dependensi aktif memakai noisy-OR', () => {
    const bn = bayesianNetwork({
      symptoms: gejala,
      alternatives: dua,
      weights,
      selected,
      dependencies: [{ childId: 2, parentId: 1, probabilitas: 0.5 }],
    });
    // P(G2|H1,G1) = 1 − 0,5·0,5 = 0,75 ; P(G2|H2,G1) = 1 − 0,1·0,5 = 0,95
    // gabungan: H1 = 0,5·0,8·0,75 = 0,3 ; H2 = 0,5·0,2·0,95 = 0,095
    expect(skorOf(bn, 10)).toBeCloseTo(0.3 / 0.395, 12);
  });

  it('dependensi tidak aktif bila gejala induk tidak dipilih', () => {
    const tanpa = bayesianNetwork({ symptoms: gejala, alternatives: dua, weights, selected: [{ symptomId: 2 }] });
    const dengan = bayesianNetwork({
      symptoms: gejala,
      alternatives: dua,
      weights,
      selected: [{ symptomId: 2 }],
      dependencies: [{ childId: 2, parentId: 1, probabilitas: 0.5 }],
    });
    expect(skorOf(dengan, 10)).toBeCloseTo(skorOf(tanpa, 10), 12);
  });

  it('menolak dependensi yang membentuk siklus', () => {
    expect(findDependencyCycle([{ childId: 2, parentId: 1 }, { childId: 3, parentId: 2 }])).toBeNull();
    expect(findDependencyCycle([{ childId: 2, parentId: 1 }, { childId: 1, parentId: 2 }])).not.toBeNull();
    expect(() =>
      bayesianNetwork({
        symptoms: gejala,
        alternatives: dua,
        weights,
        selected,
        dependencies: [
          { childId: 2, parentId: 1, probabilitas: 0.5 },
          { childId: 1, parentId: 2, probabilitas: 0.5 },
        ],
      }),
    ).toThrow(EngineError);
  });
});
