import { EngineError, type AltRef, type CalcStep, type ProbInput, type SymptomRef } from './types';
import { safe } from './utils';

export interface ProbContext {
  alts: (AltRef & { prior?: number | null })[];
  /** gejala terpilih, mengikuti urutan daftar gejala */
  dipilih: { gejala: SymptomRef; keyakinan: number }[];
  /** nilai pakar: get(alternativeId, symptomId) */
  nilai: (alternativeId: number, symptomId: number) => number | undefined;
  steps: CalcStep[];
}

export function gejalaLabel(g: SymptomRef): string {
  return `${safe(g.kode)} — ${safe(g.nama)}`;
}

export function prepareProb(
  input: ProbInput,
  namaMetode: string,
  opts: { min: number; max: number; namaNilai: string; pakaiKeyakinan?: boolean },
): ProbContext {
  if (input.alternatives.length === 0) throw new EngineError(`Metode ${namaMetode}: belum ada alternatif.`);
  if (input.symptoms.length === 0) throw new EngineError(`Metode ${namaMetode}: belum ada gejala.`);
  if (input.selected.length === 0) throw new EngineError('Pilih minimal satu gejala yang dialami.');

  const altIds = new Set(input.alternatives.map((a) => a.id));
  const symIds = new Set(input.symptoms.map((s) => s.id));
  const peta = new Map<string, number>();
  for (const wgt of input.weights) {
    if (!altIds.has(wgt.alternativeId) || !symIds.has(wgt.symptomId)) continue;
    if (!Number.isFinite(wgt.nilai) || wgt.nilai < opts.min || wgt.nilai > opts.max) {
      throw new EngineError(
        `Metode ${namaMetode}: ${opts.namaNilai} harus berada pada rentang ${opts.min} sampai ${opts.max}.`,
      );
    }
    peta.set(`${wgt.alternativeId}:${wgt.symptomId}`, wgt.nilai);
  }

  const keyakinan = new Map<number, number>();
  for (const s of input.selected) {
    if (!symIds.has(s.symptomId)) throw new EngineError('Terdapat gejala terpilih yang tidak dikenal pada kasus ini.');
    const k = s.keyakinan ?? 1;
    if (!Number.isFinite(k) || k < 0 || k > 1) {
      throw new EngineError('Tingkat keyakinan pengguna harus berada pada rentang 0 sampai 1.');
    }
    keyakinan.set(s.symptomId, k);
  }
  const dipilih = input.symptoms
    .filter((g) => keyakinan.has(g.id))
    .map((g) => ({ gejala: g, keyakinan: keyakinan.get(g.id) as number }));

  const steps: CalcStep[] = [
    {
      judul: 'Gejala yang dipilih pengguna',
      deskripsi: `Pengguna memilih ${dipilih.length} dari ${input.symptoms.length} gejala yang tersedia.`,
      detail: [
        {
          type: 'table',
          kolom: opts.pakaiKeyakinan ? ['No', 'Kode', 'Gejala', 'Keyakinan pengguna'] : ['No', 'Kode', 'Gejala'],
          baris: dipilih.map((d, i) =>
            opts.pakaiKeyakinan
              ? [i + 1, safe(d.gejala.kode), safe(d.gejala.nama), d.keyakinan]
              : [i + 1, safe(d.gejala.kode), safe(d.gejala.nama)],
          ),
        },
      ],
    },
  ];

  return {
    alts: input.alternatives,
    dipilih,
    nilai: (a, s) => peta.get(`${a}:${s}`),
    steps,
  };
}

/** Prior ternormalisasi; seragam bila ada prior yang kosong/tidak valid. */
export function resolvePriors(alts: (AltRef & { prior?: number | null })[]): { prior: number[]; seragam: boolean } {
  const valid = alts.every((a) => typeof a.prior === 'number' && Number.isFinite(a.prior) && a.prior > 0);
  if (!valid) return { prior: alts.map(() => 1 / alts.length), seragam: true };
  const total = alts.reduce((acc, a) => acc + (a.prior as number), 0);
  return { prior: alts.map((a) => (a.prior as number) / total), seragam: false };
}
