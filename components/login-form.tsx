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
import { loginSchema, type LoginValues } from '@/lib/schemas/auth';

interface Props {
  /** diisi untuk login end-user (akun dicari di dalam client ini) */
  clientSlug?: string;
  /** tujuan setelah berhasil masuk */
  callbackUrl: string;
}

export function LoginForm({ clientSlug, callbackUrl }: Props) {
  const router = useRouter();
  const [galat, setGalat] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setGalat(null);
    const hasil = await signIn('credentials', {
      redirect: false,
      email: values.email,
      password: values.password,
      clientSlug: clientSlug ?? '',
    });
    if (!hasil || hasil.error) {
      setGalat(
        hasil?.error && hasil.error !== 'CredentialsSignin' ? hasil.error : 'Email atau kata sandi salah, atau akun tidak aktif.',
      );
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
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!errors.email} {...register('email')} />
      </Field>
      <Field label="Kata sandi" htmlFor="password" error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
      </Field>
      <Button type="submit" disabled={isSubmitting} className="mt-1">
        {isSubmitting ? 'Memeriksa…' : 'Masuk'}
      </Button>
    </form>
  );
}
