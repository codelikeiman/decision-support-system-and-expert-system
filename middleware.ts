import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Middleware berbasis peran (lapisan pertama). Lapisan kedua ada di
 * lib/guards.ts yang memverifikasi ulang pengguna ke database dan mengunci
 * setiap query pada client-nya.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const keLogin = () => {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  };
  const ke = (tujuan: string) => {
    const url = req.nextUrl.clone();
    url.pathname = tujuan;
    url.search = '';
    return NextResponse.redirect(url);
  };

  if (pathname.startsWith('/super-admin')) {
    if (!token) return keLogin();
    if (token.role !== 'super_admin') return ke(token.role === 'admin' ? '/admin' : '/');
  }

  if (pathname.startsWith('/admin')) {
    if (!token) return keLogin();
    if (token.role !== 'admin' && token.role !== 'super_admin') return ke('/');
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/super-admin/:path*', '/admin/:path*'],
};
