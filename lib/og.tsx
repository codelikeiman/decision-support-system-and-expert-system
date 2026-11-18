import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { ringkas } from './site';
import { bacaBerkas } from './uploads';
import { HEX_WARNA, kontrasTeks } from './utils';

/**
 * Generator gambar pratinjau tautan (Open Graph) 1200×630 PNG.
 * Ukuran ini adalah rekomendasi bersama WhatsApp, Telegram, LinkedIn,
 * Facebook, dan X (summary_large_image).
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

let fontPromise: Promise<{ regular: Buffer; bold: Buffer }> | null = null;
function muatFont() {
  fontPromise ??= (async () => {
    const dir = path.join(process.cwd(), 'assets', 'fonts');
    const [regular, bold] = await Promise.all([readFile(path.join(dir, 'Inter-Regular.woff')), readFile(path.join(dir, 'Inter-Bold.woff'))]);
    return { regular, bold };
  })().catch((e) => {
    fontPromise = null;
    throw e;
  });
  return fontPromise;
}

/** Logo sebagai data-URI; hanya PNG/JPG (format yang dapat dirender generator gambar). */
export async function logoDataUri(url: string | null | undefined): Promise<string | null> {
  const berkas = await bacaBerkas(url);
  if (!berkas || !['image/png', 'image/jpeg'].includes(berkas.mime)) return null;
  return `data:${berkas.mime};base64,${berkas.data.toString('base64')}`;
}

export interface KartuOg {
  /** nama organisasi / platform di kepala kartu */
  organisasi: string;
  logo?: string | null;
  label?: string | null;
  judul: string;
  deskripsi?: string | null;
  kaki: string;
  warna?: { primary: string; secondary: string; accent: string };
}

const warnaAman = (hex: string | undefined, cadangan: string) => (hex && HEX_WARNA.test(hex) ? hex : cadangan);

export async function renderKartuOg(k: KartuOg): Promise<ImageResponse> {
  const primary = warnaAman(k.warna?.primary, '#0f766e');
  const secondary = warnaAman(k.warna?.secondary, '#134e4a');
  const accent = warnaAman(k.warna?.accent, '#f59e0b');
  const teks = kontrasTeks(secondary);
  const redup = teks === '#ffffff' ? 'rgba(255,255,255,0.78)' : 'rgba(15,23,42,0.72)';
  const judul = ringkas(k.judul, 110);
  const panjang = judul.length;
  const ukuranJudul = panjang > 80 ? 52 : panjang > 50 ? 62 : 72;
  const inisial = k.organisasi
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();

  let fonts: { regular: Buffer; bold: Buffer } | null = null;
  try {
    fonts = await muatFont();
  } catch (e) {
    console.error('[og] font tidak dapat dimuat, memakai font bawaan', e);
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          backgroundColor: secondary,
          color: teks,
          fontFamily: fonts ? 'Inter' : undefined,
          overflow: 'hidden',
        }}
      >
        {/* dekorasi */}
        <div style={{ position: 'absolute', right: -230, top: -230, width: 540, height: 540, borderRadius: 9999, backgroundColor: primary, opacity: 0.55, display: 'flex' }} />
        <div style={{ position: 'absolute', right: -150, bottom: -210, width: 380, height: 380, borderRadius: 9999, backgroundColor: accent, opacity: 0.2, display: 'flex' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 16, backgroundColor: accent, display: 'flex' }} />

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', padding: '64px 80px 56px 88px' }}>
          {/* kepala */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: 20,
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {k.logo ? (
                // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                <img src={k.logo} width={72} height={72} style={{ objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: 36, fontWeight: 700, color: secondary }}>{inisial || 'SP'}</span>
              )}
            </div>
            <span style={{ fontSize: 34, fontWeight: 700, maxWidth: 820, lineClamp: 1, display: 'block' }}>{ringkas(k.organisasi, 48)}</span>
          </div>

          {/* isi */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 900 }}>
            {k.label ? (
              <div style={{ display: 'flex' }}>
                <span
                  style={{
                    backgroundColor: accent,
                    color: kontrasTeks(accent),
                    fontSize: 26,
                    fontWeight: 700,
                    padding: '8px 22px',
                    borderRadius: 9999,
                  }}
                >
                  {ringkas(k.label, 60)}
                </span>
              </div>
            ) : null}
            <span style={{ fontSize: ukuranJudul, fontWeight: 700, lineHeight: 1.12, letterSpacing: -1.5, display: 'block', lineClamp: 2 }}>{judul}</span>
            {k.deskripsi ? (
              <span style={{ fontSize: 28, lineHeight: 1.4, color: redup, display: 'block', lineClamp: 2 }}>{ringkas(k.deskripsi, 170)}</span>
            ) : null}
          </div>

          {/* kaki */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 24, color: redup }}>
            <div style={{ width: 12, height: 12, borderRadius: 9999, backgroundColor: accent, display: 'flex' }} />
            <span>{ringkas(k.kaki, 90)}</span>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: fonts
        ? [
            { name: 'Inter', data: fonts.regular, weight: 400, style: 'normal' },
            { name: 'Inter', data: fonts.bold, weight: 700, style: 'normal' },
          ]
        : undefined,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' },
    },
  );
}
