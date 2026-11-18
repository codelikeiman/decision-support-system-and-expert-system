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
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { deleteChainRule, saveChainRule } from '@/lib/actions/symptoms';
import { ruleGroups } from '@/lib/engines/forward-chaining';
import { terapkanGalat } from '@/lib/form';
import { chainRuleSchema, type ChainRuleValues } from '@/lib/schemas/knowledge';

type Gejala = { id: number; kode: string; nama: string };
type Alternatif = { id: number; kode: string; nama: string };

interface Props {
  caseId: number;
  symptoms: Gejala[];
  alternatives: Alternatif[];
  rules: (ChainRuleValues & { id: number })[];
}

/** Teks aturan dengan pengelompokan DAN sebelum ATAU. */
function teksAturan(conditions: ChainRuleValues['conditions'], kode: (id: number) => string): string {
  const groups = ruleGroups({ conditions });
  return groups
    .map((g) => {
      const isi = g.map(kode).join(' DAN ');
      return groups.length > 1 && g.length > 1 ? `(${isi})` : isi;
    })
    .join(' ATAU ');
}

function RuleDialog({ caseId, id, symptoms, alternatives, defaultValues, children }: { caseId: number; id: number | null; symptoms: Gejala[]; alternatives: Alternatif[]; defaultValues: ChainRuleValues; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ChainRuleValues>({ resolver: zodResolver(chainRuleSchema), defaultValues });
  const { fields, append, remove } = useFieldArray({ control, name: 'conditions' });
  const kondisi = watch('conditions');
  const kodeGejala = (sid: number) => symptoms.find((s) => s.id === sid)?.kode ?? '…';

  const onSubmit = handleSubmit(async (values) => {
    const hasil = await saveChainRule(caseId, id, values);
    if (!hasil.ok) {
      terapkanGalat(hasil, setError);
      toast.error(hasil.error);
      return;
    }
    toast.success(hasil.pesan ?? 'Tersimpan.');
    setOpen(false);
    router.refresh();
  });
  const galatKondisi = errors.conditions?.root?.message ?? (errors.conditions as { message?: string } | undefined)?.message;

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
            <DialogTitle>{id === null ? 'Tambah aturan' : 'Ubah aturan'}</DialogTitle>
            <DialogDescription>Susun aturan JIKA–MAKA. Operator DAN dievaluasi lebih dahulu daripada ATAU.</DialogDescription>
          </DialogHeader>
          <Field label="Nama aturan" htmlFor="r-nama" required error={errors.namaRule?.message}>
            <Input id="r-nama" aria-invalid={!!errors.namaRule} {...register('namaRule')} />
          </Field>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">JIKA</legend>
            {fields.map((f, i) => (
              <div key={f.id} className="flex items-center gap-2">
                {i === 0 ? (
                  <span className="w-24 shrink-0 text-center text-xs font-semibold text-muted-foreground">gejala</span>
                ) : (
                  <div className="w-24 shrink-0">
                    <Select aria-label={`Operator kondisi ${i + 1}`} {...register(`conditions.${i}.operator`)}>
                      <option value="AND">DAN</option>
                      <option value="OR">ATAU</option>
                    </Select>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <Controller
                    control={control}
                    name={`conditions.${i}.symptomId`}
                    render={({ field }) => (
                      <Select
                        aria-label={`Gejala kondisi ${i + 1}`}
                        aria-invalid={!!errors.conditions?.[i]?.symptomId}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      >
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
              <Button type="button" variant="outline" size="sm" onClick={() => append({ symptomId: 0, operator: 'AND' })}>
                <Plus /> Tambah kondisi
              </Button>
            </div>
          </fieldset>

          <Field label="MAKA (alternatif hasil)" htmlFor="r-alt" required error={errors.alternativeId?.message}>
            <Controller
              control={control}
              name="alternativeId"
              render={({ field }) => (
                <Select id="r-alt" aria-invalid={!!errors.alternativeId} value={field.value || ''} onChange={(e) => field.onChange(Number(e.target.value))}>
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

          <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs" aria-live="polite">
            JIKA {teksAturan(kondisi ?? [], kodeGejala)} MAKA {alternatives.find((a) => a.id === watch('alternativeId'))?.nama ?? '…'}
          </p>

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

export function ChainRulesManager({ caseId, symptoms, alternatives, rules }: Props) {
  const kode = (sid: number) => symptoms.find((s) => s.id === sid)?.kode ?? '?';
  const siap = symptoms.length > 0 && alternatives.length > 0;
  const tambah = (
    <RuleDialog
      caseId={caseId}
      id={null}
      symptoms={symptoms}
      alternatives={alternatives}
      defaultValues={{ namaRule: `Aturan ${rules.length + 1}`, alternativeId: 0, conditions: [{ symptomId: 0, operator: 'AND' }] }}
    >
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
        deskripsi={siap ? 'Susun aturan JIKA gejala … MAKA alternatif … dari pengetahuan pakar.' : 'Tambahkan alternatif dan gejala terlebih dahulu.'}
        aksi={tambah}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">{tambah}</div>
      <ul className="grid gap-3">
        {rules.map((r, i) => {
          const alt = alternatives.find((a) => a.id === r.alternativeId);
          return (
            <li key={r.id}>
              <Card className="py-4">
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-semibold text-primary">R{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.namaRule}</p>
                    <p className="mt-1 text-sm">
                      <span className="font-semibold text-muted-foreground">JIKA</span>{' '}
                      <span className="font-mono text-[13px]">{teksAturan(r.conditions, kode)}</span>{' '}
                      <span className="font-semibold text-muted-foreground">MAKA</span> <Badge>{alt ? `${alt.kode} — ${alt.nama}` : 'Alternatif terhapus'}</Badge>
                    </p>
                    <ul className="mt-2 grid gap-0.5 text-xs text-muted-foreground">
                      {[...new Set(r.conditions.map((c) => c.symptomId))].map((sid) => {
                        const g = symptoms.find((s) => s.id === sid);
                        return (
                          <li key={sid}>
                            <span className="font-mono">{g?.kode}</span> — {g?.nama}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="flex shrink-0 gap-0.5 self-end sm:self-start">
                    <RuleDialog
                      caseId={caseId}
                      id={r.id}
                      symptoms={symptoms}
                      alternatives={alternatives}
                      defaultValues={{ namaRule: r.namaRule, alternativeId: r.alternativeId, conditions: r.conditions }}
                    >
                      <Button variant="ghost" size="icon-sm" aria-label={`Ubah ${r.namaRule}`}>
                        <Pencil />
                      </Button>
                    </RuleDialog>
                    <ConfirmButton action={deleteChainRule.bind(null, caseId, r.id)} judul={`Hapus “${r.namaRule}”?`} deskripsi="Aturan beserta seluruh kondisinya akan dihapus.">
                      <Button variant="ghost" size="icon-sm" aria-label={`Hapus ${r.namaRule}`}>
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
