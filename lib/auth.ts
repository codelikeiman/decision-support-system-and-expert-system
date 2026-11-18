import bcrypt from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './db';
import { catatDanCek, cekBatas, hapusCatatan } from './rate-limit';

const JENDELA_LOGIN_MS = 10 * 60 * 1000;
const MAKS_GAGAL = 8;

/** Hash pembanding agar waktu respons sama saat email tidak ditemukan. */
const HASH_DUMMY = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8i1c0Y5dQzM9w1r1QmJ7Yp0h8oXxSa';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Konfigurasi NextAuth (Auth.js) — Credentials provider + sesi JWT.
 *
 * Satu provider melayani dua jenis login:
 *  - Staf (Super Admin & Admin): tanpa `clientSlug`, dari halaman /login.
 *  - End-User: dengan `clientSlug`, dari /c/[clientSlug]/login — akun dicari
 *    hanya di dalam client tersebut.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Email dan kata sandi',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Kata sandi', type: 'password' },
        clientSlug: { label: 'Client', type: 'text' },
      },
      async authorize(credentials) {
        const email = (credentials?.email ?? '').trim().toLowerCase();
        const password = credentials?.password ?? '';
        const clientSlug = (credentials?.clientSlug ?? '').trim();
        if (!email || !password) return null;

        const kunci = `login:${clientSlug || 'staf'}:${email}`;
        const batas = await cekBatas(kunci, MAKS_GAGAL);
        if (!batas.boleh) {
          throw new Error(`Terlalu banyak percobaan masuk. Coba lagi dalam ${Math.ceil(batas.tungguDetik / 60)} menit.`);
        }

        let user;
        try {
          if (clientSlug) {
            const client = await prisma.client.findUnique({ where: { slug: clientSlug }, select: { id: true } });
            user = client
              ? await prisma.user.findFirst({
                  where: { email, clientId: client.id, role: 'end_user' },
                  include: { client: { select: { slug: true } } },
                })
              : null;
          } else {
            user = await prisma.user.findFirst({
              where: { email, role: { in: ['super_admin', 'admin'] } },
              include: { client: { select: { slug: true } } },
            });
          }
        } catch (e) {
          // Jangan pernah meneruskan detail galat database ke browser.
          console.error('[auth] gagal membaca akun', e);
          throw new Error('Layanan sedang mengalami gangguan. Silakan coba lagi beberapa saat lagi.');
        }

        const cocok = await bcrypt.compare(password, user?.passwordHash ?? HASH_DUMMY);
        if (!user || !cocok || !user.isActive) {
          await catatDanCek(kunci, MAKS_GAGAL, JENDELA_LOGIN_MS);
          return null;
        }
        await hapusCatatan(kunci);

        return {
          id: String(user.id),
          name: user.nama,
          email: user.email,
          role: user.role,
          clientId: user.clientId,
          clientSlug: user.client?.slug ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = Number(user.id);
        token.role = user.role;
        token.clientId = user.clientId;
        token.clientSlug = user.clientSlug;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.uid,
        name: token.name ?? '',
        email: token.email ?? '',
        role: token.role,
        clientId: token.clientId ?? null,
        clientSlug: token.clientSlug ?? null,
      };
      return session;
    },
  },
};
