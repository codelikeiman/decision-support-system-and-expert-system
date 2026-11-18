import { EngineError, type Cell, type EngineResult, type ProbInput, type SymptomDependency } from './types';
import { altLabel } from './mcdm-common';
import { gejalaLabel, prepareProb, resolvePriors } from './prob-common';
import { buildRanking, fmt, ltx, safe, sum } from './utils';

/** Periksa bahwa relasi induk→anak antar-gejala tidak membentuk siklus (harus DAG). */
export function findDependencyCycle(deps: Pick<SymptomDependency, 'childId' | 'parentId'>[]): number[] | null {
  const anak = new Map<number, number[]>();
  for (const d of deps) {
    if (!anak.has(d.parentId)) anak.set(d.parentId, []);
    (anak.get(d.parentId) as number[]).push(d.childId);
  }
  const status = new Map<number, 1 | 2>(); // 1 = sedang dikunjungi, 2 = selesai
  const jalur: number[] = [];
  const kunjungi = (node: number): number[] | null => {
    status.set(node, 1);
    jalur.push(node);
    for (const next of anak.get(node) ?? []) {
      if (status.get(next) === 1) return [...jalur.slice(jalur.indexOf(next)), next];
      if (!status.has(next)) {
        const siklus = kunjungi(next);
        if (siklus) return siklus;
      }
    }
    jalur.pop();
    status.set(node, 2);
    return null;
  };
  for (const node of anak.keys()) {
    if (!status.has(node)) {
      const siklus = kunjungi(node);
      if (siklus) return siklus;
    }
  }
  return null;
}

/**
 * Bayesian Network sederhana: Naive Bayes yang diperluas dengan dependensi
 * antar-gejala. Tiap gejala punya induk "penyakit" dan boleh punya induk berupa
 * gejala lain; tabel probabilitas bersyaratnya dibentuk dengan model noisy-OR
 * (Pearl, 1988):
 *   P(e_k | H_i, induk) = 1 − (1 − P(e_k|H_i)) · Π_{p ∈ induk terpilih} (1 − P(e_k|e_p))
 *   P(H_i | E) ∝ P(H_i) · Π_k P(e_k | H_i, induk)
 * Tanpa dependensi, hasilnya identik dengan Naive Bayes.
 */
export function bayesianNetwork(input: ProbInput): EngineResult {
  const ctx = prepareProb(input, 'Bayesian Network', { min: 0, max: 1, namaNilai: 'nilai P(gejala|alternatif)' });
  const { alts, dipilih, steps } = ctx;
  const symById = new Map(input.symptoms.map((s) => [s.id, s]));

  const deps = (input.dependencies ?? []).filter((d) => symById.has(d.childId) && symById.has(d.parentId));
  for (const d of deps) {
    if (d.childId === d.parentId) throw new EngineError('Bayesian Network: sebuah gejala tidak boleh bergantung pada dirinya sendiri.');
    if (!Number.isFinite(d.probabilitas) || d.probabilitas < 0 || d.probabilitas > 1) {
      throw new EngineError('Bayesian Network: probabilitas dependensi harus berada pada rentang 0 sampai 1.');
    }
  }
  const siklus = findDependencyCycle(deps);
  if (siklus) {
    throw new EngineError(
      `Bayesian Network: dependensi antar-gejala membentuk siklus (${siklus.map((id) => symById.get(id)?.kode ?? id).join(' → ')}).`,
    );
  }

  const { prior, seragam } = resolvePriors(alts);
  steps.push({
    judul: 'Probabilitas prior',
    deskripsi: seragam
      ? 'Prior tidak diisi lengkap oleh pakar sehingga setiap alternatif diberi peluang awal yang sama.'
      : 'Prior dari pakar dinormalisasi sehingga jumlahnya sama dengan 1.',
    rumus: [seragam ? 'P(H_i) = \\dfrac{1}{m}' : 'P(H_i) = \\dfrac{prior_i}{\\sum_{k=1}^{m} prior_k}'],
    detail: [{ type: 'table', kolom: ['Alternatif', '$P(H_i)$'], baris: alts.map((a, i) => [altLabel(a), prior[i]]) }],
  });

  const terpilih = new Set(dipilih.map((d) => d.gejala.id));
  const indukAktif = dipilih.map((d) => deps.filter((dep) => dep.childId === d.gejala.id && terpilih.has(dep.parentId)));
  const relevan = deps.filter((dep) => terpilih.has(dep.childId));

  steps.push({
    judul: 'Struktur dependensi antar-gejala',
    deskripsi:
      relevan.length === 0
        ? 'Tidak ada dependensi yang melibatkan gejala terpilih, sehingga perhitungan sama dengan Naive Bayes.'
        : 'Dependensi berlaku bila gejala induk juga dipilih pengguna; gejala anak yang sudah “dijelaskan” oleh induknya tidak lagi dihitung sebagai bukti yang sepenuhnya bebas.',
    detail:
      relevan.length === 0
        ? []
        : [
            {
              type: 'table',
              kolom: ['Gejala anak', 'Gejala induk', '$P(\\text{anak} \\mid \\text{induk})$', 'Induk dipilih?'],
              baris: relevan.map((dep) => [
                gejalaLabel(symById.get(dep.childId)!),
                gejalaLabel(symById.get(dep.parentId)!),
                dep.probabilitas,
                terpilih.has(dep.parentId) ? 'Ya — dependensi aktif' : 'Tidak',
              ]),
            },
          ],
  });

  const dasar = dipilih.map((d) => alts.map((a) => ctx.nilai(a.id, d.gejala.id) ?? 0));
  const sisaInduk = indukAktif.map((list) => list.reduce((acc, dep) => acc * (1 - dep.probabilitas), 1));
  const efektif = dasar.map((row, k) => row.map((p) => 1 - (1 - p) * sisaInduk[k]));

  steps.push({
    judul: 'Probabilitas bersyarat efektif tiap gejala',
    deskripsi:
      'Untuk gejala tanpa induk aktif nilainya sama dengan $P(e_k \\mid H_i)$. Untuk gejala dengan induk aktif dipakai model noisy-OR.',
    rumus: [
      'P(e_k \\mid H_i, \\text{induk}) = 1 - \\bigl(1 - P(e_k \\mid H_i)\\bigr) \\prod_{p \\,\\in\\, \\text{induk aktif}} \\bigl(1 - P(e_k \\mid e_p)\\bigr)',
    ],
    detail: [
      {
        type: 'table',
        judul: 'Nilai dasar $P(e_k \\mid H_i)$',
        kolom: ['Gejala', ...alts.map((a) => a.kode)],
        baris: dipilih.map((d, k): Cell[] => [gejalaLabel(d.gejala), ...dasar[k]]),
      },
      {
        type: 'table',
        judul: 'Nilai efektif setelah dependensi',
        kolom: ['Gejala', 'Induk aktif', '$\\prod (1 - P(e_k \\mid e_p))$', ...alts.map((a) => a.kode)],
        baris: dipilih.map((d, k): Cell[] => [
          gejalaLabel(d.gejala),
          indukAktif[k].length === 0 ? '–' : indukAktif[k].map((dep) => safe(symById.get(dep.parentId)!.kode)).join(', '),
          sisaInduk[k],
          ...efektif[k],
        ]),
      },
    ],
  });

  const likelihood = alts.map((_, i) => efektif.reduce((acc, row) => acc * row[i], 1));
  const joint = likelihood.map((l, i) => prior[i] * l);
  const total = sum(joint);
  const posterior = joint.map((j) => (total === 0 ? 0 : j / total));
  const best = posterior.indexOf(Math.max(...posterior));

  steps.push({
    judul: 'Probabilitas gabungan dan posterior',
    rumus: [
      'P(H_i, E) = P(H_i) \\prod_{k} P(e_k \\mid H_i, \\text{induk})',
      'P(H_i \\mid E) = \\dfrac{P(H_i, E)}{\\sum_{j=1}^{m} P(H_j, E)}',
    ],
    detail: [
      {
        type: 'table',
        kolom: ['Alternatif', '$P(H_i)$', '$\\prod_k P(e_k \\mid H_i, \\text{induk})$', '$P(H_i, E)$', '$P(H_i \\mid E)$'],
        baris: [
          ...alts.map((a, i): Cell[] => [altLabel(a), prior[i], likelihood[i], joint[i], posterior[i]]),
          ['Jumlah', null, null, total, sum(posterior)],
        ],
        catatan: total === 0 ? 'Semua probabilitas gabungan bernilai 0.' : undefined,
      },
      {
        type: 'formula',
        judul: `Contoh perhitungan ${alts[best].kode}`,
        latex: `P(H_{${best + 1}}, E) = ${ltx(prior[best])} \\times ${efektif.map((row) => ltx(row[best])).join(' \\times ')} = ${ltx(joint[best], 6)}`,
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
          ringkasan: 'Tidak ada alternatif yang cocok dengan gejala yang dipilih (semua probabilitas bernilai 0).',
        },
    ranking,
    steps,
    meta: {
      skorLabel: 'Probabilitas posterior',
      skorFormat: 'persen',
      info: [{ label: 'Dependensi aktif', nilai: String(indukAktif.reduce((acc, l) => acc + l.length, 0)) }],
    },
  };
}
