import type { Metadata, Viewport } from 'next';
import 'katex/dist/katex.min.css';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { getSettings } from '@/lib/settings';
import { ringkas, siteUrl } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const deskripsi = ringkas(s.deskripsiPlatform) || s.namaPlatform;
  return {
    metadataBase: siteUrl(),
    applicationName: s.namaPlatform,
    title: { default: s.namaPlatform, template: `%s · ${s.namaPlatform}` },
    description: deskripsi,
    // Gambar pratinjau berasal dari app/opengraph-image.tsx (dan turunannya per client/Case).
    openGraph: {
      type: 'website',
      locale: 'id_ID',
      siteName: s.namaPlatform,
      title: s.namaPlatform,
      description: deskripsi,
      url: '/',
    },
    twitter: { card: 'summary_large_image', title: s.namaPlatform, description: deskripsi },
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
