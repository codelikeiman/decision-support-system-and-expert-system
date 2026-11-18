import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { ConfirmButton } from '@/components/confirm-button';
import { PageHeader } from '@/components/page-header';
import { ResultView } from '@/components/result-view';
import { Button } from '@/components/ui/button';
import { deleteConsultation } from '@/lib/actions/case-common';
import { parseId, requireCaseAccess } from '@/lib/guards';
import { getSettings } from '@/lib/settings';
import { stepsFromRows } from '@/lib/spk/consultation';

export const metadata: Metadata = { title: 'Detail Konsultasi' };

export default async function RiwayatDetailPage({ params }: { params: Promise<{ caseId: string; kode: string }> }) {
  const p = await params;
  const caseId = parseId(p.caseId);
  const { db } = await requireCaseAccess(caseId);
  const [konsultasi, settings] = await Promise.all([
    db.consultation.findFirst({
      where: { kode: p.kode, caseId },
      include: { steps: { orderBy: { langkahKe: 'asc' } }, user: { select: { nama: true, email: true } } },
    }),
    getSettings(),
  ]);
  if (!konsultasi) notFound();
  const base = `/admin/cases/${caseId}/riwayat`;

  return (
    <>
      <PageHeader
        judul="Detail konsultasi"
        deskripsi={konsultasi.user ? `Akun: ${konsultasi.user.nama} (${konsultasi.user.email})` : 'Konsultasi tanpa akun'}
        crumbs={[{ label: 'Riwayat konsultasi', href: base }, { label: konsultasi.kode }]}
        aksi={
          <ConfirmButton
            action={deleteConsultation.bind(null, caseId, konsultasi.kode)}
            judul="Hapus riwayat konsultasi ini?"
            deskripsi="Hasil dan seluruh langkah perhitungannya akan dihapus permanen."
            redirectTo={base}
          >
            <Button variant="outline">
              <Trash2 className="text-destructive" /> Hapus
            </Button>
          </ConfirmButton>
        }
      />
      <ResultView
        konsultasi={{ ...konsultasi, namaResponden: konsultasi.namaResponden ?? konsultasi.user?.nama ?? null }}
        steps={stepsFromRows(konsultasi.steps)}
        digits={settings.presisiDesimal}
        disclaimer={settings.teksDisclaimer}
        langkahTampil
      />
    </>
  );
}
