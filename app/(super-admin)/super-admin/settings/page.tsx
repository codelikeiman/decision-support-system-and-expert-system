import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { SettingsForm } from '@/components/super-admin/settings-form';
import { requireSuperAdmin } from '@/lib/guards';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Pengaturan' };

export default async function SettingsPage() {
  await requireSuperAdmin();
  const settings = await getSettings();
  return (
    <>
      <PageHeader judul="Pengaturan global" deskripsi="Berlaku untuk seluruh client pada platform." />
      <SettingsForm defaultValues={settings} />
    </>
  );
}
