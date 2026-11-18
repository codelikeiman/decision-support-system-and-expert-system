import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CircleAlert, CircleCheck, CircleX, Pencil } from 'lucide-react';
import { AddItemButton, DeleteTestButton, ItemActions, RunTestButton, TestDialog } from '@/components/admin/validation-manager';
import { MethodBadge } from '@/components/method-badge';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { METHODS, isMethodKey } from '@/lib/engines';
import { formatSkor } from '@/lib/format';
import { parseId, requireCaseAccess } from '@/lib/guards';
import { getSettings } from '@/lib/settings';
import { loadCaseConfig } from '@/lib/spk/config';
import { toFormConfig } from '@/lib/spk/form-config';
import { inputTersimpan, ringkasTersimpan } from '@/lib/spk/input';
import { checkReadiness } from '@/lib/spk/readiness';
import { cn, tanggalWaktu } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dataset Uji' };

const persen = (a: number, b: number) => (b === 0 ? '–' : `${((a / b) * 100).toFixed(2)}%`);

export default async function ValidasiDetailPage({ params }: { params: Promise<{ caseId: string; testId: string }> }) {
  const p = await params;
  const caseId = parseId(p.caseId);
  const testId = parseId(p.testId);
  const { kasus, db } = await requireCaseAccess(caseId);
  const [test, config, settings] = await Promise.all([
    db.validationTest.findFirst({ where: { id: testId, caseId }, include: { items: { orderBy: { id: 'asc' } } } }),
    loadCaseConfig(db, kasus),
    getSettings(),
  ]);
  if (!test) notFound();

  const base = `/admin/cases/${caseId}`;
  const alts = config.alternatives.map((a) => ({ id: a.id, kode: a.kode, nama: a.nama }));
  const altById = new Map(alts.map((a) => [a.id, a]));
  const form = toFormConfig(config);
  const kesiapan = checkReadiness(config);
  const skorFormat = METHODS[config.methodKey] ? (['B'].includes(config.category) ? 'persen' : config.category === 'D' ? 'bulat' : 'desimal') : 'desimal';

  const items = test.items;
  const total = items.length;
  const diuji = items.filter((i) => i.status !== null);
  const cocok = items.filter((i) => i.status === 'match').length;
  const lengkap = total > 0 && diuji.length === total;
  const metodeBeda = lengkap && test.lastRunMethod !== null && test.lastRunMethod !== kasus.methodKey;

  // Tabel kecocokan (confusion table): baris = diagnosis pakar, kolom = hasil sistem.
  const kolom = [...alts.map((a) => a.id as number | null), null];
  const sel = new Map<string, number>();
  for (const i of diuji) {
    const k = `${i.diagnosisPakarAlternativeId}:${i.hasilSistemAlternativeId ?? 'x'}`;
    sel.set(k, (sel.get(k) ?? 0) + 1);
  }
  const hitung = (pakar: number, sistem: number | null) => sel.get(`${pakar}:${sistem ?? 'x'}`) ?? 0;
  const perAlt = alts.map((a) => {
    const jumlahPakar = diuji.filter((i) => i.diagnosisPakarAlternativeId === a.id).length;
    const jumlahSistem = diuji.filter((i) => i.hasilSistemAlternativeId === a.id).length;
    const benar = hitung(a.id, a.id);
    return { ...a, jumlahPakar, jumlahSistem, benar };
  });
  const adaTanpaHasil = diuji.some((i) => i.hasilSistemAlternativeId === null);

  const dialog = { caseId, testId, form, alternatives: alts };

  return (
    <>
      <PageHeader
        judul={test.namaDatasetUji}
        crumbs={[{ label: 'Uji validitas', href: `${base}/validasi` }, { label: test.namaDatasetUji }]}
        aksi={
          <>
            <TestDialog caseId={caseId} id={test.id} namaAwal={test.namaDatasetUji}>
              <Button variant="outline">
                <Pencil /> Ganti nama
              </Button>
            </TestDialog>
            <DeleteTestButton caseId={caseId} id={test.id} nama={test.namaDatasetUji} />
          </>
        }
      />

      {!kesiapan.siap ? (
        <Alert variant="destructive" className="mb-6">
          <CircleAlert />
          <AlertTitle>Basis pengetahuan belum lengkap</AlertTitle>
          <AlertDescription>
            <p>
              Pengujian belum dapat dijalankan.{' '}
              <Link href={base} className="font-medium underline underline-offset-2">
                Lihat daftar periksa kesiapan
              </Link>
              .
            </p>
          </AlertDescription>
        </Alert>
      ) : null}
      {metodeBeda ? (
        <Alert variant="warning" className="mb-6">
          <CircleAlert />
          <AlertTitle>Metode Case telah berubah</AlertTitle>
          <AlertDescription>
            <p>
              Hasil di bawah diperoleh dengan metode {isMethodKey(test.lastRunMethod ?? '') ? METHODS[test.lastRunMethod as keyof typeof METHODS].singkatan : test.lastRunMethod}.
              Jalankan ulang pengujian untuk metode yang sekarang aktif.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ringkasan pengujian</CardTitle>
            <CardDescription>
              {test.lastRunAt ? (
                <>
                  Terakhir dijalankan {tanggalWaktu(test.lastRunAt)}
                  {test.lastRunMethod ? (
                    <>
                      {' '}
                      dengan <MethodBadge methodKey={test.lastRunMethod} />
                    </>
                  ) : null}
                </>
              ) : (
                'Belum pernah dijalankan.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Jumlah data uji', nilai: String(total) },
                { label: 'Sesuai (match)', nilai: lengkap ? String(cocok) : '–' },
                { label: 'Tidak sesuai', nilai: lengkap ? String(total - cocok) : '–' },
                { label: 'Tingkat akurasi', nilai: lengkap ? persen(cocok, total) : '–', utama: true },
              ].map((k) => (
                <div key={k.label} className={cn('rounded-lg border px-4 py-3', k.utama && 'border-primary bg-primary/5')}>
                  <dt className="text-xs text-muted-foreground">{k.label}</dt>
                  <dd className={cn('mt-0.5 text-2xl font-semibold tabular-nums', k.utama && 'text-primary')}>{k.nilai}</dd>
                </div>
              ))}
            </dl>
            {lengkap ? (
              <p className="text-sm text-muted-foreground">
                Akurasi = jumlah data yang hasil sistemnya sama dengan diagnosis pakar ÷ jumlah seluruh data uji × 100% = {cocok} ÷ {total} × 100% ={' '}
                <strong className="text-foreground">{persen(cocok, total)}</strong>.
              </p>
            ) : total > 0 ? (
              <p className="text-sm text-amber-700">
                {total - diuji.length} data belum diuji (baru ditambahkan atau diubah). Jalankan pengujian untuk memperbarui hasil.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Tambahkan data uji terlebih dahulu.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <RunTestButton caseId={caseId} testId={testId} disabled={!kesiapan.siap || total === 0} />
              {alts.length > 0 ? <AddItemButton {...dialog} /> : null}
            </div>
          </CardContent>
        </Card>

        {lengkap ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tabel kecocokan (confusion table)</CardTitle>
                <CardDescription>Baris: diagnosis pakar. Kolom: hasil sistem. Diagonal yang disorot adalah hasil yang sesuai.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-center text-sm tabular-nums">
                    <thead>
                      <tr className="bg-muted/60">
                        <th className="px-3 py-2 text-left font-semibold">Pakar ↓ / Sistem →</th>
                        {alts.map((a) => (
                          <th key={a.id} className="px-2 py-2 font-mono text-xs font-semibold" title={a.nama}>
                            {a.kode}
                          </th>
                        ))}
                        {adaTanpaHasil ? <th className="px-2 py-2 text-xs font-semibold">Tanpa hasil</th> : null}
                        <th className="px-2 py-2 text-xs font-semibold">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alts.map((a) => (
                        <tr key={a.id} className="border-t">
                          <th scope="row" className="px-3 py-2 text-left font-normal">
                            <span className="mr-1.5 font-mono text-xs text-muted-foreground">{a.kode}</span>
                            {a.nama}
                          </th>
                          {kolom
                            .filter((k) => k !== null || adaTanpaHasil)
                            .map((k) => {
                              const n = hitung(a.id, k);
                              return (
                                <td
                                  key={k ?? 'x'}
                                  className={cn('px-2 py-2', k === a.id && 'bg-emerald-50 font-semibold text-emerald-800', k !== a.id && n > 0 && 'bg-red-50 font-medium text-red-800')}
                                >
                                  {n}
                                </td>
                              );
                            })}
                          <td className="px-2 py-2 font-medium">{diuji.filter((i) => i.diagnosisPakarAlternativeId === a.id).length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Kinerja per alternatif</CardTitle>
                <CardDescription>
                  Recall: bagian kasus pakar yang ditebak benar oleh sistem. Presisi: bagian tebakan sistem yang benar.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alternatif</TableHead>
                      <TableHead className="text-right">Data pakar</TableHead>
                      <TableHead className="text-right">Benar</TableHead>
                      <TableHead className="text-right">Recall</TableHead>
                      <TableHead className="text-right">Presisi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perAlt.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <span className="mr-1.5 font-mono text-xs text-muted-foreground">{a.kode}</span>
                          {a.nama}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{a.jumlahPakar}</TableCell>
                        <TableCell className="text-right tabular-nums">{a.benar}</TableCell>
                        <TableCell className="text-right tabular-nums">{persen(a.benar, a.jumlahPakar)}</TableCell>
                        <TableCell className="text-right tabular-nums">{persen(a.benar, a.jumlahSistem)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Data uji</CardTitle>
            <CardDescription>Setiap baris adalah satu kasus dengan diagnosis pakar yang sudah diketahui.</CardDescription>
          </CardHeader>
          <CardContent className="px-2">
            {total === 0 ? (
              <p className="px-3 text-sm text-muted-foreground">Belum ada data uji.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">No</TableHead>
                    <TableHead>Masukan</TableHead>
                    <TableHead>Diagnosis pakar</TableHead>
                    <TableHead>Hasil sistem</TableHead>
                    <TableHead className="text-right">Skor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => {
                    const masukan = inputTersimpan(it.inputDataJson);
                    const kompatibel = masukan !== null && masukan.kategori === config.category;
                    const sistem = it.hasilSistemAlternativeId !== null ? altById.get(it.hasilSistemAlternativeId) : null;
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="tabular-nums">{idx + 1}</TableCell>
                        <TableCell className="max-w-xs">
                          {it.label ? <p className="font-medium">{it.label}</p> : null}
                          <p className="text-xs break-words text-muted-foreground">{ringkasTersimpan(it.inputDataJson)}</p>
                          {!kompatibel ? <Badge variant="warning">Tidak kompatibel dengan kategori metode saat ini</Badge> : null}
                        </TableCell>
                        <TableCell>{altById.get(it.diagnosisPakarAlternativeId)?.nama ?? '–'}</TableCell>
                        <TableCell>
                          {it.status === null ? <span className="text-muted-foreground">–</span> : (sistem?.nama ?? <span className="text-muted-foreground">Tidak ada hasil</span>)}
                          {it.catatan ? <p className="max-w-56 text-xs text-muted-foreground">{it.catatan}</p> : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{it.status === null ? '–' : formatSkor(it.skor, skorFormat, settings.presisiDesimal)}</TableCell>
                        <TableCell>
                          {it.status === 'match' ? (
                            <Badge variant="success">
                              <CircleCheck /> Sesuai
                            </Badge>
                          ) : it.status === 'mismatch' ? (
                            <Badge variant="destructive">
                              <CircleX /> Tidak sesuai
                            </Badge>
                          ) : (
                            <Badge variant="outline">Belum diuji</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <ItemActions
                            {...dialog}
                            id={it.id}
                            nomor={idx + 1}
                            awal={{ label: it.label ?? '', diagnosisPakarAlternativeId: it.diagnosisPakarAlternativeId, input: kompatibel ? masukan : null }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
