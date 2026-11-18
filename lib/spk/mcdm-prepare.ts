import { EngineError, type CalcStep, type Cell, type McdmInput } from '@/lib/engines';
import { ltx, safe } from '@/lib/engines/utils';
import type { CaseConfig } from './config';

/**
 * Susun matriks perbandingan berpasangan n×n dari data segitiga yang
 * tersimpan. Pasangan yang belum diisi dianggap 1 (sama penting).
 */
export function pairwiseMatrix(config: Pick<CaseConfig, 'criteria' | 'pairwise'>): { matrix: number[][]; kosong: number } {
  const ids = config.criteria.map((c) => c.id);
  let kosong = 0;
  const matrix = ids.map((a, i) =>
    ids.map((b, j) => {
      if (i === j) return 1;
      const langsung = config.pairwise[`${a}:${b}`];
      if (typeof langsung === 'number' && langsung > 0) return langsung;
      const balik = config.pairwise[`${b}:${a}`];
      if (typeof balik === 'number' && balik > 0) return 1 / balik;
      if (i < j) kosong += 1;
      return 1;
    }),
  );
  return { matrix, kosong };
}

/** Matriks nilai alternatif (profil acuan) dari konfigurasi; error bila ada sel kosong. */
export function referenceMatrix(config: Pick<CaseConfig, 'criteria' | 'alternatives' | 'values'>): number[][] {
  return config.alternatives.map((a) =>
    config.criteria.map((c) => {
      const v = config.values[`${a.id}:${c.id}`];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new EngineError(`Nilai alternatif "${a.nama}" pada kriteria "${c.nama}" belum diisi.`);
      }
      return v;
    }),
  );
}

/**
 * Mode "profil": matriks keputusan berisi nilai kesesuaian jawaban pengguna
 * terhadap profil acuan tiap alternatif:  x_ij = s_j(maks) − |u_j − a_ij|.
 */
export function profileMatrix(reference: number[][], jawaban: number[], skalaMaks: number[]): number[][] {
  return reference.map((row) => row.map((a, j) => skalaMaks[j] - Math.abs(jawaban[j] - a)));
}

export interface PreparedMcdm {
  input: McdmInput;
  steps: CalcStep[];
}

/**
 * Bentuk input engine MCDM dari konfigurasi Case + jawaban end-user.
 *
 * - mode `profil`     : jawaban = kondisi pengguna; alternatif diperingkat
 *                       menurut kesesuaian jawaban dengan profil acuannya.
 * - mode `preferensi` : jawaban = tingkat kepentingan kriteria; matriks
 *                       keputusan memakai nilai alternatif apa adanya dan
 *                       bobot pakar disesuaikan dengan jawaban pengguna.
 */
export function buildMcdmInput(config: CaseConfig, jawaban: Record<string, number>): PreparedMcdm {
  if (config.criteria.length === 0) throw new EngineError('Kasus ini belum memiliki kriteria.');
  if (config.alternatives.length === 0) throw new EngineError('Kasus ini belum memiliki alternatif.');

  const u = config.criteria.map((c) => {
    const v = jawaban[String(c.id)];
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new EngineError(`Jawaban untuk kriteria "${c.nama}" belum diisi.`);
    return v;
  });
  const reference = referenceMatrix(config);
  const alternatives = config.alternatives.map((a) => ({ id: a.id, kode: a.kode, nama: a.nama }));
  const labelJawaban = (j: number) => config.criteria[j].scales.find((s) => Math.abs(s.nilai - u[j]) < 1e-9)?.label ?? String(u[j]);
  const pairwise = config.methodKey === 'ahp' ? pairwiseMatrix(config).matrix : undefined;
  const steps: CalcStep[] = [];

  if (config.mcdmMode === 'preferensi') {
    steps.push({
      judul: 'Jawaban pengguna (tingkat kepentingan kriteria)',
      deskripsi:
        'Pada mode preferensi, jawaban pengguna menyatakan seberapa penting tiap kriteria baginya. Nilai $u_j$ dipakai untuk menyesuaikan bobot pakar pada langkah bobot kriteria.',
      detail: [
        {
          type: 'table',
          kolom: ['Kriteria', 'Jawaban', 'Nilai $u_j$'],
          baris: config.criteria.map((c, j): Cell[] => [`${c.kode} — ${safe(c.nama)}`, safe(labelJawaban(j)), u[j]]),
        },
      ],
    });
    return {
      input: {
        criteria: config.criteria.map((c) => ({ id: c.id, kode: c.kode, nama: c.nama, tipe: c.tipe, bobot: c.bobot })),
        alternatives,
        matrix: reference,
        pairwise,
        preferensi: u,
      },
      steps,
    };
  }

  const skalaMaks = config.criteria.map((c, j) => {
    const kandidat = c.scales.length > 0 ? c.scales.map((s) => s.nilai) : [u[j], ...reference.map((row) => row[j])];
    return Math.max(...kandidat);
  });
  const matrix = profileMatrix(reference, u, skalaMaks);

  steps.push({
    judul: 'Jawaban pengguna',
    deskripsi: 'Jawaban pengguna pada tiap kriteria dikonversi menjadi nilai $u_j$ sesuai skala penilaian kriteria tersebut.',
    detail: [
      {
        type: 'table',
        kolom: ['Kriteria', 'Jawaban', 'Nilai $u_j$'],
        baris: config.criteria.map((c, j): Cell[] => [`${c.kode} — ${safe(c.nama)}`, safe(labelJawaban(j)), u[j]]),
      },
    ],
  });
  steps.push({
    judul: 'Pembentukan matriks keputusan (kesesuaian profil)',
    deskripsi:
      'Setiap alternatif memiliki profil acuan $a_{ij}$ yang diisi pakar pada skala yang sama dengan jawaban pengguna. Nilai kesesuaian $x_{ij}$ dihitung dari selisih jawaban pengguna terhadap profil acuan: semakin kecil selisihnya, semakin tinggi nilainya. Karena menyatakan tingkat kesesuaian, seluruh kriteria diperlakukan sebagai benefit. Hasilnya menjadi matriks keputusan pada langkah berikutnya.',
    rumus: ['x_{ij} = s_j^{maks} - \\left| u_j - a_{ij} \\right|'],
    detail: [
      {
        type: 'table',
        judul: 'Profil acuan alternatif $a_{ij}$',
        kolom: ['Alternatif', ...config.criteria.map((c) => c.kode)],
        baris: [
          ...config.alternatives.map((a, i): Cell[] => [`${a.kode} — ${safe(a.nama)}`, ...reference[i]]),
          ['Jawaban pengguna $u_j$', ...u],
          ['Skala maksimum $s_j^{maks}$', ...skalaMaks],
        ],
      },
      {
        type: 'formula',
        judul: `Contoh: ${config.alternatives[0].kode} pada ${config.criteria[0].kode}`,
        latex: `x_{11} = ${ltx(skalaMaks[0])} - \\left| ${ltx(u[0])} - ${ltx(reference[0][0])} \\right| = ${ltx(matrix[0][0])}`,
      },
    ],
  });

  return {
    input: {
      criteria: config.criteria.map((c) => ({ id: c.id, kode: c.kode, nama: c.nama, tipe: 'benefit' as const, bobot: c.bobot })),
      alternatives,
      matrix,
      pairwise,
    },
    steps,
  };
}
