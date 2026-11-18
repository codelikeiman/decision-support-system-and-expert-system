import { randomBytes } from 'node:crypto';
import { getStorage } from './storage';

export const MAKS_UKURAN_UNGGAH = 2 * 1024 * 1024; // 2 MB
export const AWALAN_URL_BERKAS = '/api/files/';

const JENIS: Record<string, { ext: string; mime: string }> = {
  png: { ext: 'png', mime: 'image/png' },
  jpg: { ext: 'jpg', mime: 'image/jpeg' },
  webp: { ext: 'webp', mime: 'image/webp' },
  gif: { ext: 'gif', mime: 'image/gif' },
};

/** Kenali jenis gambar dari magic bytes (bukan dari nama berkas/Content-Type kiriman klien). */
export function kenaliGambar(buf: Buffer): keyof typeof JENIS | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buf.length >= 6 && ['GIF87a', 'GIF89a'].includes(buf.subarray(0, 6).toString('ascii'))) return 'gif';
  return null;
}

/** Simpan gambar unggahan untuk client; kembalikan URL internalnya (/api/files/…). */
export async function simpanGambar(buf: Buffer, clientId: number): Promise<{ url: string } | { error: string }> {
  if (buf.length === 0) return { error: 'Berkas kosong.' };
  if (buf.length > MAKS_UKURAN_UNGGAH) return { error: 'Ukuran berkas melebihi 2 MB.' };
  const jenis = kenaliGambar(buf);
  if (!jenis) return { error: 'Berkas harus berupa gambar PNG, JPG, WEBP, atau GIF.' };
  const nama = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}.${JENIS[jenis].ext}`;
  const kunci = `${clientId}/${nama}`;
  await getStorage().simpan(kunci, buf, JENIS[jenis].mime);
  return { url: `${AWALAN_URL_BERKAS}${kunci}` };
}

/** Pola kunci yang dihasilkan `simpanGambar` — satu-satunya bentuk yang dilayani. */
const POLA_BERKAS = /^(\d+)\/([a-z0-9]+-[a-f0-9]{16})\.(png|jpg|webp|gif)$/;

export function parseUrlBerkas(url: string | null | undefined): { kunci: string; mime: string; clientId: number } | null {
  if (!url || !url.startsWith(AWALAN_URL_BERKAS)) return null;
  const m = url.slice(AWALAN_URL_BERKAS.length).match(POLA_BERKAS);
  if (!m) return null;
  return { kunci: `${m[1]}/${m[2]}.${m[3]}`, mime: JENIS[m[3]].mime, clientId: Number(m[1]) };
}

/** Apakah URL adalah berkas unggahan milik client tersebut. */
export function milikClient(url: string | null | undefined, clientId: number): boolean {
  return parseUrlBerkas(url)?.clientId === clientId;
}

export async function bacaBerkas(url: string | null | undefined): Promise<{ data: Buffer; mime: string } | null> {
  const info = parseUrlBerkas(url);
  if (!info) return null;
  try {
    const data = await getStorage().baca(info.kunci);
    return data ? { data, mime: info.mime } : null;
  } catch {
    return null;
  }
}

export async function berkasKeDataUri(url: string | null | undefined): Promise<string | null> {
  const berkas = await bacaBerkas(url);
  return berkas ? `data:${berkas.mime};base64,${berkas.data.toString('base64')}` : null;
}

/** Hapus satu berkas unggahan (abaikan bila URL bukan berkas sistem). */
export async function hapusBerkas(url: string | null | undefined): Promise<void> {
  const info = parseUrlBerkas(url);
  if (!info) return;
  await getStorage().hapus(info.kunci).catch((e) => console.error('[storage] gagal menghapus', info.kunci, e));
}

/** Hapus seluruh berkas milik satu client. */
export async function hapusBerkasClient(clientId: number): Promise<void> {
  await getStorage().hapusAwalan(`${clientId}/`).catch((e) => console.error('[storage] gagal menghapus folder client', clientId, e));
}
