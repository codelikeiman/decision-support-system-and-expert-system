'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Field } from '@/components/field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { saveCase } from '@/lib/actions/super-admin';
import { CATEGORY_INFO, METHOD_LIST, METHODS, type Category } from '@/lib/engines';
import { terapkanGalat } from '@/lib/form';
import { caseSchema, type CaseValues } from '@/lib/schemas/platform';
import { cn, slugify } from '@/lib/utils';

interface Props {
  id: number | null;
  clients: { id: number; namaClient: string; slug: string }[];
  defaultValues: CaseValues;
  /** kategori metode yang saat ini tersimpan (hanya saat mengubah) */
  kategoriTersimpan?: Category;
}

const KATEGORI: Category[] = ['A', 'B', 'C', 'D'];

const MODE: { nilai: 'profil' | 'preferensi'; judul: string; isi: string }[] = [
  {
    nilai: 'profil',
    judul: 'Kesesuaian profil (diagnosis/skrining)',
    isi: 'Jawaban pengguna menggambarkan kondisinya. Alternatif diperingkat menurut kesesuaian jawaban dengan profil acuan tiap alternatif.',
  },
  {
    nilai: 'preferensi',
    judul: 'Preferensi (pemilihan/rekomendasi)',
    isi: 'Jawaban pengguna menyatakan tingkat kepentingan tiap kriteria. Nilai alternatif dari pakar dipakai apa adanya (benefit/cost berlaku).',
  },
];

export function CaseForm({ id, clients, defaultValues, kategoriTersimpan }: Props) {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<CaseValues>({ resolver: zodResolver(caseSchema), defaultValues });

  const v = watch();
  const metode = METHODS[v.methodKey];
  const kategori = metode?.kategori;
  const client = clients.find((c) => c.id === v.clientId);
  const gantiKategori = id !== null && kategoriTersimpan !== undefined && kategori !== kategoriTersimpan;

  const onSubmit = handleSubmit(async (values) => {
    const hasil = await saveCase(id, values);
    if (!hasil.ok) {
      terapkanGalat(hasil, setError);
      toast.error(hasil.error);
      return;
    }
    toast.success(hasil.pesan ?? 'Tersimpan.');
    if (id === null && hasil.data) router.push(`/admin/cases/${hasil.data.id}`);
    else router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="grid max-w-3xl gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Informasi Case</CardTitle>
          <CardDescription>Satu Case adalah satu layanan SPK untuk satu domain, mis. “Diagnosis Penyakit Jantung”.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Client" htmlFor="clientId" required error={errors.clientId?.message} hint={id !== null ? 'Case tidak dapat dipindahkan ke client lain.' : undefined}>
            <Controller
              control={control}
              name="clientId"
              render={({ field }) => (
                <Select
                  id="clientId"
                  disabled={id !== null}
                  aria-invalid={!!errors.clientId}
                  value={field.value || ''}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                >
                  <option value="" disabled>
                    Pilih client…
                  </option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.namaClient}
                    </option>
                  ))}
                </Select>
              )}
            />
          </Field>
          <Field label="Judul" htmlFor="judul" required error={errors.judul?.message}>
            <Input
              id="judul"
              aria-invalid={!!errors.judul}
              {...register('judul', {
                onChange: (e) => {
                  if (id === null && !dirtyFields.slug) setValue('slug', slugify(e.target.value), { shouldValidate: false });
                },
              })}
            />
          </Field>
          <Field
            label="Slug"
            htmlFor="slug"
            required
            error={errors.slug?.message}
            hint={
              <>
                Alamat publik: <span className="font-mono">/c/{client?.slug ?? '…'}/{v.slug || '…'}</span>
              </>
            }
          >
            <Input id="slug" className="font-mono" aria-invalid={!!errors.slug} {...register('slug')} />
          </Field>
          <Field label="Deskripsi" htmlFor="deskripsi" error={errors.deskripsi?.message} hint="Admin client dapat menyempurnakannya di menu Tampilan.">
            <Textarea id="deskripsi" rows={4} aria-invalid={!!errors.deskripsi} {...register('deskripsi')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metode</CardTitle>
          <CardDescription>
            Metode menentukan kategori, dan kategori menentukan bentuk basis pengetahuan serta form konsultasi yang dibuat otomatis.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Metode SPK / sistem pakar" htmlFor="methodKey" required error={errors.methodKey?.message}>
            <Select id="methodKey" aria-invalid={!!errors.methodKey} {...register('methodKey')}>
              {KATEGORI.map((k) => (
                <optgroup key={k} label={`Kategori ${k} — ${CATEGORY_INFO[k].nama}`}>
                  {METHOD_LIST.filter((m) => m.kategori === k).map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.singkatan} — {m.nama}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>

          {metode && kategori ? (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <Badge>Kategori {kategori}</Badge>
                <span className="font-medium">{CATEGORY_INFO[kategori].nama}</span>
              </div>
              <p>{metode.deskripsi}</p>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-muted-foreground sm:grid-cols-2">
                <div>
                  <dt className="inline font-medium text-foreground">Masukan: </dt>
                  <dd className="inline">{CATEGORY_INFO[kategori].masukan}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-foreground">Keluaran: </dt>
                  <dd className="inline">{CATEGORY_INFO[kategori].keluaran}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="inline font-medium text-foreground">Rujukan: </dt>
                  <dd className="inline">{metode.referensi}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          {gantiKategori ? (
            <Alert variant="warning">
              <TriangleAlert />
              <AlertTitle>Kategori metode berubah</AlertTitle>
              <AlertDescription>
                <p>
                  Basis pengetahuan kategori {kategoriTersimpan} tidak dipakai oleh metode baru (datanya tetap tersimpan dan kembali dipakai
                  bila metode dikembalikan). Admin perlu mengisi basis pengetahuan kategori {kategori}, dan data uji validitas lama menjadi
                  tidak kompatibel. Riwayat konsultasi tidak berubah.
                </p>
              </AlertDescription>
            </Alert>
          ) : null}

          {kategori === 'A' ? (
            <Controller
              control={control}
              name="mcdmMode"
              render={({ field }) => (
                <fieldset className="grid gap-2">
                  <legend className="mb-1.5 text-sm font-medium">Cara memakai jawaban pengguna</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {MODE.map((m) => (
                      <label
                        key={m.nilai}
                        className={cn(
                          'flex cursor-pointer gap-3 rounded-lg border bg-card p-3 text-sm transition-colors',
                          field.value === m.nilai ? 'border-primary ring-2 ring-primary/20' : 'hover:bg-accent',
                        )}
                      >
                        <input
                          type="radio"
                          className="mt-0.5 size-4 accent-(--brand-primary)"
                          name="mcdmMode"
                          checked={field.value === m.nilai}
                          onChange={() => field.onChange(m.nilai)}
                        />
                        <span>
                          <span className="block font-medium">{m.judul}</span>
                          <span className="mt-0.5 block text-muted-foreground">{m.isi}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Akses</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Controller
            control={control}
            name="requiresLogin"
            render={({ field }) => (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p id="lbl-login" className="text-sm font-medium">
                    Wajib login
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Aktif: pengguna harus mendaftar/masuk dan seluruh riwayat konsultasinya tersimpan di akunnya. Nonaktif: form publik tanpa akun.
                  </p>
                </div>
                <Switch aria-labelledby="lbl-login" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-start justify-between gap-4 border-t pt-4">
                <div>
                  <p id="lbl-aktif" className="text-sm font-medium">
                    Case aktif
                  </p>
                  <p className="text-sm text-muted-foreground">Case yang tidak aktif tidak dapat diakses publik (pengelola tetap dapat melihat pratinjau).</p>
                </div>
                <Switch aria-labelledby="lbl-aktif" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
        </CardContent>
      </Card>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan…' : id === null ? 'Buat Case' : 'Simpan perubahan'}
        </Button>
      </div>
    </form>
  );
}
