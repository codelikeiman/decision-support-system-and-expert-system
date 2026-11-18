import { runEngine, type EngineResult } from '@/lib/engines';
import type { CaseConfig } from './config';
import type { ConsultationInput } from './input';
import { buildMcdmInput } from './mcdm-prepare';

/**
 * Jalankan perhitungan satu konsultasi: konfigurasi Case + masukan pengguna →
 * `{ hasil, ranking, steps }`. Fungsi murni — dipakai oleh konsultasi end-user
 * maupun uji validitas, sehingga keduanya dijamin melewati jalur yang sama.
 */
export function computeConsultation(config: CaseConfig, input: ConsultationInput): EngineResult {
  if (input.kategori !== config.category) {
    throw new Error(`Masukan kategori ${input.kategori} tidak cocok dengan kategori Case (${config.category}).`);
  }
  const alternatives = config.alternatives.map((a) => ({ id: a.id, kode: a.kode, nama: a.nama }));

  switch (input.kategori) {
    case 'A': {
      const siap = buildMcdmInput(config, input.jawaban);
      const hasil = runEngine(config.methodKey, { kategori: 'A', data: siap.input });
      return { ...hasil, steps: [...siap.steps, ...hasil.steps] };
    }
    case 'B':
      return runEngine(config.methodKey, {
        kategori: 'B',
        data: {
          symptoms: config.symptoms,
          alternatives: config.alternatives.map((a) => ({ id: a.id, kode: a.kode, nama: a.nama, prior: a.prior })),
          weights: config.weights,
          selected: input.gejala.map((g) => ({ symptomId: g.id, keyakinan: g.keyakinan })),
          dependencies: config.dependencies,
        },
      });
    case 'C':
      return runEngine(config.methodKey, {
        kategori: 'C',
        data: {
          variables: config.variables,
          rules: config.fuzzyRules,
          alternatives,
          nilai: Object.fromEntries(Object.entries(input.nilai).map(([k, v]) => [Number(k), v])),
        },
      });
    case 'D':
      return runEngine(config.methodKey, {
        kategori: 'D',
        data: { symptoms: config.symptoms, alternatives, rules: config.chainRules, selected: input.gejala },
      });
  }
}
