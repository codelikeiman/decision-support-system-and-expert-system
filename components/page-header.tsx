import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface Crumb {
  label: string;
  href?: string;
}

interface Props {
  judul: string;
  deskripsi?: React.ReactNode;
  crumbs?: Crumb[];
  aksi?: React.ReactNode;
}

export function PageHeader({ judul, deskripsi, crumbs, aksi }: Props) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 ? (
          <nav aria-label="Jejak navigasi" className="mb-1.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {crumbs.map((c, i) => (
              <React.Fragment key={`${c.label}-${i}`}>
                {i > 0 ? <ChevronRight className="size-3" aria-hidden /> : null}
                {c.href ? (
                  <Link href={c.href} className="hover:text-foreground hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        ) : null}
        <h1 className="text-2xl font-semibold text-balance">{judul}</h1>
        {deskripsi ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{deskripsi}</p> : null}
      </div>
      {aksi ? <div className="flex shrink-0 flex-wrap items-center gap-2">{aksi}</div> : null}
    </div>
  );
}
