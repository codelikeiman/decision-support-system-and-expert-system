'use client';

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
import { saveTampilan } from '@/lib/actions/case-common';
import { terapkanGalat } from '@/lib/form';
import { tampilanSchema, type TampilanValues } from '@/lib/schemas/knowledge';

export function TampilanForm({ caseId, clientId, defaultValues }: { caseId: number; clientId: number; defaultValues: TampilanValues }) {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TampilanValues>({ resolver: zodResolver(tampilanSchema), defaultValues });

  const onSubmit = handleSubmit(async (values) => {
    const hasil = await saveTampilan(caseId, values);
    if (!hasil.ok) {
      terapkanGalat(hasil, setError);
      toast.error(hasil.error);
      return;
    }
    toast.success(hasil.pesan ?? 'Tersimpan.');
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="grid max-w-3xl gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Teks halaman publik</CardTitle>
          <CardDescription>Ditampilkan kepada pengguna pada halaman depan dan form konsultasi Case ini.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Judul" htmlFor="t-judul" required error={errors.judul?.message}>
            <Input id="t-judul" aria-invalid={!!errors.judul} {...register('judul')} />
          </Field>
          <Field label="Deskripsi" htmlFor="t-deskripsi" error={errors.deskripsi?.message} hint="Penjelasan singkat tentang layanan ini.">
            <Textarea id="t-deskripsi" rows={5} aria-invalid={!!errors.deskripsi} {...register('deskripsi')} />
          </Field>
          <Field
            label="Instruksi pengisian"
            htmlFor="t-instruksi"
            error={errors.instruksi?.message}
            hint="Ditampilkan di atas form konsultasi, mis. cara menjawab atau hal yang perlu disiapkan."
          >
            <Textarea id="t-instruksi" rows={5} aria-invalid={!!errors.instruksi} {...register('instruksi')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gambar ilustrasi</CardTitle>
          <CardDescription>Opsional. Ditampilkan pada halaman depan Case.</CardDescription>
        </CardHeader>
        <CardContent>
          <Controller
            control={control}
            name="gambarUrl"
            render={({ field }) => <ImageUpload clientId={clientId} value={field.value} onChange={field.onChange} previewClassName="h-28 w-44" />}
          />
        </CardContent>
      </Card>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan…' : 'Simpan tampilan'}
        </Button>
      </div>
    </form>
  );
}
