import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, History, RotateCcw } from 'lucide-react';
import { ResultView } from '@/components/result-view';
import { Button } from '@/components/ui/button';
import { getSettings } from '@/lib/settings';
import { stepsFromRows } from '@/lib/spk/consultation';
import { ambilKonsultasi, peranTerhadapClient } from '@/lib/spk/public';

export const metadata: Metadata = { title: 'Hasil Konsultasi', robots: { index: false, follow: false } };

export default async function HasilPage({ params }: { params: Promise<{ clientSlug: string; caseSlug: string; kode: string }> }) {
  const { clientSlug, caseSlug, kode } = await params;
  const [data, settings] = await Promise.all([ambilKonsultasi(kode), getSettings()]);
  // Kode yang sah tetapi bukan milik Case/client pada URL ini diperlakukan sebagai tidak ada.
  if (!data || data.konsultasi.client.slug !== clientSlug || data.konsultasi.case.slug !== caseSlug) notFound();
  const { konsultasi, viewer } = data;
  const base = `/c/${clientSlug}/${caseSlug}`;
  const punyaRiwayat = peranTerhadapClient(viewer, konsultasi.clientId) !== null;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={base} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {konsultasi.case.judul}
        </Link>
        <div className="flex flex-wrap gap-2">
          {punyaRiwayat ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/riwayat`}>
                <History /> Riwayat saya
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href={`${base}/konsultasi`}>
              <RotateCcw /> Konsultasi lagi
            </Link>
          </Button>
        </div>
      </div>
      <h1 className="text-2xl font-semibold">Hasil konsultasi</h1>
      <ResultView
        konsultasi={{ ...konsultasi, namaResponden: konsultasi.namaResponden ?? konsultasi.user?.nama ?? null }}
        steps={stepsFromRows(konsultasi.steps)}
        digits={settings.presisiDesimal}
        disclaimer={settings.teksDisclaimer}
      />
    </div>
  );
}
