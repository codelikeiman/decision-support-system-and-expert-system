'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { saveWeights } from '@/lib/actions/symptoms';
import { cn } from '@/lib/utils';

interface Props {
  caseId: number;
  rentang: { min: number; max: number; label: string; bantuan: string };
  alternatives: { id: number; kode: string; nama: string }[];
  symptoms: { id: number; kode: string; nama: string }[];
  /** `${alternativeId}:${symptomId}` → nilai pakar */
  weights: Record<string, number>;
}

/** Editor matriks gejala × alternatif (nilai pakar). Sel kosong = tidak berkaitan. */
export function WeightsEditor({ caseId, rentang, alternatives, symptoms, weights }: Props) {
  const router = useRouter();
  const awal = React.useMemo(() => Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, String(v)])), [weights]);
  const [sel, setSel] = React.useState<Record<string, string>>(awal);
  const [pending, startTransition] = React.useTransition();
  React.useEffect(() => setSel(awal), [awal]);

  const sah = (teks: string) => {
    if (teks === '') return true;
    const n = Number(teks);
    return Number.isFinite(n) && n >= rentang.min && n <= rentang.max;
  };
  const adaGalat = Object.values(sel).some((v) => !sah(v));
  const terisi = Object.values(sel).filter((v) => v !== '' && Number(v) !== 0).length;
  const berubah = JSON.stringify(sel) !== JSON.stringify(awal);

  const simpan = () => {
    if (adaGalat) {
      toast.error(`${rentang.label} harus berada pada rentang ${rentang.min} sampai ${rentang.max}.`);
      return;
    }
    const data: { alternativeId: number; symptomId: number; nilai: number | null }[] = [];
    for (const g of symptoms) {
      for (const a of alternatives) {
        const teks = sel[`${a.id}:${g.id}`] ?? '';
        data.push({ alternativeId: a.id, symptomId: g.id, nilai: teks === '' ? null : Number(teks) });
      }
    }
    startTransition(async () => {
      const hasil = await saveWeights(caseId, data);
      if (hasil.ok) {
        toast.success(hasil.pesan ?? 'Tersimpan.');
        router.refresh();
      } else toast.error(hasil.error);
    });
  };

  return (
    <div className="grid gap-4">
      <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{rentang.label}.</span> {rentang.bantuan}
      </p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/60">
              <th className="sticky left-0 z-10 min-w-56 bg-muted px-3 py-2.5 text-left font-semibold">Gejala</th>
              {alternatives.map((a) => (
                <th key={a.id} className="min-w-24 px-2 py-2.5 text-center font-semibold" title={a.nama}>
                  <span className="font-mono text-xs">{a.kode}</span>
                  <span className="mx-auto block max-w-28 truncate text-xs font-normal text-muted-foreground">{a.nama}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {symptoms.map((g) => (
              <tr key={g.id} className="border-t">
                <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-normal">
                  <span className="mr-1.5 font-mono text-xs text-muted-foreground">{g.kode}</span>
                  {g.nama}
                </th>
                {alternatives.map((a) => {
                  const kunci = `${a.id}:${g.id}`;
                  const v = sel[kunci] ?? '';
                  return (
                    <td key={a.id} className="px-1.5 py-1.5">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.05"
                        min={rentang.min}
                        max={rentang.max}
                        aria-label={`${rentang.label} ${g.kode} terhadap ${a.nama}`}
                        aria-invalid={!sah(v)}
                        className={cn(
                          'h-9 w-full min-w-16 rounded-md border bg-card px-2 text-center text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30',
                          !sah(v) ? 'border-destructive bg-red-50' : v !== '' && Number(v) !== 0 ? 'border-primary/50 bg-primary/5 font-medium' : 'border-input',
                        )}
                        value={v}
                        onChange={(e) => setSel((s) => ({ ...s, [kunci]: e.target.value }))}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {terisi} relasi gejala–alternatif terisi. Sel kosong berarti tidak berkaitan.
        </p>
        <Button onClick={simpan} disabled={pending || !berubah}>
          <Save />
          {pending ? 'Menyimpan…' : 'Simpan bobot'}
        </Button>
      </div>
    </div>
  );
}
