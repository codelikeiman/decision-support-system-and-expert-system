'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmButton } from '@/components/confirm-button';
import { EmptyState } from '@/components/empty-state';
import { Field } from '@/components/field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { deleteAlternative, saveAlternative } from '@/lib/actions/case-common';
import { terapkanGalat } from '@/lib/form';
import { alternativeSchema, type AlternativeValues } from '@/lib/schemas/knowledge';
import { MoveButtons } from './move-buttons';

interface Item extends AlternativeValues {
  id: number;
  kode: string;
}

interface Props {
  caseId: number;
  /** tampilkan kolom prior (Naive Bayes / Bayesian Network) */
  pakaiPrior: boolean;
  items: Item[];
}

const KOSONG: AlternativeValues = { namaAlternatif: '', deskripsiHasil: '', saranTindakan: '', prior: null };

function AlternativeDialog({ caseId, id, pakaiPrior, defaultValues, children }: { caseId: number; id: number | null; pakaiPrior: boolean; defaultValues: AlternativeValues; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AlternativeValues>({ resolver: zodResolver(alternativeSchema), defaultValues });

  const onSubmit = handleSubmit(async (values) => {
    const hasil = await saveAlternative(caseId, id, values);
    if (!hasil.ok) {
      terapkanGalat(hasil, setError);
      toast.error(hasil.error);
      return;
    }
    toast.success(hasil.pesan ?? 'Tersimpan.');
    setOpen(false);
    router.refresh();
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset(defaultValues);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{id === null ? 'Tambah alternatif' : 'Ubah alternatif'}</DialogTitle>
            <DialogDescription>Alternatif adalah hasil yang mungkin muncul, mis. nama penyakit atau tingkat risiko.</DialogDescription>
          </DialogHeader>
          <Field label="Nama alternatif / hasil" htmlFor="a-nama" required error={errors.namaAlternatif?.message}>
            <Input id="a-nama" aria-invalid={!!errors.namaAlternatif} {...register('namaAlternatif')} />
          </Field>
          <Field label="Deskripsi hasil" htmlFor="a-deskripsi" error={errors.deskripsiHasil?.message} hint="Penjelasan yang ditampilkan kepada pengguna bila alternatif ini menjadi hasil.">
            <Textarea id="a-deskripsi" rows={4} aria-invalid={!!errors.deskripsiHasil} {...register('deskripsiHasil')} />
          </Field>
          <Field label="Saran tindakan" htmlFor="a-saran" error={errors.saranTindakan?.message} hint="Rekomendasi langkah selanjutnya bagi pengguna.">
            <Textarea id="a-saran" rows={4} aria-invalid={!!errors.saranTindakan} {...register('saranTindakan')} />
          </Field>
          {pakaiPrior ? (
            <Field
              label="Probabilitas prior P(H)"
              htmlFor="a-prior"
              error={errors.prior?.message}
              hint="Peluang awal alternatif ini (0–1). Kosongkan semua untuk prior seragam; bila diisi, isi pada semua alternatif."
              className="max-w-xs"
            >
              <Controller
                control={control}
                name="prior"
                render={({ field }) => (
                  <Input
                    id="a-prior"
                    type="number"
                    step="any"
                    min={0}
                    max={1}
                    aria-invalid={!!errors.prior}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                  />
                )}
              />
            </Field>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AlternativesManager({ caseId, pakaiPrior, items }: Props) {
  const tambah = (
    <AlternativeDialog caseId={caseId} id={null} pakaiPrior={pakaiPrior} defaultValues={KOSONG}>
      <Button>
        <Plus /> Tambah alternatif
      </Button>
    </AlternativeDialog>
  );

  if (items.length === 0) {
    return <EmptyState ikon={<ListChecks />} judul="Belum ada alternatif" deskripsi="Tambahkan hasil diagnosis/keputusan yang mungkin, lengkap dengan penjelasan dan saran tindakannya." aksi={tambah} />;
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">{tambah}</div>
      <Card className="py-2">
        <CardContent className="px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead className="hidden md:table-cell">Deskripsi &amp; saran</TableHead>
                {pakaiPrior ? <TableHead className="text-right">Prior</TableHead> : null}
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((a, i) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{a.kode}</TableCell>
                  <TableCell className="font-medium">{a.namaAlternatif}</TableCell>
                  <TableCell className="hidden max-w-md md:table-cell">
                    <p className="line-clamp-1 text-sm text-muted-foreground">{a.deskripsiHasil || <em>Belum ada deskripsi</em>}</p>
                    <p className="line-clamp-1 text-sm text-muted-foreground">{a.saranTindakan || <em>Belum ada saran tindakan</em>}</p>
                  </TableCell>
                  {pakaiPrior ? <TableCell className="text-right tabular-nums">{a.prior ?? '–'}</TableCell> : null}
                  <TableCell>
                    <div className="flex justify-end gap-0.5">
                      <MoveButtons caseId={caseId} jenis="alternatif" id={a.id} pertama={i === 0} terakhir={i === items.length - 1} />
                      <AlternativeDialog
                        caseId={caseId}
                        id={a.id}
                        pakaiPrior={pakaiPrior}
                        defaultValues={{ namaAlternatif: a.namaAlternatif, deskripsiHasil: a.deskripsiHasil, saranTindakan: a.saranTindakan, prior: a.prior }}
                      >
                        <Button variant="ghost" size="icon-sm" aria-label={`Ubah ${a.namaAlternatif}`}>
                          <Pencil />
                        </Button>
                      </AlternativeDialog>
                      <ConfirmButton
                        action={deleteAlternative.bind(null, caseId, a.id)}
                        judul={`Hapus “${a.namaAlternatif}”?`}
                        deskripsi="Nilai, bobot gejala, dan aturan yang terkait alternatif ini ikut terhapus. Data uji yang memakai alternatif ini sebagai diagnosis pakar juga dihapus. Riwayat konsultasi tetap tersimpan."
                      >
                        <Button variant="ghost" size="icon-sm" aria-label={`Hapus ${a.namaAlternatif}`}>
                          <Trash2 className="text-destructive" />
                        </Button>
                      </ConfirmButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
