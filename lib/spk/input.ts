import { z } from 'zod';
import type { Cell } from '@/lib/engines';
import type { CaseConfig } from './config';

export const consultationInputSchema = z.discriminatedUnion('kategori', [
  z.object({ kategori: z.literal('A'), jawaban: z.record(z.string(), z.number()) }),
  z.object({
    kategori: z.literal('B'),
    gejala: z.array(z.object({ id: z.number().int(), keyakinan: z.number().min(0).max(1).optional() })).max(1000),
  }),
  z.object({ kategori: z.literal('C'), nilai: z.record(z.string(), z.number()) }),
  z.object({ kategori: z.literal('D'), gejala: z.array(z.number().int()).max(1000) }),
]);

export type ConsultationInput = z.infer<typeof consultationInputSchema>;

export interface InputSummary {
  kolom: string[];
  baris: Cell[][];
}

export type ValidasiInput = { ok: true; input: ConsultationInput } | { ok: false; error: string };

const sama = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** Validasi masukan end-user/data uji terhadap konfigurasi Case, lalu normalisasi. */
export function validateInput(config: CaseConfig, raw: unknown): ValidasiInput {
  const parsed = consultationInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Format data masukan tidak valid.' };
  const input = parsed.data;
  if (input.kategori !== config.category) {
    return { ok: false, error: `Data masukan dibuat untuk kategori ${input.kategori}, sedangkan metode Case saat ini berkategori ${config.category}.` };
  }

  switch (input.kategori) {
    case 'A': {
      const jawaban: Record<string, number> = {};
      for (const c of config.criteria) {
        const v = input.jawaban[String(c.id)];
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          return { ok: false, error: `Jawaban untuk kriteria "${c.nama}" belum diisi.` };
        }
        if (c.scales.length > 0 && !c.scales.some((s) => sama(s.nilai, v))) {
          return { ok: false, error: `Jawaban untuk kriteria "${c.nama}" tidak sesuai dengan skala penilaiannya.` };
        }
        jawaban[String(c.id)] = v;
      }
      return { ok: true, input: { kategori: 'A', jawaban } };
    }
    case 'B': {
      const dikenal = new Set(config.symptoms.map((s) => s.id));
      const peta = new Map<number, number | undefined>();
      for (const g of input.gejala) {
        if (!dikenal.has(g.id)) return { ok: false, error: 'Terdapat gejala yang tidak dikenal pada kasus ini.' };
        peta.set(g.id, g.keyakinan);
      }
      if (peta.size === 0) return { ok: false, error: 'Pilih minimal satu gejala yang dialami.' };
      const pakaiKeyakinan = config.methodKey === 'certainty_factor';
      return {
        ok: true,
        input: {
          kategori: 'B',
          gejala: config.symptoms
            .filter((s) => peta.has(s.id))
            .map((s) => (pakaiKeyakinan ? { id: s.id, keyakinan: peta.get(s.id) ?? 1 } : { id: s.id })),
        },
      };
    }
    case 'C': {
      const nilai: Record<string, number> = {};
      for (const v of config.variables.filter((x) => x.tipe === 'input')) {
        const x = input.nilai[String(v.id)];
        if (typeof x !== 'number' || !Number.isFinite(x)) return { ok: false, error: `Nilai "${v.nama}" belum diisi.` };
        if (x < v.min || x > v.max) {
          return { ok: false, error: `Nilai "${v.nama}" harus berada pada rentang ${v.min} sampai ${v.max}.` };
        }
        nilai[String(v.id)] = x;
      }
      return { ok: true, input: { kategori: 'C', nilai } };
    }
    case 'D': {
      const dikenal = new Set(config.symptoms.map((s) => s.id));
      const dipilih = new Set<number>();
      for (const id of input.gejala) {
        if (!dikenal.has(id)) return { ok: false, error: 'Terdapat gejala yang tidak dikenal pada kasus ini.' };
        dipilih.add(id);
      }
      if (dipilih.size === 0) return { ok: false, error: 'Pilih minimal satu gejala yang dialami.' };
      return { ok: true, input: { kategori: 'D', gejala: config.symptoms.filter((s) => dipilih.has(s.id)).map((s) => s.id) } };
    }
  }
}

/** Ringkasan masukan yang mudah dibaca (disimpan bersama input untuk keperluan audit). */
export function describeInput(config: CaseConfig, input: ConsultationInput): InputSummary {
  switch (input.kategori) {
    case 'A':
      return {
        kolom: ['Kriteria', config.mcdmMode === 'preferensi' ? 'Tingkat kepentingan' : 'Jawaban', 'Nilai'],
        baris: config.criteria.map((c) => {
          const v = input.jawaban[String(c.id)];
          const skala = c.scales.find((s) => sama(s.nilai, v));
          return [`${c.kode} — ${c.nama}`, skala?.label ?? String(v), v];
        }),
      };
    case 'B': {
      const pakaiKeyakinan = config.methodKey === 'certainty_factor';
      const peta = new Map(input.gejala.map((g) => [g.id, g.keyakinan]));
      return {
        kolom: pakaiKeyakinan ? ['Kode', 'Gejala', 'Keyakinan'] : ['Kode', 'Gejala'],
        baris: config.symptoms
          .filter((s) => peta.has(s.id))
          .map((s) => (pakaiKeyakinan ? [s.kode, s.nama, peta.get(s.id) ?? 1] : [s.kode, s.nama])),
      };
    }
    case 'C':
      return {
        kolom: ['Variabel', 'Nilai'],
        baris: config.variables
          .filter((v) => v.tipe === 'input')
          .map((v) => [v.nama, `${input.nilai[String(v.id)]}${v.satuan ? ` ${v.satuan}` : ''}`]),
      };
    case 'D': {
      const dipilih = new Set(input.gejala);
      return {
        kolom: ['Kode', 'Gejala'],
        baris: config.symptoms.filter((s) => dipilih.has(s.id)).map((s) => [s.kode, s.nama]),
      };
    }
  }
}

/** Ringkasan satu baris dari kolom `input_data_json` (untuk tabel riwayat & data uji). */
export function ringkasTersimpan(json: unknown): string {
  const j = json as { kategori?: string; ringkasan?: { baris?: Cell[][] } } | null;
  const baris = Array.isArray(j?.ringkasan?.baris) ? (j?.ringkasan?.baris as Cell[][]) : [];
  if (baris.length === 0) return '–';
  switch (j?.kategori) {
    case 'A':
      return baris.map((b) => `${String(b[0]).split(' — ')[0]}: ${b[1]}`).join(' · ');
    case 'B':
      return baris.map((b) => (b.length > 2 ? `${b[0]} (${b[2]})` : String(b[0]))).join(', ');
    case 'C':
      return baris.map((b) => `${b[0]}: ${b[1]}`).join(' · ');
    case 'D':
      return baris.map((b) => String(b[0])).join(', ');
    default:
      return baris.map((b) => b.join(' ')).join(' · ');
  }
}

/** Ambil kembali masukan murni (tanpa ringkasan) dari JSON tersimpan; null bila bentuknya tidak dikenali. */
export function inputTersimpan(json: unknown): ConsultationInput | null {
  const parsed = consultationInputSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}
