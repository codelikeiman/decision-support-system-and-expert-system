'use server';

import { randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { hashPassword } from '@/lib/auth';
import { COOKIE_SESI_PUBLIK } from '@/lib/constants';
import { EngineError } from '@/lib/engines';
import { catatDanCek } from '@/lib/rate-limit';
import { registerSchema } from '@/lib/schemas/auth';
import { getSettings } from '@/lib/settings';
import { loadCaseConfig } from '@/lib/spk/config';
import { hitungDanSimpan } from '@/lib/spk/consultation';
import { validateInput } from '@/lib/spk/input';
import { getClientBySlug, loadPublicCase } from '@/lib/spk/public';
import { checkReadiness } from '@/lib/spk/readiness';
import { tenantDb } from '@/lib/tenant';
import type { ActionResult } from '@/lib/utils';
import { galatTakTerduga, tidakValid } from './helpers';

async function alamatIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'lokal';
}

/** Proses satu konsultasi end-user: validasi → hitung → simpan hasil & langkah perhitungan. */
export async function submitConsultation(
  clientSlug: string,
  caseSlug: string,
  payload: { input: unknown; nama?: string },
): Promise<ActionResult<{ kode: string }>> {
  try {
    const ctx = await loadPublicCase(clientSlug, caseSlug);
    if (!ctx) return { ok: false, error: 'Layanan tidak ditemukan atau sudah tidak aktif.' };
    const { client, kasus, db, viewer, peran } = ctx;
    if (kasus.requiresLogin && peran === null) return { ok: false, error: 'Silakan masuk terlebih dahulu untuk memakai layanan ini.' };

    const kunci = `konsultasi:${kasus.id}:${await alamatIp()}`;
    const jendela = 10 * 60 * 1000;
    const batas = await catatDanCek(kunci, 40, jendela);
    if (!batas.boleh) return { ok: false, error: 'Terlalu banyak permintaan. Silakan coba lagi beberapa menit lagi.' };

    const config = await loadCaseConfig(db, kasus);
    if (!checkReadiness(config).siap) return { ok: false, error: 'Layanan ini belum siap digunakan. Silakan hubungi penyelenggara.' };

    const cek = validateInput(config, payload.input);
    if (!cek.ok) return { ok: false, error: cek.error };

    // Akun dicatat hanya bila memang milik client ini (atau pengelola yang mencoba layanan).
    const userId = peran !== null && viewer ? viewer.id : null;
    let sessionId: string | null = null;
    if (userId === null) {
      const jar = await cookies();
      const lama = jar.get(COOKIE_SESI_PUBLIK)?.value;
      sessionId = lama && /^[a-f0-9]{32}$/.test(lama) ? lama : randomBytes(16).toString('hex');
      jar.set(COOKIE_SESI_PUBLIK, sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: Boolean(process.env.VERCEL) || (process.env.NEXTAUTH_URL ?? '').startsWith('https://'),
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });
    }
    const nama = (payload.nama ?? '').trim().slice(0, 100);

    const { kode } = await hitungDanSimpan(tenantDb(client.id), {
      config,
      input: cek.input,
      userId,
      sessionId,
      namaResponden: nama || (peran === 'enduser' && viewer ? viewer.nama : null),
    });
    return { ok: true, data: { kode } };
  } catch (e) {
    if (e instanceof EngineError) return { ok: false, error: e.message };
    return galatTakTerduga(e, 'submitConsultation');
  }
}

/** Pendaftaran akun end-user; akun selalu terikat pada client tempat ia mendaftar. */
export async function registerEndUser(clientSlug: string, values: unknown): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(values);
  if (!parsed.success) return tidakValid(parsed.error);
  const v = parsed.data;
  try {
    const [client, settings] = await Promise.all([getClientBySlug(clientSlug), getSettings()]);
    if (!client) return { ok: false, error: 'Layanan tidak ditemukan.' };
    if (!settings.izinkanRegistrasi) return { ok: false, error: 'Pendaftaran akun sedang ditutup. Silakan hubungi penyelenggara.' };

    const kunci = `daftar:${client.id}:${await alamatIp()}`;
    const jendela = 60 * 60 * 1000;
    if (!(await catatDanCek(kunci, 10, jendela)).boleh) return { ok: false, error: 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.' };

    const db = tenantDb(client.id);
    const ada = await db.user.findFirst({ where: { email: v.email }, select: { id: true } });
    if (ada) return { ok: false, error: 'Email sudah terdaftar. Silakan masuk.', fieldErrors: { email: ['Email sudah terdaftar.'] } };
    await db.user.create({
      data: { clientId: client.id, role: 'end_user', nama: v.nama, email: v.email, passwordHash: await hashPassword(v.password) },
    });
    return { ok: true, pesan: 'Akun berhasil dibuat.' };
  } catch (e) {
    return galatTakTerduga(e, 'registerEndUser');
  }
}
