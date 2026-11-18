import katex from 'katex';
import type { CalcStep, Cell, StepBlock } from '@/lib/engines';

/**
 * Perender langkah perhitungan → HTML. Dipakai BERSAMA oleh halaman hasil
 * (web) dan dokumen laporan PDF, sehingga keduanya selalu identik.
 *
 * Keamanan: seluruh teks di-escape; rumus dirender KaTeX dengan `trust: false`.
 */

export function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderMath(latex: string, display: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode: display,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      output: 'htmlAndMathml',
    });
  } catch {
    return `<code>${esc(latex)}</code>`;
  }
}

/**
 * Teks dengan matematika inline `$...$` dan penekanan `**...**`.
 * `\$` dan `\\` di luar rumus adalah karakter literal (lihat `safe()` di engine).
 */
export function renderInline(text: string): string {
  // Pisahkan menjadi ruas teks dan ruas rumus.
  const ruas: { math: boolean; isi: string }[] = [];
  let buf = '';
  let dalamMath = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!dalamMath && ch === '\\' && (text[i + 1] === '$' || text[i + 1] === '\\')) {
      buf += text[i + 1];
      i += 1;
      continue;
    }
    if (ch === '$') {
      if (dalamMath) {
        ruas.push({ math: true, isi: buf });
        buf = '';
        dalamMath = false;
      } else {
        // hanya buka rumus bila ada penutupnya
        const tutup = text.indexOf('$', i + 1);
        if (tutup === -1) {
          buf += ch;
          continue;
        }
        if (buf) ruas.push({ math: false, isi: buf });
        buf = '';
        dalamMath = true;
      }
      continue;
    }
    buf += ch;
  }
  if (buf) ruas.push({ math: dalamMath, isi: buf });

  return ruas
    .map((r) => {
      if (r.math) return renderMath(r.isi, false);
      return esc(r.isi).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    })
    .join('');
}

export function formatAngka(n: number, digits: number): string {
  if (!Number.isFinite(n)) return '–';
  const r = Number(n.toFixed(digits));
  return (Object.is(r, -0) ? 0 : r).toString();
}

function renderCell(cell: Cell, digits: number): string {
  if (cell === null || cell === undefined) return '<td></td>';
  if (typeof cell === 'number') return `<td class="num">${esc(formatAngka(cell, digits))}</td>`;
  return `<td>${renderInline(cell)}</td>`;
}

export function renderBlock(block: StepBlock, digits: number): string {
  switch (block.type) {
    case 'text':
      return `<p class="calc-text">${renderInline(block.teks)}</p>`;
    case 'list':
      return (
        (block.judul ? `<p class="calc-block-title">${renderInline(block.judul)}</p>` : '') +
        `<ul class="calc-list">${block.item.map((it) => `<li>${renderInline(it)}</li>`).join('')}</ul>`
      );
    case 'formula':
      return (
        `<div class="calc-worked">` +
        (block.judul ? `<p class="calc-block-title">${renderInline(block.judul)}</p>` : '') +
        `<div class="calc-formula">${renderMath(block.latex, true)}</div></div>`
      );
    case 'table': {
      const sorot = new Set(block.sorot ?? []);
      // kolom dianggap numerik bila semua sel terisinya berupa angka (kolom pertama selalu rata kiri)
      const numerik = block.kolom.map(
        (_, j) => j > 0 && block.baris.some((row) => typeof row[j] === 'number') && block.baris.every((row) => row[j] === null || row[j] === undefined || typeof row[j] === 'number'),
      );
      const kepala = `<thead><tr>${block.kolom.map((k, j) => `<th${numerik[j] ? ' class="num"' : ''}>${renderInline(k)}</th>`).join('')}</tr></thead>`;
      const badan =
        block.baris.length === 0
          ? `<tbody><tr><td colspan="${block.kolom.length}" class="calc-empty">Tidak ada data</td></tr></tbody>`
          : `<tbody>${block.baris
              .map((row, i) => `<tr${sorot.has(i) ? ' class="is-highlight"' : ''}>${row.map((c) => renderCell(c, digits)).join('')}</tr>`)
              .join('')}</tbody>`;
      return (
        `<div class="calc-table-block">` +
        (block.judul ? `<p class="calc-block-title">${renderInline(block.judul)}</p>` : '') +
        `<div class="calc-table-wrap"><table class="calc-table">${kepala}${badan}</table></div>` +
        (block.catatan ? `<p class="calc-note">${renderInline(block.catatan)}</p>` : '') +
        `</div>`
      );
    }
  }
}

export interface RenderStepsOptions {
  /** jumlah angka desimal */
  digits: number;
  /** true = pakai <details> yang bisa dibuka-tutup (web); false = <section> (PDF) */
  collapsible: boolean;
  /** langkah langsung terbuka */
  open?: boolean;
}

export function renderStep(step: CalcStep, nomor: number, opts: RenderStepsOptions): string {
  const isi =
    (step.deskripsi ? `<p class="calc-desc">${renderInline(step.deskripsi)}</p>` : '') +
    (step.rumus && step.rumus.length > 0
      ? `<div class="calc-formulas">${step.rumus.map((r) => `<div class="calc-formula">${renderMath(r, true)}</div>`).join('')}</div>`
      : '') +
    step.detail.map((b) => renderBlock(b, opts.digits)).join('');
  const kepala = `<span class="calc-step-no">Langkah ${nomor}</span><span class="calc-step-title">${renderInline(step.judul)}</span>`;
  if (opts.collapsible) {
    return `<details class="calc-step"${opts.open ? ' open' : ''}><summary>${kepala}</summary><div class="calc-step-body">${isi}</div></details>`;
  }
  return `<section class="calc-step"><h3 class="calc-step-head">${kepala}</h3><div class="calc-step-body">${isi}</div></section>`;
}

export function renderSteps(steps: CalcStep[], opts: RenderStepsOptions): string {
  return steps.map((s, i) => renderStep(s, i + 1, opts)).join('');
}
