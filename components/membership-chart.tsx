import type { MembershipFn } from '@/lib/engines';

export interface ChartSet {
  nama: string;
  fungsi: MembershipFn;
  params: number[];
}

/** Palet kategorikal dengan kontras cukup di atas latar putih. */
export const WARNA_HIMPUNAN = ['#2563eb', '#d97706', '#059669', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#475569'];

function titik(set: ChartSet, min: number, max: number): [number, number][] {
  const p = set.params;
  switch (set.fungsi) {
    case 'linear_naik':
      return [[min, 0], [p[0], 0], [p[1], 1], [max, 1]];
    case 'linear_turun':
      return [[min, 1], [p[0], 1], [p[1], 0], [max, 0]];
    case 'segitiga':
      return [[min, 0], [p[0], 0], [p[1], 1], [p[2], 0], [max, 0]];
    case 'trapesium':
      return [[min, 0], [p[0], 0], [p[1], 1], [p[2], 1], [p[3], 0], [max, 0]];
  }
}

const ringkas = (n: number) => String(Number(n.toFixed(3)));

/** Grafik fungsi keanggotaan sebuah variabel fuzzy (SVG, tanpa pustaka tambahan). */
export function MembershipChart({ min, max, sets, satuan, tinggi = 190 }: { min: number; max: number; sets: ChartSet[]; satuan?: string | null; tinggi?: number }) {
  const W = 640;
  const H = tinggi;
  const pad = { l: 36, r: 14, t: 16, b: 28 };
  const sah = Number.isFinite(min) && Number.isFinite(max) && max > min;
  const x = (v: number) => pad.l + ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * (W - pad.l - pad.r);
  const y = (m: number) => pad.t + (1 - m) * (H - pad.t - pad.b);

  if (!sah) {
    return <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Batas semesta pembicaraan belum valid.</p>;
  }

  const valid = sets.filter((s) => s.params.length >= 2 && s.params.every((p) => Number.isFinite(p)));
  // tanda sumbu-x: batas semesta + parameter himpunan, dijarangkan agar tidak bertumpuk
  const kandidat = [...new Set([min, max, ...valid.flatMap((s) => s.params)])].sort((a, b) => a - b);
  const tanda: number[] = [];
  for (const k of kandidat) {
    if (tanda.length === 0 || x(k) - x(tanda[tanda.length - 1]) >= 44) tanda.push(k);
  }
  if (tanda[tanda.length - 1] !== max) {
    if (x(max) - x(tanda[tanda.length - 1]) < 44) tanda.pop();
    tanda.push(max);
  }

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Grafik fungsi keanggotaan: ${valid.map((s) => s.nama).join(', ') || 'belum ada himpunan'}`}
      >
        {[0, 0.5, 1].map((m) => (
          <g key={m}>
            <line x1={pad.l} x2={W - pad.r} y1={y(m)} y2={y(m)} stroke="#e2e8f0" strokeWidth={1} strokeDasharray={m === 0 ? undefined : '3 4'} />
            <text x={pad.l - 6} y={y(m) + 4} textAnchor="end" fontSize={12.5} fill="#64748b">
              {m}
            </text>
          </g>
        ))}
        {tanda.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(0) + 4} stroke="#94a3b8" strokeWidth={1} />
            <text x={x(t)} y={H - 8} textAnchor="middle" fontSize={12.5} fill="#64748b">
              {ringkas(t)}
            </text>
          </g>
        ))}
        {valid.map((s, i) => {
          const warna = WARNA_HIMPUNAN[i % WARNA_HIMPUNAN.length];
          const pts = titik(s, min, max);
          const puncak = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
          const tengah = pts.filter((p) => p[1] === 1);
          const xLabel = tengah.length > 0 ? (x(tengah[0][0]) + x(tengah[tengah.length - 1][0])) / 2 : x(puncak[0]);
          return (
            <g key={`${s.nama}-${i}`}>
              <polygon points={pts.map(([px, py]) => `${x(px)},${y(py)}`).join(' ') + ` ${x(max)},${y(0)} ${x(min)},${y(0)}`} fill={warna} opacity={0.08} />
              <polyline points={pts.map(([px, py]) => `${x(px)},${y(py)}`).join(' ')} fill="none" stroke={warna} strokeWidth={2.25} strokeLinejoin="round" />
              <text x={Math.min(W - pad.r - 4, Math.max(pad.l + 4, xLabel))} y={pad.t - 2} textAnchor="middle" fontSize={12.5} fontWeight={600} fill={warna}>
                {s.nama.length > 14 ? `${s.nama.slice(0, 13)}…` : s.nama}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {valid.map((s, i) => (
          <span key={`${s.nama}-${i}`} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: WARNA_HIMPUNAN[i % WARNA_HIMPUNAN.length] }} />
            {s.nama} [{s.params.map(ringkas).join('; ')}]
          </span>
        ))}
        {satuan ? <span className="ml-auto">Satuan: {satuan}</span> : null}
      </figcaption>
    </figure>
  );
}
