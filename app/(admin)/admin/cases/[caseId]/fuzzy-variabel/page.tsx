import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FuzzyVariablesManager } from '@/components/admin/fuzzy-variables-manager';
import { PageHeader } from '@/components/page-header';
import { parseId, requireCaseAccess } from '@/lib/guards';
import { loadCaseConfig } from '@/lib/spk/config';

export const metadata: Metadata = { title: 'Variabel & Himpunan Fuzzy' };

export default async function FuzzyVariabelPage({ params }: { params: Promise<{ caseId: string }> }) {
  const caseId = parseId((await params).caseId);
  const { kasus, db } = await requireCaseAccess(caseId);
  if (kasus.category !== 'C') notFound();
  const config = await loadCaseConfig(db, kasus);

  return (
    <>
      <PageHeader
        judul="Variabel & himpunan fuzzy"
        deskripsi="Definisikan variabel input yang diisi pengguna dan variabel output hasil inferensi, lengkap dengan himpunan fuzzy dan fungsi keanggotaannya."
      />
      <FuzzyVariablesManager
        caseId={caseId}
        tsukamoto={kasus.methodKey === 'fuzzy_tsukamoto'}
        variables={config.variables.map((v) => ({
          id: v.id,
          namaVariabel: v.nama,
          tipe: v.tipe,
          satuan: v.satuan ?? '',
          nilaiMin: v.min,
          nilaiMax: v.max,
          sets: v.sets.map((s) => ({ id: s.id, namaHimpunan: s.nama, fungsiKeanggotaan: s.fungsi, params: s.params })),
        }))}
      />
    </>
  );
}
