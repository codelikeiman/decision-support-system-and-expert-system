'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveMatrix } from '@/lib/actions/mcdm';
import { cn } from '@/lib/utils';

interface Props {
  caseId: number;
  mode: 'profil' | 'preferensi';
  alternatives: { id: number; kode: string; nama: string }[];
  criteria: { id: number; kode: string; nama: string; tipe: 'benefit' | 'cost'; scales: { label: string; nilai: number }[] }[];
  /** `${alternativeId}:${criteriaId}` → nilai */
  values: Record<string, number>;
}

/** Editor matriks alternatif × kriteria. Seluruh matriks disimpan sekaligus. */
export function MatrixEditor({ caseId, mode, alternatives, criteria, values }: Props) {
  const router = useRouter();
  const awal = React.useMemo(() => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)])), [values]);
  const [sel, setSel] = React.useState<Record<string, string>>(awal);
  const [pending, startTransition] = React.useTransition();
  React.useEffect(() => setSel(awal), [awal]);

  const total = alternatives.length * criteria.length;
  const terisi = alternatives.reduce((acc, a) => acc + criteria.filter((c) => (sel[`${a.id}:${c.id}`] ?? '') !== '').length, 0);
  const berubah = JSON.stringify(sel) !== JSON.stringify(awal);

  const simpan = () => {
    const data: { alternativeId: number; criteriaId: number; nilai: number | null }[] = [];
    for (const a of alternatives) {
      for (const c of criteria) {
        const teks = sel[`${a.id}:${c.id}`] ?? '';
        const nilai = teks === '' ? null : Number(teks);
        if (nilai !== null && !Number.isFinite(nilai)) {
          toast.error(`Nilai ${a.kode} pada ${c.kode} bukan angka yang valid.`);
          return;
        }
        data.push({ alternativeId: a.id, criteriaId: c.id, nilai });
      }
    }
    startTransition(async () => {
      const hasil = await saveMatrix(caseId, data);
      if (hasil.ok) {
        toast.success(hasil.pesan ?? 'Tersimpan.');
        router.refresh();
      } else toast.error(hasil.error);
    });
  };

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/60">
              <th className="sticky left-0 z-10 min-w-44 bg-muted px-3 py-2.5 text-left font-semibold">Alternatif</th>
              {criteria.map((c) => (
                <th key={c.id} className="min-w-36 px-3 py-2.5 text-left font-semibold" title={c.nama}>
                  <span className="font-mono text-xs text-muted-foreground">{c.kode}</span>
                  <span className="block max-w-40 truncate">{c.nama}</span>
                  {mode === 'preferensi' ? <span className="text-xs font-normal text-muted-foreground">{c.tipe}</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alternatives.map((a) => (
              <tr key={a.id} className="border-t">
                <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">
                  <span className="mr-1.5 font-mono text-xs text-muted-foreground">{a.kode}</span>
                  {a.nama}
                </th>
                {criteria.map((c) => {
                  const kunci = `${a.id}:${c.id}`;
                  const v = sel[kunci] ?? '';
                  const label = `Nilai ${a.nama} pada ${c.nama}`;
                  const pilihSkala = mode === 'profil' && c.scales.length > 0;
                  return (
                    <td key={c.id} className="px-2 py-1.5">
                      {pilihSkala ? (
                        <select
                          aria-label={label}
                          className={cn(
                            'h-9 w-full rounded-md border bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30',
                            v === '' ? 'border-amber-400 text-muted-foreground' : 'border-input',
                          )}
                          value={v}
                          onChange={(e) => setSel((s) => ({ ...s, [kunci]: e.target.value }))}
                        >
                          <option value="">— pilih —</option>
                          {c.scales.map((s) => (
                            <option key={s.nilai} value={String(s.nilai)}>
                              {s.label} ({s.nilai})
                            </option>
                          ))}
                          {v !== '' && !c.scales.some((s) => String(s.nilai) === v) ? <option value={v}>{v} (di luar skala)</option> : null}
                        </select>
                      ) : (
                        <Input
                          aria-label={label}
                          type="number"
                          step="any"
                          className={cn('h-9', v === '' && 'border-amber-400')}
                          value={v}
                          onChange={(e) => setSel((s) => ({ ...s, [kunci]: e.target.value }))}
                        />
                      )}
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
          {terisi} dari {total} sel terisi{terisi < total ? ' — sel berbingkai kuning belum diisi.' : '.'}
        </p>
        <Button onClick={simpan} disabled={pending || !berubah}>
          <Save />
          {pending ? 'Menyimpan…' : 'Simpan matriks'}
        </Button>
      </div>
    </div>
  );
}
