import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { MethodBadge } from '@/components/method-badge';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatSkor } from '@/lib/format';
import { parseId, requireCaseAccess } from '@/lib/guards';
import { getSettings } from '@/lib/settings';
import { bacaHasil } from '@/lib/spk/consultation';
import { angka, tanggalWaktu } from '@/lib/utils';

export const metadata: Metadata = { title: 'Riwayat Konsultasi' };

const PER_HALAMAN = 25;

export default async function RiwayatPage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<{ hal?: string }> }) {
  const caseId = parseId((await params).caseId);
  const { db } = await requireCaseAccess(caseId);
  const { hal } = await searchParams;
  const halaman = hal && /^\d+$/.test(hal) ? Math.max(1, Number(hal)) : 1;
  const base = `/admin/cases/${caseId}/riwayat`;

  const [total, rows, sebaran, alternatif, settings] = await Promise.all([
    db.consultation.count({ where: { caseId } }),
    db.consultation.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      skip: (halaman - 1) * PER_HALAMAN,
      take: PER_HALAMAN,
      select: { id: true, kode: true, createdAt: true, methodKey: true, namaResponden: true, userId: true, hasilJson: true, user: { select: { nama: true } } },
    }),
    db.consultation.groupBy({ by: ['hasilAlternativeId'], where: { caseId }, _count: { _all: true } }),
    db.alternative.findMany({ where: { caseId }, select: { id: true, namaAlternatif: true } }),
    getSettings(),
  ]);
  const jumlahHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN));
  const namaAlt = new Map(alternatif.map((a) => [a.id, a.namaAlternatif]));
  const urutSebaran = [...sebaran].sort((a, b) => b._count._all - a._count._all);

  return (
    <>
      <PageHeader judul="Riwayat konsultasi" deskripsi="Seluruh konsultasi pada Case ini. Buka sebuah entri untuk melihat rincian perhitungan langkah demi langkah." />

      {total === 0 ? (
        <EmptyState ikon={<History />} judul="Belum ada konsultasi" deskripsi="Riwayat akan muncul setelah pengguna mengisi form konsultasi pada halaman publik." />
      ) : (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Sebaran hasil</CardTitle>
              <CardDescription>{angka(total)} konsultasi tercatat.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2.5">
                {urutSebaran.map((s) => {
                  const nama = s.hasilAlternativeId === null ? 'Tidak ada hasil / alternatif terhapus' : (namaAlt.get(s.hasilAlternativeId) ?? 'Alternatif terhapus');
                  return (
                    <li key={s.hasilAlternativeId ?? 'null'} className="text-sm">
                      <div className="flex justify-between gap-3">
                        <span>{nama}</span>
                        <span className="font-semibold tabular-nums">
                          {s._count._all} <span className="font-normal text-muted-foreground">({((s._count._all / total) * 100).toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(s._count._all / total) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card className="py-2">
            <CardContent className="px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Kode</TableHead>
                    <TableHead>Pengguna</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead>Hasil</TableHead>
                    <TableHead className="text-right">Skor</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((k) => {
                    const stored = bacaHasil(k.hasilJson);
                    return (
                      <TableRow key={k.id}>
                        <TableCell className="whitespace-nowrap">{tanggalWaktu(k.createdAt)}</TableCell>
                        <TableCell className="font-mono text-xs">{k.kode}</TableCell>
                        <TableCell>
                          {k.namaResponden ?? k.user?.nama ?? <span className="text-muted-foreground">Anonim</span>}
                          <span className="block text-xs text-muted-foreground">{k.userId ? 'akun terdaftar' : 'tanpa akun'}</span>
                        </TableCell>
                        <TableCell>
                          <MethodBadge methodKey={k.methodKey} />
                        </TableCell>
                        <TableCell>{stored.hasil.nama ?? <span className="text-muted-foreground">Tidak ada hasil</span>}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatSkor(stored.hasil.skor, stored.meta.skorFormat, settings.presisiDesimal)}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`${base}/${k.kode}`}>Detail</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {jumlahHalaman > 1 ? (
            <nav className="flex items-center justify-between" aria-label="Halaman riwayat">
              <p className="text-sm text-muted-foreground">
                Halaman {halaman} dari {jumlahHalaman}
              </p>
              <div className="flex gap-2">
                {halaman <= 1 ? (
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft /> Sebelumnya
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`${base}?hal=${halaman - 1}`}>
                      <ChevronLeft /> Sebelumnya
                    </Link>
                  </Button>
                )}
                {halaman >= jumlahHalaman ? (
                  <Button variant="outline" size="sm" disabled>
                    Berikutnya <ChevronRight />
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`${base}?hal=${halaman + 1}`}>
                      Berikutnya <ChevronRight />
                    </Link>
                  </Button>
                )}
              </div>
            </nav>
          ) : null}
        </div>
      )}
    </>
  );
}
