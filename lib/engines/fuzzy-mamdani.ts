import type { Cell, EngineResult, FuzzyInput, FuzzyVariableDef, StepBlock } from './types';
import { alphaCut, finishFuzzy, membership, prepareFuzzy } from './fuzzy-common';
import { ltx, safe, sum } from './utils';

/** Ruas garis lurus daerah hasil komposisi: μ bergerak linear dari mu0 (di z0) ke mu1 (di z1). */
export interface Segmen {
  z0: number;
  z1: number;
  mu0: number;
  mu1: number;
}

const bersih = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);

export function luasSegmen(s: Segmen): number {
  return ((s.mu0 + s.mu1) / 2) * (s.z1 - s.z0);
}

/** Momen ∫ z·μ(z) dz pada satu ruas linear (eksak). */
export function momenSegmen(s: Segmen): number {
  return ((s.z1 - s.z0) / 6) * (s.z0 * (2 * s.mu0 + s.mu1) + s.z1 * (s.mu0 + 2 * s.mu1));
}

/**
 * Komposisi MAX atas himpunan output yang dipotong (MIN) pada α masing-masing.
 * Hasilnya fungsi linear sepotong-sepotong yang dinyatakan sebagai daftar ruas,
 * sehingga luas dan momennya dapat dihitung secara eksak (tanpa sampling).
 */
export function aggregateMamdani(variable: FuzzyVariableDef, alphaBySet: Map<number, number>): Segmen[] {
  const aktif = variable.sets.filter((s) => (alphaBySet.get(s.id) ?? 0) > 0);
  if (aktif.length === 0) return [];
  const { min, max } = variable;

  const titik = new Set<number>([min, max]);
  for (const s of aktif) {
    for (const p of s.params) if (p > min && p < max) titik.add(p);
    const cut = alphaCut(s, alphaBySet.get(s.id) as number);
    for (const z of [cut.naik, cut.turun]) if (z !== undefined && z > min && z < max) titik.add(z);
  }
  const pts = [...titik].sort((a, b) => a - b);
  const f = (s: (typeof aktif)[number], z: number) => Math.min(alphaBySet.get(s.id) as number, membership(s, z));

  const segmen: Segmen[] = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const p = pts[k];
    const h = pts[k + 1] - p;
    if (h <= 0) continue;
    // Pada selang terbuka (p, p+h) setiap himpunan terpotong berupa garis lurus;
    // nilai ujungnya diperoleh dari dua titik dalam agar tahan terhadap lompatan.
    const garis = aktif.map((s) => {
      const v1 = f(s, p + h / 3);
      const v2 = f(s, p + (2 * h) / 3);
      return { awal: 2 * v1 - v2, akhir: 2 * v2 - v1 };
    });
    const potong = new Set<number>([0, 1]);
    for (let i = 0; i < garis.length; i++) {
      for (let j = i + 1; j < garis.length; j++) {
        const d0 = garis[i].awal - garis[j].awal;
        const d1 = garis[i].akhir - garis[j].akhir;
        if (d0 * d1 < 0) {
          const t = d0 / (d0 - d1);
          if (t > 1e-12 && t < 1 - 1e-12) potong.add(t);
        }
      }
    }
    const ts = [...potong].sort((a, b) => a - b);
    for (let u = 0; u < ts.length - 1; u++) {
      const t0 = ts[u];
      const t1 = ts[u + 1];
      const tm = (t0 + t1) / 2;
      let pilih = garis[0];
      let nilai = -Infinity;
      for (const g of garis) {
        const v = g.awal + (g.akhir - g.awal) * tm;
        if (v > nilai) {
          nilai = v;
          pilih = g;
        }
      }
      segmen.push({
        z0: p + t0 * h,
        z1: p + t1 * h,
        mu0: bersih(pilih.awal + (pilih.akhir - pilih.awal) * t0),
        mu1: bersih(pilih.awal + (pilih.akhir - pilih.awal) * t1),
      });
    }
  }

  // Gabungkan ruas bertetangga yang segaris agar tabel ringkas.
  const gabung: Segmen[] = [];
  for (const s of segmen) {
    const prev = gabung[gabung.length - 1];
    if (prev) {
      const g1 = (prev.mu1 - prev.mu0) / (prev.z1 - prev.z0);
      const g2 = (s.mu1 - s.mu0) / (s.z1 - s.z0);
      if (Math.abs(prev.mu1 - s.mu0) < 1e-9 && Math.abs(g1 - g2) < 1e-9) {
        prev.z1 = s.z1;
        prev.mu1 = s.mu1;
        continue;
      }
    }
    gabung.push({ ...s });
  }
  return gabung;
}

/**
 * Fuzzy Mamdani (Mamdani & Assilian, 1975) — metode MAX–MIN.
 *   implikasi: μ_r(z) = min(α_r, μ_{C_r}(z))     komposisi: μ(z) = max_r μ_r(z)
 *   defuzzifikasi centroid: z* = ∫ z μ(z) dz / ∫ μ(z) dz
 */
export function fuzzyMamdani(input: FuzzyInput): EngineResult {
  const ctx = prepareFuzzy(input, 'Fuzzy Mamdani', 'Aplikasi fungsi implikasi (MIN)');
  const { rules, outputs, steps } = ctx;

  const crisp = new Map<number, number | null>();
  const komposisi: StepBlock[] = [];
  const defuzz: StepBlock[] = [];

  for (const v of outputs) {
    const alphaBySet = new Map<number, number>();
    for (const r of rules) {
      if (r.outVar.id !== v.id) continue;
      alphaBySet.set(r.outSet.id, Math.max(alphaBySet.get(r.outSet.id) ?? 0, r.alpha));
    }
    komposisi.push({
      type: 'table',
      judul: `Komposisi aturan untuk ${safe(v.nama)}`,
      kolom: ['Himpunan output', 'Aturan pendukung', '$\\alpha$ hasil MAX'],
      baris: v.sets
        .filter((s) => alphaBySet.has(s.id))
        .map((s): Cell[] => [
          safe(s.nama),
          rules
            .filter((r) => r.outSet.id === s.id)
            .map((r) => `R${r.nomor} (${ltx(r.alpha)})`)
            .join(', '),
          alphaBySet.get(s.id) as number,
        ]),
    });

    const segmen = aggregateMamdani(v, alphaBySet);
    const luas = segmen.map(luasSegmen);
    const momen = segmen.map(momenSegmen);
    const totalLuas = sum(luas);
    const totalMomen = sum(momen);

    if (segmen.length === 0 || totalLuas <= 0) {
      crisp.set(v.id, null);
      defuzz.push({ type: 'text', teks: `${safe(v.nama)}: tidak ada aturan yang aktif sehingga daerah hasil kosong dan nilai crisp tidak terdefinisi.` });
      continue;
    }
    const hasil = totalMomen / totalLuas;
    crisp.set(v.id, hasil);

    komposisi.push({
      type: 'table',
      judul: `Daerah hasil komposisi ${safe(v.nama)} (fungsi keanggotaan gabungan)`,
      kolom: ['Daerah', '$z$ awal', '$z$ akhir', '$\\mu$ awal', '$\\mu$ akhir', 'Bentuk'],
      baris: segmen.map((s, i): Cell[] => [
        `D${i + 1}`,
        s.z0,
        s.z1,
        s.mu0,
        s.mu1,
        Math.abs(s.mu0 - s.mu1) < 1e-12 ? 'datar' : s.mu1 > s.mu0 ? 'naik' : 'turun',
      ]),
    });
    defuzz.push({
      type: 'table',
      judul: `Luas dan momen tiap daerah — ${safe(v.nama)}`,
      kolom: ['Daerah', 'Batas $z$', 'Luas $A_k$', 'Momen $M_k$'],
      baris: [
        ...segmen.map((s, i): Cell[] => [`D${i + 1}`, `${ltx(s.z0)} – ${ltx(s.z1)}`, luas[i], momen[i]]),
        ['Jumlah', null, totalLuas, totalMomen],
      ],
    });
    defuzz.push({
      type: 'formula',
      judul: safe(v.nama),
      latex: `z^* = \\dfrac{\\sum M_k}{\\sum A_k} = \\dfrac{${ltx(totalMomen)}}{${ltx(totalLuas)}} = ${ltx(hasil)}`,
    });
  }

  steps.push({
    judul: 'Komposisi aturan (MAX)',
    deskripsi:
      'Setiap himpunan konsekuen dipotong pada $\\alpha$-predikat aturannya (implikasi MIN), lalu seluruh hasil digabung dengan operator MAX menjadi satu daerah fuzzy.',
    rumus: ['\\mu_{hasil}(z) = \\max_{r} \\, \\min\\bigl(\\alpha_r,\; \\mu_{C_r}(z)\\bigr)'],
    detail: komposisi,
  });
  steps.push({
    judul: 'Defuzzifikasi (centroid)',
    deskripsi:
      'Nilai tegas adalah titik pusat massa daerah hasil komposisi. Luas dan momen tiap daerah dihitung secara eksak (integral garis lurus sepotong-sepotong).',
    rumus: [
      'z^* = \\dfrac{\\int z \\, \\mu(z) \\, dz}{\\int \\mu(z) \\, dz} = \\dfrac{\\sum_k M_k}{\\sum_k A_k}',
      'A_k = \\dfrac{(\\mu_0 + \\mu_1)}{2} (z_1 - z_0), \\qquad M_k = \\dfrac{z_1 - z_0}{6} \\bigl[ z_0 (2\\mu_0 + \\mu_1) + z_1 (\\mu_0 + 2\\mu_1) \\bigr]',
    ],
    detail: defuzz,
  });

  return finishFuzzy(ctx, crisp, 'Mamdani');
}
