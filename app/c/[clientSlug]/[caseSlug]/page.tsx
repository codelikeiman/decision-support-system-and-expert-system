import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, CircleAlert, ClipboardList, Eye, History, Lock, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { METHODS, isMethodKey } from '@/lib/engines';
import { loadCaseConfig } from '@/lib/spk/config';
import { loadPublicCase } from '@/lib/spk/public';
import { checkReadiness } from '@/lib/spk/readiness';

type Params = Promise<{ clientSlug: string; caseSlug: string }>;

export default async function CaseLandingPage({ params }: { params: Params }) {
  const { clientSlug, caseSlug } = await params;
  const ctx = await loadPublicCase(clientSlug, caseSlug);
  if (!ctx) notFound();
  const { client, kasus, db, peran, pratinjau } = ctx;
  const base = `/c/${client.slug}/${kasus.slug}`;
  const config = await loadCaseConfig(db, kasus);
  const siap = checkReadiness(config).siap;
  const metode = isMethodKey(kasus.methodKey) ? METHODS[kasus.methodKey] : null;
  const perluMasuk = kasus.requiresLogin && peran === null;
  const jumlahIsian =
    kasus.category === 'A'
      ? `${config.criteria.length} pertanyaan`
      : kasus.category === 'C'
        ? `${config.variables.filter((v) => v.tipe === 'input').length} nilai yang diisi`
        : `${config.symptoms.length} gejala dalam daftar centang`;

  return (
    <div className="grid gap-6">
      {pratinjau ? (
        <Alert variant="warning">
          <Eye />
          <AlertTitle>Pratinjau</AlertTitle>
          <AlertDescription>
            <p>Case ini belum aktif dan hanya terlihat oleh pengelola.</p>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        <div className="grid md:grid-cols-[1fr_300px]">
          <div className="px-5 py-7 sm:px-8 sm:py-9">
            <div className="mb-3 flex flex-wrap gap-2">
              {kasus.requiresLogin ? (
                <Badge variant="info">
                  <Lock /> Perlu akun
                </Badge>
              ) : (
                <Badge variant="outline">Tanpa akun</Badge>
              )}
              {metode ? <Badge variant="secondary">Metode {metode.singkatan}</Badge> : null}
            </div>
            <h1 className="text-3xl font-semibold text-balance">{kasus.judul}</h1>
            {kasus.deskripsi ? <p className="mt-3 max-w-2xl whitespace-pre-line text-muted-foreground">{kasus.deskripsi}</p> : null}

            <div className="mt-6 flex flex-wrap gap-3">
              {!siap ? null : perluMasuk ? (
                <>
                  <Button asChild size="lg">
                    <Link href={`/c/${client.slug}/masuk?callbackUrl=${encodeURIComponent(`${base}/konsultasi`)}`}>Masuk untuk memulai</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href={`/c/${client.slug}/daftar?callbackUrl=${encodeURIComponent(`${base}/konsultasi`)}`}>Buat akun</Link>
                  </Button>
                </>
              ) : (
                <Button asChild size="lg">
                  <Link href={`${base}/konsultasi`}>
                    Mulai konsultasi <ArrowRight />
                  </Link>
                </Button>
              )}
              {peran !== null ? (
                <Button asChild size="lg" variant="outline">
                  <Link href={`${base}/riwayat`}>
                    <History /> Riwayat saya
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
          {kasus.gambarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={kasus.gambarUrl} alt="" className="h-48 w-full object-cover md:h-full" />
          ) : (
            <div className="hidden items-center justify-center bg-brand/10 md:flex" aria-hidden>
              <ClipboardList className="size-20 text-brand/50" />
            </div>
          )}
        </div>
      </section>

      {!siap ? (
        <Alert variant="warning">
          <CircleAlert />
          <AlertTitle>Layanan belum siap digunakan</AlertTitle>
          <AlertDescription>
            <p>Basis pengetahuan layanan ini masih dilengkapi oleh penyelenggara. Silakan kembali lagi nanti.</p>
            {peran === 'staf' ? (
              <Link href={`/admin/cases/${kasus.id}`} className="font-medium underline underline-offset-2">
                Buka daftar periksa kesiapan di dashboard
              </Link>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Cara kerja">
        {[
          { ikon: <ClipboardList />, judul: 'Isi form', isi: `Form berisi ${jumlahIsian}. Jawab sesuai kondisi Anda.` },
          { ikon: <ShieldCheck />, judul: 'Perhitungan transparan', isi: 'Setiap langkah perhitungan ditampilkan lengkap dengan rumusnya.' },
          { ikon: <History />, judul: 'Laporan PDF', isi: 'Hasil dan rincian perhitungan dapat diunduh sebagai laporan.' },
        ].map((x) => (
          <div key={x.judul} className="rounded-xl border bg-card p-4">
            <span className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4">{x.ikon}</span>
            <p className="font-medium">{x.judul}</p>
            <p className="mt-1 text-sm text-muted-foreground">{x.isi}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
