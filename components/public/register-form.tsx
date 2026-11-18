'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Field } from '@/components/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { registerEndUser } from '@/lib/actions/public';
import { terapkanGalat } from '@/lib/form';
import { registerSchema, type RegisterValues } from '@/lib/schemas/auth';

export function RegisterForm({ clientSlug, callbackUrl }: { clientSlug: string; callbackUrl: string }) {
  const router = useRouter();
  const [galat, setGalat] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: { nama: '', email: '', password: '', konfirmasi: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setGalat(null);
    const hasil = await registerEndUser(clientSlug, values);
    if (!hasil.ok) {
      terapkanGalat(hasil, setError);
      setGalat(hasil.error);
      return;
    }
    const masuk = await signIn('credentials', { redirect: false, email: values.email, password: values.password, clientSlug });
    if (!masuk || masuk.error) {
      router.replace(`/c/${clientSlug}/masuk?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }
    router.replace(callbackUrl);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {galat ? (
        <Alert variant="destructive">
          <AlertDescription>{galat}</AlertDescription>
        </Alert>
      ) : null}
      <Field label="Nama lengkap" htmlFor="r-nama" error={errors.nama?.message}>
        <Input id="r-nama" autoComplete="name" aria-invalid={!!errors.nama} {...register('nama')} />
      </Field>
      <Field label="Email" htmlFor="r-email" error={errors.email?.message}>
        <Input id="r-email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!errors.email} {...register('email')} />
      </Field>
      <Field label="Kata sandi" htmlFor="r-password" error={errors.password?.message} hint="Minimal 8 karakter, memuat huruf dan angka.">
        <Input id="r-password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
      </Field>
      <Field label="Ulangi kata sandi" htmlFor="r-konfirmasi" error={errors.konfirmasi?.message}>
        <Input id="r-konfirmasi" type="password" autoComplete="new-password" aria-invalid={!!errors.konfirmasi} {...register('konfirmasi')} />
      </Field>
      <Button type="submit" disabled={isSubmitting} className="mt-1">
        {isSubmitting ? 'Mendaftarkan…' : 'Daftar'}
      </Button>
    </form>
  );
}
