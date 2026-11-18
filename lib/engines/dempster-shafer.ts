import type { Cell, EngineResult, ProbInput, StepBlock } from './types';
import { gejalaLabel, prepareProb } from './prob-common';
import { buildRanking, fmt, ltx, nearlyEqual, safe, setLabel } from './utils';

/** Fungsi massa: kunci = indeks alternatif terurut digabung koma. */
type Massa = Map<string, { anggota: number[]; m: number }>;

const kunci = (anggota: number[]) => anggota.join(',');

function irisan(a: number[], b: number[]): number[] {
  const sb = new Set(b);
  return a.filter((x) => sb.has(x));
}

export interface DsEvidence {
  label: string;
  anggota: number[];
  m: number;
}

/** Aturan kombinasi Dempster untuk dua fungsi massa. */
export function combineMass(m1: Massa, m2: Massa): { hasil: Massa; konflik: number; mentah: Massa } {
  const mentah: Massa = new Map();
  let konflik = 0;
  for (const a of m1.values()) {
    for (const b of m2.values()) {
      const c = irisan(a.anggota, b.anggota);
      const nilai = a.m * b.m;
      if (c.length === 0) {
        konflik += nilai;
        continue;
      }
      const k = kunci(c);
      const lama = mentah.get(k);
      if (lama) lama.m += nilai;
      else mentah.set(k, { anggota: c, m: nilai });
    }
  }
  const hasil: Massa = new Map();
  const penyebut = 1 - konflik;
  if (penyebut > 1e-12) {
    for (const [k, v] of mentah) hasil.set(k, { anggota: v.anggota, m: v.m / penyebut });
  }
  return { hasil, konflik, mentah };
}

/**
 * Dempster-Shafer (Dempster, 1967; Shafer, 1976).
 *   m_k(X) = densitas gejala k,   m_k(Θ) = 1 − m_k(X)
 *   m_3(Z) = Σ_{X∩Y=Z} m_1(X) m_2(Y) / (1 − K),   K = Σ_{X∩Y=∅} m_1(X) m_2(Y)
 */
export function dempsterShafer(input: ProbInput): EngineResult {
  const ctx = prepareProb(input, 'Dempster-Shafer', { min: 0, max: 1, namaNilai: 'nilai densitas' });
  const { alts, dipilih, steps } = ctx;
  const semua = alts.map((_, i) => i);
  const kunciTheta = kunci(semua);
  const label = (anggota: number[]) => (kunci(anggota) === kunciTheta ? '$\\Theta$' : setLabel(anggota.map((i) => alts[i].kode)));

  // Bentuk evidence: tiap gejala → himpunan alternatif dengan densitas yang sama.
  const evidences: DsEvidence[] = [];
  const tanpaRelasi: string[] = [];
  for (const d of dipilih) {
    const grup: { nilai: number; anggota: number[] }[] = [];
    alts.forEach((a, i) => {
      const v = ctx.nilai(a.id, d.gejala.id);
      if (v === undefined || v <= 0) return;
      const g = grup.find((x) => nearlyEqual(x.nilai, v));
      if (g) g.anggota.push(i);
      else grup.push({ nilai: v, anggota: [i] });
    });
    if (grup.length === 0) {
      tanpaRelasi.push(d.gejala.kode);
      continue;
    }
    grup.sort((x, y) => y.nilai - x.nilai);
    grup.forEach((g, idx) => {
      evidences.push({
        label: grup.length > 1 ? `${d.gejala.kode} (${idx + 1})` : d.gejala.kode,
        anggota: g.anggota,
        m: g.nilai,
      });
    });
  }

  steps.push({
    judul: 'Nilai densitas (evidence) tiap gejala',
    deskripsi:
      'Setiap gejala mendukung himpunan alternatif yang berkaitan dengannya sebesar nilai densitas $m(X)$; sisanya diberikan kepada $\\Theta$ (seluruh alternatif).' +
      ' Bila satu gejala memiliki densitas berbeda untuk alternatif yang berbeda, tiap nilai diperlakukan sebagai evidence tersendiri.',
    rumus: ['m_k(X) = \\text{densitas}, \\qquad m_k(\\Theta) = 1 - m_k(X)', `\\Theta = \\{ ${alts.map((a) => `\\text{${a.kode.replace(/[^A-Za-z0-9.-]/g, '')}}`).join(', ')} \\}`],
    detail: [
      {
        type: 'table',
        kolom: ['Evidence', 'Himpunan $X$', '$m(X)$', '$m(\\Theta)$'],
        baris: evidences.map((e) => [safe(e.label), label(e.anggota), e.m, 1 - e.m]),
        catatan:
          tanpaRelasi.length > 0
            ? `Gejala ${tanpaRelasi.map(safe).join(', ')} tidak berkaitan dengan alternatif mana pun sehingga tidak ikut dikombinasikan.`
            : undefined,
      },
      {
        type: 'table',
        judul: 'Keterangan kode alternatif',
        kolom: ['Kode', 'Alternatif'],
        baris: alts.map((a) => [a.kode, safe(a.nama)]),
      },
    ],
  });

  const massaDari = (e: DsEvidence): Massa => {
    const m: Massa = new Map();
    if (kunci(e.anggota) === kunciTheta) {
      m.set(kunciTheta, { anggota: semua, m: 1 });
      return m;
    }
    if (e.m > 0) m.set(kunci(e.anggota), { anggota: e.anggota, m: e.m });
    if (1 - e.m > 1e-12) m.set(kunciTheta, { anggota: semua, m: 1 - e.m });
    return m;
  };

  let saatIni: Massa = new Map();
  let konflikTotal = false;
  evidences.forEach((e, idx) => {
    const baru = massaDari(e);
    if (idx === 0) {
      saatIni = baru;
      return;
    }
    const { hasil, konflik, mentah } = combineMass(saatIni, baru);
    const kolomBaru = [...baru.values()];
    const detail: StepBlock[] = [
      {
        type: 'table',
        judul: 'Tabel kombinasi (irisan himpunan dan hasil kali densitas)',
        kolom: ['', ...kolomBaru.map((b) => `${label(b.anggota)} = ${fmt(b.m)}`)],
        baris: [...saatIni.values()].map((a): Cell[] => [
          `${label(a.anggota)} = ${fmt(a.m)}`,
          ...kolomBaru.map((b) => {
            const c = irisan(a.anggota, b.anggota);
            return `${c.length === 0 ? '$\\varnothing$' : label(c)} = ${fmt(a.m * b.m)}`;
          }),
        ]),
      },
      {
        type: 'formula',
        latex: `K = ${ltx(konflik)}, \\qquad 1 - K = ${ltx(1 - konflik)}`,
      },
    ];
    if (1 - konflik <= 1e-12) {
      konflikTotal = true;
      detail.push({
        type: 'text',
        teks: 'Seluruh evidence saling bertentangan ($K = 1$) sehingga kombinasi tidak dapat dinormalisasi. Tidak ada kesimpulan yang dapat ditarik.',
      });
    } else {
      detail.push({
        type: 'table',
        judul: `Fungsi massa hasil kombinasi $m_{${idx + 1}}$`,
        kolom: ['Himpunan $Z$', '$\\sum m_1(X)\\,m_2(Y)$', '$m(Z)$'],
        baris: [...mentah.values()].map((v) => [label(v.anggota), v.m, v.m / (1 - konflik)]),
      });
    }
    steps.push({
      judul: `Kombinasi evidence ke-${idx + 1} (${safe(e.label)})`,
      deskripsi: `Fungsi massa hasil sebelumnya dikombinasikan dengan evidence ${safe(e.label)} memakai aturan kombinasi Dempster.`,
      rumus: [
        'm_3(Z) = \\dfrac{\\sum_{X \\cap Y = Z} m_1(X) \\, m_2(Y)}{1 - K}, \\qquad K = \\sum_{X \\cap Y = \\varnothing} m_1(X) \\, m_2(Y)',
      ],
      detail,
    });
    saatIni = hasil;
  });

  const akhir = [...saatIni.values()].sort((a, b) => b.m - a.m || a.anggota.length - b.anggota.length);
  const bel = alts.map((_, i) => saatIni.get(kunci([i]))?.m ?? 0);
  const pl = alts.map((_, i) => akhir.filter((f) => f.anggota.includes(i)).reduce((acc, f) => acc + f.m, 0));
  // Skor alternatif = densitas tertinggi dari himpunan (selain Θ) yang memuat alternatif tersebut.
  const skor = alts.map((_, i) =>
    akhir.filter((f) => kunci(f.anggota) !== kunciTheta && f.anggota.includes(i)).reduce((acc, f) => Math.max(acc, f.m), 0),
  );

  const ranking = buildRanking(alts, skor, {
    tieBreak: (a, b) => {
      if (!nearlyEqual(bel[a], bel[b])) return bel[b] - bel[a];
      if (!nearlyEqual(pl[a], pl[b])) return pl[b] - pl[a];
      return 0;
    },
    keterangan: (i) => `Bel = ${fmt(bel[i])}, Pl = ${fmt(pl[i])}`,
  });

  const fokusUtama = akhir.find((f) => kunci(f.anggota) !== kunciTheta);
  steps.push({
    judul: 'Hasil akhir dan peringkat',
    deskripsi:
      'Kesimpulan diambil dari himpunan dengan nilai densitas tertinggi. Untuk tiap alternatif ditampilkan pula Belief (dukungan pasti) dan Plausibility (dukungan maksimum yang mungkin).',
    rumus: ['Bel(A) = \\sum_{B \\subseteq A} m(B), \\qquad Pl(A) = \\sum_{B \\cap A \\ne \\varnothing} m(B)'],
    detail: [
      {
        type: 'table',
        judul: 'Fungsi massa akhir',
        kolom: ['Himpunan', '$m$', 'Persentase'],
        baris: akhir.map((f) => [label(f.anggota), f.m, `${fmt(f.m * 100, 2)}%`]),
        sorot: fokusUtama ? [akhir.indexOf(fokusUtama)] : [],
      },
      {
        type: 'table',
        judul: 'Peringkat alternatif',
        kolom: ['Peringkat', 'Alternatif', 'Densitas tertinggi', 'Belief', 'Plausibility'],
        baris: ranking.map((r) => {
          const i = alts.findIndex((a) => a.id === r.alternativeId);
          return [r.peringkat, `${r.kode} — ${safe(r.nama)}`, r.skor, bel[i], pl[i]];
        }),
        sorot: ranking.length > 0 && ranking[0].skor > 0 ? [0] : [],
      },
    ],
  });

  const top = ranking[0];
  const adaHasil = !konflikTotal && top !== undefined && top.skor > 0 && fokusUtama !== undefined;
  let ringkasan: string;
  if (konflikTotal) ringkasan = 'Gejala yang dipilih saling bertentangan sepenuhnya sehingga tidak ada kesimpulan yang dapat ditarik.';
  else if (!adaHasil) ringkasan = 'Gejala yang dipilih tidak berkaitan dengan alternatif mana pun.';
  else if (fokusUtama.anggota.length > 1) {
    ringkasan = `Densitas tertinggi (${fmt(fokusUtama.m * 100, 2)}%) dimiliki himpunan ${fokusUtama.anggota
      .map((i) => alts[i].nama)
      .join(' / ')}; kandidat terkuat adalah ${top.nama}.`;
  } else {
    ringkasan = `Hasil dengan nilai densitas tertinggi adalah ${top.nama} (m = ${fmt(top.skor)} atau ${fmt(top.skor * 100, 2)}%).`;
  }

  return {
    hasil: adaHasil
      ? { alternativeId: top.alternativeId, nama: top.nama, skor: top.skor, ringkasan }
      : { alternativeId: null, nama: null, skor: null, ringkasan },
    ranking,
    steps,
    meta: {
      skorLabel: 'Nilai densitas (m)',
      skorFormat: 'persen',
      peringatan: konflikTotal ? ['Konflik total antar-evidence (K = 1).'] : undefined,
    },
  };
}
