import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Halaman tidak ditemukan</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">Alamat yang Anda buka tidak tersedia, sudah dihapus, atau Anda tidak memiliki akses.</p>
      <Button asChild className="mt-6">
        <Link href="/">Kembali ke beranda</Link>
      </Button>
    </main>
  );
}
