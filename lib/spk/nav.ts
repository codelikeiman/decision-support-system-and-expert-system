import type { Category } from '@/lib/engines';

export interface CaseSection {
  segmen: string;
  label: string;
  deskripsi: string;
}

/** Bagian basis pengetahuan yang relevan untuk kategori & metode sebuah Case. */
export function knowledgeSections(category: Category, methodKey: string): CaseSection[] {
  switch (category) {
    case 'A':
      return [
        { segmen: 'kriteria', label: 'Kriteria & Skala', deskripsi: 'Kriteria, tipe, bobot, dan skala penilaian.' },
        { segmen: 'matriks', label: 'Nilai Alternatif', deskripsi: 'Matriks nilai tiap alternatif pada tiap kriteria.' },
        ...(methodKey === 'ahp'
          ? [{ segmen: 'ahp', label: 'Perbandingan Berpasangan', deskripsi: 'Matriks perbandingan kriteria dan uji konsistensi (CR).' }]
          : []),
      ];
    case 'B':
      return [
        { segmen: 'gejala', label: 'Gejala', deskripsi: 'Daftar gejala beserta kodenya.' },
        { segmen: 'bobot', label: 'Bobot Gejala', deskripsi: 'Nilai pakar tiap gejala terhadap tiap alternatif.' },
        ...(methodKey === 'bayesian_network'
          ? [{ segmen: 'dependensi', label: 'Dependensi Gejala', deskripsi: 'Hubungan induk–anak antar-gejala.' }]
          : []),
      ];
    case 'C':
      return [
        { segmen: 'fuzzy-variabel', label: 'Variabel & Himpunan', deskripsi: 'Variabel input/output dan fungsi keanggotaannya.' },
        { segmen: 'fuzzy-rule', label: 'Basis Aturan', deskripsi: 'Aturan IF–THEN fuzzy.' },
      ];
    case 'D':
      return [
        { segmen: 'gejala', label: 'Gejala', deskripsi: 'Daftar gejala beserta kodenya.' },
        { segmen: 'rule', label: 'Basis Aturan', deskripsi: 'Aturan IF–THEN dari gejala ke alternatif.' },
      ];
  }
}

/** Apakah sebuah segmen halaman berlaku untuk Case ini. */
export function sectionApplies(category: Category, methodKey: string, segmen: string): boolean {
  return knowledgeSections(category, methodKey).some((s) => s.segmen === segmen);
}
