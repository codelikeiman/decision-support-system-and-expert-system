'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Pencil, Plus, Stethoscope, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmButton } from '@/components/confirm-button';
import { EmptyState } from '@/components/empty-state';
import { Field } from '@/components/field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { deleteSymptom, saveSymptom } from '@/lib/actions/symptoms';
import { terapkanGalat } from '@/lib/form';
import { symptomSchema, type SymptomValues } from '@/lib/schemas/knowledge';
import { MoveButtons } from './move-buttons';

interface Item extends SymptomValues {
  id: number;
  /** jumlah relasi (bobot/aturan) yang memakai gejala ini */
  dipakai: number;
}

interface Props {
  caseId: number;
  symptoms: Item[];
  /** sebutan relasi pada kolom "dipakai", mis. "alternatif" atau "aturan" */
  satuanRelasi: string;
}

/** Saran kode berikutnya: G01, G02, … mengikuti pola kode terakhir. */
function kodeBerikut(symptoms: Item[]): string {
  let maks = 0;
  let awalan = 'G';
  let lebar = 2;
  for (const s of symptoms) {
    const m = s.kodeGejala.match(/^([A-Za-z._-]*)(\d+)$/);
    if (!m) continue;
    const n = Number(m[2]);
    if (n >= maks) {
      maks = n;
      awalan = m[1] || awalan;
      lebar = m[2].length;
    }
  }
  return `${awalan}${String(maks + 1).padStart(lebar, '0')}`;
}

function SymptomDialog({ caseId, id, defaultValues, children }: { caseId: number; id: number | null; defaultValues: SymptomValues; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SymptomValues>({ resolver: zodResolver(symptomSchema), defaultValues });

  const onSubmit = handleSubmit(async (values) => {
    const hasil = await saveSymptom(caseId, id, values);
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
      <DialogContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{id === null ? 'Tambah gejala' : 'Ubah gejala'}</DialogTitle>
            <DialogDescription>Kode dipakai pada tabel perhitungan dan aturan; nama ditampilkan kepada pengguna.</DialogDescription>
          </DialogHeader>
          <Field label="Kode" htmlFor="g-kode" required error={errors.kodeGejala?.message} className="max-w-40">
            <Input id="g-kode" className="font-mono" aria-invalid={!!errors.kodeGejala} {...register('kodeGejala')} />
          </Field>
          <Field label="Nama gejala" htmlFor="g-nama" required error={errors.namaGejala?.message}>
            <Input id="g-nama" aria-invalid={!!errors.namaGejala} {...register('namaGejala')} />
          </Field>
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

export function SymptomsManager({ caseId, symptoms, satuanRelasi }: Props) {
  const tambah = (
    <SymptomDialog caseId={caseId} id={null} defaultValues={{ kodeGejala: kodeBerikut(symptoms), namaGejala: '' }}>
      <Button>
        <Plus /> Tambah gejala
      </Button>
    </SymptomDialog>
  );

  if (symptoms.length === 0) {
    return <EmptyState ikon={<Stethoscope />} judul="Belum ada gejala" deskripsi="Tambahkan gejala yang akan ditanyakan kepada pengguna." aksi={tambah} />;
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">{tambah}</div>
      <Card className="py-2">
        <CardContent className="px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Kode</TableHead>
                <TableHead>Gejala</TableHead>
                <TableHead className="text-right">Dipakai</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {symptoms.map((s, i) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.kodeGejala}</TableCell>
                  <TableCell>{s.namaGejala}</TableCell>
                  <TableCell className="text-right text-sm whitespace-nowrap text-muted-foreground">
                    {s.dipakai > 0 ? `${s.dipakai} ${satuanRelasi}` : <span className="text-amber-700">belum dipakai</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-0.5">
                      <MoveButtons caseId={caseId} jenis="gejala" id={s.id} pertama={i === 0} terakhir={i === symptoms.length - 1} />
                      <SymptomDialog caseId={caseId} id={s.id} defaultValues={{ kodeGejala: s.kodeGejala, namaGejala: s.namaGejala }}>
                        <Button variant="ghost" size="icon-sm" aria-label={`Ubah ${s.namaGejala}`}>
                          <Pencil />
                        </Button>
                      </SymptomDialog>
                      <ConfirmButton
                        action={deleteSymptom.bind(null, caseId, s.id)}
                        judul={`Hapus gejala ${s.kodeGejala}?`}
                        deskripsi={
                          s.dipakai > 0
                            ? `Gejala ini dipakai pada ${s.dipakai} ${satuanRelasi}. Bobot, dependensi, dan kondisi aturan yang memakainya ikut terhapus sehingga hasil diagnosis dapat berubah.`
                            : 'Gejala akan dihapus permanen.'
                        }
                      >
                        <Button variant="ghost" size="icon-sm" aria-label={`Hapus ${s.namaGejala}`}>
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
