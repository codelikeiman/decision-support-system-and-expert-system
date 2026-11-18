import type { AltRef, Cell, EngineHasil, RankingItem, SkorFormat } from './types';

export const EPS = 1e-12;

/** Format angka gaya Indonesia tanpa pemisah ribuan (titik desimal → koma tidak dipakai agar konsisten dengan rumus). */
export function fmt(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return '–';
  const r = Number(n.toFixed(digits));
  // hindari "-0"
  return (Object.is(r, -0) ? 0 : r).toString();
}

export function fmtSkor(n: number, format: SkorFormat, digits = 4): string {
  if (format === 'persen') return `${fmt(n * 100, 2)}%`;
  if (format === 'bulat') return fmt(n, 0);
  return fmt(n, digits);
}

/** Amankan teks buatan pengguna agar tanda `$` tidak dianggap pembuka rumus inline. */
export function safe(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\$/g, '\\$');
}

/** Escape teks agar aman dimasukkan ke dalam `\text{...}` LaTeX. */
export function latexText(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash ')
    .replace(/([{}$&#%_])/g, '\\$1')
    .replace(/\^/g, '\\textasciicircum ')
    .replace(/~/g, '\\textasciitilde ');
}

/** Angka untuk dipakai di dalam LaTeX. */
export function ltx(n: number, digits = 4): string {
  return fmt(n, digits);
}

/** Kecilkan huruf pertama saja, mis. "Nilai preferensi (V)" → "nilai preferensi (V)". */
export function kecilAwal(text: string): string {
  return text.length > 0 ? text[0].toLowerCase() + text.slice(1) : text;
}

export function sum(values: number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

export function column(matrix: number[][], j: number): number[] {
  return matrix.map((row) => row[j]);
}

export function nearlyEqual(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
}

export interface RankOptions {
  /** fungsi pembanding tambahan saat skor seri (negatif = a lebih dulu) */
  tieBreak?: (a: number, b: number) => number;
  keterangan?: (index: number) => string | undefined;
}

/**
 * Susun peringkat dari skor (semakin besar semakin baik). Skor yang sama
 * memperoleh peringkat yang sama (competition ranking: 1, 1, 3).
 */
export function buildRanking(alternatives: AltRef[], scores: number[], options: RankOptions = {}): RankingItem[] {
  const order = alternatives.map((_, i) => i);
  order.sort((a, b) => {
    if (!nearlyEqual(scores[a], scores[b])) return scores[b] - scores[a];
    const tb = options.tieBreak ? options.tieBreak(a, b) : 0;
    return tb !== 0 ? tb : a - b;
  });
  const items: RankingItem[] = [];
  order.forEach((idx, pos) => {
    let peringkat = pos + 1;
    if (pos > 0) {
      const prevIdx = order[pos - 1];
      const tied =
        nearlyEqual(scores[idx], scores[prevIdx]) && (!options.tieBreak || options.tieBreak(prevIdx, idx) === 0);
      if (tied) peringkat = items[pos - 1].peringkat;
    }
    items.push({
      alternativeId: alternatives[idx].id,
      kode: alternatives[idx].kode,
      nama: alternatives[idx].nama,
      skor: scores[idx],
      peringkat,
      keterangan: options.keterangan?.(idx),
    });
  });
  return items;
}

export function topHasil(ranking: RankingItem[], ringkasan: (top: RankingItem) => string, kosong: string): EngineHasil {
  if (ranking.length === 0) {
    return { alternativeId: null, nama: null, skor: null, ringkasan: kosong };
  }
  const top = ranking[0];
  return { alternativeId: top.alternativeId, nama: top.nama, skor: top.skor, ringkasan: ringkasan(top) };
}

export function rankingRows(ranking: RankingItem[], format: SkorFormat): Cell[][] {
  return ranking.map((r) => [r.peringkat, `${r.kode} — ${safe(r.nama)}`, format === 'persen' ? `${fmt(r.skor * 100, 2)}%` : r.skor]);
}

/** Label himpunan penyakit, mis. {P1, P3}. */
export function setLabel(kodes: string[]): string {
  return `{${kodes.map(safe).join(', ')}}`;
}
