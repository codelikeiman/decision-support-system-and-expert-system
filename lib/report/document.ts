import type { CalcStep } from '@/lib/engines';
import { formatSkor } from '@/lib/format';
import type { StoredHasil } from '@/lib/spk/consultation';
import type { InputSummary } from '@/lib/spk/input';
import { HEX_WARNA, kontrasTeks, tanggalWaktu } from '@/lib/utils';
import { katexInlineCss } from './katex-css';
import { esc, formatAngka, renderSteps } from './render';
import { REPORT_CSS } from './styles';

export interface ReportData {
  namaPlatform: string;
  client: { nama: string; warnaPrimary: string; logoDataUri: string | null };
  kasus: { judul: string };
  konsultasi: { kode: string; createdAt: Date; namaResponden: string | null };
  input: InputSummary;
  stored: StoredHasil;
  steps: CalcStep[];
  digits: number;
  disclaimer: string;
}

const DOC_CSS = `
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'Segoe UI', 'Helvetica Neue', Arial, 'Noto Sans', 'Liberation Sans', sans-serif; color: #0f172a; font-size: 12px; line-height: 1.5; }
h1, h2, h3, p { margin: 0; }
.kop { display: flex; align-items: center; gap: 14px; padding-bottom: 12px; border-bottom: 3px solid var(--brand-primary); margin-bottom: 16px; }
.kop img { height: 52px; max-width: 140px; object-fit: contain; }
.kop .org { font-size: 17px; font-weight: 700; }
.kop .sub { color: #475569; font-size: 12px; }
.judul { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
.kecil { color: #64748b; font-size: 11px; }
h2.bagian { font-size: 13px; font-weight: 700; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; color: var(--brand-primary); text-transform: uppercase; letter-spacing: .04em; break-after: avoid; }
table.data { width: 100%; border-collapse: collapse; font-size: 12px; }
table.data th { text-align: left; background: #f1f5f9; padding: 6px 9px; border: 1px solid #e2e8f0; font-weight: 600; }
table.data td { padding: 6px 9px; border: 1px solid #e2e8f0; vertical-align: top; }
table.data td.num, table.data th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
table.data tr.top td { background: color-mix(in srgb, var(--brand-primary) 10%, #fff); font-weight: 600; }
table.identitas td:first-child { width: 32%; background: #f8fafc; font-weight: 600; }
.hasil { border: 1.5px solid var(--brand-primary); border-radius: 10px; padding: 14px 16px; background: color-mix(in srgb, var(--brand-primary) 6%, #fff); break-inside: avoid; }
.hasil .label { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #475569; }
.hasil .nama { font-size: 19px; font-weight: 700; color: var(--brand-primary); margin: 2px 0 4px; }
.hasil .skor { display: inline-block; background: var(--brand-primary); color: var(--brand-primary-foreground); border-radius: 999px; padding: 2px 10px; font-weight: 600; font-size: 11.5px; margin-bottom: 8px; }
.kotak { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-top: 10px; break-inside: avoid; }
.kotak h3 { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
.kotak p { white-space: pre-wrap; }
.peringatan { border: 1px solid #f59e0b; background: #fffbeb; border-radius: 8px; padding: 8px 12px; margin-top: 10px; color: #92400e; }
.disclaimer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 10.5px; }
tr { break-inside: avoid; }
.calc-report { font-size: 11.5px; }
.calc-report .calc-step { break-inside: auto; margin-bottom: 10px; }
.calc-report .calc-step-head { break-after: avoid; }
.calc-report .calc-table { font-size: 11px; }
.calc-report .calc-table th, .calc-report .calc-table td { padding: 4px 7px; }
.calc-report .calc-table th { white-space: normal; }
.calc-report .calc-table-wrap, .calc-report .calc-formulas, .calc-report .calc-formula { overflow: visible; }
.calc-report .calc-worked, .calc-report .calc-formulas { break-inside: avoid; }
`;

/** Bangun dokumen HTML mandiri (CSS & font tertanam) untuk dicetak ke PDF. */
export async function buildReportHtml(data: ReportData): Promise<string> {
  const { stored, digits } = data;
  const warna = HEX_WARNA.test(data.client.warnaPrimary) ? data.client.warnaPrimary : '#0f766e';
  const katexCss = await katexInlineCss();
  const format = stored.meta.skorFormat;
  const top = stored.hasil;
  const rekom = top.alternativeId !== null ? stored.rekomendasi[String(top.alternativeId)] : undefined;

  const barisIdentitas: [string, string][] = [
    ['Kode konsultasi', data.konsultasi.kode],
    ['Tanggal', tanggalWaktu(data.konsultasi.createdAt)],
    ['Kasus', data.kasus.judul],
    ['Metode', `${stored.metode.nama} (${stored.metode.singkatan})`],
  ];
  if (data.konsultasi.namaResponden) barisIdentitas.push(['Nama', data.konsultasi.namaResponden]);

  const sel = (c: string | number | null) =>
    c === null ? '<td></td>' : typeof c === 'number' ? `<td class="num">${esc(formatAngka(c, digits))}</td>` : `<td>${esc(c)}</td>`;

  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Laporan ${esc(data.konsultasi.kode)}</title>
<style>${katexCss}</style>
<style>:root { --brand-primary: ${warna}; --brand-primary-foreground: ${kontrasTeks(warna)}; }${DOC_CSS}${REPORT_CSS}</style>
</head>
<body>
<header class="kop">
  ${data.client.logoDataUri ? `<img src="${data.client.logoDataUri}" alt="">` : ''}
  <div>
    <div class="org">${esc(data.client.nama)}</div>
    <div class="sub">${esc(data.kasus.judul)}</div>
  </div>
</header>

<h1 class="judul">Laporan Hasil Konsultasi</h1>
<p class="kecil">Dibuat oleh ${esc(data.namaPlatform)} · metode ${esc(stored.metode.singkatan)}</p>

<h2 class="bagian">Identitas konsultasi</h2>
<table class="data identitas"><tbody>
${barisIdentitas.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
</tbody></table>

<h2 class="bagian">Input yang dimasukkan</h2>
<table class="data"><thead><tr>${data.input.kolom.map((k) => `<th>${esc(k)}</th>`).join('')}</tr></thead>
<tbody>${data.input.baris.map((row) => `<tr>${row.map(sel).join('')}</tr>`).join('')}</tbody></table>

<h2 class="bagian">Hasil akhir</h2>
<div class="hasil">
  <div class="label">Hasil</div>
  <div class="nama">${esc(top.nama ?? 'Tidak dapat ditentukan')}</div>
  ${top.skor !== null ? `<div class="skor">${esc(stored.meta.skorLabel)}: ${esc(formatSkor(top.skor, format, digits))}</div>` : ''}
  <p>${esc(top.ringkasan)}</p>
</div>
${(stored.meta.info ?? []).length > 0 ? `<div class="kotak"><h3>Informasi perhitungan</h3>${(stored.meta.info ?? []).map((i) => `<p>${esc(i.label)}: <strong>${esc(i.nilai)}</strong></p>`).join('')}</div>` : ''}
${(stored.meta.peringatan ?? []).map((p) => `<div class="peringatan">${esc(p)}</div>`).join('')}
${rekom?.deskripsi ? `<div class="kotak"><h3>Penjelasan</h3><p>${esc(rekom.deskripsi)}</p></div>` : ''}
${rekom?.saran ? `<div class="kotak"><h3>Rekomendasi / saran tindakan</h3><p>${esc(rekom.saran)}</p></div>` : ''}

<h2 class="bagian">Peringkat alternatif</h2>
<table class="data"><thead><tr><th class="num">Peringkat</th><th>Alternatif</th><th class="num">${esc(stored.meta.skorLabel)}</th><th>Keterangan</th></tr></thead>
<tbody>${stored.ranking
    .map(
      (r) =>
        `<tr${r.alternativeId === top.alternativeId ? ' class="top"' : ''}><td class="num">${r.peringkat}</td><td>${esc(`${r.kode} — ${r.nama}`)}</td><td class="num">${esc(formatSkor(r.skor, format, digits))}</td><td>${esc(r.keterangan ?? '')}</td></tr>`,
    )
    .join('')}</tbody></table>

<h2 class="bagian">Rincian langkah perhitungan</h2>
<div class="calc-report">${renderSteps(data.steps, { digits, collapsible: false })}</div>

<p class="disclaimer">${esc(data.disclaimer)}</p>
</body>
</html>`;
  return html;
}
