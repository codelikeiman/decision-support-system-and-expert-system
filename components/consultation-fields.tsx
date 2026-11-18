'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { KEYAKINAN_CF } from '@/lib/constants';
import type { FormConfig } from '@/lib/spk/form-config';
import type { ConsultationInput } from '@/lib/spk/input';
import { cn } from '@/lib/utils';

interface Props {
  form: FormConfig;
  value: ConsultationInput;
  onChange: (value: ConsultationInput) => void;
  /** awalan id elemen agar unik bila form dipakai lebih dari sekali dalam satu halaman */
  idPrefix?: string;
}

/**
 * Form generator konsultasi: satu komponen untuk keempat kategori metode.
 * Dipakai oleh halaman publik end-user dan editor data uji validitas.
 */
export function ConsultationFields({ form, value, onChange, idPrefix = 'kf' }: Props) {
  if (form.kategori === 'A' && value.kategori === 'A') {
    return (
      <div className="grid gap-5">
        {form.criteria.map((c, idx) => {
          const dipilih = value.jawaban[String(c.id)];
          return (
            <fieldset key={c.id} className="rounded-xl border bg-card p-4">
              <legend className="float-left mb-3 w-full text-sm font-medium">
                <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {idx + 1}
                </span>
                {c.pertanyaan || c.nama}
                {c.pertanyaan ? <span className="mt-0.5 block pl-8 text-xs font-normal text-muted-foreground">{c.nama}</span> : null}
              </legend>
              <div className="clear-both flex flex-wrap gap-2">
                {c.scales.map((s) => {
                  const aktif = dipilih !== undefined && Math.abs(dipilih - s.nilai) < 1e-9;
                  return (
                    <label
                      key={s.nilai}
                      className={cn(
                        'flex min-w-[5.5rem] flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-center text-sm transition-colors has-focus-visible:ring-[3px] has-focus-visible:ring-ring/30',
                        aktif ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
                      )}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name={`${idPrefix}-c-${c.id}`}
                        checked={aktif}
                        onChange={() => onChange({ kategori: 'A', jawaban: { ...value.jawaban, [String(c.id)]: s.nilai } })}
                      />
                      {s.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    );
  }

  if (form.kategori === 'B' && value.kategori === 'B') {
    const peta = new Map(value.gejala.map((g) => [g.id, g.keyakinan]));
    return (
      <DaftarGejala
        idPrefix={idPrefix}
        symptoms={form.symptoms}
        terpilih={(id) => peta.has(id)}
        onToggle={(id, on) => {
          const baru = value.gejala.filter((g) => g.id !== id);
          if (on) baru.push(form.pakaiKeyakinan ? { id, keyakinan: 1 } : { id });
          onChange({ kategori: 'B', gejala: baru });
        }}
        tambahan={
          form.pakaiKeyakinan
            ? (id) => (
                <Select
                  aria-label="Tingkat keyakinan"
                  className="h-8 w-40"
                  value={String(peta.get(id) ?? 1)}
                  onChange={(e) =>
                    onChange({ kategori: 'B', gejala: value.gejala.map((g) => (g.id === id ? { id, keyakinan: Number(e.target.value) } : g)) })
                  }
                >
                  {KEYAKINAN_CF.map((k) => (
                    <option key={k.nilai} value={k.nilai}>
                      {k.label} ({k.nilai})
                    </option>
                  ))}
                </Select>
              )
            : undefined
        }
      />
    );
  }

  if (form.kategori === 'C' && value.kategori === 'C') {
    return (
      <div className="grid gap-5">
        {form.variables.map((v) => {
          const x = value.nilai[String(v.id)];
          const langkah = langkahSlider(v.min, v.max);
          const set = (n: number | undefined) => {
            const baru = { ...value.nilai };
            if (n === undefined || Number.isNaN(n)) delete baru[String(v.id)];
            else baru[String(v.id)] = n;
            onChange({ kategori: 'C', nilai: baru });
          };
          const id = `${idPrefix}-v-${v.id}`;
          return (
            <div key={v.id} className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <label htmlFor={id} className="text-sm font-medium">
                  {v.nama}
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    Rentang {v.min} – {v.max}
                    {v.satuan ? ` ${v.satuan}` : ''}
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    className="w-28 text-right"
                    min={v.min}
                    max={v.max}
                    step="any"
                    value={x ?? ''}
                    onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))}
                  />
                  {v.satuan ? <span className="text-sm text-muted-foreground">{v.satuan}</span> : null}
                </div>
              </div>
              <input
                type="range"
                aria-label={`${v.nama} (penggeser)`}
                className="h-2 w-full cursor-pointer accent-(--brand-primary)"
                min={v.min}
                max={v.max}
                step={langkah}
                value={x ?? v.min}
                onChange={(e) => set(Number(e.target.value))}
              />
            </div>
          );
        })}
      </div>
    );
  }

  if (form.kategori === 'D' && value.kategori === 'D') {
    const dipilih = new Set(value.gejala);
    return (
      <DaftarGejala
        idPrefix={idPrefix}
        symptoms={form.symptoms}
        terpilih={(id) => dipilih.has(id)}
        onToggle={(id, on) => onChange({ kategori: 'D', gejala: on ? [...value.gejala, id] : value.gejala.filter((g) => g !== id) })}
      />
    );
  }

  return <p className="text-sm text-destructive">Form tidak cocok dengan kategori metode.</p>;
}

/** Langkah penggeser yang "bulat" (±200 langkah sepanjang rentang). */
function langkahSlider(min: number, max: number): number {
  const kasar = (max - min) / 200;
  if (!(kasar > 0)) return 1;
  const pangkat = Math.pow(10, Math.floor(Math.log10(kasar)));
  const kandidat = [1, 2, 5, 10].map((k) => k * pangkat);
  return kandidat.find((k) => k >= kasar) ?? kandidat[kandidat.length - 1];
}

function DaftarGejala({
  idPrefix,
  symptoms,
  terpilih,
  onToggle,
  tambahan,
}: {
  idPrefix: string;
  symptoms: { id: number; kode: string; nama: string }[];
  terpilih: (id: number) => boolean;
  onToggle: (id: number, on: boolean) => void;
  tambahan?: (id: number) => React.ReactNode;
}) {
  const [cari, setCari] = React.useState('');
  const kata = cari.trim().toLowerCase();
  const tampil = kata ? symptoms.filter((s) => s.nama.toLowerCase().includes(kata) || s.kode.toLowerCase().includes(kata)) : symptoms;
  const jumlah = symptoms.filter((s) => terpilih(s.id)).length;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {symptoms.length > 10 ? (
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input className="pl-8" placeholder="Cari gejala…" aria-label="Cari gejala" value={cari} onChange={(e) => setCari(e.target.value)} />
          </div>
        ) : (
          <span />
        )}
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {jumlah} dari {symptoms.length} gejala dipilih
        </p>
      </div>
      <ul className="grid gap-2">
        {tampil.map((s) => {
          const on = terpilih(s.id);
          const id = `${idPrefix}-g-${s.id}`;
          return (
            <li
              key={s.id}
              className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card px-3 py-2.5 transition-colors',
                on ? 'border-primary bg-primary/5' : 'hover:bg-accent/60',
              )}
            >
              <Checkbox id={id} checked={on} onChange={(e) => onToggle(s.id, e.target.checked)} />
              <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer text-sm">
                <span className="mr-2 font-mono text-xs text-muted-foreground">{s.kode}</span>
                {s.nama}
              </label>
              {on && tambahan ? tambahan(s.id) : null}
            </li>
          );
        })}
        {tampil.length === 0 ? <li className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada gejala yang cocok.</li> : null}
      </ul>
    </div>
  );
}
