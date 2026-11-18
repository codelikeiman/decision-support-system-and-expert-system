import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { berandaUntuk, getCurrentUser } from '@/lib/guards';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Masuk', robots: { index: false, follow: true } };

/** Hanya izinkan tujuan internal area staf agar tidak menjadi open redirect. */
function tujuanAman(callbackUrl: string | undefined, cadangan: string): string {
  if (!callbackUrl || !callbackUrl.startsWith('/') || callbackUrl.startsWith('//') || callbackUrl.includes('\\')) return cadangan;
  return callbackUrl;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const [{ callbackUrl }, user, settings] = await Promise.all([searchParams, getCurrentUser(), getSettings()]);
  if (user && user.role !== 'end_user') redirect(berandaUntuk(user));

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            {settings.namaPlatform.slice(0, 2).toUpperCase()}
          </span>
          <h1 className="text-xl font-semibold">{settings.namaPlatform}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Masuk sebagai Super Admin atau Admin</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Masuk ke dashboard</CardTitle>
            <CardDescription>Gunakan email dan kata sandi akun pengelola Anda.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* tujuan akhir ditentukan /masuk sesuai peran bila callbackUrl kosong */}
            <LoginForm callbackUrl={tujuanAman(callbackUrl, '/masuk')} />
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Pasien/pengguna umum masuk melalui halaman layanan masing-masing.{' '}
          <Link href="/" className="underline underline-offset-2">
            Kembali ke beranda
          </Link>
        </p>
      </div>
    </main>
  );
}
