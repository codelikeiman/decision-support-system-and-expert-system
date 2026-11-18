import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, History } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatSkor } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { bacaHasil } from '@/lib/spk/consultation';
import { loadPublicCase } from '@/lib/spk/public';
import { tanggalWaktu } from '@/lib/utils';

export const metadata: Metadata = { title: 'Riwayat Saya', robots: { index: false, follow: false } };

export default async function RiwayatSayaPage({ params }: { params: Promise<{ clientSlug: string; caseSlug: string }> }) {
  const { clientSlug, caseSlug } = await params;
  const ctx = await loadPublicCase(clientSlug, caseSlug);
  if (!ctx) notFound();
  const { client, kasus, db, viewer, peran } = ctx;
  const base = `/c/${client.slug}/${kasus.slug}`;
  if (peran === null || !viewer) redirect(`/c/${client.slug}/masuk?callbackUrl=${encodeURIComponent(`${base}/riwayat`)}`);

  // Hanya konsultasi milik akun yang sedang login.
  const [rows, settings] = await Promise.all([
    db.consultation.findMany({
      where: { caseId: kasus.id, userId: viewer.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, kode: true, createdAt: true, hasilJson: true },
    }),
    getSettings(),
  ]);

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">
      <div>
        <Link href={base} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {kasus.judul}
        </Link>
        <h1 className="text-2xl font-semibold">Riwayat konsultasi saya</h1>
        <p className="mt-1 text-sm text-muted-foreground">Konsultasi yang pernah Anda lakukan pada layanan ini.</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          ikon={<History />}
          judul="Belum ada riwayat"
          deskripsi="Hasil konsultasi Anda akan tersimpan di sini."
          aksi={
            <Button asChild>
              <Link href={`${base}/konsultasi`}>Mulai konsultasi</Link>
            </Button>
          }
        />
      ) : (
        <Card className="py-2">
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Hasil</TableHead>
                  <TableHead className="text-right">Skor</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((k) => {
                  const s = bacaHasil(k.hasilJson);
                  return (
                    <TableRow key={k.id}>
                      <TableCell className="whitespace-nowrap">{tanggalWaktu(k.createdAt)}</TableCell>
                      <TableCell className="font-mono text-xs">{k.kode}</TableCell>
                      <TableCell>{s.hasil.nama ?? <span className="text-muted-foreground">Tidak ada hasil</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatSkor(s.hasil.skor, s.meta.skorFormat, settings.presisiDesimal)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`${base}/hasil/${k.kode}`}>Lihat</Link>
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
    </div>
  );
}
