import type { Cell, EngineResult, ProbInput } from './types';
import { altLabel } from './mcdm-common';
import { gejalaLabel, prepareProb, resolvePriors } from './prob-common';
import { buildRanking, fmt, ltx, safe, sum } from './utils';

/**
 * Naive Bayes.
 *   P(H_i | E) = P(H_i) Π_k P(e_k | H_i) / Σ_j P(H_j) Π_k P(e_k | H_j)
 * Perkalian dilakukan atas gejala yang dipilih pengguna (asumsi antar-gejala
 * saling bebas bila penyakit diketahui).
 */
export function naiveBayes(input: ProbInput): EngineResult {
  const ctx = prepareProb(input, 'Naive Bayes', { min: 0, max: 1, namaNilai: 'nilai P(gejala|alternatif)' });
  const { alts, dipilih, steps } = ctx;

  const { prior, seragam } = resolvePriors(alts);
  steps.push({
    judul: 'Probabilitas prior',
    deskripsi: seragam
      ? 'Prior tidak diisi lengkap oleh pakar sehingga setiap alternatif diberi peluang awal yang sama.'
      : 'Prior dari pakar dinormalisasi sehingga jumlahnya sama dengan 1.',
    rumus: [seragam ? 'P(H_i) = \\dfrac{1}{m}' : 'P(H_i) = \\dfrac{prior_i}{\\sum_{k=1}^{m} prior_k}'],
    detail: [
      {
        type: 'table',
        kolom: ['Alternatif', '$P(H_i)$'],
        baris: alts.map((a, i) => [altLabel(a), prior[i]]),
      },
    ],
  });

  const L = dipilih.map((d) => alts.map((a) => ctx.nilai(a.id, d.gejala.id) ?? 0));
  steps.push({
    judul: 'Probabilitas gejala terhadap tiap alternatif (likelihood)',
    deskripsi: 'Nilai $P(e_k \\mid H_i)$ diambil dari basis pengetahuan; pasangan yang tidak diisi bernilai 0.',
    detail: [
      {
        type: 'table',
        kolom: ['Gejala', ...alts.map((a) => a.kode)],
        baris: dipilih.map((d, k): Cell[] => [gejalaLabel(d.gejala), ...L[k]]),
      },
    ],
  });

  const likelihood = alts.map((_, i) => L.reduce((acc, row) => acc * row[i], 1));
  const joint = likelihood.map((l, i) => prior[i] * l);
  const total = sum(joint);
  const posterior = joint.map((j) => (total === 0 ? 0 : j / total));
  const best = posterior.indexOf(Math.max(...posterior));

  steps.push({
    judul: 'Perkalian prior dengan likelihood',
    rumus: ['P(E \\mid H_i) = \\prod_{k} P(e_k \\mid H_i)', 'P(H_i) \\, P(E \\mid H_i)'],
    detail: [
      {
        type: 'table',
        kolom: ['Alternatif', '$P(H_i)$', '$P(E \\mid H_i)$', '$P(H_i)\\,P(E \\mid H_i)$'],
        baris: [...alts.map((a, i): Cell[] => [altLabel(a), prior[i], likelihood[i], joint[i]]), ['Jumlah', null, null, total]],
      },
      {
        type: 'formula',
        judul: `Contoh perhitungan ${alts[best].kode}`,
        latex: `P(H_{${best + 1}}) \\, P(E \\mid H_{${best + 1}}) = ${ltx(prior[best])} \\times ${L.map((row) => ltx(row[best])).join(' \\times ')} = ${ltx(joint[best], 6)}`,
      },
    ],
  });

  steps.push({
    judul: 'Probabilitas posterior',
    deskripsi: 'Hasil perkalian dinormalisasi sehingga jumlah probabilitas seluruh alternatif sama dengan 1.',
    rumus: ['P(H_i \\mid E) = \\dfrac{P(H_i) \\, P(E \\mid H_i)}{\\sum_{j=1}^{m} P(H_j) \\, P(E \\mid H_j)}'],
    detail: [
      {
        type: 'table',
        kolom: ['Alternatif', '$P(H_i \\mid E)$', 'Persentase'],
        baris: alts.map((a, i) => [altLabel(a), posterior[i], `${fmt(posterior[i] * 100, 2)}%`]),
        catatan:
          total === 0
            ? 'Semua hasil perkalian bernilai 0: tidak ada alternatif yang memiliki seluruh gejala terpilih.'
            : undefined,
      },
    ],
  });

  const ranking = buildRanking(alts, posterior);
  steps.push({
    judul: 'Peringkat akhir',
    detail: [
      {
        type: 'table',
        kolom: ['Peringkat', 'Alternatif', '$P(H_i \\mid E)$', 'Persentase'],
        baris: ranking.map((r) => [r.peringkat, `${r.kode} — ${safe(r.nama)}`, r.skor, `${fmt(r.skor * 100, 2)}%`]),
        sorot: total > 0 ? [0] : [],
      },
    ],
  });

  const top = ranking[0];
  const adaHasil = total > 0 && top !== undefined;
  return {
    hasil: adaHasil
      ? {
          alternativeId: top.alternativeId,
          nama: top.nama,
          skor: top.skor,
          ringkasan: `Alternatif dengan probabilitas posterior tertinggi adalah ${top.nama} (${fmt(top.skor * 100, 2)}%).`,
        }
      : {
          alternativeId: null,
          nama: null,
          skor: null,
          ringkasan: 'Tidak ada alternatif yang cocok dengan seluruh gejala yang dipilih (semua probabilitas bernilai 0).',
        },
    ranking,
    steps,
    meta: { skorLabel: 'Probabilitas posterior', skorFormat: 'persen' },
  };
}
