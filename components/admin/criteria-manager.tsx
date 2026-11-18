'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { Pencil, Plus, Scale, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmButton } from '@/components/confirm-button';
import { EmptyState } from '@/components/empty-state';
import { Field } from '@/components/field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { deleteCriterion, saveCriterion } from '@/lib/actions/mcdm';
import { sebagaiAngka, terapkanGalat } from '@/lib/form';
import { formatAngka } from '@/lib/format';
import { criterionSchema, type CriterionValues } from '@/lib/schemas/knowledge';
import { MoveButtons } from './move-buttons';

interface Item extends CriterionValues {
  id: number;
  kode: string;
}

interface Props {
  caseId: number;
  mode: 'profil' | 'preferensi';
  /** metode AHP: bobot berasal dari perbandingan berpasangan */
  ahp: boolean;
  criteria: Item[];
}

const PRESET: { label: string; skala: { label: string; nilai: number }[] }[] = [
  {
    label: 'Frekuensi 1–5',
    skala: [
      { label: 'Tidak pernah', nilai: 1 },
      { label: 'Jarang', nilai: 2 },
      { label: 'Kadang-kadang', nilai: 3 },
      { label: 'Sering', nilai: 4 },
      { label: 'Selalu', nilai: 5 },
    ],
  },
  {
    label: 'Tingkat 1–5',
    skala: [
      { label: 'Sangat rendah', nilai: 1 },
      { label: 'Rendah', nilai: 2 },
      { label: 'Sedang', nilai: 3 },
      { label: 'Tinggi', nilai: 4 },
      { label: 'Sangat tinggi', nilai: 5 },
    ],
  },
  {
    label: 'Kepentingan 1–5',
    skala: [
      { label: 'Tidak penting', nilai: 1 },
      { label: 'Kurang penting', nilai: 2 },
      { label: 'Cukup penting', nilai: 3 },
      { label: 'Penting', nilai: 4 },
      { label: 'Sangat penting', nilai: 5 },
    ],
  },
  {
    label: 'Ya / Tidak',
    skala: [
      { label: 'Tidak', nilai: 1 },
      { label: 'Ya', nilai: 2 },
    ],
  },
];

function CriterionDialog({ caseId, id, mode, ahp, defaultValues, children }: { caseId: number; id: number | null; mode: Props['mode']; ahp: boolean; defaultValues: CriterionValues; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CriterionValues>({ resolver: zodResolver(criterionSchema), defaultValues });
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'scales' });

  const onSubmit = handleSubmit(async (values) => {
    const hasil = await saveCriterion(caseId, id, values);
    if (!hasil.ok) {
      terapkanGalat(hasil, setError);
      toast.error(hasil.error);
      return;
    }
    toast.success(hasil.pesan ?? 'Tersimpan.');
    setOpen(false);
    router.refresh();
  });
  const galatSkala = errors.scales?.root?.message ?? (errors.scales as { message?: string } | undefined)?.message;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset(defaultValues);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{id === null ? 'Tambah kriteria' : 'Ubah kriteria'}</DialogTitle>
            <DialogDescription>
              {mode === 'profil'
                ? 'Skala penilaian dipakai untuk jawaban pengguna sekaligus untuk profil acuan tiap alternatif.'
                : 'Skala penilaian menjadi pilihan tingkat kepentingan kriteria bagi pengguna.'}
            </DialogDescription>
          </DialogHeader>

          <Field label="Nama kriteria" htmlFor="k-nama" required error={errors.namaKriteria?.message}>
            <Input id="k-nama" aria-invalid={!!errors.namaKriteria} {...register('namaKriteria')} />
          </Field>
          <Field
            label="Pertanyaan untuk pengguna"
            htmlFor="k-tanya"
            error={errors.pertanyaan?.message}
            hint="Opsional. Mis. “Seberapa sering Anda merasa nyeri dada?”. Bila kosong, nama kriteria yang ditampilkan."
          >
            <Textarea id="k-tanya" rows={2} aria-invalid={!!errors.pertanyaan} {...register('pertanyaan')} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            {mode === 'preferensi' ? (
              <Field label="Tipe" htmlFor="k-tipe" required error={errors.tipe?.message} hint="Benefit: makin besar makin baik. Cost: makin kecil makin baik.">
                <Select id="k-tipe" {...register('tipe')}>
                  <option value="benefit">Benefit (keuntungan)</option>
                  <option value="cost">Cost (biaya)</option>
                </Select>
              </Field>
            ) : null}
            {!ahp ? (
              <Field label="Bobot" htmlFor="k-bobot" required error={errors.bobot?.message} hint="Bobot dinormalisasi otomatis; skala bebas (mis. 1–5 atau persen).">
                <Input id="k-bobot" type="number" step="any" min={0} aria-invalid={!!errors.bobot} {...register('bobot', sebagaiAngka)} />
              </Field>
            ) : null}
          </div>
          {mode === 'profil' ? (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Pada mode kesesuaian profil, nilai yang dihitung adalah tingkat kesesuaian jawaban pengguna dengan profil alternatif, sehingga semua
              kriteria diperlakukan sebagai benefit.
            </p>
          ) : null}
          {ahp ? (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Metode AHP: bobot kriteria dihitung dari menu Perbandingan Berpasangan, bukan diisi di sini.
            </p>
          ) : null}

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Skala penilaian</legend>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Isi cepat:</span>
              {PRESET.map((p) => (
                <Button key={p.label} type="button" variant="outline" size="sm" onClick={() => replace(p.skala)}>
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-2">
              {fields.map((f, i) => (
                <div key={f.id} className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input
                      aria-label={`Label pilihan ${i + 1}`}
                      placeholder="Label, mis. Sering"
                      aria-invalid={!!errors.scales?.[i]?.label}
                      {...register(`scales.${i}.label`)}
                    />
                    {errors.scales?.[i]?.label ? <p className="mt-1 text-xs text-destructive">{errors.scales[i]?.label?.message}</p> : null}
                  </div>
                  <div className="w-28">
                    <Input
                      aria-label={`Nilai pilihan ${i + 1}`}
                      type="number"
                      step="any"
                      placeholder="Nilai"
                      aria-invalid={!!errors.scales?.[i]?.nilai}
                      {...register(`scales.${i}.nilai`, sebagaiAngka)}
                    />
                    {errors.scales?.[i]?.nilai ? <p className="mt-1 text-xs text-destructive">{errors.scales[i]?.nilai?.message}</p> : null}
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} disabled={fields.length <= 2} aria-label={`Hapus pilihan ${i + 1}`}>
                    <X />
                  </Button>
                </div>
              ))}
            </div>
            {galatSkala ? (
              <p className="text-xs font-medium text-destructive" role="alert">
                {galatSkala}
              </p>
            ) : null}
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ label: '', nilai: fields.length + 1 })}>
                <Plus /> Tambah pilihan
              </Button>
            </div>
          </fieldset>

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

export function CriteriaManager({ caseId, mode, ahp, criteria }: Props) {
  const total = criteria.reduce((acc, c) => acc + c.bobot, 0);
  const kosong: CriterionValues = {
    namaKriteria: '',
    pertanyaan: '',
    tipe: 'benefit',
    bobot: 1,
    scales: mode === 'profil' ? PRESET[0].skala : PRESET[2].skala,
  };
  const tambah = (
    <CriterionDialog caseId={caseId} id={null} mode={mode} ahp={ahp} defaultValues={kosong}>
      <Button>
        <Plus /> Tambah kriteria
      </Button>
    </CriterionDialog>
  );

  if (criteria.length === 0) {
    return <EmptyState ikon={<Scale />} judul="Belum ada kriteria" deskripsi="Tambahkan kriteria penilaian beserta skala jawabannya." aksi={tambah} />;
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">{tambah}</div>
      <div className="grid gap-3">
        {criteria.map((c, i) => (
          <Card key={c.id} className="py-4">
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-semibold text-primary">{c.kode}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{c.namaKriteria}</p>
                  {mode === 'preferensi' ? <Badge variant={c.tipe === 'benefit' ? 'success' : 'warning'}>{c.tipe}</Badge> : null}
                  <Badge variant="secondary">
                    Bobot {formatAngka(c.bobot, 4)}
                    {total > 0 ? ` (${formatAngka((c.bobot / total) * 100, 1)}%)` : ''}
                  </Badge>
                </div>
                {c.pertanyaan ? <p className="mt-1 text-sm text-muted-foreground">“{c.pertanyaan}”</p> : null}
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Skala penilaian">
                  {c.scales.map((s) => (
                    <li key={s.nilai} className="rounded-md border bg-muted/50 px-2 py-0.5 text-xs">
                      {s.label} = <span className="font-semibold tabular-nums">{s.nilai}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex shrink-0 gap-0.5 self-end sm:self-start">
                <MoveButtons caseId={caseId} jenis="kriteria" id={c.id} pertama={i === 0} terakhir={i === criteria.length - 1} />
                <CriterionDialog
                  caseId={caseId}
                  id={c.id}
                  mode={mode}
                  ahp={ahp}
                  defaultValues={{ namaKriteria: c.namaKriteria, pertanyaan: c.pertanyaan, tipe: c.tipe, bobot: c.bobot, scales: c.scales }}
                >
                  <Button variant="ghost" size="icon-sm" aria-label={`Ubah ${c.namaKriteria}`}>
                    <Pencil />
                  </Button>
                </CriterionDialog>
                <ConfirmButton
                  action={deleteCriterion.bind(null, caseId, c.id)}
                  judul={`Hapus kriteria “${c.namaKriteria}”?`}
                  deskripsi="Skala penilaian, nilai alternatif, dan perbandingan berpasangan untuk kriteria ini ikut terhapus."
                >
                  <Button variant="ghost" size="icon-sm" aria-label={`Hapus ${c.namaKriteria}`}>
                    <Trash2 className="text-destructive" />
                  </Button>
                </ConfirmButton>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
