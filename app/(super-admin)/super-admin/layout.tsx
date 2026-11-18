import type { Metadata } from 'next';
import { Building2, FolderKanban, LayoutDashboard, Settings, Users } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { requireSuperAdmin } from '@/lib/guards';
import { getSettings } from '@/lib/settings';

/** Area pengelola tidak untuk diindeks mesin pencari. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [user, settings] = await Promise.all([requireSuperAdmin(), getSettings()]);
  return (
    <AppShell
      brand={{ nama: settings.namaPlatform, sub: 'Super Admin', href: '/super-admin' }}
      user={{ nama: user.nama, peran: 'Super Admin' }}
      groups={[
        {
          items: [
            { href: '/super-admin', label: 'Dasbor', icon: <LayoutDashboard />, exact: true },
            { href: '/super-admin/clients', label: 'Client', icon: <Building2 /> },
            { href: '/super-admin/cases', label: 'SPK Case', icon: <FolderKanban /> },
            { href: '/super-admin/users', label: 'Pengguna', icon: <Users /> },
            { href: '/super-admin/settings', label: 'Pengaturan', icon: <Settings /> },
          ],
        },
      ]}
    >
      {children}
    </AppShell>
  );
}
