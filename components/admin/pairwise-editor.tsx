'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, CircleCheck, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { savePairwise } from '@/lib/actions/mcdm';
import { SKALA_SAATY } from '@/lib/constants';
import { ahpWeights } from '@/lib/engines/ahp';
import { formatAngka } from '@/lib/format';

interface Props {
  caseId: number;
  criteria: { id: number; kode: string; nama: string }[];
  /** `${idA}:${idB}` → nilai perbandingan tersimpan */
  pairwise: Record<string, number>;
}

/** Nilai pilihan: k (2..9) = kriteria kiri k× lebih penting; -k = kriteria kanan; 1 = sama. */
function keOpsi(nilai: number | undefined): string {
  if (nilai === undefined) return '';
  if (Math.abs(nilai - 1) < 1e-9) return '1';
  return nilai > 1 ? String(Math.round(nilai)) : String(-Math.round(1 / nilai));
}
function dariOpsi(opsi: string): number | undefined {
  if (opsi === '') return undefined;
  const k = Number(opsi);
  return k >= 1 ? k : 1 / -k;
}
function pecahan(v: number): string {
  if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
  const kebalikan = 1 / v;
  if (Math.abs(kebalikan - Math.round(kebalikan)) < 1e-9) return `1/${Math.round(kebalikan)}`;
  return formatAngka(v, 3);
}

export function PairwiseEditor({ caseId, criteria, pairwise }: Props) {
  const router = useRouter();
  const n = criteria.length;
  const awal = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = criteria[i].id;
        const b = criteria[j].id;
        const langsung = pairwise[`${a}:${b}`];
        const balik = pairwise[`${b}:${a}`];
        m[`${i}-${j}`] = keOpsi(langsung ?? (balik ? 1 / balik : undefined));
      }
    }
    return m;
  }, [criteria, pairwise, n]);
  const [opsi, setOpsi] = React.useState(awal);
  const [pending, startTransition] = React.useTransition();
  React.useEffect(() => setOpsi(awal), [awal]);

  const lengkap = Object.values(opsi).every((o) => o !== '');
  const matriks = criteria.map((_, i) =>
    criteria.map((__, j) => {
      if (i === j) return 1;
      const v = i < j ? dariOpsi(opsi[`${i}-${j}`]) : dariOpsi(opsi[`${j}-${i}`]);
      if (v === undefined) return 1;
      return i < j ? v : 1 / v;
    }),
  );
  const a = n >= 2 ? ahpWeights(matriks) : null;
  const berubah = JSON.stringify(opsi) !== JSON.stringify(awal);

  const simpan = () => {
    const data: { a: number; b: number; nilai: number }[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const v = dariOpsi(opsi[`${i}-${j}`]);
        if (v === undefined) {
          toast.error('Lengkapi seluruh perbandingan berpasangan.');
          return;
        }
        data.push({ a: criteria[i].id, b: criteria[j].id, nilai: v });
      }
    }
    startTransition(async () => {
      const hasil = await savePairwise(caseId, data);
      if (hasil.ok) {
        toast.success(hasil.pesan ?? 'Tersimpan.');
        router.refresh();
      } else toast.error(hasil.error);
    });
  };

  if (n < 2) {
    return (
      <Alert variant="info">
        <AlertTitle>Minimal dua kriteria</AlertTitle>
        <AlertDescription>
          <p>Tambahkan sedikitnya dua kriteria pada menu Kriteria &amp; Skala untuk mengisi perbandingan berpasangan.</p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader>
          <CardTitle>Perbandingan antar-kriteria</CardTitle>
          <CardDescription>Untuk tiap pasangan, pilih kriteria yang lebih penting dan seberapa besar (skala Saaty 1–9).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {criteria.flatMap((ci, i) =>
            criteria.slice(i + 1).map((cj, off) => {
              const j = i + 1 + off;
              const kunci = `${i}-${j}`;
              return (
                <div key={kunci} className="grid items-center gap-2 rounded-lg border p-3 md:grid-cols-[1fr_minmax(0,1.4fr)_1fr]">
                  <p className="text-sm font-medium">
                    <span className="mr-1.5 font-mono text-xs text-muted-foreground">{ci.kode}</span>
                    {ci.nama}
                  </p>
                  <Select
                    aria-label={`Perbandingan ${ci.nama} dengan ${cj.nama}`}
                    aria-invalid={opsi[kunci] === ''}
                    value={opsi[kunci]}
                    onChange={(e) => setOpsi((o) => ({ ...o, [kunci]: e.target.value }))}
                  >
                    <option value="">— pilih —</option>
                    {[...SKALA_SAATY]
                      .reverse()
                      .filter((s) => s.nilai > 1)
                      .map((s) => (
                        <option key={`l${s.nilai}`} value={String(s.nilai)}>
                          ← {ci.kode}: {s.label.toLowerCase()} ({s.nilai})
                        </option>
                      ))}
                    <option value="1">= Sama penting (1)</option>
                    {SKALA_SAATY.filter((s) => s.nilai > 1).map((s) => (
                      <option key={`r${s.nilai}`} value={String(-s.nilai)}>
                        {cj.kode} →: {s.label.toLowerCase()} (1/{s.nilai})
                      </option>
                    ))}
                  </Select>
                  <p className="text-sm font-medium md:text-right">
                    <span className="mr-1.5 font-mono text-xs text-muted-foreground">{cj.kode}</span>
                    {cj.nama}
                  </p>
                </div>
              );
            }),
          )}
        </CardContent>
      </Card>

      <div className="grid content-start gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Uji konsistensi</CardTitle>
            <CardDescription>Dihitung langsung saat Anda mengubah perbandingan.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!lengkap ? (
              <Alert variant="warning">
                <CircleAlert />
                <AlertDescription>
                  <p>Masih ada perbandingan yang belum dipilih (sementara dianggap sama penting).</p>
                </AlertDescription>
              </Alert>
            ) : a?.konsisten ? (
              <Alert variant="success">
                <CircleCheck />
                <AlertTitle>Konsisten</AlertTitle>
                <AlertDescription>
                  <p>CR = {formatAngka(a.cr, 4)} ≤ 0,1 — bobot dapat dipakai.</p>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Tidak konsisten</AlertTitle>
                <AlertDescription>
                  <p>CR = {a ? formatAngka(a.cr, 4) : '–'} &gt; 0,1 — perbandingan tidak dapat disimpan sebelum diperbaiki.</p>
                </AlertDescription>
              </Alert>
            )}
            {a ? (
              <>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {[
                    ['λ maks', formatAngka(a.lambdaMax, 4)],
                    ['CI', formatAngka(a.ci, 4)],
                    [`RI (n = ${n})`, formatAngka(a.ri, 2)],
                    ['CR', formatAngka(a.cr, 4)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2 rounded-md bg-muted/60 px-2.5 py-1.5">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-semibold tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <p className="mb-2 text-sm font-medium">Bobot prioritas</p>
                  <ul className="grid gap-2">
                    {criteria.map((c, i) => (
                      <li key={c.id} className="text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="min-w-0 truncate">
                            <span className="mr-1.5 font-mono text-xs text-muted-foreground">{c.kode}</span>
                            {c.nama}
                          </span>
                          <span className="font-semibold tabular-nums">{formatAngka(a.weights[i], 4)}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <div className="h-full rounded-full bg-primary" style={{ width: `${a.weights[i] * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}
            <Button onClick={simpan} disabled={pending || !lengkap || !a?.konsisten || !berubah}>
              <Save />
              {pending ? 'Menyimpan…' : 'Simpan perbandingan'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Matriks perbandingan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-center text-sm tabular-nums">
                <thead>
                  <tr className="bg-muted/60">
                    <th className="px-2 py-1.5" />
                    {criteria.map((c) => (
                      <th key={c.id} className="px-2 py-1.5 font-mono text-xs font-semibold">
                        {c.kode}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matriks.map((row, i) => (
                    <tr key={criteria[i].id} className="border-t">
                      <th scope="row" className="bg-muted/60 px-2 py-1.5 font-mono text-xs font-semibold">
                        {criteria[i].kode}
                      </th>
                      {row.map((v, j) => (
                        <td key={j} className={i === j ? 'bg-muted/30 px-2 py-1.5 text-muted-foreground' : 'px-2 py-1.5'}>
                          {pecahan(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
