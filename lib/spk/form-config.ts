import type { CaseConfig } from './config';
import type { ConsultationInput } from './input';

/**
 * Bagian konfigurasi yang dibutuhkan form konsultasi. Hanya memuat hal yang
 * memang tampil ke pengguna — bobot, nilai pakar, dan aturan TIDAK ikut dikirim
 * ke browser.
 */
export type FormConfig =
  | {
      kategori: 'A';
      mode: 'profil' | 'preferensi';
      criteria: { id: number; kode: string; nama: string; pertanyaan: string | null; scales: { label: string; nilai: number }[] }[];
    }
  | { kategori: 'B'; pakaiKeyakinan: boolean; symptoms: { id: number; kode: string; nama: string }[] }
  | { kategori: 'C'; variables: { id: number; nama: string; satuan: string | null; min: number; max: number }[] }
  | { kategori: 'D'; symptoms: { id: number; kode: string; nama: string }[] };

export function toFormConfig(config: CaseConfig): FormConfig {
  switch (config.category) {
    case 'A':
      return {
        kategori: 'A',
        mode: config.mcdmMode,
        criteria: config.criteria.map((c) => ({
          id: c.id,
          kode: c.kode,
          nama: c.nama,
          pertanyaan: c.pertanyaan,
          scales: c.scales.map((s) => ({ label: s.label, nilai: s.nilai })),
        })),
      };
    case 'B':
      return { kategori: 'B', pakaiKeyakinan: config.methodKey === 'certainty_factor', symptoms: config.symptoms };
    case 'C':
      return {
        kategori: 'C',
        variables: config.variables
          .filter((v) => v.tipe === 'input')
          .map((v) => ({ id: v.id, nama: v.nama, satuan: v.satuan ?? null, min: v.min, max: v.max })),
      };
    case 'D':
      return { kategori: 'D', symptoms: config.symptoms };
  }
}

export function inputKosong(form: FormConfig): ConsultationInput {
  switch (form.kategori) {
    case 'A':
      return { kategori: 'A', jawaban: {} };
    case 'B':
      return { kategori: 'B', gejala: [] };
    case 'C':
      return { kategori: 'C', nilai: {} };
    case 'D':
      return { kategori: 'D', gejala: [] };
  }
}
