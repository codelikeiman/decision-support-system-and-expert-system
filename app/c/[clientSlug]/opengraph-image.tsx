import { OG_CONTENT_TYPE, OG_SIZE, logoDataUri, renderKartuOg } from '@/lib/og';
import { getSettings } from '@/lib/settings';
import { getClientBySlug } from '@/lib/spk/public';
import { tenantDb } from '@/lib/tenant';

export const alt = 'Layanan konsultasi sistem pakar';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

type Params = { clientSlug: string };

export default async function Image({ params }: { params: Promise<Params> | Params }) {
  const { clientSlug } = await Promise.resolve(params);
  const [client, settings] = await Promise.all([getClientBySlug(clientSlug), getSettings()]);
  if (!client) {
    return renderKartuOg({ organisasi: settings.namaPlatform, judul: settings.deskripsiPlatform || settings.namaPlatform, kaki: settings.namaPlatform });
  }
  const jumlah = await tenantDb(client.id).spkCase.count({ where: { isActive: true } });
  return renderKartuOg({
    organisasi: client.namaClient,
    logo: await logoDataUri(client.logoUrl),
    label: jumlah > 0 ? `${jumlah} layanan konsultasi` : 'Layanan konsultasi',
    judul: client.namaClient,
    deskripsi: client.deskripsi,
    kaki: `Didukung oleh ${settings.namaPlatform}`,
    warna: { primary: client.warnaPrimary, secondary: client.warnaSecondary, accent: client.warnaAccent },
  });
}
