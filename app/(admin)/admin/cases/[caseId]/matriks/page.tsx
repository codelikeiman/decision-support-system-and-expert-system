import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Grid3x3 } from 'lucide-react';
import { MatrixEditor } from '@/components/admin/matrix-editor';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { parseId, requireCaseAccess } from '@/lib/guards';
import { loadCaseConfig } from '@/lib/spk/config';

export const metadata: Metadata = { title: 'Nilai Alternatif' };

export default async function MatriksPage({ params }: { params: Promise<{ caseId: string }> }) {
  const caseId = parseId((await params).caseId);
  const { kasus, db } = await requireCaseAccess(caseId);
  if (kasus.category !== 'A') notFound();
  const config = await loadCaseConfig(db, kasus);
  const base = `/admin/cases/${caseId}`;

  return (
    <>
      <PageHeader
        judul="Nilai alternatif"
        deskripsi={
          kasus.mcdmMode === 'profil'
            ? 'Isi profil acuan setiap alternatif: jawaban yang paling menggambarkan alternatif tersebut pada tiap kriteria. Jawaban pengguna dibandingkan dengan profil ini.'
            : 'Isi nilai (rating/atribut) setiap alternatif pada tiap kriteria. Nilai ini menjadi matriks keputusan.'
        }
      />
      {config.alternatives.length === 0 || config.criteria.length === 0 ? (
        <EmptyState
          ikon={<Grid3x3 />}
          judul="Matriks belum dapat diisi"
          deskripsi="Tambahkan minimal satu alternatif dan satu kriteria terlebih dahulu."
          aksi={
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href={`${base}/alternatif`}>Alternatif</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`${base}/kriteria`}>Kriteria</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <MatrixEditor
          caseId={caseId}
          mode={kasus.mcdmMode}
          alternatives={config.alternatives.map((a) => ({ id: a.id, kode: a.kode, nama: a.nama }))}
          criteria={config.criteria.map((c) => ({ id: c.id, kode: c.kode, nama: c.nama, tipe: c.tipe, scales: c.scales.map((s) => ({ label: s.label, nilai: s.nilai })) }))}
          values={config.values}
        />
      )}
    </>
  );
}
