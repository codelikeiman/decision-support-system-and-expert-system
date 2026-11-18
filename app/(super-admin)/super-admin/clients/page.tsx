import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, ExternalLink, Plus } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/guards';
import { angka, tanggal } from '@/lib/utils';

export const metadata: Metadata = { title: 'Client' };

export default async function ClientsPage() {
  await requireSuperAdmin();
  const clients = await prisma.client.findMany({
    orderBy: { namaClient: 'asc' },
    include: { _count: { select: { cases: true, consultations: true } } },
  });

  return (
    <>
      <PageHeader
        judul="Client"
        deskripsi="Organisasi (tenant) yang dilayani platform. Data setiap client terisolasi satu sama lain."
        aksi={
          <Button asChild>
            <Link href="/super-admin/clients/new">
              <Plus /> Tambah client
            </Link>
          </Button>
        }
      />
      {clients.length === 0 ? (
        <EmptyState
          ikon={<Building2 />}
          judul="Belum ada client"
          deskripsi="Buat client pertama, lalu tambahkan SPK Case dan akun admin untuknya."
          aksi={
            <Button asChild>
              <Link href="/super-admin/clients/new">
                <Plus /> Tambah client
              </Link>
            </Button>
          }
        />
      ) : (
        <Card className="py-2">
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Tema</TableHead>
                  <TableHead className="text-right">Case</TableHead>
                  <TableHead className="text-right">Konsultasi</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {c.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.logoUrl} alt="" className="size-9 rounded-md border bg-white object-contain" />
                        ) : (
                          <span
                            className="flex size-9 items-center justify-center rounded-md text-xs font-bold text-white"
                            style={{ background: c.warnaPrimary }}
                          >
                            {c.namaClient.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <Link href={`/super-admin/clients/${c.id}`} className="font-medium hover:underline">
                            {c.namaClient}
                          </Link>
                          <p className="font-mono text-xs text-muted-foreground">/c/{c.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" aria-label="Warna tema">
                        {[c.warnaPrimary, c.warnaSecondary, c.warnaAccent].map((w, i) => (
                          <span key={i} className="size-5 rounded-full border" style={{ background: w }} title={w} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c._count.cases}</TableCell>
                    <TableCell className="text-right tabular-nums">{angka(c._count.consultations)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{tanggal(c.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/c/${c.slug}`} target="_blank">
                            <ExternalLink /> Publik
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/super-admin/clients/${c.id}`}>Kelola</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
