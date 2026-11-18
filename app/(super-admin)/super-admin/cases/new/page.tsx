import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { CaseForm } from '@/components/super-admin/case-form';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/guards';

export const metadata: Metadata = { title: 'Buat Case' };

export default async function NewCasePage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  await requireSuperAdmin();
  const { clientId } = await searchParams;
  const clients = await prisma.client.findMany({ orderBy: { namaClient: 'asc' }, select: { id: true, namaClient: true, slug: true } });
  if (clients.length === 0) redirect('/super-admin/clients/new');
  const terpilih = clients.find((c) => String(c.id) === clientId)?.id ?? (clients.length === 1 ? clients[0].id : 0);

  return (
    <>
      <PageHeader
        judul="Buat SPK Case"
        deskripsi="Pilih client dan metode. Form basis pengetahuan dan form konsultasi dibuat otomatis sesuai kategori metode."
        crumbs={[{ label: 'SPK Case', href: '/super-admin/cases' }, { label: 'Buat' }]}
      />
      <CaseForm
        id={null}
        clients={clients}
        defaultValues={{
          clientId: terpilih,
          judul: '',
          slug: '',
          deskripsi: '',
          methodKey: 'saw',
          mcdmMode: 'profil',
          requiresLogin: false,
          isActive: true,
        }}
      />
    </>
  );
}
