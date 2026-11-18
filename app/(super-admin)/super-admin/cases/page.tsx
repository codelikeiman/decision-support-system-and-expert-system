import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, FolderKanban, Plus } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { MethodBadge } from '@/components/method-badge';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/guards';
import { angka, cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'SPK Case' };

export default async function CasesPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  await requireSuperAdmin();
  const { client } = await searchParams;
  const clientId = client && /^\d+$/.test(client) ? Number(client) : null;
  const [clients, cases] = await Promise.all([
    prisma.client.findMany({ orderBy: { namaClient: 'asc' }, select: { id: true, namaClient: true } }),
    prisma.spkCase.findMany({
      where: clientId ? { clientId } : undefined,
      orderBy: [{ client: { namaClient: 'asc' } }, { judul: 'asc' }],
      include: { client: { select: { namaClient: true, slug: true } }, _count: { select: { consultations: true } } },
    }),
  ]);

  const tambah = (
    <Button asChild>
      <Link href={`/super-admin/cases/new${clientId ? `?clientId=${clientId}` : ''}`}>
        <Plus /> Buat Case
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader judul="SPK Case" deskripsi="Setiap Case adalah satu layanan SPK/sistem pakar dengan satu metode." aksi={clients.length > 0 ? tambah : null} />

      {clients.length > 0 ? (
        <nav aria-label="Saring menurut client" className="mb-4 flex flex-wrap gap-2">
          {[{ id: null as number | null, namaClient: 'Semua client' }, ...clients].map((c) => (
            <Link
              key={c.id ?? 'semua'}
              href={c.id ? `/super-admin/cases?client=${c.id}` : '/super-admin/cases'}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                c.id === clientId ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
              )}
            >
              {c.namaClient}
            </Link>
          ))}
        </nav>
      ) : null}

      {clients.length === 0 ? (
        <EmptyState
          ikon={<FolderKanban />}
          judul="Buat client terlebih dahulu"
          deskripsi="Case selalu dimiliki oleh satu client."
          aksi={
            <Button asChild>
              <Link href="/super-admin/clients/new">Tambah client</Link>
            </Button>
          }
        />
      ) : cases.length === 0 ? (
        <EmptyState ikon={<FolderKanban />} judul="Belum ada Case" deskripsi="Buat Case dan pilih salah satu dari 15 metode yang tersedia." aksi={tambah} />
      ) : (
        <Card className="py-2">
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead>Akses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Konsultasi</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>
                      <Link href={`/super-admin/cases/${k.id}`} className="font-medium hover:underline">
                        {k.judul}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">
                        /c/{k.client.slug}/{k.slug}
                      </p>
                    </TableCell>
                    <TableCell>{k.client.namaClient}</TableCell>
                    <TableCell>
                      <MethodBadge methodKey={k.methodKey} />
                    </TableCell>
                    <TableCell>{k.requiresLogin ? <Badge variant="info">Wajib login</Badge> : <Badge variant="outline">Publik</Badge>}</TableCell>
                    <TableCell>{k.isActive ? <Badge variant="success">Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>}</TableCell>
                    <TableCell className="text-right tabular-nums">{angka(k._count.consultations)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="icon-sm" title="Halaman publik">
                          <Link href={`/c/${k.client.slug}/${k.slug}`} target="_blank" aria-label={`Buka halaman publik ${k.judul}`}>
                            <ExternalLink />
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/cases/${k.id}`}>Basis pengetahuan</Link>
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
