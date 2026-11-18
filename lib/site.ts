/**
 * URL publik aplikasi — dipakai sebagai `metadataBase` agar tag Open Graph
 * (og:image, og:url) berisi URL absolut yang dapat dibaca WhatsApp, Telegram,
 * LinkedIn, dan X.
 *
 * Urutan: NEXT_PUBLIC_SITE_URL → domain produksi Vercel → URL deployment Vercel
 * → NEXTAUTH_URL → localhost.
 */
export function siteUrl(): URL {
  const kandidat = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    process.env.NEXTAUTH_URL,
  ];
  for (const k of kandidat) {
    if (!k) continue;
    try {
      return new URL(k.trim().replace(/\/+$/, '') + '/');
    } catch {
      /* lanjut ke kandidat berikutnya */
    }
  }
  return new URL('http://localhost:3000/');
}

/** Ringkas teks untuk deskripsi meta (≈ batas tampil pratinjau tautan). */
export function ringkas(teks: string | null | undefined, maks = 200): string {
  const bersih = (teks ?? '').replace(/\s+/g, ' ').trim();
  if (bersih.length <= maks) return bersih;
  return bersih.slice(0, maks - 1).replace(/\s+\S*$/, '') + '…';
}
