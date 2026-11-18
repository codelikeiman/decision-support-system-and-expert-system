import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PairwiseEditor } from '@/components/admin/pairwise-editor';
import { PageHeader } from '@/components/page-header';
import { parseId, requireCaseAccess } from '@/lib/guards';

export const metadata: Metadata = { title: 'Perbandingan Berpasangan' };

export default async function AhpPage({ params }: { params: Promise<{ caseId: string }> }) {
  const caseId = parseId((await params).caseId);
  const { kasus, db } = await requireCaseAccess(caseId);
  if (kasus.category !== 'A' || kasus.methodKey !== 'ahp') notFound();
  const [criteria, pairwise] = await Promise.all([
    db.criteriaMcdm.findMany({ where: { caseId }, orderBy: [{ urutan: 'asc' }, { id: 'asc' }], select: { id: true, namaKriteria: true } }),
    db.ahpPairwise.findMany({ where: { caseId } }),
  ]);

  return (
    <>
      <PageHeader
        judul="Perbandingan berpasangan (AHP)"
        deskripsi="Bobot kriteria dihitung dari matriks perbandingan berpasangan. Perbandingan hanya dapat disimpan bila Consistency Ratio (CR) ≤ 0,1."
      />
      <PairwiseEditor
        caseId={caseId}
        criteria={criteria.map((c, i) => ({ id: c.id, kode: `C${i + 1}`, nama: c.namaKriteria }))}
        pairwise={Object.fromEntries(pairwise.map((p) => [`${p.criteriaIdA}:${p.criteriaIdB}`, p.nilaiPerbandingan]))}
      />
    </>
  );
}
