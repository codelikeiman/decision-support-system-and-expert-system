/** Pilihan tingkat keyakinan pengguna untuk metode Certainty Factor. */
export const KEYAKINAN_CF = [
  { nilai: 1, label: 'Sangat yakin' },
  { nilai: 0.8, label: 'Yakin' },
  { nilai: 0.6, label: 'Cukup yakin' },
  { nilai: 0.4, label: 'Sedikit yakin' },
  { nilai: 0.2, label: 'Tidak tahu' },
] as const;

/** Skala perbandingan berpasangan Saaty (1–9). */
export const SKALA_SAATY = [
  { nilai: 1, label: 'Sama penting' },
  { nilai: 2, label: 'Antara sama dan sedikit lebih penting' },
  { nilai: 3, label: 'Sedikit lebih penting' },
  { nilai: 4, label: 'Antara sedikit dan jelas lebih penting' },
  { nilai: 5, label: 'Jelas lebih penting' },
  { nilai: 6, label: 'Antara jelas dan sangat jelas lebih penting' },
  { nilai: 7, label: 'Sangat jelas lebih penting' },
  { nilai: 8, label: 'Antara sangat jelas dan mutlak lebih penting' },
  { nilai: 9, label: 'Mutlak lebih penting' },
] as const;

/** Rentang nilai pakar yang sah per metode Kategori B. */
export const RENTANG_NILAI_PAKAR: Record<string, { min: number; max: number; label: string; bantuan: string }> = {
  certainty_factor: {
    min: -1,
    max: 1,
    label: 'CF pakar',
    bantuan: 'Nilai −1 (pasti tidak) sampai 1 (pasti). Kosongkan bila gejala tidak berkaitan dengan alternatif.',
  },
  dempster_shafer: {
    min: 0,
    max: 1,
    label: 'Densitas (belief)',
    bantuan:
      'Nilai 0 sampai 1. Isi nilai yang sama pada semua alternatif yang didukung gejala tersebut; kosongkan bila tidak berkaitan.',
  },
  naive_bayes: {
    min: 0,
    max: 1,
    label: 'P(gejala | alternatif)',
    bantuan: 'Peluang gejala muncul bila alternatif tersebut benar (0 sampai 1). Kosong dianggap 0 (mustahil).',
  },
  bayesian_network: {
    min: 0,
    max: 1,
    label: 'P(gejala | alternatif)',
    bantuan: 'Peluang gejala muncul bila alternatif tersebut benar (0 sampai 1). Kosong dianggap 0.',
  },
};

export const NAMA_PERAN: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  end_user: 'End-User',
};

export const COOKIE_SESI_PUBLIK = 'spk_sid';
