import { METHODS, isMethodKey } from '@/lib/engines';
import { OG_CONTENT_TYPE, OG_SIZE, logoDataUri, renderKartuOg } from '@/lib/og';
import { getSettings } from '@/lib/settings';
import { getClientBySlug } from '@/lib/spk/public';
import { tenantDb } from '@/lib/tenant';

export const alt = 'Layanan konsultasi sistem pakar';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

type Params = { clientSlug: string; caseSlug: string };

/**
 * Gambar pratinjau satu layanan (Case). Dipakai juga oleh halaman turunannya
 * (konsultasi, hasil, riwayat) — hanya berisi informasi publik Case, tidak
 * pernah data konsultasi.
 */
export default async function Image({ params }: { params: Promise<Params> | Params }) {
  const { clientSlug, caseSlug } = await Promise.resolve(params);
  const [client, settings] = await Promise.all([getClientBySlug(clientSlug), getSettings()]);
  const kasus =
    client && /^[a-z0-9-]{1,80}$/.test(caseSlug)
      ? await tenantDb(client.id).spkCase.findFirst({ where: { slug: caseSlug, isActive: true } })
      : null;
  if (!client || !kasus) {
    return renderKartuOg({
      organisasi: client?.namaClient ?? settings.namaPlatform,
      judul: client?.namaClient ?? settings.namaPlatform,
      deskripsi: client?.deskripsi ?? settings.deskripsiPlatform,
      kaki: `Didukung oleh ${settings.namaPlatform}`,
      warna: client ? { primary: client.warnaPrimary, secondary: client.warnaSecondary, accent: client.warnaAccent } : undefined,
    });
  }
  const metode = isMethodKey(kasus.methodKey) ? METHODS[kasus.methodKey] : null;
  return renderKartuOg({
    organisasi: client.namaClient,
    logo: await logoDataUri(client.logoUrl),
    label: metode ? `Konsultasi online · Metode ${metode.singkatan}` : 'Konsultasi online',
    judul: kasus.judul,
    deskripsi: kasus.deskripsi,
    kaki: `${kasus.requiresLogin ? 'Perlu akun' : 'Gratis, tanpa akun'} · Hasil & rincian perhitungan dapat diunduh (PDF)`,
    warna: { primary: client.warnaPrimary, secondary: client.warnaSecondary, accent: client.warnaAccent },
  });
}
