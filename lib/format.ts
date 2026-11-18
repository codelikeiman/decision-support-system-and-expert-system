import type { SkorFormat } from '@/lib/engines';

export function formatAngka(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return '–';
  const r = Number(n.toFixed(digits));
  return (Object.is(r, -0) ? 0 : r).toString();
}

/** Tampilkan skor sesuai jenis besaran metodenya. */
export function formatSkor(skor: number | null | undefined, format: SkorFormat, digits = 4): string {
  if (skor === null || skor === undefined || !Number.isFinite(skor)) return '–';
  if (format === 'persen') return `${formatAngka(skor * 100, 2)}%`;
  if (format === 'bulat') return formatAngka(skor, 0);
  return formatAngka(skor, digits);
}
