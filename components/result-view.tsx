import { CircleAlert, ClipboardList, Info, Lightbulb, Trophy } from 'lucide-react';
import { CalcSteps } from '@/components/calc-steps';
import { PdfButton } from '@/components/pdf-button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CalcStep } from '@/lib/engines';
import { kecilAwal } from '@/lib/engines/utils';
import { formatAngka, formatSkor } from '@/lib/format';
import { renderSteps } from '@/lib/report/render';
import { REPORT_CSS } from '@/lib/report/styles';
import { bacaHasil, bacaRingkasanInput } from '@/lib/spk/consultation';
import { cn, tanggalWaktu } from '@/lib/utils';

interface Props {
  konsultasi: {
    kode: string;
    createdAt: Date;
    namaResponden: string | null;
    inputDataJson: unknown;
    hasilJson: unknown;
  };
  steps: CalcStep[];
  digits: number;
  disclaimer: string;
  /** rincian perhitungan langsung tampil (dashboard admin) */
  langkahTampil?: boolean;
}

/** Tampilan hasil konsultasi — dipakai halaman publik dan riwayat di dashboard admin. */
export function ResultView({ konsultasi, steps, digits, disclaimer, langkahTampil = false }: Props) {
  const stored = bacaHasil(konsultasi.hasilJson);
  const input = bacaRingkasanInput(konsultasi.inputDataJson);
  const { hasil, ranking, meta, metode } = stored;
  const rekom = hasil.alternativeId !== null ? stored.rekomendasi[String(hasil.alternativeId)] : undefined;
  const maks = Math.max(0, ...ranking.map((r) => r.skor));
  const html = renderSteps(steps, { digits, collapsible: true, open: false });

  return (
    <div className="grid gap-6">
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />

      <section aria-labelledby="judul-hasil" className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        <div className="border-b bg-brand-secondary px-5 py-3 text-brand-secondary-foreground sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
            <span className="font-mono">{konsultasi.kode}</span>
            <span className="opacity-90">{tanggalWaktu(konsultasi.createdAt)}</span>
          </div>
        </div>
        <div className="px-5 py-6 sm:px-6">
          <p id="judul-hasil" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Hasil{konsultasi.namaResponden ? ` untuk ${konsultasi.namaResponden}` : ''}
          </p>
          <p className={cn('mt-1 text-2xl font-semibold text-balance sm:text-3xl', hasil.nama ? 'text-primary' : 'text-muted-foreground')}>
            {hasil.nama ?? 'Hasil tidak dapat ditentukan'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {hasil.skor !== null ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-accent px-3 py-1 text-sm font-semibold text-brand-accent-foreground">
                <Trophy className="size-3.5" aria-hidden />
                {meta.skorLabel}: {formatSkor(hasil.skor, meta.skorFormat, digits)}
              </span>
            ) : null}
            {metode.singkatan ? (
              <Badge variant="outline" title={metode.nama}>
                Metode {metode.singkatan}
              </Badge>
            ) : null}
          </div>
          {hasil.ringkasan ? <p className="mt-4 max-w-3xl text-sm text-slate-700">{hasil.ringkasan}</p> : null}
          <div className="no-print mt-5">
            <PdfButton kode={konsultasi.kode} />
          </div>
        </div>
      </section>

      {(meta.peringatan ?? []).map((p) => (
        <Alert key={p} variant="warning">
          <CircleAlert />
          <AlertDescription>{p}</AlertDescription>
        </Alert>
      ))}

      {rekom?.deskripsi || rekom?.saran ? (
        <div className="grid gap-4 md:grid-cols-2">
          {rekom.deskripsi ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="size-4 text-primary" aria-hidden /> Penjelasan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line text-slate-700">{rekom.deskripsi}</p>
              </CardContent>
            </Card>
          ) : null}
          {rekom.saran ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="size-4 text-primary" aria-hidden /> Rekomendasi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line text-slate-700">{rekom.saran}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Peringkat alternatif</CardTitle>
          <CardDescription>Seluruh alternatif diurutkan menurut {kecilAwal(meta.skorLabel)}.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2.5">
            {ranking.map((r) => {
              const utama = r.alternativeId === hasil.alternativeId;
              const lebar = maks > 0 && r.skor > 0 ? Math.max(2, (r.skor / maks) * 100) : 0;
              return (
                <li key={r.alternativeId} className={cn('rounded-lg border px-3 py-2.5', utama && 'border-primary bg-primary/5')}>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                        utama ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}
                      aria-label={`Peringkat ${r.peringkat}`}
                    >
                      {r.peringkat}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="min-w-0 text-sm font-medium">
                          <span className="mr-1.5 font-mono text-xs text-muted-foreground">{r.kode}</span>
                          {r.nama}
                        </p>
                        <p className="text-sm font-semibold tabular-nums">{formatSkor(r.skor, meta.skorFormat, digits)}</p>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div className={cn('h-full rounded-full', utama ? 'bg-primary' : 'bg-slate-400')} style={{ width: `${lebar}%` }} />
                      </div>
                      {r.keterangan ? <p className="mt-1 text-xs text-muted-foreground">{r.keterangan}</p> : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          {(meta.info ?? []).length > 0 ? (
            <dl className="mt-4 grid gap-x-6 gap-y-1 border-t pt-4 text-sm sm:grid-cols-2">
              {(meta.info ?? []).map((i) => (
                <div key={i.label} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{i.label}</dt>
                  <dd className="font-medium">{i.nilai}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" aria-hidden /> Input yang dimasukkan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 text-left">
                  {input.kolom.map((k) => (
                    <th key={k} className="px-3 py-2 font-semibold">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {input.baris.map((row, i) => (
                  <tr key={i} className="border-t">
                    {row.map((c, j) => (
                      <td key={j} className={cn('px-3 py-2', typeof c === 'number' && 'tabular-nums')}>
                        {typeof c === 'number' ? formatAngka(c, digits) : c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="judul-langkah">
        <h2 id="judul-langkah" className="text-lg font-semibold">
          Rincian perhitungan
        </h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          Setiap tahap perhitungan metode {metode.singkatan || 'ini'} dicatat lengkap dengan rumusnya sehingga hasil dapat diperiksa ulang secara manual.
        </p>
        <CalcSteps html={html} jumlah={steps.length} awalTampil={langkahTampil} />
      </section>

      {disclaimer ? <p className="border-t pt-4 text-xs text-muted-foreground">{disclaimer}</p> : null}
    </div>
  );
}
