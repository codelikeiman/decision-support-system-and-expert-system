'use server';

import { revalidatePath } from 'next/cache';
import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { METHODS } from '@/lib/engines';
import { requireSuperAdmin } from '@/lib/guards';
import { caseSchema, clientSchema, settingsSchema, staffUserSchema } from '@/lib/schemas/platform';
import { saveSettings } from '@/lib/settings';
import { hapusBerkas, hapusBerkasClient, milikClient } from '@/lib/uploads';
import type { ActionResult } from '@/lib/utils';
import { galatTakTerduga, tidakValid } from './helpers';

function segarkan() {
  revalidatePath('/super-admin', 'layout');
  revalidatePath('/admin', 'layout');
}

const hapusBerkasLama = hapusBerkas;

/* ------------------------------ Client ----------------------------- */

export async function saveClient(id: number | null, values: unknown): Promise<ActionResult<{ id: number }>> {
  await requireSuperAdmin();
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) return tidakValid(parsed.error);
  const v = parsed.data;
  try {
    const bentrok = await prisma.client.findFirst({ where: { slug: v.slug, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
    if (bentrok) return { ok: false, error: 'Slug sudah dipakai client lain.', fieldErrors: { slug: ['Slug sudah dipakai client lain.'] } };

    const data = {
      namaClient: v.namaClient,
      slug: v.slug,
      deskripsi: v.deskripsi || null,
      warnaPrimary: v.warnaPrimary.toLowerCase(),
      warnaSecondary: v.warnaSecondary.toLowerCase(),
      warnaAccent: v.warnaAccent.toLowerCase(),
    };

    if (id === null) {
      const baru = await prisma.client.create({ data });
      segarkan();
      return { ok: true, pesan: 'Client berhasil dibuat.', data: { id: baru.id } };
    }

    const lama = await prisma.client.findUnique({ where: { id }, select: { logoUrl: true } });
    if (!lama) return { ok: false, error: 'Client tidak ditemukan.' };
    if (v.logoUrl !== null && !milikClient(v.logoUrl, id)) return { ok: false, error: 'Berkas logo tidak valid.' };
    await prisma.client.update({ where: { id }, data: { ...data, logoUrl: v.logoUrl } });
    if (lama.logoUrl && lama.logoUrl !== v.logoUrl) await hapusBerkasLama(lama.logoUrl);
    segarkan();
    return { ok: true, pesan: 'Perubahan client disimpan.', data: { id } };
  } catch (e) {
    return galatTakTerduga(e, 'saveClient');
  }
}

export async function deleteClient(id: number): Promise<ActionResult> {
  await requireSuperAdmin();
  try {
    const client = await prisma.client.findUnique({ where: { id }, select: { id: true } });
    if (!client) return { ok: false, error: 'Client tidak ditemukan.' };
    // ON DELETE CASCADE menghapus seluruh data milik client ini.
    await prisma.client.delete({ where: { id } });
    await hapusBerkasClient(id);
    segarkan();
    return { ok: true, pesan: 'Client beserta seluruh datanya dihapus.' };
  } catch (e) {
    return galatTakTerduga(e, 'deleteClient');
  }
}

/* ----------------------------- SPK Case ---------------------------- */

export async function saveCase(id: number | null, values: unknown): Promise<ActionResult<{ id: number }>> {
  await requireSuperAdmin();
  const parsed = caseSchema.safeParse(values);
  if (!parsed.success) return tidakValid(parsed.error);
  const v = parsed.data;
  try {
    const client = await prisma.client.findUnique({ where: { id: v.clientId }, select: { id: true } });
    if (!client) return { ok: false, error: 'Client tidak ditemukan.', fieldErrors: { clientId: ['Client tidak ditemukan.'] } };

    const bentrok = await prisma.spkCase.findFirst({
      where: { clientId: v.clientId, slug: v.slug, ...(id ? { id: { not: id } } : {}) },
      select: { id: true },
    });
    if (bentrok) {
      return { ok: false, error: 'Slug sudah dipakai Case lain pada client ini.', fieldErrors: { slug: ['Slug sudah dipakai Case lain pada client ini.'] } };
    }

    // Kategori selalu diturunkan dari metode — tidak pernah diterima dari klien.
    const category = METHODS[v.methodKey].kategori;
    const data = {
      judul: v.judul,
      slug: v.slug,
      deskripsi: v.deskripsi || null,
      methodKey: v.methodKey,
      category,
      mcdmMode: v.mcdmMode,
      requiresLogin: v.requiresLogin,
      isActive: v.isActive,
    };

    if (id === null) {
      const baru = await prisma.spkCase.create({ data: { ...data, clientId: v.clientId } });
      segarkan();
      return { ok: true, pesan: 'SPK Case berhasil dibuat.', data: { id: baru.id } };
    }

    const lama = await prisma.spkCase.findUnique({ where: { id }, select: { clientId: true } });
    if (!lama) return { ok: false, error: 'Case tidak ditemukan.' };
    if (lama.clientId !== v.clientId) return { ok: false, error: 'Case tidak dapat dipindahkan ke client lain.' };
    await prisma.spkCase.update({ where: { id }, data });
    segarkan();
    return { ok: true, pesan: 'Perubahan Case disimpan.', data: { id } };
  } catch (e) {
    return galatTakTerduga(e, 'saveCase');
  }
}

export async function deleteCase(id: number): Promise<ActionResult> {
  await requireSuperAdmin();
  try {
    const kasus = await prisma.spkCase.findUnique({ where: { id }, select: { gambarUrl: true } });
    if (!kasus) return { ok: false, error: 'Case tidak ditemukan.' };
    await prisma.spkCase.delete({ where: { id } });
    await hapusBerkasLama(kasus.gambarUrl);
    segarkan();
    return { ok: true, pesan: 'Case beserta seluruh datanya dihapus.' };
  } catch (e) {
    return galatTakTerduga(e, 'deleteCase');
  }
}

/* ----------------------------- Pengguna ---------------------------- */

async function superAdminAktifLain(kecualiId: number): Promise<number> {
  return prisma.user.count({ where: { role: 'super_admin', isActive: true, id: { not: kecualiId } } });
}

export async function saveStaffUser(id: number | null, values: unknown): Promise<ActionResult> {
  const saya = await requireSuperAdmin();
  const parsed = staffUserSchema.safeParse(values);
  if (!parsed.success) return tidakValid(parsed.error);
  const v = parsed.data;
  try {
    const clientId = v.role === 'admin' ? v.clientId : null;
    if (clientId) {
      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!client) return { ok: false, error: 'Client tidak ditemukan.', fieldErrors: { clientId: ['Client tidak ditemukan.'] } };
    }
    // Email staf harus unik di seluruh platform (login staf tidak membawa konteks client).
    const bentrok = await prisma.user.findFirst({
      where: { email: v.email, role: { in: ['super_admin', 'admin'] }, ...(id ? { id: { not: id } } : {}) },
      select: { id: true },
    });
    if (bentrok) return { ok: false, error: 'Email sudah dipakai akun pengelola lain.', fieldErrors: { email: ['Email sudah dipakai akun pengelola lain.'] } };
    if (clientId) {
      const bentrokClient = await prisma.user.findFirst({
        where: { email: v.email, clientId, ...(id ? { id: { not: id } } : {}) },
        select: { id: true },
      });
      if (bentrokClient) return { ok: false, error: 'Email sudah terdaftar pada client ini.', fieldErrors: { email: ['Email sudah terdaftar pada client ini.'] } };
    }

    if (id === null) {
      if (v.password === '') return { ok: false, error: 'Kata sandi wajib diisi.', fieldErrors: { password: ['Kata sandi wajib diisi.'] } };
      await prisma.user.create({
        data: { nama: v.nama, email: v.email, role: v.role, clientId, passwordHash: await hashPassword(v.password) },
      });
      segarkan();
      return { ok: true, pesan: 'Akun berhasil dibuat.' };
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target || target.role === 'end_user') return { ok: false, error: 'Akun pengelola tidak ditemukan.' };
    if (target.id === saya.id && v.role !== 'super_admin') return { ok: false, error: 'Anda tidak dapat mengubah peran akun sendiri.' };
    if (target.role === 'super_admin' && v.role !== 'super_admin' && (await superAdminAktifLain(id)) === 0) {
      return { ok: false, error: 'Harus ada minimal satu Super Admin aktif.' };
    }
    await prisma.user.update({
      where: { id },
      data: {
        nama: v.nama,
        email: v.email,
        role: v.role,
        clientId,
        ...(v.password !== '' ? { passwordHash: await hashPassword(v.password) } : {}),
      },
    });
    segarkan();
    return { ok: true, pesan: 'Perubahan akun disimpan.' };
  } catch (e) {
    return galatTakTerduga(e, 'saveStaffUser');
  }
}

export async function setUserActive(id: number, aktif: boolean): Promise<ActionResult> {
  const saya = await requireSuperAdmin();
  try {
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) return { ok: false, error: 'Akun tidak ditemukan.' };
    if (target.id === saya.id) return { ok: false, error: 'Anda tidak dapat menonaktifkan akun sendiri.' };
    if (!aktif && target.role === 'super_admin' && (await superAdminAktifLain(id)) === 0) {
      return { ok: false, error: 'Harus ada minimal satu Super Admin aktif.' };
    }
    await prisma.user.update({ where: { id }, data: { isActive: aktif } });
    segarkan();
    return { ok: true, pesan: aktif ? 'Akun diaktifkan.' : 'Akun dinonaktifkan.' };
  } catch (e) {
    return galatTakTerduga(e, 'setUserActive');
  }
}

export async function deleteUser(id: number): Promise<ActionResult> {
  const saya = await requireSuperAdmin();
  try {
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) return { ok: false, error: 'Akun tidak ditemukan.' };
    if (target.id === saya.id) return { ok: false, error: 'Anda tidak dapat menghapus akun sendiri.' };
    if (target.role === 'super_admin' && (await superAdminAktifLain(id)) === 0) {
      return { ok: false, error: 'Harus ada minimal satu Super Admin aktif.' };
    }
    // Riwayat konsultasi tetap tersimpan (user_id menjadi NULL).
    await prisma.user.delete({ where: { id } });
    segarkan();
    return { ok: true, pesan: 'Akun dihapus.' };
  } catch (e) {
    return galatTakTerduga(e, 'deleteUser');
  }
}

/* ---------------------------- Pengaturan --------------------------- */

export async function saveSettingsAction(values: unknown): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = settingsSchema.safeParse(values);
  if (!parsed.success) return tidakValid(parsed.error);
  try {
    await saveSettings(parsed.data);
    revalidatePath('/', 'layout');
    return { ok: true, pesan: 'Pengaturan disimpan.' };
  } catch (e) {
    return galatTakTerduga(e, 'saveSettings');
  }
}
