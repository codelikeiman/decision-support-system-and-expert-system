import { cache } from 'react';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from './auth';
import { prisma } from './db';
import { tenantDb, type TenantDb } from './tenant';

export interface CurrentUser {
  id: number;
  nama: string;
  email: string;
  role: 'super_admin' | 'admin' | 'end_user';
  clientId: number | null;
  clientSlug: string | null;
}

/**
 * Pengguna yang sedang login, diverifikasi ulang ke database pada setiap
 * request (akun yang dinonaktifkan/dihapus langsung kehilangan akses walaupun
 * token JWT-nya belum kedaluwarsa).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, nama: true, email: true, role: true, clientId: true, isActive: true, client: { select: { slug: true } } },
  });
  if (!user || !user.isActive) return null;
  return {
    id: user.id,
    nama: user.nama,
    email: user.email,
    role: user.role,
    clientId: user.clientId,
    clientSlug: user.client?.slug ?? null,
  };
});

export function berandaUntuk(user: CurrentUser): string {
  if (user.role === 'super_admin') return '/super-admin';
  if (user.role === 'admin') return '/admin';
  return user.clientSlug ? `/c/${user.clientSlug}` : '/';
}

export async function requireSuperAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'super_admin') redirect(berandaUntuk(user));
  return user;
}

/** Super Admin atau Admin. */
export async function requireStaff(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'super_admin' && user.role !== 'admin') redirect(berandaUntuk(user));
  if (user.role === 'admin' && !user.clientId) redirect('/login');
  return user;
}

export function parseId(value: string | number | undefined | null): number {
  const id = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return id;
}

/**
 * Akses ke satu SPK Case dari area admin.
 *  - Admin: Case dicari melalui tenantDb client-nya → Case milik client lain
 *    tidak pernah ditemukan (404).
 *  - Super Admin: boleh membuka Case mana pun; `db` yang dikembalikan tetap
 *    terkunci pada client pemilik Case.
 */
export const requireCaseAccess = cache(async (caseId: number) => {
  const user = await requireStaff();
  if (!Number.isInteger(caseId) || caseId <= 0) notFound();
  const kasus =
    user.role === 'super_admin'
      ? await prisma.spkCase.findUnique({ where: { id: caseId }, include: { client: true } })
      : await tenantDb(user.clientId as number).spkCase.findFirst({ where: { id: caseId }, include: { client: true } });
  if (!kasus) notFound();
  const db: TenantDb = tenantDb(kasus.clientId);
  return { user, kasus, client: kasus.client, db };
});

export type CaseAccess = Awaited<ReturnType<typeof requireCaseAccess>>;
