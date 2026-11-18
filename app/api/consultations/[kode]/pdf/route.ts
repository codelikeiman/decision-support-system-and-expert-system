import { NextResponse } from 'next/server';
import { buildReportHtml } from '@/lib/report/document';
import { htmlToPdf, PdfUnavailableError } from '@/lib/report/pdf';
import { getSettings } from '@/lib/settings';
import { bacaHasil, bacaRingkasanInput, stepsFromRows } from '@/lib/spk/consultation';
import { ambilKonsultasi } from '@/lib/spk/public';
import { berkasKeDataUri } from '@/lib/uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Laporan hasil konsultasi.
 *   GET .../pdf              → berkas PDF (dirender Puppeteer di server)
 *   GET .../pdf?format=html  → dokumen yang sama dalam bentuk HTML siap cetak
 * Hak akses sama dengan halaman hasil (lihat ambilKonsultasi).
 */
export async function GET(req: Request, ctx: { params: Promise<{ kode: string }> }) {
  const { kode } = await ctx.params;
  const data = await ambilKonsultasi(kode);
  if (!data) return NextResponse.json({ error: 'Konsultasi tidak ditemukan.' }, { status: 404 });
  const { konsultasi } = data;
  const settings = await getSettings();

  const html = await buildReportHtml({
    namaPlatform: settings.namaPlatform,
    client: {
      nama: konsultasi.client.namaClient,
      warnaPrimary: konsultasi.client.warnaPrimary,
      logoDataUri: await berkasKeDataUri(konsultasi.client.logoUrl),
    },
    kasus: { judul: konsultasi.case.judul },
    konsultasi: { kode: konsultasi.kode, createdAt: konsultasi.createdAt, namaResponden: konsultasi.namaResponden },
    input: bacaRingkasanInput(konsultasi.inputDataJson),
    stored: bacaHasil(konsultasi.hasilJson),
    steps: stepsFromRows(konsultasi.steps),
    digits: settings.presisiDesimal,
    disclaimer: settings.teksDisclaimer,
  });

  const privat = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' };

  if (new URL(req.url).searchParams.get('format') === 'html') {
    const cetak = html.replace(
      '</body>',
      '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},400)})</script></body>',
    );
    return new NextResponse(cetak, { headers: { ...privat, 'Content-Type': 'text/html; charset=utf-8' } });
  }

  try {
    const pdf = await htmlToPdf(html, `${konsultasi.client.namaClient} — ${konsultasi.kode}`);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        ...privat,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="laporan-${konsultasi.kode}.pdf"`,
      },
    });
  } catch (e) {
    if (e instanceof PdfUnavailableError) {
      console.warn('[pdf]', e.message);
      return NextResponse.json({ error: e.message }, { status: 503, headers: privat });
    }
    console.error('[pdf]', e);
    return NextResponse.json({ error: 'Gagal membuat laporan PDF.' }, { status: 500, headers: privat });
  }
}
