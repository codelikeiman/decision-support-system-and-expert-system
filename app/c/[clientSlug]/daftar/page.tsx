import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { RegisterForm } from '@/components/public/register-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/guards';
import { getSettings } from '@/lib/settings';
import { getClientBySlug, peranTerhadapClient } from '@/lib/spk/public';
import { tujuanDalamClient } from '@/lib/spk/redirect';

export const metadata: Metadata = { title: 'Daftar' };

export default async function EndUserRegisterPage({ params, searchParams }: { params: Promise<{ clientSlug: string }>; searchParams: Promise<{ callbackUrl?: string }> }) {
  const [{ clientSlug }, { callbackUrl }] = await Promise.all([params, searchParams]);
  const [client, viewer, settings] = await Promise.all([getClientBySlug(clientSlug), getCurrentUser(), getSettings()]);
  if (!client) notFound();
  const tujuan = tujuanDalamClient(client.slug, callbackUrl);
  if (peranTerhadapClient(viewer, client.id) !== null) redirect(tujuan);

  return (
    <div className="mx-auto w-full max-w-sm py-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Buat akun</CardTitle>
          <CardDescription>Akun ini hanya berlaku untuk layanan {client.namaClient}.</CardDescription>
        </CardHeader>
        <CardContent>
          {settings.izinkanRegistrasi ? (
            <RegisterForm clientSlug={client.slug} callbackUrl={tujuan} />
          ) : (
            <Alert variant="warning">
              <AlertDescription>
                <p>Pendaftaran akun sedang ditutup. Silakan hubungi penyelenggara layanan.</p>
              </AlertDescription>
            </Alert>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Sudah punya akun?{' '}
            <Link href={`/c/${client.slug}/masuk?callbackUrl=${encodeURIComponent(tujuan)}`} className="font-medium text-primary underline-offset-4 hover:underline">
              Masuk
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
