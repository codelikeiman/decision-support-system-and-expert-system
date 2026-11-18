import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChainRulesManager } from '@/components/admin/chain-rules-manager';
import { PageHeader } from '@/components/page-header';
import { parseId, requireCaseAccess } from '@/lib/guards';
import { loadCaseConfig } from '@/lib/spk/config';

export const metadata: Metadata = { title: 'Basis Aturan' };

export default async function RulePage({ params }: { params: Promise<{ caseId: string }> }) {
  const caseId = parseId((await params).caseId);
  const { kasus, db } = await requireCaseAccess(caseId);
  if (kasus.category !== 'D') notFound();
  const config = await loadCaseConfig(db, kasus);

  return (
    <>
      <PageHeader
        judul="Basis aturan (Forward Chaining)"
        deskripsi="Aturan JIKA gejala … MAKA alternatif. Mesin inferensi menjalankan aturan yang seluruh premisnya terpenuhi oleh gejala pengguna."
      />
      <ChainRulesManager
        caseId={caseId}
        symptoms={config.symptoms}
        alternatives={config.alternatives.map((a) => ({ id: a.id, kode: a.kode, nama: a.nama }))}
        rules={config.chainRules.map((r) => ({ id: r.id, namaRule: r.nama, alternativeId: r.alternativeId, conditions: r.conditions }))}
      />
    </>
  );
}
