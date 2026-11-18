'use client';

import * as React from 'react';
import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  /** HTML langkah perhitungan dari lib/report/render.ts (sudah di-escape di server) */
  html: string;
  jumlah: number;
  /** tampilkan rincian sejak awal (dipakai pada dashboard admin) */
  awalTampil?: boolean;
}

/** Rincian perhitungan yang dapat dibuka-tutup: ringkas secara bawaan. */
export function CalcSteps({ html, jumlah, awalTampil = false }: Props) {
  const [tampil, setTampil] = React.useState(awalTampil);
  const ref = React.useRef<HTMLDivElement>(null);
  const isi = React.useMemo(() => ({ __html: html }), [html]);

  const setSemua = (open: boolean) => ref.current?.querySelectorAll('details').forEach((d) => (d.open = open));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => setTampil((t) => !t)} aria-expanded={tampil}>
          <ChevronDown className={cn('transition-transform', tampil && 'rotate-180')} />
          {tampil ? 'Sembunyikan detail perhitungan' : 'Lihat detail perhitungan'}
          <span className="text-muted-foreground">({jumlah} langkah)</span>
        </Button>
        {tampil ? (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSemua(true)}>
              <ChevronsUpDown /> Buka semua
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSemua(false)}>
              <ChevronsDownUp /> Tutup semua
            </Button>
          </>
        ) : null}
      </div>
      {tampil ? <div ref={ref} className="calc-report mt-4" dangerouslySetInnerHTML={isi} /> : null}
    </div>
  );
}
