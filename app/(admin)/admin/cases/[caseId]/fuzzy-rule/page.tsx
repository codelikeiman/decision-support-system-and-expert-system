import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FuzzyRulesManager } from '@/components/admin/fuzzy-rules-manager';
import { PageHeader } from '@/components/page-header';
import { parseId, requireCaseAccess } from '@/lib/guards';
import { loadCaseConfig } from '@/lib/spk/config';

export const metadata: Metadata = { title: 'Basis Aturan Fuzzy' };

export default async function FuzzyRulePage({ params }: { params: Promise<{ caseId: string }> }) {
  const caseId = parseId((await params).caseId);
  const { kasus, db } = await requireCaseAccess(caseId);
  if (kasus.category !== 'C') notFound();
  const config = await loadCaseConfig(db, kasus);

  return (
    <>
      <PageHeader
        judul="Basis aturan fuzzy"
        deskripsi="Aturan JIKA–MAKA yang menghubungkan himpunan variabel input dengan himpunan variabel output. Setiap aturan dikaitkan dengan alternatif hasil."
      />
      <FuzzyRulesManager
        caseId={caseId}
        variables={config.variables.map((v) => ({ id: v.id, nama: v.nama, tipe: v.tipe, sets: v.sets.map((s) => ({ id: s.id, nama: s.nama })) }))}
        alternatives={config.alternatives.map((a) => ({ id: a.id, kode: a.kode, nama: a.nama }))}
        rules={config.fuzzyRules.map((r) => ({ id: r.id, alternativeId: r.alternativeId, operator: r.operator, kondisi: r.anteseden, konsekuen: r.konsekuen }))}
      />
    </>
  );
}
