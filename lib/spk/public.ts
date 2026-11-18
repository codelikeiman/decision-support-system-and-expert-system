import { cache } from 'react';
import { cookies } from 'next/headers';
import { COOKIE_SESI_PUBLIK } from '@/lib/constants';
import { prisma } from '@/lib/db';
import { getCurrentUser, type CurrentUser } from '@/lib/guards';
import { tenantDb } from '@/lib/tenant';

export const getClientBySlug = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  return prisma.client.findUnique({ where: { slug } });
});

/** Hubungan pengguna yang login dengan sebuah client. */
export type PeranViewer = 'staf' | 'enduser' | null;

export function peranTerhadapClient(viewer: CurrentUser | null, clientId: number): PeranViewer {
  if (!viewer) return null;
  if (viewer.role === 'super_admin') return 'staf';
  if (viewer.clientId !== clientId) return null; // akun milik client lain dianggap tamu
  return viewer.role === 'admin' ? 'staf' : 'enduser';
}

/**
 * Muat Case untuk halaman publik. Case nonaktif hanya dapat dibuka pengelola
 * (sebagai pratinjau); bagi pengunjung lain dianggap tidak ada.
 */
export const loadPublicCase = cache(async (clientSlug: string, caseSlug: string) => {
  const client = await getClientBySlug(clientSlug);
  if (!client || !/^[a-z0-9-]{1,80}$/.test(caseSlug)) return null;
  const db = tenantDb(client.id);
  const [kasus, viewer] = await Promise.all([db.spkCase.findFirst({ where: { slug: caseSlug } }), getCurrentUser()]);
  if (!kasus) return null;
  const peran = peranTerhadapClient(viewer, client.id);
  if (!kasus.isActive && peran !== 'staf') return null;
  return { client, kasus, db, viewer, peran, pratinjau: !kasus.isActive };
});

export async function sesiPublik(): Promise<string | null> {
  const sid = (await cookies()).get(COOKIE_SESI_PUBLIK)?.value;
  return sid && /^[a-f0-9]{32}$/.test(sid) ? sid : null;
}

/**
 * Ambil satu konsultasi bila — dan hanya bila — penampil berhak melihatnya:
 *  - pengelola client pemilik konsultasi (atau Super Admin),
 *  - akun yang membuat konsultasi tersebut,
 *  - browser yang membuatnya (cookie sesi publik) untuk konsultasi tanpa akun.
 * Selain itu dikembalikan null (diperlakukan sebagai "tidak ditemukan").
 */
export const ambilKonsultasi = cache(async (kode: string) => {
  if (!/^KS-[0-9A-Z]{6,20}$/.test(kode)) return null;
  const konsultasi = await prisma.consultation.findUnique({
    where: { kode },
    include: {
      client: true,
      case: true,
      user: { select: { nama: true } },
      steps: { orderBy: { langkahKe: 'asc' } },
    },
  });
  if (!konsultasi) return null;
  const viewer = await getCurrentUser();
  const peran = peranTerhadapClient(viewer, konsultasi.clientId);
  let sebagai: 'staf' | 'pemilik' | null = null;
  if (peran === 'staf') sebagai = 'staf';
  else if (viewer && konsultasi.userId !== null && konsultasi.userId === viewer.id) sebagai = 'pemilik';
  else if (konsultasi.userId === null && konsultasi.sessionId) {
    const sid = await sesiPublik();
    if (sid && sid === konsultasi.sessionId) sebagai = 'pemilik';
  }
  if (!sebagai) return null;
  return { konsultasi, viewer, sebagai };
});
