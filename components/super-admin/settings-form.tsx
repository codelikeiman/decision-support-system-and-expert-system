'use client';

import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Field } from '@/components/field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { saveSettingsAction } from '@/lib/actions/super-admin';
import { sebagaiAngka, terapkanGalat } from '@/lib/form';
import { settingsSchema, type SettingsValues } from '@/lib/schemas/platform';

export function SettingsForm({ defaultValues }: { defaultValues: SettingsValues }) {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SettingsValues>({ resolver: zodResolver(settingsSchema), defaultValues });

  const onSubmit = handleSubmit(async (values) => {
    const hasil = await saveSettingsAction(values);
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
          <CardTitle>Identitas platform</CardTitle>
          <CardDescription>Tampil pada halaman depan, halaman masuk, dan laporan PDF.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Nama platform" htmlFor="namaPlatform" required error={errors.namaPlatform?.message}>
            <Input id="namaPlatform" aria-invalid={!!errors.namaPlatform} {...register('namaPlatform')} />
          </Field>
          <Field label="Deskripsi" htmlFor="deskripsiPlatform" error={errors.deskripsiPlatform?.message}>
            <Textarea id="deskripsiPlatform" rows={2} aria-invalid={!!errors.deskripsiPlatform} {...register('deskripsiPlatform')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Perhitungan &amp; hasil</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field
            label="Jumlah angka desimal"
            htmlFor="presisiDesimal"
            error={errors.presisiDesimal?.message}
            hint="Dipakai pada tampilan rincian perhitungan dan laporan PDF (0–8). Perhitungan selalu memakai presisi penuh."
            className="max-w-xs"
          >
            <Input id="presisiDesimal" type="number" min={0} max={8} step={1} aria-invalid={!!errors.presisiDesimal} {...register('presisiDesimal', sebagaiAngka)} />
          </Field>
          <Field
            label="Catatan pada halaman hasil"
            htmlFor="teksDisclaimer"
            error={errors.teksDisclaimer?.message}
            hint="Ditampilkan di bawah setiap hasil konsultasi dan laporan PDF."
          >
            <Textarea id="teksDisclaimer" rows={3} aria-invalid={!!errors.teksDisclaimer} {...register('teksDisclaimer')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Akun end-user</CardTitle>
        </CardHeader>
        <CardContent>
          <Controller
            control={control}
            name="izinkanRegistrasi"
            render={({ field }) => (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p id="lbl-reg" className="text-sm font-medium">
                    Izinkan pendaftaran mandiri
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Bila dimatikan, halaman pendaftaran end-user ditutup di semua client; akun yang sudah ada tetap dapat masuk.
                  </p>
                </div>
                <Switch aria-labelledby="lbl-reg" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
        </CardContent>
      </Card>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan…' : 'Simpan pengaturan'}
        </Button>
      </div>
    </form>
  );
}
