import type { Metadata } from 'next';
import { AlternativesManager } from '@/components/admin/alternatives-manager';
import { PageHeader } from '@/components/page-header';
import { parseId, requireCaseAccess } from '@/lib/guards';
import { awalanKode } from '@/lib/spk/config';

export const metadata: Metadata = { title: 'Alternatif' };

export default async function AlternatifPage({ params }: { params: Promise<{ caseId: string }> }) {
  const caseId = parseId((await params).caseId);
  const { kasus, db } = await requireCaseAccess(caseId);
  const items = await db.alternative.findMany({ where: { caseId }, orderBy: [{ urutan: 'asc' }, { id: 'asc' }] });
  const awalan = awalanKode(kasus.category);

  return (
    <>
      <PageHeader
        judul="Alternatif / hasil diagnosis"
        deskripsi="Daftar hasil yang mungkin dikeluarkan sistem. Deskripsi dan saran tindakan ditampilkan kepada pengguna pada halaman hasil dan laporan PDF."
      />
      <AlternativesManager
        caseId={caseId}
        pakaiPrior={kasus.methodKey === 'naive_bayes' || kasus.methodKey === 'bayesian_network'}
        items={items.map((a, i) => ({
          id: a.id,
          kode: `${awalan}${i + 1}`,
          namaAlternatif: a.namaAlternatif,
          deskripsiHasil: a.deskripsiHasil ?? '',
          saranTindakan: a.saranTindakan ?? '',
          prior: a.prior,
        }))}
      />
    </>
  );
}
