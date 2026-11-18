'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmButton } from '@/components/confirm-button';
import { EmptyState } from '@/components/empty-state';
import { Field } from '@/components/field';
import { MembershipChart, WARNA_HIMPUNAN } from '@/components/membership-chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { deleteFuzzyVariable, saveFuzzyVariable } from '@/lib/actions/fuzzy';
import type { MembershipFn } from '@/lib/engines';
import { JUMLAH_PARAMETER, NAMA_FUNGSI, validateSetParams } from '@/lib/engines/fuzzy-common';
import { fuzzyVariableSchema } from '@/lib/schemas/knowledge';

interface SetData {
  id: number | null;
  namaHimpunan: string;
  fungsiKeanggotaan: MembershipFn;
  params: number[];
}

interface VariableData {
  id: number;
  namaVariabel: string;
  tipe: 'input' | 'output';
  satuan: string;
  nilaiMin: number;
  nilaiMax: number;
  sets: SetData[];
}

interface Props {
  caseId: number;
  /** Tsukamoto menganjurkan himpunan output yang monoton */
  tsukamoto: boolean;
  variables: VariableData[];
}

interface Draft {
  namaVariabel: string;
  tipe: 'input' | 'output';
  satuan: string;
  nilaiMin: string;
  nilaiMax: string;
  sets: (SetData & { kunci: string })[];
}

const LABEL_PARAM: Record<MembershipFn, string[]> = {
  linear_naik: ['a (μ = 0)', 'b (μ = 1)'],
  linear_turun: ['a (μ = 1)', 'b (μ = 0)'],
  segitiga: ['a (kaki kiri)', 'b (puncak)', 'c (kaki kanan)'],
  trapesium: ['a (kaki kiri)', 'b (bahu kiri)', 'c (bahu kanan)', 'd (kaki kanan)'],
};

let hitung = 0;
const kunciBaru = () => `s${Date.now()}-${hitung++}`;
const bulat = (n: number) => Number(n.toFixed(4));

function langkah(min: number, max: number): number {
  const kasar = (max - min) / 200;
  if (!(kasar > 0)) return 1;
  const pangkat = Math.pow(10, Math.floor(Math.log10(kasar)));
  return [1, 2, 5, 10].map((k) => k * pangkat).find((k) => k >= kasar) ?? pangkat * 10;
}

/** Parameter bawaan saat fungsi keanggotaan diganti: disebar merata pada rentang lama. */
function sebarParams(fungsi: MembershipFn, lama: number[], min: number, max: number): number[] {
  const sah = lama.filter((p) => Number.isFinite(p));
  const lo = sah.length > 0 ? Math.min(...sah) : min + (max - min) * 0.25;
  const hi = sah.length > 0 && Math.max(...sah) > lo ? Math.max(...sah) : min + (max - min) * 0.75;
  const n = JUMLAH_PARAMETER[fungsi];
  return Array.from({ length: n }, (_, i) => bulat(lo + ((hi - lo) * i) / (n - 1)));
}

function drafDari(v: VariableData | null): Draft {
  if (!v) return { namaVariabel: '', tipe: 'input', satuan: '', nilaiMin: '0', nilaiMax: '100', sets: [] };
  return {
    namaVariabel: v.namaVariabel,
    tipe: v.tipe,
    satuan: v.satuan,
    nilaiMin: String(v.nilaiMin),
    nilaiMax: String(v.nilaiMax),
    sets: v.sets.map((s) => ({ ...s, kunci: kunciBaru() })),
  };
}

function VariableDialog({ caseId, variable, tsukamoto, children }: { caseId: number; variable: VariableData | null; tsukamoto: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [d, setD] = React.useState<Draft>(() => drafDari(variable));
  const [galat, setGalat] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const min = Number(d.nilaiMin);
  const max = Number(d.nilaiMax);
  const semestaSah = d.nilaiMin !== '' && d.nilaiMax !== '' && Number.isFinite(min) && Number.isFinite(max) && max > min;
  const lo = semestaSah ? min : 0;
  const hi = semestaSah ? max : 100;
  const r = hi - lo;

  const ubahSet = (kunci: string, patch: Partial<SetData>) => setD((x) => ({ ...x, sets: x.sets.map((s) => (s.kunci === kunci ? { ...s, ...patch } : s)) }));
  const ubahParam = (kunci: string, i: number, nilai: number) =>
    setD((x) => ({
      ...x,
      sets: x.sets.map((s) => {
        if (s.kunci !== kunci) return s;
        // jaga urutan a ≤ b ≤ c ≤ d dan tetap di dalam semesta
        const bawah = i > 0 ? s.params[i - 1] : lo;
        const atas = i < s.params.length - 1 ? s.params[i + 1] : hi;
        const p = [...s.params];
        p[i] = Number.isFinite(nilai) ? Math.min(Math.max(nilai, bawah), atas) : nilai;
        return { ...s, params: p };
      }),
    }));

  const tambahSet = () =>
    setD((x) => ({
      ...x,
      sets: [
        ...x.sets,
        { kunci: kunciBaru(), id: null, namaHimpunan: '', fungsiKeanggotaan: 'segitiga', params: [bulat(lo + r * 0.25), bulat(lo + r * 0.5), bulat(lo + r * 0.75)] },
      ],
    }));
  const isiTiga = () =>
    setD((x) => ({
      ...x,
      sets: [
        { kunci: kunciBaru(), id: null, namaHimpunan: 'Rendah', fungsiKeanggotaan: 'linear_turun', params: [bulat(lo + r * 0.25), bulat(lo + r * 0.5)] },
        { kunci: kunciBaru(), id: null, namaHimpunan: 'Sedang', fungsiKeanggotaan: 'segitiga', params: [bulat(lo + r * 0.25), bulat(lo + r * 0.5), bulat(lo + r * 0.75)] },
        { kunci: kunciBaru(), id: null, namaHimpunan: 'Tinggi', fungsiKeanggotaan: 'linear_naik', params: [bulat(lo + r * 0.5), bulat(lo + r * 0.75)] },
      ],
    }));

  const simpan = () => {
    setGalat(null);
    const values = {
      namaVariabel: d.namaVariabel,
      tipe: d.tipe,
      satuan: d.satuan,
      nilaiMin: d.nilaiMin === '' ? Number.NaN : min,
      nilaiMax: d.nilaiMax === '' ? Number.NaN : max,
      sets: d.sets.map((s) => ({ id: s.id, namaHimpunan: s.namaHimpunan, fungsiKeanggotaan: s.fungsiKeanggotaan, params: s.params })),
    };
    const parsed = fuzzyVariableSchema.safeParse(values);
    if (!parsed.success) {
      setGalat(parsed.error.issues[0]?.message ?? 'Periksa kembali isian form.');
      return;
    }
    for (const s of parsed.data.sets) {
      const g = validateSetParams(s.fungsiKeanggotaan, s.params);
      if (g) {
        setGalat(`Himpunan "${s.namaHimpunan}": ${g}`);
        return;
      }
    }
    startTransition(async () => {
      const hasil = await saveFuzzyVariable(caseId, variable?.id ?? null, parsed.data);
      if (!hasil.ok) {
        setGalat(hasil.error);
        return;
      }
      toast.success(hasil.pesan ?? 'Tersimpan.');
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setD(drafDari(variable));
          setGalat(null);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{variable ? 'Ubah variabel fuzzy' : 'Tambah variabel fuzzy'}</DialogTitle>
          <DialogDescription>Atur semesta pembicaraan, lalu geser parameter tiap himpunan — grafik berubah seketika.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama variabel" htmlFor="fv-nama" required className="sm:col-span-2">
            <Input id="fv-nama" value={d.namaVariabel} onChange={(e) => setD({ ...d, namaVariabel: e.target.value })} placeholder="mis. Suhu Tubuh" />
          </Field>
          <Field label="Tipe" htmlFor="fv-tipe" required hint="Input: diisi pengguna. Output: hasil inferensi.">
            <Select id="fv-tipe" value={d.tipe} onChange={(e) => setD({ ...d, tipe: e.target.value as 'input' | 'output' })}>
              <option value="input">Input</option>
              <option value="output">Output</option>
            </Select>
          </Field>
          <Field label="Satuan" htmlFor="fv-satuan" hint="Opsional, mis. °C, mmHg, %.">
            <Input id="fv-satuan" value={d.satuan} onChange={(e) => setD({ ...d, satuan: e.target.value })} />
          </Field>
          <Field label="Batas bawah semesta" htmlFor="fv-min" required>
            <Input id="fv-min" type="number" step="any" value={d.nilaiMin} onChange={(e) => setD({ ...d, nilaiMin: e.target.value })} />
          </Field>
          <Field label="Batas atas semesta" htmlFor="fv-max" required>
            <Input id="fv-max" type="number" step="any" value={d.nilaiMax} onChange={(e) => setD({ ...d, nilaiMax: e.target.value })} />
          </Field>
        </div>

        <div className="rounded-xl border bg-card p-3">
          <MembershipChart min={lo} max={hi} satuan={d.satuan} sets={d.sets.map((s) => ({ nama: s.namaHimpunan || '(tanpa nama)', fungsi: s.fungsiKeanggotaan, params: s.params }))} />
        </div>

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Himpunan fuzzy</p>
            <div className="flex flex-wrap gap-2">
              {d.sets.length === 0 ? (
                <Button type="button" variant="outline" size="sm" onClick={isiTiga} disabled={!semestaSah}>
                  Isi Rendah / Sedang / Tinggi
                </Button>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={tambahSet} disabled={!semestaSah || d.sets.length >= 15}>
                <Plus /> Tambah himpunan
              </Button>
            </div>
          </div>
          {d.sets.length === 0 ? <p className="rounded-lg border border-dashed px-3 py-5 text-center text-sm text-muted-foreground">Belum ada himpunan.</p> : null}
          {d.sets.map((s, idx) => {
            const tidakMonoton = tsukamoto && d.tipe === 'output' && (s.fungsiKeanggotaan === 'segitiga' || s.fungsiKeanggotaan === 'trapesium');
            return (
              <div key={s.kunci} className="rounded-lg border p-3" style={{ borderLeft: `4px solid ${WARNA_HIMPUNAN[idx % WARNA_HIMPUNAN.length]}` }}>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-40 flex-1">
                    <label className="mb-1 block text-xs font-medium" htmlFor={`${s.kunci}-nama`}>
                      Nama himpunan
                    </label>
                    <Input id={`${s.kunci}-nama`} value={s.namaHimpunan} onChange={(e) => ubahSet(s.kunci, { namaHimpunan: e.target.value })} placeholder="mis. Tinggi" />
                  </div>
                  <div className="w-44">
                    <label className="mb-1 block text-xs font-medium" htmlFor={`${s.kunci}-fn`}>
                      Fungsi keanggotaan
                    </label>
                    <Select
                      id={`${s.kunci}-fn`}
                      value={s.fungsiKeanggotaan}
                      onChange={(e) => {
                        const f = e.target.value as MembershipFn;
                        ubahSet(s.kunci, { fungsiKeanggotaan: f, params: sebarParams(f, s.params, lo, hi) });
                      }}
                    >
                      {(Object.keys(NAMA_FUNGSI) as MembershipFn[]).map((f) => (
                        <option key={f} value={f}>
                          {NAMA_FUNGSI[f]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setD((x) => ({ ...x, sets: x.sets.filter((y) => y.kunci !== s.kunci) }))} aria-label={`Hapus himpunan ${s.namaHimpunan || idx + 1}`}>
                    <X />
                  </Button>
                </div>
                <div className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                  {s.params.map((p, i) => (
                    <div key={i}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className="text-xs text-muted-foreground" htmlFor={`${s.kunci}-p${i}`}>
                          {LABEL_PARAM[s.fungsiKeanggotaan][i]}
                        </label>
                        <Input
                          id={`${s.kunci}-p${i}`}
                          type="number"
                          step="any"
                          className="h-7 w-24 px-2 text-right text-xs"
                          value={Number.isFinite(p) ? p : ''}
                          onChange={(e) => ubahParam(s.kunci, i, e.target.value === '' ? Number.NaN : Number(e.target.value))}
                        />
                      </div>
                      <input
                        type="range"
                        aria-label={`${LABEL_PARAM[s.fungsiKeanggotaan][i]} himpunan ${s.namaHimpunan || idx + 1}`}
                        className="h-2 w-full cursor-pointer accent-(--brand-primary)"
                        min={lo}
                        max={hi}
                        step={langkah(lo, hi)}
                        value={Number.isFinite(p) ? p : lo}
                        disabled={!semestaSah}
                        onChange={(e) => ubahParam(s.kunci, i, Number(e.target.value))}
                      />
                    </div>
                  ))}
                </div>
                {tidakMonoton ? (
                  <p className="mt-2 text-xs text-amber-700">Tsukamoto menganjurkan himpunan output yang monoton (linear naik/turun).</p>
                ) : null}
              </div>
            );
          })}
        </div>

        {galat ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
            {galat}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Batal
          </Button>
          <Button type="button" onClick={simpan} disabled={pending}>
            {pending ? 'Menyimpan…' : 'Simpan variabel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FuzzyVariablesManager({ caseId, tsukamoto, variables }: Props) {
  const tambah = (
    <VariableDialog caseId={caseId} variable={null} tsukamoto={tsukamoto}>
      <Button>
        <Plus /> Tambah variabel
      </Button>
    </VariableDialog>
  );

  if (variables.length === 0) {
    return (
      <EmptyState
        ikon={<Activity />}
        judul="Belum ada variabel fuzzy"
        deskripsi="Tambahkan variabel input (mis. Suhu Tubuh, Detak Jantung) dan satu variabel output (mis. Tingkat Risiko) beserta himpunan fuzzy-nya."
        aksi={tambah}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">{tambah}</div>
      <div className="grid gap-4 xl:grid-cols-2">
        {variables.map((v) => (
          <Card key={v.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {v.namaVariabel}
                <Badge variant={v.tipe === 'input' ? 'info' : 'warning'}>{v.tipe === 'input' ? 'Input' : 'Output'}</Badge>
              </CardTitle>
              <CardDescription>
                Semesta [{v.nilaiMin}, {v.nilaiMax}]
                {v.satuan ? ` ${v.satuan}` : ''} · {v.sets.length} himpunan
              </CardDescription>
              <CardAction className="flex gap-0.5">
                <VariableDialog caseId={caseId} variable={v} tsukamoto={tsukamoto}>
                  <Button variant="ghost" size="icon-sm" aria-label={`Ubah ${v.namaVariabel}`}>
                    <Pencil />
                  </Button>
                </VariableDialog>
                <ConfirmButton
                  action={deleteFuzzyVariable.bind(null, caseId, v.id)}
                  judul={`Hapus variabel “${v.namaVariabel}”?`}
                  deskripsi="Seluruh himpunan fuzzy variabel ini dan aturan yang memakainya ikut terhapus."
                >
                  <Button variant="ghost" size="icon-sm" aria-label={`Hapus ${v.namaVariabel}`}>
                    <Trash2 className="text-destructive" />
                  </Button>
                </ConfirmButton>
              </CardAction>
            </CardHeader>
            <CardContent>
              <MembershipChart
                min={v.nilaiMin}
                max={v.nilaiMax}
                satuan={v.satuan}
                sets={v.sets.map((s) => ({ nama: s.namaHimpunan, fungsi: s.fungsiKeanggotaan, params: s.params }))}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
