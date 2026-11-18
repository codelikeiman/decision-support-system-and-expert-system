import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { ClientForm } from '@/components/super-admin/client-form';
import { requireSuperAdmin } from '@/lib/guards';

export const metadata: Metadata = { title: 'Tambah client' };

export default async function NewClientPage() {
  await requireSuperAdmin();
  return (
    <>
      <PageHeader judul="Tambah client" crumbs={[{ label: 'Client', href: '/super-admin/clients' }, { label: 'Tambah' }]} />
      <ClientForm
        id={null}
        defaultValues={{
          namaClient: '',
          slug: '',
          deskripsi: '',
          logoUrl: null,
          warnaPrimary: '#0f766e',
          warnaSecondary: '#134e4a',
          warnaAccent: '#f59e0b',
        }}
      />
    </>
  );
}
