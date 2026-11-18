'use client';

import * as React from 'react';
import { FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * Unduh laporan PDF. Bila browser PDF di server tidak tersedia (HTTP 503),
 * buka versi cetak agar pengguna tetap dapat "Simpan sebagai PDF".
 */
export function PdfButton({ kode }: { kode: string }) {
  const [sibuk, setSibuk] = React.useState(false);
  const href = `/api/consultations/${encodeURIComponent(kode)}/pdf`;

  const unduh = async () => {
    setSibuk(true);
    try {
      const res = await fetch(href);
      if (res.status === 503) {
        toast.info('Ekspor PDF otomatis tidak tersedia di server ini. Membuka versi cetak — pilih “Simpan sebagai PDF”.');
        window.open(`${href}?format=html`, '_blank', 'noopener');
        return;
      }
      if (!res.ok) throw new Error('Gagal membuat laporan.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laporan-${kode}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal membuat laporan.');
    } finally {
      setSibuk(false);
    }
  };

  return (
    <Button type="button" onClick={unduh} disabled={sibuk}>
      <FileDown />
      {sibuk ? 'Menyiapkan laporan…' : 'Unduh Laporan (PDF)'}
    </Button>
  );
}
