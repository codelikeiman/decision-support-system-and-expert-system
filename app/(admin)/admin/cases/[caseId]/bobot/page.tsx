import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Grid3x3 } from 'lucide-react';
import { WeightsEditor } from '@/components/admin/weights-editor';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { RENTANG_NILAI_PAKAR } from '@/lib/constants';
import { parseId, requireCaseAccess } from '@/lib/guards';
import { loadCaseConfig } from '@/lib/spk/config';

export const metadata: Metadata = { title: 'Bobot Gejala' };

export default async function BobotPage({ params }: { params: Promise<{ caseId: string }> }) {
  const caseId = parseId((await params).caseId);
  const { kasus, db } = await requireCaseAccess(caseId);
  if (kasus.category !== 'B') notFound();
  const config = await loadCaseConfig(db, kasus);
  const base = `/admin/cases/${caseId}`;
  const rentang = RENTANG_NILAI_PAKAR[kasus.methodKey] ?? RENTANG_NILAI_PAKAR.naive_bayes;

  return (
    <>
      <PageHeader judul="Bobot gejala" deskripsi="Matriks nilai pakar: seberapa kuat tiap gejala berkaitan dengan tiap alternatif." />
      {config.alternatives.length === 0 || config.symptoms.length === 0 ? (
        <EmptyState
          ikon={<Grid3x3 />}
          judul="Matriks belum dapat diisi"
          deskripsi="Tambahkan minimal satu alternatif dan satu gejala terlebih dahulu."
          aksi={
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href={`${base}/alternatif`}>Alternatif</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`${base}/gejala`}>Gejala</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <WeightsEditor
          caseId={caseId}
          rentang={rentang}
          alternatives={config.alternatives.map((a) => ({ id: a.id, kode: a.kode, nama: a.nama }))}
          symptoms={config.symptoms}
          weights={Object.fromEntries(config.weights.map((w) => [`${w.alternativeId}:${w.symptomId}`, w.nilai]))}
        />
      )}
    </>
  );
}
