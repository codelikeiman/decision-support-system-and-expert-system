import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';
import { ClientTheme } from '@/components/client-theme';
import { LogoutButton } from '@/components/logout-button';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/guards';
import { getSettings } from '@/lib/settings';
import { ringkas } from '@/lib/site';
import { getClientBySlug, peranTerhadapClient } from '@/lib/spk/public';

export async function generateMetadata({ params }: { params: Promise<{ clientSlug: string }> }): Promise<Metadata> {
  const [client, settings] = await Promise.all([getClientBySlug((await params).clientSlug), getSettings()]);
  if (!client) return {};
  const deskripsi = ringkas(client.deskripsi) || `Layanan konsultasi ${client.namaClient}.`;
  return {
    title: { default: client.namaClient, template: `%s · ${client.namaClient}` },
    description: deskripsi,
    openGraph: {
      type: 'website',
      locale: 'id_ID',
      siteName: `${client.namaClient} · ${settings.namaPlatform}`,
      title: client.namaClient,
      description: deskripsi,
      url: `/c/${client.slug}`,
    },
    twitter: { card: 'summary_large_image', title: client.namaClient, description: deskripsi },
  };
}

export default async function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = await params;
  const [client, viewer, settings] = await Promise.all([getClientBySlug(clientSlug), getCurrentUser(), getSettings()]);
  if (!client) notFound();
  const peran = peranTerhadapClient(viewer, client.id);
  const beranda = `/c/${client.slug}`;

  return (
    <>
      <ClientTheme warnaPrimary={client.warnaPrimary} warnaSecondary={client.warnaSecondary} warnaAccent={client.warnaAccent} />
      <div className="flex min-h-dvh flex-col">
        <header className="no-print bg-brand-secondary text-brand-secondary-foreground">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href={beranda} className="flex min-w-0 items-center gap-3">
              {client.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={client.logoUrl} alt="" className="size-10 shrink-0 rounded-lg bg-white object-contain p-0.5" />
              ) : (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-foreground">
                  {client.namaClient.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="truncate font-semibold">{client.namaClient}</span>
            </Link>
            <nav className="flex shrink-0 items-center gap-2" aria-label="Akun">
              {peran === 'enduser' && viewer ? (
                <>
                  <span className="hidden text-sm opacity-90 sm:inline">{viewer.nama}</span>
                  <span className="rounded-md bg-white/10">
                    <LogoutButton callbackUrl={beranda} />
                  </span>
                </>
              ) : peran === 'staf' && viewer ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={viewer.role === 'super_admin' ? `/super-admin/clients/${client.id}` : '/admin'}>
                    <LayoutDashboard /> Dashboard
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="secondary" size="sm">
                  <Link href={`${beranda}/masuk`}>Masuk</Link>
                </Button>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        <footer className="no-print border-t bg-card">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:px-6">
            <span>
              © {new Date().getFullYear()} {client.namaClient}
            </span>
            <span>Didukung oleh {settings.namaPlatform}</span>
          </div>
        </footer>
      </div>
    </>
  );
}
