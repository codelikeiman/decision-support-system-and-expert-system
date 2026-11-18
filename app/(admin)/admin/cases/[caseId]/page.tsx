import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CircleAlert, CircleCheck, ExternalLink, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CATEGORY_INFO, METHODS, isMethodKey } from '@/lib/engines';
import { parseId, requireCaseAccess } from '@/lib/guards';
import { loadCaseConfig } from '@/lib/spk/config';
import { knowledgeSections } from '@/lib/spk/nav';
import { checkReadiness } from '@/lib/spk/readiness';
import { angka, tanggalWaktu } from '@/lib/utils';

export const metadata: Metadata = { title: 'Ringkasan Case' };

const NAMA_BAGIAN: Record<string, string> = {
  alternatif: 'Alternatif / Hasil',
  kriteria: 'Kriteria & Skala',
  matriks: 'Nilai Alternatif',
  ahp: 'Perbandingan Berpasangan',
  gejala: 'Gejala',
  bobot: 'Bobot Gejala',
  dependensi: 'Dependensi Gejala',
  'fuzzy-variabel': 'Variabel & Himpunan',
  'fuzzy-rule': 'Basis Aturan',
  rule: 'Basis Aturan',
};

export default async function CaseOverviewPage({ params }: { params: Promise<{ caseId: string }> }) {
  const caseId = parseId((await params).caseId);
  const { kasus, client, db } = await requireCaseAccess(caseId);
  const base = `/admin/cases/${kasus.id}`;
  const metode = isMethodKey(kasus.methodKey) ? METHODS[kasus.methodKey] : null;

  const tujuhHari = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [config, total, minggu, terakhir, uji] = await Promise.all([
    loadCaseConfig(db, kasus),
    db.consultation.count({ where: { caseId } }),
    db.consultation.count({ where: { caseId, createdAt: { gte: tujuhHari } } }),
    db.consultation.findFirst({ where: { caseId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    db.validationTest.count({ where: { caseId } }),
  ]);
  const kesiapan = checkReadiness(config);
  const galat = kesiapan.issues.filter((i) => i.level === 'error');
  const peringatan = kesiapan.issues.filter((i) => i.level === 'warning');
  const urlPublik = `/c/${client.slug}/${kasus.slug}`;

  const isi: { label: string; nilai: number }[] = [{ label: 'Alternatif', nilai: config.alternatives.length }];
  if (kasus.category === 'A') isi.push({ label: 'Kriteria', nilai: config.criteria.length });
  if (kasus.category === 'B' || kasus.category === 'D') isi.push({ label: 'Gejala', nilai: config.symptoms.length });
  if (kasus.category === 'C') {
    isi.push({ label: 'Variabel fuzzy', nilai: config.variables.length }, { label: 'Aturan fuzzy', nilai: config.fuzzyRules.length });
  }
  if (kasus.category === 'D') isi.push({ label: 'Aturan', nilai: config.chainRules.length });

  return (
    <>
      <PageHeader
        judul={kasus.judul}
        deskripsi={metode ? `${metode.nama} (${metode.singkatan}) — Kategori ${metode.kategori}: ${CATEGORY_INFO[metode.kategori].nama}` : undefined}
        aksi={
          <Button asChild variant="outline">
            <Link href={urlPublik} target="_blank">
              <ExternalLink /> Buka halaman publik
            </Link>
          </Button>
        }
      />

      {kesiapan.siap ? (
        <Alert variant="success" className="mb-6">
          <CircleCheck />
          <AlertTitle>Basis pengetahuan siap dipakai</AlertTitle>
          <AlertDescription>
            <p>
              {kasus.isActive
                ? 'Layanan dapat diakses pengguna melalui halaman publik.'
                : 'Case masih nonaktif — minta Super Admin mengaktifkannya agar dapat diakses publik.'}
            </p>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive" className="mb-6">
          <CircleAlert />
          <AlertTitle>Basis pengetahuan belum lengkap</AlertTitle>
          <AlertDescription>
            <p>Layanan belum dapat dipakai pengguna sampai {galat.length} hal berikut dilengkapi.</p>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Daftar periksa kesiapan</CardTitle>
              <CardDescription>Diperiksa otomatis dari isi basis pengetahuan saat ini.</CardDescription>
            </CardHeader>
            <CardContent>
              {kesiapan.issues.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-emerald-700">
                  <CircleCheck className="size-4" /> Tidak ada catatan. Semua bagian lengkap.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {[...galat, ...peringatan].map((i, idx) => (
                    <li key={idx} className="flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm">
                      {i.level === 'error' ? (
                        <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Wajib dilengkapi" />
                      ) : (
                        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-label="Peringatan" />
                      )}
                      <span className="min-w-0 flex-1">{i.pesan}</span>
                      <Link href={`${base}/${i.bagian}`} className="shrink-0 text-xs font-medium whitespace-nowrap text-primary hover:underline">
                        {NAMA_BAGIAN[i.bagian] ?? 'Buka'} →
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Langkah pengisian</CardTitle>
              <CardDescription>Urutan yang disarankan untuk metode {metode?.singkatan ?? kasus.methodKey}.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-2">
                {[
                  { segmen: 'alternatif', label: 'Alternatif / Hasil', deskripsi: 'Daftar hasil diagnosis beserta penjelasan dan saran tindakan.' },
                  ...knowledgeSections(kasus.category, kasus.methodKey),
                  { segmen: 'tampilan', label: 'Tampilan', deskripsi: 'Judul, deskripsi, instruksi, dan gambar ilustrasi untuk pengguna.' },
                  { segmen: 'validasi', label: 'Uji Validitas', deskripsi: 'Bandingkan hasil sistem dengan diagnosis pakar.' },
                ].map((s, i) => (
                  <li key={s.segmen}>
                    <Link href={`${base}/${s.segmen}`} className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{s.label}</span>
                        <span className="block text-xs text-muted-foreground">{s.deskripsi}</span>
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Status layanan</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex flex-wrap gap-2">
                {kasus.isActive ? <Badge variant="success">Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>}
                {kasus.requiresLogin ? <Badge variant="info">Wajib login</Badge> : <Badge variant="outline">Publik tanpa akun</Badge>}
                {kasus.category === 'A' ? (
                  <Badge variant="secondary">Mode {kasus.mcdmMode === 'profil' ? 'kesesuaian profil' : 'preferensi'}</Badge>
                ) : null}
              </div>
              <div>
                <p className="text-muted-foreground">Alamat publik</p>
                <p className="font-mono text-xs break-all">{urlPublik}</p>
              </div>
              <p className="text-xs text-muted-foreground">Metode, slug, status aktif, dan kewajiban login diatur oleh Super Admin.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Statistik</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {isi.map((x) => (
                  <div key={x.label}>
                    <dt className="text-muted-foreground">{x.label}</dt>
                    <dd className="text-xl font-semibold tabular-nums">{x.nilai}</dd>
                  </div>
                ))}
                <div>
                  <dt className="text-muted-foreground">Konsultasi</dt>
                  <dd className="text-xl font-semibold tabular-nums">{angka(total)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">7 hari terakhir</dt>
                  <dd className="text-xl font-semibold tabular-nums">{angka(minggu)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Dataset uji</dt>
                  <dd className="text-xl font-semibold tabular-nums">{uji}</dd>
                </div>
              </dl>
              <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                Konsultasi terakhir: {terakhir ? tanggalWaktu(terakhir.createdAt) : 'belum ada'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
