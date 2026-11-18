'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Pencil, Plus, Trash2, Workflow, X } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmButton } from '@/components/confirm-button';
import { EmptyState } from '@/components/empty-state';
import { Field } from '@/components/field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { deleteFuzzyRule, saveFuzzyRule } from '@/lib/actions/fuzzy';
import { terapkanGalat } from '@/lib/form';
import { fuzzyRuleSchema, type FuzzyRuleValues } from '@/lib/schemas/knowledge';

interface Variabel {
  id: number;
  nama: string;
  tipe: 'input' | 'output';
  sets: { id: number; nama: string }[];
}
type Alternatif = { id: number; kode: string; nama: string };

interface Aturan extends Omit<FuzzyRuleValues, 'alternativeId'> {
  id: number;
  alternativeId: number | null;
}

interface Props {
  caseId: number;
  variables: Variabel[];
  alternatives: Alternatif[];
  rules: Aturan[];
}

function RuleDialog({
  caseId,
  id,
  variables,
  alternatives,
  rules,
  defaultValues,
  children,
}: {
  caseId: number;
  id: number | null;
  variables: Variabel[];
  alternatives: Alternatif[];
  rules: Aturan[];
  defaultValues: FuzzyRuleValues;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const inputs = variables.filter((v) => v.tipe === 'input');
  const outputs = variables.filter((v) => v.tipe === 'output');
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FuzzyRuleValues>({ resolver: zodResolver(fuzzyRuleSchema), defaultValues });
  const { fields, append, remove } = useFieldArray({ control, name: 'kondisi' });
  const v = watch();
  const setOf = (variableId: number) => variables.find((x) => x.id === variableId)?.sets ?? [];

  const onSubmit = handleSubmit(async (values) => {
    const hasil = await saveFuzzyRule(caseId, id, values);
    if (!hasil.ok) {
      terapkanGalat(hasil, setError);
      toast.error(hasil.error);
      return;
    }
    toast.success(hasil.pesan ?? 'Tersimpan.');
    setOpen(false);
    router.refresh();
  });

  /** Saat himpunan konsekuen dipilih, sarankan alternatif yang sudah dipakai aturan lain dengan konsekuen sama. */
  const sarankanAlternatif = (setId: number) => {
    if (getValues('alternativeId')) return;
    const sama = rules.find((r) => r.konsekuen.setId === setId && r.alternativeId);
    if (sama?.alternativeId) setValue('alternativeId', sama.alternativeId, { shouldValidate: true });
  };

  const galatKondisi = errors.kondisi?.root?.message ?? (errors.kondisi as { message?: string } | undefined)?.message;
  const penghubung = v.operator === 'OR' ? 'ATAU' : 'DAN';

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
            <DialogTitle>{id === null ? 'Tambah aturan fuzzy' : 'Ubah aturan fuzzy'}</DialogTitle>
            <DialogDescription>Pilih himpunan untuk tiap variabel input, lalu tentukan himpunan output dan alternatif hasilnya.</DialogDescription>
          </DialogHeader>

          <Field label="Penghubung antar-kondisi" htmlFor="fr-op" className="max-w-xs" hint="DAN memakai operator MIN, ATAU memakai operator MAX.">
            <Select id="fr-op" {...register('operator')}>
              <option value="AND">DAN (AND)</option>
              <option value="OR">ATAU (OR)</option>
            </Select>
          </Field>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">JIKA</legend>
            {fields.map((f, i) => (
              <div key={f.id} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-center text-xs font-semibold text-muted-foreground">{i === 0 ? '' : penghubung}</span>
                <div className="min-w-0 flex-1">
                  <Controller
                    control={control}
                    name={`kondisi.${i}.variableId`}
                    render={({ field }) => (
                      <Select
                        aria-label={`Variabel kondisi ${i + 1}`}
                        value={field.value || ''}
                        onChange={(e) => {
                          const vid = Number(e.target.value);
                          field.onChange(vid);
                          setValue(`kondisi.${i}.setId`, setOf(vid)[0]?.id ?? 0);
                        }}
                      >
                        <option value="" disabled>
                          Pilih variabel…
                        </option>
                        {inputs.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.nama}
                          </option>
                        ))}
                      </Select>
                    )}
                  />
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">adalah</span>
                <div className="min-w-0 flex-1">
                  <Controller
                    control={control}
                    name={`kondisi.${i}.setId`}
                    render={({ field }) => (
                      <Select
                        aria-label={`Himpunan kondisi ${i + 1}`}
                        aria-invalid={!!errors.kondisi?.[i]?.setId}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      >
                        <option value="" disabled>
                          Pilih himpunan…
                        </option>
                        {setOf(v.kondisi?.[i]?.variableId ?? 0).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nama}
                          </option>
                        ))}
                      </Select>
                    )}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} disabled={fields.length <= 1} aria-label={`Hapus kondisi ${i + 1}`}>
                  <X />
                </Button>
              </div>
            ))}
            {galatKondisi ? (
              <p className="text-xs font-medium text-destructive" role="alert">
                {galatKondisi}
              </p>
            ) : null}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const dipakai = new Set((getValues('kondisi') ?? []).map((k) => k.variableId));
                  const berikut = inputs.find((x) => !dipakai.has(x.id)) ?? inputs[0];
                  append({ variableId: berikut?.id ?? 0, setId: berikut?.sets[0]?.id ?? 0 });
                }}
              >
                <Plus /> Tambah kondisi
              </Button>
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">MAKA</legend>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Controller
                  control={control}
                  name="konsekuen.variableId"
                  render={({ field }) => (
                    <Select
                      aria-label="Variabel output"
                      aria-invalid={!!errors.konsekuen?.variableId}
                      value={field.value || ''}
                      onChange={(e) => {
                        const vid = Number(e.target.value);
                        field.onChange(vid);
                        setValue('konsekuen.setId', setOf(vid)[0]?.id ?? 0);
                      }}
                    >
                      <option value="" disabled>
                        Pilih variabel output…
                      </option>
                      {outputs.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.nama}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">adalah</span>
              <div className="min-w-0 flex-1">
                <Controller
                  control={control}
                  name="konsekuen.setId"
                  render={({ field }) => (
                    <Select
                      aria-label="Himpunan output"
                      aria-invalid={!!errors.konsekuen?.setId}
                      value={field.value || ''}
                      onChange={(e) => {
                        const sid = Number(e.target.value);
                        field.onChange(sid);
                        sarankanAlternatif(sid);
                      }}
                    >
                      <option value="" disabled>
                        Pilih himpunan…
                      </option>
                      {setOf(v.konsekuen?.variableId ?? 0).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nama}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              </div>
            </div>
            {errors.konsekuen?.setId ? <p className="text-xs font-medium text-destructive">{errors.konsekuen.setId.message}</p> : null}
          </fieldset>

          <Field
            label="Alternatif hasil"
            htmlFor="fr-alt"
            required
            error={errors.alternativeId?.message}
            hint="Hasil diagnosis yang diwakili himpunan output ini. Gunakan alternatif yang sama untuk aturan-aturan dengan himpunan output yang sama."
          >
            <Controller
              control={control}
              name="alternativeId"
              render={({ field }) => (
                <Select id="fr-alt" aria-invalid={!!errors.alternativeId} value={field.value || ''} onChange={(e) => field.onChange(Number(e.target.value))}>
                  <option value="" disabled>
                    Pilih alternatif…
                  </option>
                  {alternatives.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.kode} — {a.nama}
                    </option>
                  ))}
                </Select>
              )}
            />
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

export function FuzzyRulesManager({ caseId, variables, alternatives, rules }: Props) {
  const inputs = variables.filter((x) => x.tipe === 'input');
  const outputs = variables.filter((x) => x.tipe === 'output');
  const siap = inputs.length > 0 && outputs.length > 0 && alternatives.length > 0 && variables.every((x) => x.sets.length > 0);
  const namaVar = (id: number) => variables.find((x) => x.id === id)?.nama ?? '?';
  const namaSet = (vid: number, sid: number) => variables.find((x) => x.id === vid)?.sets.find((s) => s.id === sid)?.nama ?? '?';

  const kosong: FuzzyRuleValues = {
    alternativeId: 0,
    operator: 'AND',
    kondisi: inputs.map((x) => ({ variableId: x.id, setId: x.sets[0]?.id ?? 0 })),
    konsekuen: { variableId: outputs[0]?.id ?? 0, setId: outputs[0]?.sets[0]?.id ?? 0 },
  };
  const tambah = (
    <RuleDialog caseId={caseId} id={null} variables={variables} alternatives={alternatives} rules={rules} defaultValues={kosong}>
      <Button disabled={!siap}>
        <Plus /> Tambah aturan
      </Button>
    </RuleDialog>
  );

  if (rules.length === 0) {
    return (
      <EmptyState
        ikon={<Workflow />}
        judul="Basis aturan masih kosong"
        deskripsi={
          siap
            ? 'Susun aturan JIKA … MAKA … yang menghubungkan himpunan variabel input dengan himpunan variabel output.'
            : 'Lengkapi dahulu alternatif, minimal satu variabel input dan satu variabel output, masing-masing dengan himpunan fuzzy.'
        }
        aksi={tambah}
      />
    );
  }

  const kombinasi = inputs.reduce((acc, x) => acc * Math.max(1, x.sets.length), 1);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rules.length} aturan · {kombinasi} kombinasi himpunan input yang mungkin
        </p>
        {tambah}
      </div>
      <ul className="grid gap-2.5">
        {rules.map((r, i) => {
          const alt = alternatives.find((a) => a.id === r.alternativeId);
          const penghubung = r.operator === 'OR' ? 'ATAU' : 'DAN';
          return (
            <li key={r.id}>
              <Card className="py-3.5">
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-semibold text-primary">R{i + 1}</span>
                  <p className="min-w-0 flex-1 text-sm leading-relaxed">
                    <span className="font-semibold text-muted-foreground">JIKA </span>
                    {r.kondisi.map((k, j) => (
                      <React.Fragment key={j}>
                        {j > 0 ? <span className="font-semibold text-muted-foreground"> {penghubung} </span> : null}
                        {namaVar(k.variableId)} <span className="rounded bg-sky-100 px-1.5 py-0.5 font-medium text-sky-900">{namaSet(k.variableId, k.setId)}</span>
                      </React.Fragment>
                    ))}
                    <span className="font-semibold text-muted-foreground"> MAKA </span>
                    {namaVar(r.konsekuen.variableId)}{' '}
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">{namaSet(r.konsekuen.variableId, r.konsekuen.setId)}</span>
                    <span className="mx-1.5 text-muted-foreground">→</span>
                    {alt ? <Badge>{alt.kode} — {alt.nama}</Badge> : <Badge variant="warning">Belum ada alternatif</Badge>}
                  </p>
                  <div className="flex shrink-0 gap-0.5 self-end sm:self-center">
                    <RuleDialog
                      caseId={caseId}
                      id={r.id}
                      variables={variables}
                      alternatives={alternatives}
                      rules={rules}
                      defaultValues={{ alternativeId: r.alternativeId ?? 0, operator: r.operator, kondisi: r.kondisi, konsekuen: r.konsekuen }}
                    >
                      <Button variant="ghost" size="icon-sm" aria-label={`Ubah aturan R${i + 1}`}>
                        <Pencil />
                      </Button>
                    </RuleDialog>
                    <ConfirmButton action={deleteFuzzyRule.bind(null, caseId, r.id)} judul={`Hapus aturan R${i + 1}?`} deskripsi="Aturan fuzzy ini akan dihapus.">
                      <Button variant="ghost" size="icon-sm" aria-label={`Hapus aturan R${i + 1}`}>
                        <Trash2 className="text-destructive" />
                      </Button>
                    </ConfirmButton>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
