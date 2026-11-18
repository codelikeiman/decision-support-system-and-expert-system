import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/guards';
import { StorageNotConfiguredError } from '@/lib/storage';
import { MAKS_UKURAN_UNGGAH, simpanGambar } from '@/lib/uploads';

export const runtime = 'nodejs';

/**
 * Unggah gambar (logo client / ilustrasi Case).
 * - Super Admin: boleh untuk client mana pun.
 * - Admin: hanya untuk client-nya sendiri.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'super_admin' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'Tidak berwenang.' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
  }
  const clientId = Number(form.get('clientId'));
  const file = form.get('file');
  if (!Number.isInteger(clientId) || clientId <= 0 || !(file instanceof File)) {
    return NextResponse.json({ error: 'Permintaan tidak lengkap.' }, { status: 400 });
  }
  if (user.role === 'admin' && user.clientId !== clientId) {
    return NextResponse.json({ error: 'Tidak berwenang untuk client ini.' }, { status: 403 });
  }
  if (file.size > MAKS_UKURAN_UNGGAH) return NextResponse.json({ error: 'Ukuran berkas melebihi 2 MB.' }, { status: 413 });

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return NextResponse.json({ error: 'Client tidak ditemukan.' }, { status: 404 });

  let hasil: Awaited<ReturnType<typeof simpanGambar>>;
  try {
    hasil = await simpanGambar(Buffer.from(await file.arrayBuffer()), clientId);
  } catch (e) {
    console.error('[upload]', e);
    const pesan = e instanceof StorageNotConfiguredError ? e.message : 'Gagal menyimpan berkas. Silakan coba lagi.';
    return NextResponse.json({ error: pesan }, { status: 500 });
  }
  if ('error' in hasil) return NextResponse.json({ error: hasil.error }, { status: 400 });
  return NextResponse.json({ url: hasil.url });
}
