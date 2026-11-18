import type { Metadata } from 'next';
import { METHODS, isMethodKey } from '@/lib/engines';
import { getSettings } from '@/lib/settings';
import { ringkas } from '@/lib/site';
import { loadPublicCase } from '@/lib/spk/public';

type Params = Promise<{ clientSlug: string; caseSlug: string }>;

/**
 * Metadata pratinjau tautan untuk satu layanan. Ditaruh di layout agar halaman
 * turunannya (konsultasi, hasil, riwayat) ikut menampilkan pratinjau layanan
 * yang sama — tanpa pernah memuat data konsultasi siapa pun.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { clientSlug, caseSlug } = await params;
  const [ctx, settings] = await Promise.all([loadPublicCase(clientSlug, caseSlug), getSettings()]);
  if (!ctx) return {};
  const { client, kasus } = ctx;
  const metode = isMethodKey(kasus.methodKey) ? METHODS[kasus.methodKey] : null;
  const deskripsi =
    ringkas(kasus.deskripsi) ||
    `Konsultasi online ${kasus.judul} dari ${client.namaClient}${metode ? ` dengan metode ${metode.nama}` : ''}.`;
  const judulBagikan = `${kasus.judul} — ${client.namaClient}`;
  return {
    title: kasus.judul,
    description: deskripsi,
    openGraph: {
      type: 'website',
      locale: 'id_ID',
      siteName: `${client.namaClient} · ${settings.namaPlatform}`,
      title: judulBagikan,
      description: deskripsi,
      url: `/c/${client.slug}/${kasus.slug}`,
    },
    twitter: { card: 'summary_large_image', title: judulBagikan, description: deskripsi },
  };
}

export default function CaseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
