import Link from 'next/link';
import { ArrowRight, Brain, FileCheck2, Layers, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CATEGORY_INFO, METHOD_LIST } from '@/lib/engines';
import { berandaUntuk, getCurrentUser } from '@/lib/guards';
import { getSettings } from '@/lib/settings';

export default async function HomePage() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const fitur = [
    { ikon: <Layers />, judul: 'Multi-tenant', isi: 'Satu instalasi melayani banyak client; setiap client dapat menjalankan banyak kasus SPK sekaligus.' },
    { ikon: <Brain />, judul: `${METHOD_LIST.length} metode`, isi: 'MCDM, probabilistik, fuzzy, dan rule-based — dipilih per kasus dari dashboard tanpa mengubah kode.' },
    { ikon: <FileCheck2 />, judul: 'Perhitungan transparan', isi: 'Setiap langkah perhitungan dicatat lengkap dengan rumusnya dan dapat diunduh sebagai laporan PDF.' },
    { ikon: <ShieldCheck />, judul: 'Uji validitas', isi: 'Bandingkan hasil sistem dengan diagnosis pakar untuk memperoleh tingkat akurasi.' },
  ];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-10 sm:px-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            {settings.namaPlatform.slice(0, 2).toUpperCase()}
          </span>
          <span className="font-semibold">{settings.namaPlatform}</span>
        </div>
        <Button asChild variant="outline" size="sm">
          {user ? <Link href={berandaUntuk(user)}>Buka dashboard</Link> : <Link href="/login">Masuk pengelola</Link>}
        </Button>
      </header>

      <section className="py-14 sm:py-20">
        <p className="mb-3 text-sm font-medium text-primary">Sistem pakar &amp; sistem pendukung keputusan</p>
        <h1 className="max-w-3xl text-3xl font-semibold text-balance sm:text-5xl">{settings.deskripsiPlatform}</h1>
        <p className="mt-5 max-w-2xl text-muted-foreground">
          Metode, kriteria, gejala, bobot, aturan, hingga tampilan tiap layanan diatur sepenuhnya dari dashboard. Pasien atau pengguna umum
          mengakses layanan melalui tautan yang dibagikan oleh penyelenggara.
        </p>
        <div className="mt-7">
          <Button asChild size="lg">
            {user ? (
              <Link href={berandaUntuk(user)}>
                Buka dashboard <ArrowRight />
              </Link>
            ) : (
              <Link href="/login">
                Masuk sebagai pengelola <ArrowRight />
              </Link>
            )}
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {fitur.map((f) => (
          <Card key={f.judul}>
            <CardContent className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">{f.ikon}</span>
              <div>
                <h2 className="font-semibold">{f.judul}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{f.isi}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Metode yang tersedia</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(Object.keys(CATEGORY_INFO) as (keyof typeof CATEGORY_INFO)[]).map((k) => (
            <div key={k} className="rounded-xl border bg-card p-5">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Kategori {k}</p>
              <p className="mt-0.5 font-medium">{CATEGORY_INFO[k].nama}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {METHOD_LIST.filter((m) => m.kategori === k)
                  .map((m) => m.singkatan)
                  .join(' · ')}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto pt-12 text-xs text-muted-foreground">© {new Date().getFullYear()} {settings.namaPlatform}</footer>
    </main>
  );
}
