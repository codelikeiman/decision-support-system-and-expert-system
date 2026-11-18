import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CircleAlert, Eye, Info } from 'lucide-react';
import { ConsultationForm } from '@/components/public/consultation-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { loadCaseConfig } from '@/lib/spk/config';
import { toFormConfig } from '@/lib/spk/form-config';
import { loadPublicCase } from '@/lib/spk/public';
import { checkReadiness } from '@/lib/spk/readiness';

export const metadata: Metadata = { title: 'Konsultasi' };

export default async function KonsultasiPage({ params }: { params: Promise<{ clientSlug: string; caseSlug: string }> }) {
  const { clientSlug, caseSlug } = await params;
  const ctx = await loadPublicCase(clientSlug, caseSlug);
  if (!ctx) notFound();
  const { client, kasus, db, peran, pratinjau } = ctx;
  const base = `/c/${client.slug}/${kasus.slug}`;
  if (kasus.requiresLogin && peran === null) {
    redirect(`/c/${client.slug}/masuk?callbackUrl=${encodeURIComponent(`${base}/konsultasi`)}`);
  }
  const config = await loadCaseConfig(db, kasus);
  const siap = checkReadiness(config).siap;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div>
        <Link href={base} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {kasus.judul}
        </Link>
        <h1 className="text-2xl font-semibold">Form konsultasi</h1>
      </div>

      {pratinjau ? (
        <Alert variant="warning">
          <Eye />
          <AlertDescription>
            <p>Pratinjau — Case ini belum aktif. Konsultasi yang Anda kirim tetap tersimpan di riwayat.</p>
          </AlertDescription>
        </Alert>
      ) : null}

      {kasus.instruksi ? (
        <Alert variant="info">
          <Info />
          <AlertTitle>Petunjuk pengisian</AlertTitle>
          <AlertDescription>
            <p className="whitespace-pre-line">{kasus.instruksi}</p>
          </AlertDescription>
        </Alert>
      ) : null}

      {siap ? (
        <ConsultationForm clientSlug={client.slug} caseSlug={kasus.slug} form={toFormConfig(config)} tanyaNama={peran !== 'enduser'} />
      ) : (
        <Alert variant="warning">
          <CircleAlert />
          <AlertTitle>Layanan belum siap digunakan</AlertTitle>
          <AlertDescription>
            <p>Basis pengetahuan layanan ini masih dilengkapi oleh penyelenggara.</p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
