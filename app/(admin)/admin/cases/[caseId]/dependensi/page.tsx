import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DependenciesManager } from '@/components/admin/dependencies-manager';
import { PageHeader } from '@/components/page-header';
import { parseId, requireCaseAccess } from '@/lib/guards';
import { loadCaseConfig } from '@/lib/spk/config';

export const metadata: Metadata = { title: 'Dependensi Gejala' };

export default async function DependensiPage({ params }: { params: Promise<{ caseId: string }> }) {
  const caseId = parseId((await params).caseId);
  const { kasus, db } = await requireCaseAccess(caseId);
  if (kasus.methodKey !== 'bayesian_network') notFound();
  const config = await loadCaseConfig(db, kasus);

  return (
    <>
      <PageHeader
        judul="Dependensi antar-gejala"
        deskripsi="Khusus Bayesian Network: nyatakan gejala yang dapat dipicu oleh gejala lain. Hubungan tidak boleh membentuk siklus."
      />
      <DependenciesManager
        caseId={caseId}
        symptoms={config.symptoms}
        deps={config.dependencies.map((d) => ({ id: d.id, childId: d.childId, parentId: d.parentId, probabilitas: d.probabilitas }))}
      />
    </>
  );
}
