import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Zona waktu tampilan (IANA). Diatur lewat NEXT_PUBLIC_APP_TIMEZONE; bawaan Asia/Jakarta (WIB). */
function zonaWaktu(): string {
  const tz = process.env.NEXT_PUBLIC_APP_TIMEZONE || 'Asia/Jakarta';
  try {
    new Intl.DateTimeFormat('id-ID', { timeZone: tz });
    return tz;
  } catch {
    return 'Asia/Jakarta';
  }
}
const ZONA = zonaWaktu();
const SINGKATAN_ZONA: Record<string, string> = { 'Asia/Jakarta': 'WIB', 'Asia/Pontianak': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' };

const formatTanggalWaktu = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: ZONA });
const formatTanggalSaja = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: ZONA });
const formatSingkatanZona = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, timeZoneName: 'short' });

export function tanggalWaktu(d: Date | string): string {
  const waktu = new Date(d);
  const zona = SINGKATAN_ZONA[ZONA] ?? formatSingkatanZona.formatToParts(waktu).find((p) => p.type === 'timeZoneName')?.value ?? '';
  return `${formatTanggalWaktu.format(waktu)} ${zona}`.trim();
}

export function tanggal(d: Date | string): string {
  return formatTanggalSaja.format(new Date(d));
}

export function angka(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n);
}

export const HEX_WARNA = /^#[0-9a-fA-F]{6}$/;

/** Warna teks (hitam/putih) dengan kontras terbaik di atas warna latar hex. */
export function kontrasTeks(hex: string): '#ffffff' | '#0f172a' {
  if (!HEX_WARNA.test(hex)) return '#ffffff';
  const kanal = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const luminans = 0.2126 * kanal[0] + 0.7152 * kanal[1] + 0.0722 * kanal[2];
  // rasio kontras terhadap putih vs terhadap teks gelap (#0f172a, L≈0.0092)
  const kontrasPutih = 1.05 / (luminans + 0.05);
  const kontrasGelap = (luminans + 0.05) / (0.0092 + 0.05);
  return kontrasPutih >= kontrasGelap ? '#ffffff' : '#0f172a';
}

export type ActionResult<T = undefined> =
  | { ok: true; pesan?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export function gagal(error: string, fieldErrors?: Record<string, string[] | undefined>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}
