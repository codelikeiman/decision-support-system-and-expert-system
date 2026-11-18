import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CriteriaManager } from '@/components/admin/criteria-manager';
import { PageHeader } from '@/components/page-header';
import { parseId, requireCaseAccess } from '@/lib/guards';

export const metadata: Metadata = { title: 'Kriteria & Skala' };

export default async function KriteriaPage({ params }: { params: Promise<{ caseId: string }> }) {
  const caseId = parseId((await params).caseId);
  const { kasus, db } = await requireCaseAccess(caseId);
  if (kasus.category !== 'A') notFound();
  const criteria = await db.criteriaMcdm.findMany({
    where: { caseId },
    orderBy: [{ urutan: 'asc' }, { id: 'asc' }],
    include: { scales: { orderBy: [{ urutan: 'asc' }, { nilai: 'asc' }, { id: 'asc' }] } },
  });

  return (
    <>
      <PageHeader
        judul="Kriteria & skala penilaian"
        deskripsi={
          kasus.mcdmMode === 'profil'
            ? 'Setiap kriteria memiliki bobot dan skala penilaian. Pengguna menjawab pada skala ini, dan profil acuan tiap alternatif diisi pada skala yang sama.'
            : 'Setiap kriteria memiliki tipe (benefit/cost), bobot, dan skala tingkat kepentingan yang dipilih pengguna.'
        }
      />
      <CriteriaManager
        caseId={caseId}
        mode={kasus.mcdmMode}
        ahp={kasus.methodKey === 'ahp'}
        criteria={criteria.map((c, i) => ({
          id: c.id,
          kode: `C${i + 1}`,
          namaKriteria: c.namaKriteria,
          pertanyaan: c.pertanyaan ?? '',
          tipe: c.tipe,
          bobot: c.bobot,
          scales: c.scales.map((s) => ({ label: s.label, nilai: s.nilai })),
        }))}
      />
    </>
  );
}
