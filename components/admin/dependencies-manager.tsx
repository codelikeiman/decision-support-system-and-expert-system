'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { ArrowRight, GitBranch, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmButton } from '@/components/confirm-button';
import { EmptyState } from '@/components/empty-state';
import { Field } from '@/components/field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { deleteDependency, saveDependency } from '@/lib/actions/symptoms';
import { sebagaiAngka, terapkanGalat } from '@/lib/form';
import { dependencySchema, type DependencyValues } from '@/lib/schemas/knowledge';

type Gejala = { id: number; kode: string; nama: string };

interface Props {
  caseId: number;
  symptoms: Gejala[];
  deps: (DependencyValues & { id: number })[];
}

function DependencyDialog({ caseId, id, symptoms, defaultValues, children }: { caseId: number; id: number | null; symptoms: Gejala[]; defaultValues: DependencyValues; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DependencyValues>({ resolver: zodResolver(dependencySchema), defaultValues });

  const onSubmit = handleSubmit(async (values) => {
    const hasil = await saveDependency(caseId, id, values);
    if (!hasil.ok) {
      terapkanGalat(hasil, setError);
      toast.error(hasil.error);
      return;
    }
    toast.success(hasil.pesan ?? 'Tersimpan.');
    setOpen(false);
    router.refresh();
  });

  const pilihGejala = (name: 'childId' | 'parentId', idEl: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select id={idEl} aria-invalid={!!errors[name]} value={field.value || ''} onChange={(e) => field.onChange(Number(e.target.value))}>
          <option value="" disabled>
            Pilih gejala…
          </option>
          {symptoms.map((s) => (
            <option key={s.id} value={s.id}>
              {s.kode} — {s.nama}
            </option>
          ))}
        </Select>
      )}
    />
  );

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
            <DialogTitle>{id === null ? 'Tambah dependensi' : 'Ubah dependensi'}</DialogTitle>
            <DialogDescription>
              Gejala induk dapat memicu gejala anak. Bila keduanya dialami pengguna, gejala anak tidak lagi dihitung sebagai bukti yang sepenuhnya
              bebas.
            </DialogDescription>
          </DialogHeader>
          <Field label="Gejala induk (pemicu)" htmlFor="d-parent" required error={errors.parentId?.message}>
            {pilihGejala('parentId', 'd-parent')}
          </Field>
          <Field label="Gejala anak (yang dipicu)" htmlFor="d-child" required error={errors.childId?.message}>
            {pilihGejala('childId', 'd-child')}
          </Field>
          <Field
            label="P(gejala anak | gejala induk)"
            htmlFor="d-prob"
            required
            error={errors.probabilitas?.message}
            hint="Peluang gejala anak muncul akibat gejala induk (0–1)."
            className="max-w-xs"
          >
            <Input id="d-prob" type="number" step="any" min={0} max={1} aria-invalid={!!errors.probabilitas} {...register('probabilitas', sebagaiAngka)} />
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

export function DependenciesManager({ caseId, symptoms, deps }: Props) {
  const byId = new Map(symptoms.map((s) => [s.id, s]));
  const tambah = (
    <DependencyDialog caseId={caseId} id={null} symptoms={symptoms} defaultValues={{ childId: 0, parentId: 0, probabilitas: 0.5 }}>
      <Button disabled={symptoms.length < 2}>
        <Plus /> Tambah dependensi
      </Button>
    </DependencyDialog>
  );

  if (deps.length === 0) {
    return (
      <EmptyState
        ikon={<GitBranch />}
        judul="Belum ada dependensi"
        deskripsi={
          symptoms.length < 2
            ? 'Tambahkan minimal dua gejala terlebih dahulu.'
            : 'Tanpa dependensi, Bayesian Network memberikan hasil yang sama dengan Naive Bayes. Tambahkan hubungan induk–anak antar-gejala yang saling berkaitan.'
        }
        aksi={tambah}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">{tambah}</div>
      <Card className="py-2">
        <CardContent className="px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gejala induk</TableHead>
                <TableHead className="w-8" />
                <TableHead>Gejala anak</TableHead>
                <TableHead className="text-right">P(anak | induk)</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deps.map((d) => {
                const induk = byId.get(d.parentId);
                const anak = byId.get(d.childId);
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <span className="mr-1.5 font-mono text-xs text-muted-foreground">{induk?.kode}</span>
                      {induk?.nama}
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="size-4 text-muted-foreground" aria-label="memicu" />
                    </TableCell>
                    <TableCell>
                      <span className="mr-1.5 font-mono text-xs text-muted-foreground">{anak?.kode}</span>
                      {anak?.nama}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{d.probabilitas}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        <DependencyDialog caseId={caseId} id={d.id} symptoms={symptoms} defaultValues={{ childId: d.childId, parentId: d.parentId, probabilitas: d.probabilitas }}>
                          <Button variant="ghost" size="icon-sm" aria-label="Ubah dependensi">
                            <Pencil />
                          </Button>
                        </DependencyDialog>
                        <ConfirmButton action={deleteDependency.bind(null, caseId, d.id)} judul="Hapus dependensi?" deskripsi="Hubungan induk–anak ini akan dihapus.">
                          <Button variant="ghost" size="icon-sm" aria-label="Hapus dependensi">
                            <Trash2 className="text-destructive" />
                          </Button>
                        </ConfirmButton>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
