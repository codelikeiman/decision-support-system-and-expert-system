'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { LogoutButton } from '@/components/logout-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface NavItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
  /** cocokkan persis (bukan awalan) */
  exact?: boolean;
}

export interface NavGroup {
  judul?: string;
  items: NavItem[];
}

interface Props {
  brand: { nama: string; sub?: string; logoUrl?: string | null; href: string };
  user: { nama: string; peran: string };
  groups: NavGroup[];
  /** konten tambahan di atas navigasi (mis. tautan kembali) */
  atas?: React.ReactNode;
  children: React.ReactNode;
}

function aktif(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Kerangka dashboard: sidebar (drawer pada layar kecil) + area konten. */
export function AppShell({ brand, user, groups, atas, children }: Props) {
  const pathname = usePathname();
  const [buka, setBuka] = React.useState(false);

  React.useEffect(() => {
    setBuka(false);
  }, [pathname]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href={brand.href} className="flex items-center gap-3 border-b px-4 py-4">
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt="" className="size-9 rounded-md object-contain" />
        ) : (
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            {brand.nama.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{brand.nama}</span>
          {brand.sub ? <span className="block truncate text-xs text-muted-foreground">{brand.sub}</span> : null}
        </span>
      </Link>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Navigasi utama">
        {atas}
        {groups.map((g, gi) => (
          <div key={g.judul ?? gi}>
            {g.judul ? <p className="mb-1.5 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{g.judul}</p> : null}
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const on = aktif(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={on ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors [&_svg]:size-4 [&_svg]:shrink-0',
                        on ? 'bg-primary/10 font-medium text-primary' : 'text-slate-700 hover:bg-accent',
                      )}
                    >
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t px-4 py-3">
        <p className="truncate text-sm font-medium">{user.nama}</p>
        <p className="mb-2 text-xs text-muted-foreground">{user.peran}</p>
        <LogoutButton variant="outline" />
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-card lg:block">{sidebar}</aside>

      <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-card px-4 py-3 lg:hidden">
        <Button variant="outline" size="icon-sm" onClick={() => setBuka(true)} aria-label="Buka menu">
          <Menu />
        </Button>
        <span className="truncate text-sm font-semibold">{brand.nama}</span>
      </header>

      {buka ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Tutup menu" onClick={() => setBuka(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-card shadow-xl">
            <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" onClick={() => setBuka(false)} aria-label="Tutup menu">
              <X />
            </Button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
