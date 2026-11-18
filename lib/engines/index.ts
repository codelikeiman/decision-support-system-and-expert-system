import { ahp } from './ahp';
import { bayesianNetwork } from './bayesian-network';
import { certaintyFactor } from './certainty-factor';
import { dempsterShafer } from './dempster-shafer';
import { edas } from './edas';
import { forwardChaining } from './forward-chaining';
import { fuzzyMamdani } from './fuzzy-mamdani';
import { fuzzyTsukamoto } from './fuzzy-tsukamoto';
import { mabac } from './mabac';
import { moora } from './moora';
import { naiveBayes } from './naive-bayes';
import { saw } from './saw';
import { topsis } from './topsis';
import { waspas } from './waspas';
import { wp } from './wp';
import type { Category, ChainingInput, EngineResult, FuzzyInput, McdmInput, MethodKey, ProbInput } from './types';

export * from './types';

export interface MethodInfo {
  key: MethodKey;
  nama: string;
  singkatan: string;
  kategori: Category;
  deskripsi: string;
  referensi: string;
}

export const CATEGORY_INFO: Record<Category, { nama: string; deskripsi: string; masukan: string; keluaran: string }> = {
  A: {
    nama: 'MCDM / Scoring-Ranking',
    deskripsi: 'Multi-Criteria Decision Making: kriteria berbobot dan matriks nilai alternatif.',
    masukan: 'Kriteria + bobot + matriks nilai alternatif',
    keluaran: 'Peringkat skor alternatif',
  },
  B: {
    nama: 'Probabilistik / Evidence-Based',
    deskripsi: 'Gejala dengan nilai keyakinan atau probabilitas terhadap tiap penyakit.',
    masukan: 'Gejala + nilai keyakinan per gejala-penyakit',
    keluaran: 'Nilai kepercayaan/probabilitas per alternatif',
  },
  C: {
    nama: 'Fuzzy Logic',
    deskripsi: 'Variabel linguistik, fungsi keanggotaan dan basis aturan fuzzy.',
    masukan: 'Himpunan fuzzy + rule base',
    keluaran: 'Nilai crisp hasil defuzzifikasi',
  },
  D: {
    nama: 'Rule-Based Expert System',
    deskripsi: 'Basis pengetahuan berupa aturan IF–THEN dengan mesin inferensi.',
    masukan: 'Aturan IF–THEN (gejala → penyakit)',
    keluaran: 'Alternatif yang aturannya terpenuhi',
  },
};

export const METHODS: Record<MethodKey, MethodInfo> = {
  saw: {
    key: 'saw',
    nama: 'Simple Additive Weighting',
    singkatan: 'SAW',
    kategori: 'A',
    deskripsi: 'Penjumlahan terbobot dari nilai kinerja ternormalisasi tiap alternatif.',
    referensi: 'Fishburn (1967); MacCrimmon (1968)',
  },
  wp: {
    key: 'wp',
    nama: 'Weighted Product',
    singkatan: 'WP',
    kategori: 'A',
    deskripsi: 'Perkalian nilai kriteria yang dipangkatkan bobotnya; tanpa normalisasi matriks.',
    referensi: 'Bridgman (1922); Yoon & Hwang (1995)',
  },
  topsis: {
    key: 'topsis',
    nama: 'Technique for Order Preference by Similarity to Ideal Solution',
    singkatan: 'TOPSIS',
    kategori: 'A',
    deskripsi: 'Alternatif terbaik paling dekat dengan solusi ideal positif dan paling jauh dari solusi ideal negatif.',
    referensi: 'Hwang & Yoon (1981)',
  },
  ahp: {
    key: 'ahp',
    nama: 'Analytical Hierarchy Process',
    singkatan: 'AHP',
    kategori: 'A',
    deskripsi: 'Bobot kriteria dari perbandingan berpasangan disertai uji Consistency Ratio.',
    referensi: 'Saaty (1980)',
  },
  moora: {
    key: 'moora',
    nama: 'Multi-Objective Optimization by Ratio Analysis',
    singkatan: 'MOORA',
    kategori: 'A',
    deskripsi: 'Rasio ternormalisasi: jumlah kriteria benefit dikurangi jumlah kriteria cost.',
    referensi: 'Brauers & Zavadskas (2006)',
  },
  mabac: {
    key: 'mabac',
    nama: 'Multi-Attributive Border Approximation area Comparison',
    singkatan: 'MABAC',
    kategori: 'A',
    deskripsi: 'Jarak tiap alternatif terhadap area perkiraan batas (rata-rata geometrik).',
    referensi: 'Pamučar & Ćirović (2015)',
  },
  edas: {
    key: 'edas',
    nama: 'Evaluation based on Distance from Average Solution',
    singkatan: 'EDAS',
    kategori: 'A',
    deskripsi: 'Jarak positif dan negatif tiap alternatif dari solusi rata-rata.',
    referensi: 'Keshavarz Ghorabaee dkk. (2015)',
  },
  waspas: {
    key: 'waspas',
    nama: 'Weighted Aggregated Sum Product Assessment',
    singkatan: 'WASPAS',
    kategori: 'A',
    deskripsi: 'Gabungan model penjumlahan terbobot (WSM) dan perkalian terbobot (WPM).',
    referensi: 'Zavadskas dkk. (2012)',
  },
  certainty_factor: {
    key: 'certainty_factor',
    nama: 'Certainty Factor',
    singkatan: 'CF',
    kategori: 'B',
    deskripsi: 'Menggabungkan tingkat keyakinan pakar dan pengguna untuk tiap gejala.',
    referensi: 'Shortliffe & Buchanan (1975)',
  },
  dempster_shafer: {
    key: 'dempster_shafer',
    nama: 'Dempster-Shafer',
    singkatan: 'DS',
    kategori: 'B',
    deskripsi: 'Kombinasi bukti (evidence) dengan fungsi kepercayaan dan aturan kombinasi Dempster.',
    referensi: 'Dempster (1967); Shafer (1976)',
  },
  naive_bayes: {
    key: 'naive_bayes',
    nama: 'Naive Bayes',
    singkatan: 'NB',
    kategori: 'B',
    deskripsi: 'Probabilitas posterior penyakit dengan asumsi antar-gejala saling bebas.',
    referensi: 'Teorema Bayes; Duda & Hart (1973)',
  },
  bayesian_network: {
    key: 'bayesian_network',
    nama: 'Bayesian Network (sederhana)',
    singkatan: 'BN',
    kategori: 'B',
    deskripsi: 'Naive Bayes yang diperluas dengan dependensi antar-gejala (model noisy-OR).',
    referensi: 'Pearl (1988)',
  },
  fuzzy_tsukamoto: {
    key: 'fuzzy_tsukamoto',
    nama: 'Fuzzy Tsukamoto',
    singkatan: 'Tsukamoto',
    kategori: 'C',
    deskripsi: 'Inferensi fuzzy dengan konsekuen monoton dan defuzzifikasi rata-rata terbobot.',
    referensi: 'Tsukamoto (1979)',
  },
  fuzzy_mamdani: {
    key: 'fuzzy_mamdani',
    nama: 'Fuzzy Mamdani',
    singkatan: 'Mamdani',
    kategori: 'C',
    deskripsi: 'Inferensi MAX–MIN dengan defuzzifikasi centroid.',
    referensi: 'Mamdani & Assilian (1975)',
  },
  forward_chaining: {
    key: 'forward_chaining',
    nama: 'Forward Chaining',
    singkatan: 'FC',
    kategori: 'D',
    deskripsi: 'Penalaran maju dari gejala menuju kesimpulan melalui aturan IF–THEN.',
    referensi: 'Giarratano & Riley (2005)',
  },
};

export const METHOD_LIST: MethodInfo[] = Object.values(METHODS);

export function isMethodKey(value: unknown): value is MethodKey {
  return typeof value === 'string' && value in METHODS;
}

export function categoryOf(key: MethodKey): Category {
  return METHODS[key].kategori;
}

const MCDM_ENGINES = { saw, wp, topsis, ahp, moora, mabac, edas, waspas } as const;
const PROB_ENGINES = {
  certainty_factor: certaintyFactor,
  dempster_shafer: dempsterShafer,
  naive_bayes: naiveBayes,
  bayesian_network: bayesianNetwork,
} as const;
const FUZZY_ENGINES = { fuzzy_tsukamoto: fuzzyTsukamoto, fuzzy_mamdani: fuzzyMamdani } as const;

export type EngineInput =
  | { kategori: 'A'; data: McdmInput }
  | { kategori: 'B'; data: ProbInput }
  | { kategori: 'C'; data: FuzzyInput }
  | { kategori: 'D'; data: ChainingInput };

/** Jalankan engine sesuai kunci metode. Input harus cocok dengan kategori metodenya. */
export function runEngine(key: MethodKey, input: EngineInput): EngineResult {
  const kategori = categoryOf(key);
  if (input.kategori !== kategori) {
    throw new Error(`Input kategori ${input.kategori} tidak cocok dengan metode ${key} (kategori ${kategori}).`);
  }
  switch (input.kategori) {
    case 'A':
      return MCDM_ENGINES[key as keyof typeof MCDM_ENGINES](input.data);
    case 'B':
      return PROB_ENGINES[key as keyof typeof PROB_ENGINES](input.data);
    case 'C':
      return FUZZY_ENGINES[key as keyof typeof FUZZY_ENGINES](input.data);
    case 'D':
      return forwardChaining(input.data);
  }
}

export {
  saw,
  wp,
  topsis,
  ahp,
  moora,
  mabac,
  edas,
  waspas,
  certaintyFactor,
  dempsterShafer,
  naiveBayes,
  bayesianNetwork,
  fuzzyTsukamoto,
  fuzzyMamdani,
  forwardChaining,
};
