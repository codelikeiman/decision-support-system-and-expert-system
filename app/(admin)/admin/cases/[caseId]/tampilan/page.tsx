import type { Metadata } from 'next';
import { TampilanForm } from '@/components/admin/tampilan-form';
import { PageHeader } from '@/components/page-header';
import { parseId, requireCaseAccess } from '@/lib/guards';

export const metadata: Metadata = { title: 'Tampilan' };

export default async function TampilanPage({ params }: { params: Promise<{ caseId: string }> }) {
  const caseId = parseId((await params).caseId);
  const { kasus } = await requireCaseAccess(caseId);
  return (
    <>
      <PageHeader judul="Tampilan" deskripsi="Atur judul, deskripsi, instruksi, dan gambar ilustrasi yang dilihat pengguna. Warna dan logo mengikuti tema client." />
      <TampilanForm
        caseId={caseId}
        clientId={kasus.clientId}
        defaultValues={{ judul: kasus.judul, deskripsi: kasus.deskripsi ?? '', instruksi: kasus.instruksi ?? '', gambarUrl: kasus.gambarUrl }}
      />
    </>
  );
}
