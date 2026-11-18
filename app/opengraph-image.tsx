import { CATEGORY_INFO, METHOD_LIST } from '@/lib/engines';
import { OG_CONTENT_TYPE, OG_SIZE, renderKartuOg } from '@/lib/og';
import { getSettings } from '@/lib/settings';

export const alt = 'Platform sistem pakar dan sistem pendukung keputusan';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
// diperbarui berkala agar perubahan nama/deskripsi platform ikut tampil
export const revalidate = 3600;

export default async function Image() {
  const s = await getSettings();
  return renderKartuOg({
    organisasi: s.namaPlatform,
    label: `${METHOD_LIST.length} metode SPK & sistem pakar`,
    judul: s.namaPlatform,
    deskripsi: s.deskripsiPlatform,
    kaki: `${Object.values(CATEGORY_INFO).length} kategori metode · Perhitungan transparan · Laporan PDF · Uji validitas`,
  });
}
