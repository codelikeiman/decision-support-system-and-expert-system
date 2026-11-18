import { describe, expect, it } from 'vitest';
import { ahp, edas, mabac, moora, saw, topsis, waspas, wp, EngineError, type McdmInput } from '@/lib/engines';
import { ahpWeights } from '@/lib/engines/ahp';

/** Ambil skor sesuai urutan alternatif pada input (bukan urutan peringkat). */
function skor(hasil: { ranking: { alternativeId: number; skor: number }[] }, ids: number[]): number[] {
  return ids.map((id) => hasil.ranking.find((r) => r.alternativeId === id)!.skor);
}
function dekat(aktual: number[], harapan: number[], digit = 5) {
  expect(aktual).toHaveLength(harapan.length);
  aktual.forEach((v, i) => expect(v).toBeCloseTo(harapan[i], digit));
}

/**
 * Data uji bersama: 4 alternatif × 4 kriteria (C3 bertipe cost), bobot 4:3:2:1.
 * Nilai harapan dihitung terpisah dengan implementasi independen (Python).
 */
const bersama: McdmInput = {
  criteria: [
    { id: 1, kode: 'C1', nama: 'Kriteria 1', tipe: 'benefit', bobot: 4 },
    { id: 2, kode: 'C2', nama: 'Kriteria 2', tipe: 'benefit', bobot: 3 },
    { id: 3, kode: 'C3', nama: 'Kriteria 3', tipe: 'cost', bobot: 2 },
    { id: 4, kode: 'C4', nama: 'Kriteria 4', tipe: 'benefit', bobot: 1 },
  ],
  alternatives: [
    { id: 11, kode: 'A1', nama: 'Alternatif 1' },
    { id: 12, kode: 'A2', nama: 'Alternatif 2' },
    { id: 13, kode: 'A3', nama: 'Alternatif 3' },
    { id: 14, kode: 'A4', nama: 'Alternatif 4' },
  ],
  matrix: [
    [4, 3, 5, 2],
    [3, 5, 4, 4],
    [5, 4, 2, 3],
    [2, 4, 3, 5],
  ],
};
const ids = [11, 12, 13, 14];

describe('SAW', () => {
  it('menghitung nilai preferensi sesuai rumus baku', () => {
    const h = saw(bersama);
    dekat(skor(h, ids), [0.62, 0.72, 0.9, 0.633333]);
    expect(h.hasil.alternativeId).toBe(13);
    expect(h.ranking.map((r) => r.alternativeId)).toEqual([13, 12, 14, 11]);
  });

  it('contoh seleksi pegawai: 6 kandidat, 4 kriteria benefit, bobot 35/25/25/15%', () => {
    const nilai = [
      [70, 50, 80, 60],
      [50, 60, 82, 70],
      [85, 55, 80, 75],
      [82, 70, 65, 85],
      [75, 75, 85, 74],
      [62, 50, 75, 80],
    ];
    const h = saw({
      criteria: [0.35, 0.25, 0.25, 0.15].map((b, j) => ({ id: j + 1, kode: `C${j + 1}`, nama: `C${j + 1}`, tipe: 'benefit' as const, bobot: b })),
      alternatives: nilai.map((_, i) => ({ id: i + 1, kode: `A${i + 1}`, nama: `Kandidat ${i + 1}` })),
      matrix: nilai,
    });
    dekat(skor(h, [1, 2, 3, 4, 5, 6]), [0.7961, 0.7706, 0.901, 0.9122, 0.9394, 0.7837], 4);
    expect(h.hasil.alternativeId).toBe(5);
  });

  it('menulis langkah perhitungan sesuai urutan spesifikasi', () => {
    const judul = saw(bersama).steps.map((s) => s.judul);
    expect(judul).toEqual([
      'Bobot kriteria',
      'Matriks keputusan',
      'Proses normalisasi per kriteria',
      'Matriks ternormalisasi',
      'Perkalian dengan bobot',
      'Penjumlahan skor per alternatif',
      'Peringkat akhir',
    ]);
  });
});

describe('WP', () => {
  it('data uji bersama', () => {
    const h = wp(bersama);
    dekat(skor(h, ids), [0.214683, 0.249955, 0.320067, 0.215294]);
    expect(skor(h, ids).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it('contoh lokasi gudang Kusumadewi dkk. (2006): S = 2,4187; 2,4270; 1,7462 dan V = 0,3669; 0,3682; 0,2649', () => {
    const h = wp({
      criteria: [
        { id: 1, kode: 'C1', nama: 'Jarak dengan pasar terdekat (km)', tipe: 'cost', bobot: 5 },
        { id: 2, kode: 'C2', nama: 'Kepadatan penduduk (orang/km²)', tipe: 'benefit', bobot: 3 },
        { id: 3, kode: 'C3', nama: 'Jarak dari pabrik (km)', tipe: 'cost', bobot: 4 },
        { id: 4, kode: 'C4', nama: 'Jarak dengan gudang yang sudah ada (km)', tipe: 'benefit', bobot: 4 },
        { id: 5, kode: 'C5', nama: 'Harga tanah (x1000 Rp/m²)', tipe: 'cost', bobot: 2 },
      ],
      alternatives: [
        { id: 1, kode: 'A1', nama: 'Ngemplak' },
        { id: 2, kode: 'A2', nama: 'Kalasan' },
        { id: 3, kode: 'A3', nama: 'Kota Gede' },
      ],
      matrix: [
        [0.75, 2000, 18, 50, 500],
        [0.5, 1500, 20, 40, 450],
        [0.9, 2050, 35, 35, 800],
      ],
    });
    dekat(skor(h, [1, 2, 3]), [0.3669, 0.3682, 0.2649], 4);
    const langkahS = h.steps.find((s) => s.judul === 'Vektor S')!;
    const tabel = langkahS.detail[0];
    expect(tabel.type).toBe('table');
    if (tabel.type === 'table') {
      const s = tabel.baris.map((b) => b[b.length - 1] as number);
      dekat(s, [2.4187, 2.427, 1.7462], 4);
    }
    expect(h.hasil.nama).toBe('Kalasan');
  });

  it('menolak nilai nol pada kriteria cost', () => {
    const buruk: McdmInput = { ...bersama, matrix: bersama.matrix.map((r, i) => (i === 0 ? [r[0], r[1], 0, r[3]] : r)) };
    expect(() => wp(buruk)).toThrow(EngineError);
  });
});

describe('TOPSIS', () => {
  it('menghitung jarak ke solusi ideal dan kedekatan relatif', () => {
    const h = topsis(bersama);
    dekat(skor(h, ids), [0.456862, 0.448234, 0.802814, 0.31338]);
    skor(h, ids).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });

  it('alternatif yang mendominasi memperoleh nilai 1 dan yang didominasi 0', () => {
    const h = topsis({
      criteria: bersama.criteria.slice(0, 2),
      alternatives: bersama.alternatives.slice(0, 2),
      matrix: [
        [5, 5],
        [1, 1],
      ],
    });
    dekat(skor(h, [11, 12]), [1, 0]);
  });

  it('alternatif identik tidak menghasilkan NaN', () => {
    const h = topsis({ criteria: bersama.criteria.slice(0, 2), alternatives: bersama.alternatives.slice(0, 2), matrix: [[3, 3], [3, 3]] });
    dekat(skor(h, [11, 12]), [0.5, 0.5]);
    expect(h.ranking.map((r) => r.peringkat)).toEqual([1, 1]);
  });
});

describe('MOORA, MABAC, EDAS, WASPAS', () => {
  it('MOORA', () => dekat(skor(moora(bersama), ids), [0.219649, 0.293503, 0.406267, 0.242968]));
  it('MABAC', () => dekat(skor(mabac(bersama), ids), [-0.186647, 0.113353, 0.330019, -0.069981]));
  it('EDAS', () => dekat(skor(edas(bersama), ids), [0.111111, 0.463085, 0.964912, 0.217836]));
  it('WASPAS (λ = 0,5)', () => dekat(skor(waspas(bersama), ids), [0.608036, 0.707003, 0.894337, 0.615551]));

  it('WASPAS dengan λ = 1 sama dengan SAW', () => {
    dekat(skor(waspas({ ...bersama, lambda: 1 }), ids), skor(saw(bersama), ids), 12);
  });

  it('kolom seragam tidak menghasilkan NaN', () => {
    const seragam: McdmInput = { ...bersama, matrix: bersama.matrix.map((r) => [r[0], 4, r[2], r[3]]) };
    for (const engine of [saw, wp, topsis, moora, mabac, edas, waspas, ahp]) {
      const h = engine(seragam);
      h.ranking.forEach((r) => expect(Number.isFinite(r.skor)).toBe(true));
    }
  });
});

describe('AHP', () => {
  const pairwise = [
    [1, 3, 5],
    [1 / 3, 1, 3],
    [1 / 5, 1 / 3, 1],
  ];

  it('vektor prioritas, λmaks, CI dan CR', () => {
    const a = ahpWeights(pairwise);
    dekat(a.weights, [0.633346, 0.260498, 0.106156]);
    expect(a.lambdaMax).toBeCloseTo(3.055361, 5);
    expect(a.ci).toBeCloseTo(0.027681, 5);
    expect(a.cr).toBeCloseTo(0.047725, 5);
    expect(a.konsisten).toBe(true);
  });

  it('matriks konsisten sempurna menghasilkan CR = 0', () => {
    const b = [4, 2, 1];
    const a = ahpWeights(b.map((bi) => b.map((bj) => bi / bj)));
    expect(a.cr).toBeCloseTo(0, 10);
    dekat(a.weights, [4 / 7, 2 / 7, 1 / 7], 10);
  });

  it('mendeteksi matriks tidak konsisten (CR > 0,1)', () => {
    const a = ahpWeights([
      [1, 9, 1 / 9],
      [1 / 9, 1, 9],
      [9, 1 / 9, 1],
    ]);
    expect(a.konsisten).toBe(false);
  });

  it('sintesis prioritas global (benefit, cost, benefit)', () => {
    const h = ahp({
      criteria: [
        { id: 1, kode: 'C1', nama: 'K1', tipe: 'benefit', bobot: 1 },
        { id: 2, kode: 'C2', nama: 'K2', tipe: 'cost', bobot: 1 },
        { id: 3, kode: 'C3', nama: 'K3', tipe: 'benefit', bobot: 1 },
      ],
      alternatives: [
        { id: 1, kode: 'A1', nama: 'A1' },
        { id: 2, kode: 'A2', nama: 'A2' },
        { id: 3, kode: 'A3', nama: 'A3' },
      ],
      matrix: [
        [80, 20, 7],
        [60, 10, 9],
        [90, 30, 6],
      ],
      pairwise,
    });
    dekat(skor(h, [1, 2, 3]), [0.325116, 0.350738, 0.324146]);
    expect(skor(h, [1, 2, 3]).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(h.meta.peringatan).toBeUndefined();
    expect(h.steps.map((s) => s.judul)).toContain('Uji konsistensi (Consistency Ratio)');
  });
});

describe('Bobot dan validasi umum MCDM', () => {
  it('bobot dinormalisasi sehingga skala bobot tidak mengubah hasil', () => {
    const kali10: McdmInput = { ...bersama, criteria: bersama.criteria.map((c) => ({ ...c, bobot: c.bobot * 10 })) };
    for (const engine of [saw, wp, topsis, moora, mabac, edas, waspas]) {
      dekat(skor(engine(kali10), ids), skor(engine(bersama), ids), 10);
    }
  });

  it('mode preferensi: bobot akhir w_j·u_j dinormalisasi', () => {
    // u = (0, 0, 0, 1) → hanya C4 yang berpengaruh → SAW = x_i4 / max
    const h = saw({ ...bersama, preferensi: [0, 0, 0, 1] });
    dekat(skor(h, ids), [2 / 5, 4 / 5, 3 / 5, 1]);
    // preferensi seragam tidak mengubah hasil
    dekat(skor(saw({ ...bersama, preferensi: [3, 3, 3, 3] }), ids), skor(saw(bersama), ids), 10);
  });

  it('menolak matriks yang tidak lengkap dan bobot nol', () => {
    expect(() => saw({ ...bersama, matrix: bersama.matrix.slice(0, 3) })).toThrow(EngineError);
    expect(() => saw({ ...bersama, matrix: bersama.matrix.map((r) => r.slice(0, 3)) })).toThrow(EngineError);
    expect(() => saw({ ...bersama, criteria: bersama.criteria.map((c) => ({ ...c, bobot: 0 })) })).toThrow(EngineError);
    expect(() => topsis({ ...bersama, matrix: bersama.matrix.map((r) => r.map(() => Number.NaN)) })).toThrow(EngineError);
  });
});
