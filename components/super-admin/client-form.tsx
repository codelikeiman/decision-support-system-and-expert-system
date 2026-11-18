'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Field } from '@/components/field';
import { ImageUpload } from '@/components/image-upload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { saveClient } from '@/lib/actions/super-admin';
import { terapkanGalat } from '@/lib/form';
import { clientSchema, type ClientValues } from '@/lib/schemas/platform';
import { HEX_WARNA, kontrasTeks, slugify } from '@/lib/utils';

interface Props {
  id: number | null;
  defaultValues: ClientValues;
}

const WARNA: { name: 'warnaPrimary' | 'warnaSecondary' | 'warnaAccent'; label: string; hint: string }[] = [
  { name: 'warnaPrimary', label: 'Warna primary', hint: 'Tombol, tautan, dan sorotan utama.' },
  { name: 'warnaSecondary', label: 'Warna secondary', hint: 'Latar kepala halaman publik.' },
  { name: 'warnaAccent', label: 'Warna accent', hint: 'Lencana dan penekanan hasil.' },
];

export function ClientForm({ id, defaultValues }: Props) {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<ClientValues>({ resolver: zodResolver(clientSchema), defaultValues });

  const v = watch();
  const hex = (s: string, cadangan: string) => (HEX_WARNA.test(s) ? s : cadangan);
  const p = hex(v.warnaPrimary, '#0f766e');
  const s = hex(v.warnaSecondary, '#134e4a');
  const a = hex(v.warnaAccent, '#f59e0b');

  const onSubmit = handleSubmit(async (values) => {
    const hasil = await saveClient(id, values);
    if (!hasil.ok) {
      terapkanGalat(hasil, setError);
      toast.error(hasil.error);
      return;
    }
    toast.success(hasil.pesan ?? 'Tersimpan.');
    if (id === null && hasil.data) router.push(`/super-admin/clients/${hasil.data.id}`);
    else router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_320px]" noValidate>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Identitas client</CardTitle>
            <CardDescription>Nama organisasi dan alamat halaman publiknya.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Nama client" htmlFor="namaClient" required error={errors.namaClient?.message}>
              <Input
                id="namaClient"
                aria-invalid={!!errors.namaClient}
                {...register('namaClient', {
                  onChange: (e) => {
                    // slug mengikuti nama selama belum diubah manual (hanya saat membuat)
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
                  Alamat halaman publik: <span className="font-mono">/c/{v.slug || '…'}</span>
                </>
              }
            >
              <Input id="slug" className="font-mono" aria-invalid={!!errors.slug} {...register('slug')} />
            </Field>
            <Field label="Deskripsi singkat" htmlFor="deskripsi" error={errors.deskripsi?.message} hint="Ditampilkan pada halaman depan client.">
              <Textarea id="deskripsi" rows={3} aria-invalid={!!errors.deskripsi} {...register('deskripsi')} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tema warna &amp; logo</CardTitle>
            <CardDescription>Diterapkan otomatis pada halaman publik dan dashboard admin client ini.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-3">
              {WARNA.map((w) => (
                <Field key={w.name} label={w.label} htmlFor={w.name} error={errors[w.name]?.message} hint={w.hint}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={`Pilih ${w.label.toLowerCase()}`}
                      className="h-9 w-11 shrink-0 cursor-pointer rounded-md border border-input bg-card p-1"
                      value={hex(v[w.name], '#000000')}
                      onChange={(e) => setValue(w.name, e.target.value, { shouldDirty: true, shouldValidate: true })}
                    />
                    <Input id={w.name} className="font-mono uppercase" maxLength={7} aria-invalid={!!errors[w.name]} {...register(w.name)} />
                  </div>
                </Field>
              ))}
            </div>
            {id !== null ? (
              <Field label="Logo">
                <Controller
                  control={control}
                  name="logoUrl"
                  render={({ field }) => <ImageUpload clientId={id} value={field.value} onChange={field.onChange} label="Unggah logo" />}
                />
              </Field>
            ) : (
              <p className="text-sm text-muted-foreground">Logo dapat diunggah setelah client dibuat.</p>
            )}
          </CardContent>
        </Card>

        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Menyimpan…' : id === null ? 'Buat client' : 'Simpan perubahan'}
          </Button>
        </div>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Pratinjau tema</p>
        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="flex items-center gap-3 px-4 py-4" style={{ background: s, color: kontrasTeks(s) }}>
            {v.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.logoUrl} alt="" className="size-9 rounded-md bg-white object-contain p-0.5" />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-md text-xs font-bold" style={{ background: p, color: kontrasTeks(p) }}>
                {(v.namaClient || 'CL').slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="truncate text-sm font-semibold">{v.namaClient || 'Nama client'}</span>
          </div>
          <div className="space-y-3 p-4">
            <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: a, color: kontrasTeks(a) }}>
              Hasil diagnosis
            </span>
            <p className="text-sm text-muted-foreground">Contoh tampilan komponen dengan warna yang dipilih.</p>
            <span className="inline-flex h-9 items-center rounded-md px-4 text-sm font-medium" style={{ background: p, color: kontrasTeks(p) }}>
              Mulai konsultasi
            </span>
            <p className="text-sm font-medium" style={{ color: p }}>
              Tautan dan sorotan
            </p>
          </div>
        </div>
      </aside>
    </form>
  );
}
