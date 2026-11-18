/**
 * Gaya tampilan rincian perhitungan. Satu sumber untuk halaman web (disisipkan
 * lewat <style>) dan dokumen PDF. Semua selektor berada di bawah `.calc-report`.
 */
export const REPORT_CSS = `
.calc-report { --calc-brand: var(--brand-primary, #0f766e); --calc-border: #e2e8f0; --calc-muted: #64748b; --calc-soft: #f8fafc; color: #0f172a; font-size: 14px; line-height: 1.55; }
.calc-report .calc-step { border: 1px solid var(--calc-border); border-radius: 10px; background: #fff; margin: 0 0 12px; overflow: hidden; }
.calc-report details.calc-step > summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 12px; padding: 12px 16px; font-weight: 600; user-select: none; }
.calc-report details.calc-step > summary::-webkit-details-marker { display: none; }
.calc-report details.calc-step > summary::after { content: ''; margin-left: auto; width: 8px; height: 8px; border-right: 2px solid var(--calc-muted); border-bottom: 2px solid var(--calc-muted); transform: rotate(45deg); transition: transform .15s ease; flex: none; }
.calc-report details.calc-step[open] > summary::after { transform: rotate(-135deg); }
.calc-report details.calc-step[open] > summary { border-bottom: 1px solid var(--calc-border); background: var(--calc-soft); }
.calc-report details.calc-step > summary:focus-visible { outline: 2px solid var(--calc-brand); outline-offset: -2px; }
.calc-report .calc-step-head { display: flex; align-items: center; gap: 12px; padding: 10px 16px; margin: 0; font-size: 14px; font-weight: 600; border-bottom: 1px solid var(--calc-border); background: var(--calc-soft); }
.calc-report .calc-step-no { flex: none; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #fff; background: var(--calc-brand); border-radius: 999px; padding: 3px 10px; }
.calc-report .calc-step-title { min-width: 0; }
.calc-report .calc-step-body { padding: 14px 16px 4px; }
.calc-report .calc-desc, .calc-report .calc-text { margin: 0 0 12px; color: #334155; }
.calc-report .calc-formulas { background: var(--calc-soft); border: 1px dashed #cbd5e1; border-radius: 8px; padding: 6px 12px; margin: 0 0 14px; overflow-x: auto; }
.calc-report .calc-formula { padding: 6px 0; overflow-x: auto; overflow-y: hidden; }
.calc-report .calc-formula .katex-display { margin: 0; }
.calc-report .calc-worked { border-left: 3px solid var(--calc-brand); padding: 2px 0 2px 12px; margin: 0 0 14px; }
.calc-report .calc-block-title { margin: 0 0 6px; font-weight: 600; font-size: 13px; color: #0f172a; }
.calc-report .calc-table-block { margin: 0 0 14px; }
.calc-report .calc-table-wrap { overflow-x: auto; border: 1px solid var(--calc-border); border-radius: 8px; }
.calc-report .calc-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.calc-report .calc-table th { text-align: left; font-weight: 600; background: #f1f5f9; color: #334155; padding: 7px 10px; border-bottom: 1px solid var(--calc-border); white-space: nowrap; }
.calc-report .calc-table td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
.calc-report .calc-table tbody tr:last-child td { border-bottom: 0; }
.calc-report .calc-table td.num, .calc-report .calc-table th.num { text-align: right; white-space: nowrap; }
.calc-report .calc-table td:first-child, .calc-report .calc-table th:first-child { text-align: left; }
.calc-report .calc-table tr.is-highlight td { background: color-mix(in srgb, var(--calc-brand) 10%, #fff); font-weight: 600; }
.calc-report .calc-table .calc-empty { text-align: center !important; color: var(--calc-muted); font-style: italic; }
.calc-report .calc-note { margin: 6px 0 0; font-size: 12.5px; color: var(--calc-muted); }
.calc-report .calc-list { margin: 0 0 12px; padding-left: 20px; }
.calc-report .katex { font-size: 1.05em; }
`;
