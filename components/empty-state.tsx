import * as React from 'react';

export function EmptyState({ ikon, judul, deskripsi, aksi }: { ikon?: React.ReactNode; judul: string; deskripsi?: React.ReactNode; aksi?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      {ikon ? <div className="mb-3 text-muted-foreground [&_svg]:size-8">{ikon}</div> : null}
      <p className="font-medium">{judul}</p>
      {deskripsi ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{deskripsi}</p> : null}
      {aksi ? <div className="mt-4">{aksi}</div> : null}
    </div>
  );
}
