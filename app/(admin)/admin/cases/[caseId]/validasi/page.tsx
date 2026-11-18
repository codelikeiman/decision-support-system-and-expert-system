import type { Metadata } from 'next';
import Link from 'next/link';
import { FlaskConical, Plus } from 'lucide-react';
import { TestDialog } from '@/components/admin/validation-manager';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { parseId, requireCaseAccess } from '@/lib/guards';
import { tanggalWaktu } from '@/lib/utils';

export const metadata: Metadata = { title: 'Uji Validitas' };

export default async function ValidasiPage({ params }: { params: Promise<{ caseId: string }> }) {
  const caseId = parseId((await params).caseId);
  const { db } = await requireCaseAccess(caseId);
  const tests = await db.validationTest.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
    include: { items: { select: { status: true } } },
  });

  const tambah = (
    <TestDialog caseId={caseId} id={null} namaAwal="">
      <Button>
        <Plus /> Buat dataset uji
      </Button>
    </TestDialog>
  );

  return (
    <>
      <PageHeader
        judul="Uji validitas"
        deskripsi="Bandingkan hasil sistem dengan diagnosis pakar pada sekumpulan kasus yang sudah diketahui jawabannya. Tingkat akurasi dan tabel kecocokan menjadi bukti validitas sistem."
        aksi={tests.length > 0 ? tambah : null}
      />
      {tests.length === 0 ? (
        <EmptyState
          ikon={<FlaskConical />}
          judul="Belum ada dataset uji"
          deskripsi="Buat dataset uji, masukkan kasus-kasus beserta diagnosis pakarnya, lalu jalankan pengujian untuk memperoleh tingkat akurasi."
          aksi={tambah}
        />
      ) : (
        <Card className="py-2">
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dataset</TableHead>
                  <TableHead className="text-right">Jumlah data</TableHead>
                  <TableHead className="text-right">Sesuai</TableHead>
                  <TableHead className="text-right">Akurasi</TableHead>
                  <TableHead>Pengujian terakhir</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tests.map((t) => {
                  const total = t.items.length;
                  const diuji = t.items.filter((i) => i.status !== null).length;
                  const cocok = t.items.filter((i) => i.status === 'match').length;
                  const lengkap = total > 0 && diuji === total;
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Link href={`/admin/cases/${caseId}/validasi/${t.id}`} className="font-medium hover:underline">
                          {t.namaDatasetUji}
                        </Link>
                        <p className="text-xs text-muted-foreground">Dibuat {tanggalWaktu(t.createdAt)}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{total}</TableCell>
                      <TableCell className="text-right tabular-nums">{lengkap ? cocok : '–'}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{lengkap ? `${((cocok / total) * 100).toFixed(2)}%` : '–'}</TableCell>
                      <TableCell>
                        {t.lastRunAt ? (
                          lengkap ? (
                            <span className="text-sm whitespace-nowrap">{tanggalWaktu(t.lastRunAt)}</span>
                          ) : (
                            <Badge variant="warning">Perlu diuji ulang</Badge>
                          )
                        ) : (
                          <Badge variant="outline">Belum diuji</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/cases/${caseId}/validasi/${t.id}`}>Buka</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
