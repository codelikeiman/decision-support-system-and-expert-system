import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, ExternalLink, FolderKanban, LayoutGrid } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { ClientTheme } from '@/components/client-theme';
import { EmptyState } from '@/components/empty-state';
import { MethodBadge } from '@/components/method-badge';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/guards';
import { loadCaseConfig } from '@/lib/spk/config';
import { checkReadiness } from '@/lib/spk/readiness';
import { tenantDb } from '@/lib/tenant';
import { angka } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard Admin', robots: { index: false, follow: false } };

export default async function AdminHome() {
  const user = await requireStaff();
  if (user.role === 'super_admin') redirect('/super-admin/cases');
  const clientId = user.clientId as number;
  const db = tenantDb(clientId);

  const [client, cases] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    db.spkCase.findMany({ orderBy: { judul: 'asc' }, include: { _count: { select: { consultations: true, alternatives: true } } } }),
  ]);
  if (!client) redirect('/login');
  const kesiapan = await Promise.all(cases.map(async (k) => checkReadiness(await loadCaseConfig(db, k))));

  return (
    <>
      <ClientTheme warnaPrimary={client.warnaPrimary} warnaSecondary={client.warnaSecondary} warnaAccent={client.warnaAccent} />
      <AppShell
        brand={{ nama: client.namaClient, sub: 'Dashboard Admin', logoUrl: client.logoUrl, href: '/admin' }}
        user={{ nama: user.nama, peran: 'Admin' }}
        groups={[
          { items: [{ href: '/admin', label: 'Semua Case', icon: <LayoutGrid />, exact: true }] },
          {
            judul: 'Case',
            items: cases.map((k) => ({ href: `/admin/cases/${k.id}`, label: k.judul, icon: <FolderKanban /> })),
          },
        ]}
      >
        <PageHeader
          judul="Kasus SPK"
          deskripsi={`Pilih Case yang ingin dikelola. Anda mengelola seluruh Case milik ${client.namaClient}.`}
          aksi={
            <Button asChild variant="outline">
              <Link href={`/c/${client.slug}`} target="_blank">
                <ExternalLink /> Halaman publik
              </Link>
            </Button>
          }
        />
        {cases.length === 0 ? (
          <EmptyState
            ikon={<FolderKanban />}
            judul="Belum ada Case"
            deskripsi="Case dibuat oleh Super Admin. Hubungi pengelola platform untuk menambahkan Case baru beserta metodenya."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {cases.map((k, i) => {
              const r = kesiapan[i];
              const galat = r.issues.filter((x) => x.level === 'error').length;
              return (
                <Card key={k.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{k.judul}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <MethodBadge methodKey={k.methodKey} />
                      {k.isActive ? <Badge variant="success">Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>}
                      {k.requiresLogin ? <Badge variant="info">Wajib login</Badge> : null}
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {k.deskripsi ? <p className="line-clamp-2 text-sm text-muted-foreground">{k.deskripsi}</p> : null}
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Alternatif</dt>
                        <dd className="text-lg font-semibold tabular-nums">{k._count.alternatives}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Konsultasi</dt>
                        <dd className="text-lg font-semibold tabular-nums">{angka(k._count.consultations)}</dd>
                      </div>
                    </dl>
                    {r.siap ? (
                      <Badge variant="success">Basis pengetahuan siap</Badge>
                    ) : (
                      <Badge variant="warning">{galat} hal perlu dilengkapi</Badge>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button asChild>
                      <Link href={`/admin/cases/${k.id}`}>
                        Kelola <ArrowRight />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </AppShell>
    </>
  );
}
