import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/guards';
import { getSettings } from '@/lib/settings';
import { getClientBySlug, peranTerhadapClient } from '@/lib/spk/public';
import { tujuanDalamClient } from '@/lib/spk/redirect';

export const metadata: Metadata = { title: 'Masuk' };

export default async function EndUserLoginPage({ params, searchParams }: { params: Promise<{ clientSlug: string }>; searchParams: Promise<{ callbackUrl?: string }> }) {
  const [{ clientSlug }, { callbackUrl }] = await Promise.all([params, searchParams]);
  const [client, viewer, settings] = await Promise.all([getClientBySlug(clientSlug), getCurrentUser(), getSettings()]);
  if (!client) notFound();
  const tujuan = tujuanDalamClient(client.slug, callbackUrl);
  if (peranTerhadapClient(viewer, client.id) !== null) redirect(tujuan);

  return (
    <div className="mx-auto w-full max-w-sm py-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Masuk</CardTitle>
          <CardDescription>Masuk dengan akun {client.namaClient} Anda untuk memakai layanan dan melihat riwayat konsultasi.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm clientSlug={client.slug} callbackUrl={tujuan} />
          {settings.izinkanRegistrasi ? (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Belum punya akun?{' '}
              <Link href={`/c/${client.slug}/daftar?callbackUrl=${encodeURIComponent(tujuan)}`} className="font-medium text-primary underline-offset-4 hover:underline">
                Daftar
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
