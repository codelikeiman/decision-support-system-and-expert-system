'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { ConsultationFields } from '@/components/consultation-fields';
import { Field } from '@/components/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { submitConsultation } from '@/lib/actions/public';
import { inputKosong, type FormConfig } from '@/lib/spk/form-config';
import type { ConsultationInput } from '@/lib/spk/input';

interface Props {
  clientSlug: string;
  caseSlug: string;
  form: FormConfig;
  /** tampilkan isian nama (konsultasi tanpa akun) */
  tanyaNama: boolean;
}

/** Periksa kelengkapan di sisi klien agar pesan muncul seketika (server tetap memvalidasi ulang). */
function periksa(form: FormConfig, input: ConsultationInput): { kemajuan: string; galat: string | null } {
  if (form.kategori === 'A' && input.kategori === 'A') {
    const terjawab = form.criteria.filter((c) => input.jawaban[String(c.id)] !== undefined).length;
    return {
      kemajuan: `${terjawab} dari ${form.criteria.length} pertanyaan terjawab`,
      galat: terjawab < form.criteria.length ? 'Jawab semua pertanyaan terlebih dahulu.' : null,
    };
  }
  if (form.kategori === 'C' && input.kategori === 'C') {
    const kurang = form.variables.find((v) => {
      const x = input.nilai[String(v.id)];
      return x === undefined || x < v.min || x > v.max;
    });
    const terisi = form.variables.filter((v) => input.nilai[String(v.id)] !== undefined).length;
    return {
      kemajuan: `${terisi} dari ${form.variables.length} nilai terisi`,
      galat: kurang ? `Isi nilai “${kurang.nama}” pada rentang ${kurang.min} sampai ${kurang.max}.` : null,
    };
  }
  const jumlah = input.kategori === 'B' || input.kategori === 'D' ? input.gejala.length : 0;
  return { kemajuan: `${jumlah} gejala dipilih`, galat: jumlah === 0 ? 'Pilih minimal satu gejala yang dialami.' : null };
}

export function ConsultationForm({ clientSlug, caseSlug, form, tanyaNama }: Props) {
  const router = useRouter();
  const [input, setInput] = React.useState<ConsultationInput>(() => inputKosong(form));
  const [nama, setNama] = React.useState('');
  const [galat, setGalat] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const status = periksa(form, input);

  const kirim = (e: React.FormEvent) => {
    e.preventDefault();
    if (status.galat) {
      setGalat(status.galat);
      return;
    }
    setGalat(null);
    startTransition(async () => {
      const hasil = await submitConsultation(clientSlug, caseSlug, { input, nama });
      if (!hasil.ok || !hasil.data) {
        setGalat(hasil.ok ? 'Terjadi kesalahan. Silakan coba lagi.' : hasil.error);
        return;
      }
      router.push(`/c/${clientSlug}/${caseSlug}/hasil/${hasil.data.kode}`);
    });
  };

  return (
    <form onSubmit={kirim} className="grid gap-6" noValidate>
      {tanyaNama ? (
        <div className="rounded-xl border bg-card p-4">
          <Field label="Nama (opsional)" htmlFor="kf-nama" hint="Dicantumkan pada hasil dan laporan PDF. Boleh dikosongkan.">
            <Input id="kf-nama" value={nama} maxLength={100} autoComplete="name" onChange={(e) => setNama(e.target.value)} />
          </Field>
        </div>
      ) : null}

      <ConsultationFields form={form} value={input} onChange={setInput} />

      {galat ? (
        <Alert variant="destructive">
          <AlertDescription>{galat}</AlertDescription>
        </Alert>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {status.kemajuan}
        </p>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Menghitung…' : 'Lihat hasil'}
          {!pending ? <ArrowRight /> : null}
        </Button>
      </div>
    </form>
  );
}
