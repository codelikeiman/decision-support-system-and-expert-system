import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Lock, Stethoscope } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/guards';
import { getClientBySlug, peranTerhadapClient } from '@/lib/spk/public';
import { tenantDb } from '@/lib/tenant';

export default async function ClientHomePage({ params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = await params;
  const [client, viewer] = await Promise.all([getClientBySlug(clientSlug), getCurrentUser()]);
  if (!client) notFound();
  const staf = peranTerhadapClient(viewer, client.id) === 'staf';
  // pengelola melihat juga Case yang belum aktif (pratinjau)
  const cases = await tenantDb(client.id).spkCase.findMany({ where: staf ? {} : { isActive: true }, orderBy: { judul: 'asc' } });

  return (
    <>
      <section className="mb-8">
        <h1 className="text-3xl font-semibold text-balance">{client.namaClient}</h1>
        {client.deskripsi ? <p className="mt-2 max-w-2xl text-muted-foreground">{client.deskripsi}</p> : null}
      </section>

      <h2 className="mb-4 text-lg font-semibold">Layanan konsultasi</h2>
      {cases.length === 0 ? (
        <EmptyState ikon={<Stethoscope />} judul="Belum ada layanan" deskripsi="Layanan konsultasi akan tampil di sini setelah diaktifkan oleh penyelenggara." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cases.map((k) => (
            <Card key={k.id} className="overflow-hidden pt-0">
              {k.gambarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={k.gambarUrl} alt="" className="h-36 w-full object-cover" />
              ) : (
                <div className="h-2 bg-brand" aria-hidden />
              )}
              <CardHeader>
                <CardTitle className="text-lg">{k.judul}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  {k.requiresLogin ? (
                    <Badge variant="info">
                      <Lock /> Perlu akun
                    </Badge>
                  ) : (
                    <Badge variant="outline">Tanpa akun</Badge>
                  )}
                  {!k.isActive ? <Badge variant="warning">Belum aktif (pratinjau)</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="line-clamp-3 text-sm text-muted-foreground">{k.deskripsi || 'Konsultasi berbasis sistem pakar.'}</p>
              </CardContent>
              <CardFooter>
                <Button asChild>
                  <Link href={`/c/${client.slug}/${k.slug}`}>
                    Buka layanan <ArrowRight />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
