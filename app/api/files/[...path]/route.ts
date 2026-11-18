import { NextResponse } from 'next/server';
import { AWALAN_URL_BERKAS, bacaBerkas } from '@/lib/uploads';

export const runtime = 'nodejs';

/** Layani berkas unggahan (logo & ilustrasi). Hanya nama berkas buatan sistem yang dilayani. */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const berkas = await bacaBerkas(`${AWALAN_URL_BERKAS}${path.join('/')}`);
  if (!berkas) return new NextResponse('Berkas tidak ditemukan.', { status: 404 });
  return new NextResponse(new Uint8Array(berkas.data), {
    headers: {
      'Content-Type': berkas.mime,
      'Content-Length': String(berkas.data.length),
      // nama berkas unik & tidak pernah berubah → aman di-cache browser; CDN Vercel menyimpan 1 hari
      'Cache-Control': 'public, max-age=31536000, s-maxage=86400, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
