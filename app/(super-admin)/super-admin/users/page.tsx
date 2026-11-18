import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { UserDialog } from '@/components/super-admin/user-dialog';
import { UserRowActions } from '@/components/super-admin/user-row-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/guards';
import { cn, tanggal } from '@/lib/utils';

export const metadata: Metadata = { title: 'Pengguna' };

const TAB = [
  { kunci: 'admin', label: 'Admin' },
  { kunci: 'super_admin', label: 'Super Admin' },
  { kunci: 'end_user', label: 'End-User' },
] as const;
type Peran = (typeof TAB)[number]['kunci'];

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ peran?: string }> }) {
  const saya = await requireSuperAdmin();
  const { peran } = await searchParams;
  const aktif: Peran = TAB.some((t) => t.kunci === peran) ? (peran as Peran) : 'admin';

  const [users, clients, jumlah] = await Promise.all([
    prisma.user.findMany({
      where: { role: aktif },
      orderBy: [{ client: { namaClient: 'asc' } }, { nama: 'asc' }],
      take: 500,
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        clientId: true,
        isActive: true,
        createdAt: true,
        client: { select: { namaClient: true } },
        _count: { select: { consultations: true } },
      },
    }),
    prisma.client.findMany({ orderBy: { namaClient: 'asc' }, select: { id: true, namaClient: true } }),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
  ]);
  const hitung = (r: Peran) => jumlah.find((j) => j.role === r)?._count._all ?? 0;

  return (
    <>
      <PageHeader
        judul="Pengguna"
        deskripsi="Kelola akun Admin per-client, Super Admin, dan End-User di seluruh platform."
        aksi={
          <UserDialog
            id={null}
            clients={clients}
            defaultValues={{ nama: '', email: '', role: aktif === 'super_admin' ? 'super_admin' : 'admin', clientId: null, password: '' }}
          >
            <Button>
              <Plus /> Tambah akun pengelola
            </Button>
          </UserDialog>
        }
      />

      <nav aria-label="Jenis akun" className="mb-4 flex flex-wrap gap-2">
        {TAB.map((t) => (
          <Link
            key={t.kunci}
            href={`/super-admin/users?peran=${t.kunci}`}
            aria-current={t.kunci === aktif ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              t.kunci === aktif ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
            )}
          >
            {t.label} <span className="tabular-nums opacity-80">({hitung(t.kunci)})</span>
          </Link>
        ))}
      </nav>

      {users.length === 0 ? (
        <EmptyState
          ikon={<Users />}
          judul="Belum ada akun"
          deskripsi={aktif === 'end_user' ? 'End-user mendaftar sendiri melalui halaman publik Case yang mewajibkan login.' : 'Tambahkan akun pengelola dengan tombol di atas.'}
        />
      ) : (
        <Card className="py-2">
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  {aktif !== 'super_admin' ? <TableHead>Client</TableHead> : null}
                  {aktif === 'end_user' ? <TableHead className="text-right">Konsultasi</TableHead> : null}
                  <TableHead>Status</TableHead>
                  <TableHead>Terdaftar</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.nama}
                      {u.id === saya.id ? <span className="ml-2 text-xs font-normal text-muted-foreground">(Anda)</span> : null}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    {aktif !== 'super_admin' ? <TableCell>{u.client?.namaClient ?? '–'}</TableCell> : null}
                    {aktif === 'end_user' ? <TableCell className="text-right tabular-nums">{u._count.consultations}</TableCell> : null}
                    <TableCell>{u.isActive ? <Badge variant="success">Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{tanggal(u.createdAt)}</TableCell>
                    <TableCell>
                      <UserRowActions
                        user={{ id: u.id, nama: u.nama, isActive: u.isActive, role: u.role }}
                        diriSendiri={u.id === saya.id}
                        clients={clients}
                        edit={
                          u.role === 'end_user'
                            ? null
                            : { nama: u.nama, email: u.email, role: u.role, clientId: u.clientId, password: '' }
                        }
                      />
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
