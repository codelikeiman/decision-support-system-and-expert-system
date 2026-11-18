'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold">Terjadi kesalahan</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Halaman tidak dapat ditampilkan. Coba muat ulang; bila masih terjadi, hubungi pengelola platform
        {error.digest ? ` dengan menyebutkan kode ${error.digest}` : ''}.
      </p>
      <Button className="mt-6" onClick={reset}>
        Coba lagi
      </Button>
    </main>
  );
}
