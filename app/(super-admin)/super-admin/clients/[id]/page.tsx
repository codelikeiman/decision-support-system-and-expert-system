import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { ConfirmButton } from '@/components/confirm-button';
import { MethodBadge } from '@/components/method-badge';
import { PageHeader } from '@/components/page-header';
import { ClientForm } from '@/components/super-admin/client-form';
import { UserDialog } from '@/components/super-admin/user-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { deleteClient } from '@/lib/actions/super-admin';
import { prisma } from '@/lib/db';
import { parseId, requireSuperAdmin } from '@/lib/guards';

export const metadata: Metadata = { title: 'Kelola client' };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const id = parseId((await params).id);
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      cases: { orderBy: { createdAt: 'desc' }, include: { _count: { select: { consultations: true } } } },
      users: { where: { role: 'admin' }, orderBy: { nama: 'asc' }, select: { id: true, nama: true, email: true, isActive: true } },
      _count: { select: { consultations: true, users: true } },
    },
  });
  if (!client) notFound();

  return (
    <>
      <PageHeader
        judul={client.namaClient}
        crumbs={[{ label: 'Client', href: '/super-admin/clients' }, { label: client.namaClient }]}
        aksi={
          <Button asChild variant="outline">
            <Link href={`/c/${client.slug}`} target="_blank">
              <ExternalLink /> Halaman publik
            </Link>
          </Button>
        }
      />

      <ClientForm
        id={client.id}
        defaultValues={{
          namaClient: client.namaClient,
          slug: client.slug,
          deskripsi: client.deskripsi ?? '',
          logoUrl: client.logoUrl,
          warnaPrimary: client.warnaPrimary,
          warnaSecondary: client.warnaSecondary,
          warnaAccent: client.warnaAccent,
        }}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>SPK Case</CardTitle>
            <CardDescription>{client.cases.length} Case pada client ini.</CardDescription>
            <CardAction>
              <Button asChild size="sm">
                <Link href={`/super-admin/cases/new?clientId=${client.id}`}>
                  <Plus /> Case baru
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {client.cases.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada Case.</p>
            ) : (
              <ul className="divide-y">
                {client.cases.map((k) => (
                  <li key={k.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/super-admin/cases/${k.id}`} className="block truncate text-sm font-medium hover:underline">
                        {k.judul}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <MethodBadge methodKey={k.methodKey} />
                        {k.isActive ? <Badge variant="success">Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>}
                        <span className="text-xs text-muted-foreground">{k._count.consultations} konsultasi</span>
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/cases/${k.id}`}>Kelola</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Akun admin</CardTitle>
            <CardDescription>Admin hanya dapat mengelola data client ini.</CardDescription>
            <CardAction>
              <UserDialog
                id={null}
                clients={[{ id: client.id, namaClient: client.namaClient }]}
                defaultValues={{ nama: '', email: '', role: 'admin', clientId: client.id, password: '' }}
              >
                <Button size="sm">
                  <Plus /> Admin baru
                </Button>
              </UserDialog>
            </CardAction>
          </CardHeader>
          <CardContent>
            {client.users.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada akun admin.</p>
            ) : (
              <ul className="divide-y">
                {client.users.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{u.nama}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    {u.isActive ? <Badge variant="success">Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Ubah, nonaktifkan, atau hapus akun melalui menu{' '}
              <Link href="/super-admin/users" className="underline underline-offset-2">
                Pengguna
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8 border-red-200">
        <CardHeader>
          <CardTitle className="text-destructive">Zona berbahaya</CardTitle>
          <CardDescription>
            Menghapus client akan menghapus permanen {client.cases.length} Case, {client._count.consultations} konsultasi, dan{' '}
            {client._count.users} akun miliknya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfirmButton
            action={deleteClient.bind(null, client.id)}
            judul={`Hapus client “${client.namaClient}”?`}
            deskripsi="Seluruh Case, basis pengetahuan, riwayat konsultasi, data uji, dan akun pada client ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
            labelKonfirmasi="Ya, hapus client"
            redirectTo="/super-admin/clients"
          >
            <Button variant="destructive">
              <Trash2 /> Hapus client
            </Button>
          </ConfirmButton>
        </CardContent>
      </Card>
    </>
  );
}
