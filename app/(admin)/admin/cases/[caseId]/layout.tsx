import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, BookOpen, FlaskConical, History, LayoutDashboard, ListChecks, Paintbrush } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { ClientTheme } from '@/components/client-theme';
import { NAMA_PERAN } from '@/lib/constants';
import { METHODS, isMethodKey } from '@/lib/engines';
import { parseId, requireCaseAccess } from '@/lib/guards';
import { knowledgeSections } from '@/lib/spk/nav';

/** Area pengelola tidak untuk diindeks mesin pencari. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CaseLayout({ children, params }: { children: React.ReactNode; params: Promise<{ caseId: string }> }) {
  const caseId = parseId((await params).caseId);
  const { user, kasus, client } = await requireCaseAccess(caseId);
  const base = `/admin/cases/${kasus.id}`;
  const metode = isMethodKey(kasus.methodKey) ? METHODS[kasus.methodKey] : null;
  const superAdmin = user.role === 'super_admin';

  return (
    <>
      <ClientTheme warnaPrimary={client.warnaPrimary} warnaSecondary={client.warnaSecondary} warnaAccent={client.warnaAccent} />
      <AppShell
        brand={{ nama: client.namaClient, sub: 'Dashboard Admin', logoUrl: client.logoUrl, href: superAdmin ? '/super-admin/cases' : '/admin' }}
        user={{ nama: user.nama, peran: NAMA_PERAN[user.role] }}
        atas={
          <div>
            <Link
              href={superAdmin ? `/super-admin/cases/${kasus.id}` : '/admin'}
              className="mb-3 flex items-center gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              {superAdmin ? 'Pengaturan Case (Super Admin)' : 'Semua Case'}
            </Link>
            <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Case aktif</p>
              <p className="mt-0.5 text-sm leading-snug font-medium">{kasus.judul}</p>
              <p className="mt-1 text-xs text-muted-foreground">{metode ? `${metode.singkatan} · Kategori ${metode.kategori}` : kasus.methodKey}</p>
            </div>
          </div>
        }
        groups={[
          {
            items: [
              { href: base, label: 'Ringkasan', icon: <LayoutDashboard />, exact: true },
              { href: `${base}/alternatif`, label: 'Alternatif / Hasil', icon: <ListChecks /> },
            ],
          },
          {
            judul: 'Basis pengetahuan',
            items: knowledgeSections(kasus.category, kasus.methodKey).map((s) => ({
              href: `${base}/${s.segmen}`,
              label: s.label,
              icon: <BookOpen />,
            })),
          },
          {
            judul: 'Layanan',
            items: [
              { href: `${base}/tampilan`, label: 'Tampilan', icon: <Paintbrush /> },
              { href: `${base}/riwayat`, label: 'Riwayat Konsultasi', icon: <History /> },
              { href: `${base}/validasi`, label: 'Uji Validitas', icon: <FlaskConical /> },
            ],
          },
        ]}
      >
        {children}
      </AppShell>
    </>
  );
}
