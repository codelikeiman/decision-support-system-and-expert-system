import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, Building2, FolderKanban, MessagesSquare, Users } from 'lucide-react';
import { MethodBadge } from '@/components/method-badge';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { prisma } from '@/lib/db';
import { METHODS, isMethodKey } from '@/lib/engines';
import { requireSuperAdmin } from '@/lib/guards';
import { angka, tanggalWaktu } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dasbor Super Admin' };

export default async function SuperAdminDashboard() {
  await requireSuperAdmin();
  const tujuhHari = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [clients, caseAktif, caseTotal, konsultasiTotal, konsultasi7, admin, endUser, perMetode, terbaru] = await Promise.all([
    prisma.client.findMany({
      orderBy: { namaClient: 'asc' },
      select: {
        id: true,
        namaClient: true,
        slug: true,
        _count: { select: { cases: true, consultations: true } },
        cases: { where: { isActive: true }, select: { id: true } },
        users: { where: { role: 'admin' }, select: { id: true } },
      },
    }),
    prisma.spkCase.count({ where: { isActive: true } }),
    prisma.spkCase.count(),
    prisma.consultation.count(),
    prisma.consultation.count({ where: { createdAt: { gte: tujuhHari } } }),
    prisma.user.count({ where: { role: 'admin' } }),
    prisma.user.count({ where: { role: 'end_user' } }),
    prisma.spkCase.groupBy({ by: ['methodKey'], _count: { _all: true }, orderBy: { _count: { methodKey: 'desc' } } }),
    prisma.consultation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        kode: true,
        createdAt: true,
        methodKey: true,
        caseId: true,
        hasilJson: true,
        client: { select: { namaClient: true } },
        case: { select: { judul: true } },
      },
    }),
  ]);

  const kartu = [
    { label: 'Client', nilai: clients.length, ikon: <Building2 />, ket: `${admin} akun admin` },
    { label: 'Case aktif', nilai: caseAktif, ikon: <FolderKanban />, ket: `dari ${caseTotal} Case` },
    { label: 'Konsultasi', nilai: konsultasiTotal, ikon: <MessagesSquare />, ket: `${angka(konsultasi7)} dalam 7 hari terakhir` },
    { label: 'End-user terdaftar', nilai: endUser, ikon: <Users />, ket: 'lintas client' },
  ];

  return (
    <>
      <PageHeader judul="Dasbor" deskripsi="Pemantauan seluruh client, Case, dan konsultasi pada platform." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kartu.map((k) => (
          <Card key={k.label} className="gap-2">
            <CardContent>
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-sm">{k.label}</span>
                <span className="[&_svg]:size-4">{k.ikon}</span>
              </div>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{angka(k.nilai)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{k.ket}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Ringkasan per client</CardTitle>
            <CardDescription>Jumlah Case dan konsultasi tiap client.</CardDescription>
          </CardHeader>
          <CardContent className="px-2">
            {clients.length === 0 ? (
              <p className="px-3 text-sm text-muted-foreground">
                Belum ada client.{' '}
                <Link href="/super-admin/clients/new" className="text-primary underline underline-offset-2">
                  Buat client pertama
                </Link>
                .
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Case aktif</TableHead>
                    <TableHead className="text-right">Total Case</TableHead>
                    <TableHead className="text-right">Admin</TableHead>
                    <TableHead className="text-right">Konsultasi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link href={`/super-admin/clients/${c.id}`} className="font-medium hover:underline">
                          {c.namaClient}
                        </Link>
                        <p className="font-mono text-xs text-muted-foreground">/c/{c.slug}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.cases.length}</TableCell>
                      <TableCell className="text-right tabular-nums">{c._count.cases}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.users.length}</TableCell>
                      <TableCell className="text-right tabular-nums">{angka(c._count.consultations)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metode yang dipakai</CardTitle>
            <CardDescription>Jumlah Case per metode.</CardDescription>
          </CardHeader>
          <CardContent>
            {perMetode.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada Case.</p>
            ) : (
              <ul className="space-y-2.5">
                {perMetode.map((m) => (
                  <li key={m.methodKey} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate" title={isMethodKey(m.methodKey) ? METHODS[m.methodKey].nama : undefined}>
                      {isMethodKey(m.methodKey) ? (
                        <>
                          <span className="font-medium">{METHODS[m.methodKey].singkatan}</span>
                          <span className="text-muted-foreground"> · {METHODS[m.methodKey].nama}</span>
                        </>
                      ) : (
                        m.methodKey
                      )}
                    </span>
                    <span className="font-semibold tabular-nums">{m._count._all}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4" /> Konsultasi terbaru
          </CardTitle>
          <CardDescription>Sepuluh konsultasi terakhir dari seluruh client.</CardDescription>
        </CardHeader>
        <CardContent className="px-2">
          {terbaru.length === 0 ? (
            <p className="px-3 text-sm text-muted-foreground">Belum ada konsultasi.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Case</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead>Hasil</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terbaru.map((k) => {
                  const hasil = (k.hasilJson as { hasil?: { nama?: string | null } } | null)?.hasil?.nama;
                  return (
                    <TableRow key={k.id}>
                      <TableCell className="whitespace-nowrap">
                        <Link href={`/admin/cases/${k.caseId}/riwayat/${k.kode}`} className="hover:underline">
                          {tanggalWaktu(k.createdAt)}
                        </Link>
                      </TableCell>
                      <TableCell>{k.client.namaClient}</TableCell>
                      <TableCell>{k.case.judul}</TableCell>
                      <TableCell>
                        <MethodBadge methodKey={k.methodKey} />
                      </TableCell>
                      <TableCell>{hasil ?? <span className="text-muted-foreground">Tidak ada hasil</span>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
