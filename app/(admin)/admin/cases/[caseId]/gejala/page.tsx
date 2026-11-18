import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SymptomsManager } from '@/components/admin/symptoms-manager';
import { PageHeader } from '@/components/page-header';
import { parseId, requireCaseAccess } from '@/lib/guards';

export const metadata: Metadata = { title: 'Gejala' };

export default async function GejalaPage({ params }: { params: Promise<{ caseId: string }> }) {
  const caseId = parseId((await params).caseId);
  const { kasus, db } = await requireCaseAccess(caseId);
  if (kasus.category !== 'B' && kasus.category !== 'D') notFound();
  const symptoms = await db.symptom.findMany({
    where: { caseId },
    orderBy: [{ urutan: 'asc' }, { id: 'asc' }],
    include: { _count: { select: { weights: true, ruleConditions: true } } },
  });

  return (
    <>
      <PageHeader
        judul="Gejala"
        deskripsi="Daftar gejala yang ditampilkan kepada pengguna sebagai daftar centang. Daftar ini dipakai bersama oleh metode probabilistik (Kategori B) dan rule-based (Kategori D)."
      />
      <SymptomsManager
        caseId={caseId}
        satuanRelasi={kasus.category === 'B' ? 'alternatif' : 'kondisi aturan'}
        symptoms={symptoms.map((s) => ({
          id: s.id,
          kodeGejala: s.kodeGejala,
          namaGejala: s.namaGejala,
          dipakai: kasus.category === 'B' ? s._count.weights : s._count.ruleConditions,
        }))}
      />
    </>
  );
}
