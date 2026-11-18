import { ahpWeights } from '@/lib/engines/ahp';
import { findDependencyCycle } from '@/lib/engines/bayesian-network';
import { validateSetParams } from '@/lib/engines/fuzzy-common';
import { RENTANG_NILAI_PAKAR } from '@/lib/constants';
import type { CaseConfig } from './config';
import { pairwiseMatrix } from './mcdm-prepare';

export interface ReadinessIssue {
  level: 'error' | 'warning';
  pesan: string;
  /** segmen halaman admin yang perlu dibuka untuk memperbaiki */
  bagian: 'alternatif' | 'kriteria' | 'matriks' | 'ahp' | 'gejala' | 'bobot' | 'dependensi' | 'fuzzy-variabel' | 'fuzzy-rule' | 'rule';
}

export interface Readiness {
  siap: boolean;
  issues: ReadinessIssue[];
}

/** Periksa kelengkapan basis pengetahuan sebelum Case dapat dipakai end-user. */
export function checkReadiness(config: CaseConfig): Readiness {
  const issues: ReadinessIssue[] = [];
  const galat = (bagian: ReadinessIssue['bagian'], pesan: string) => issues.push({ level: 'error', bagian, pesan });
  const peringatan = (bagian: ReadinessIssue['bagian'], pesan: string) => issues.push({ level: 'warning', bagian, pesan });

  const { alternatives: alts } = config;
  if (alts.length === 0) galat('alternatif', 'Belum ada alternatif/hasil diagnosis.');
  else if (alts.length === 1) peringatan('alternatif', 'Baru ada satu alternatif; hasil konsultasi akan selalu sama.');

  if (config.category === 'A') {
    const { criteria } = config;
    if (criteria.length === 0) galat('kriteria', 'Belum ada kriteria.');
    if (criteria.length > 0 && criteria.reduce((acc, c) => acc + c.bobot, 0) <= 0 && config.methodKey !== 'ahp') {
      galat('kriteria', 'Jumlah bobot kriteria harus lebih besar dari 0.');
    }
    for (const c of criteria) {
      if (c.scales.length < 2) galat('kriteria', `Kriteria "${c.nama}" membutuhkan minimal 2 pilihan skala penilaian.`);
      if ((config.methodKey === 'wp' || config.methodKey === 'ahp') && c.scales.some((s) => s.nilai <= 0)) {
        peringatan('kriteria', `Kriteria "${c.nama}" memiliki nilai skala ≤ 0; metode ini bekerja paling baik dengan nilai positif.`);
      }
    }
    let kosong = 0;
    let tidakPositif = 0;
    for (const a of alts) {
      for (const c of criteria) {
        const v = config.values[`${a.id}:${c.id}`];
        if (typeof v !== 'number') kosong += 1;
        else if (v <= 0 && c.tipe === 'cost' && config.mcdmMode === 'preferensi') tidakPositif += 1;
      }
    }
    if (kosong > 0) galat('matriks', `${kosong} sel matriks nilai alternatif belum diisi.`);
    if (tidakPositif > 0 && (config.methodKey === 'wp' || config.methodKey === 'ahp')) {
      galat('matriks', `${tidakPositif} nilai pada kriteria cost bernilai ≤ 0; metode ini mensyaratkan nilai > 0.`);
    }
    if (config.methodKey === 'ahp' && criteria.length > 0) {
      const { matrix, kosong: pasanganKosong } = pairwiseMatrix(config);
      if (pasanganKosong > 0) galat('ahp', `${pasanganKosong} perbandingan berpasangan kriteria belum diisi.`);
      else {
        const a = ahpWeights(matrix);
        if (!a.konsisten) galat('ahp', `Consistency Ratio = ${a.cr.toFixed(4)} melebihi 0,1; perbaiki perbandingan berpasangan.`);
      }
    }
  }

  if (config.category === 'B') {
    const { symptoms } = config;
    if (symptoms.length === 0) galat('gejala', 'Belum ada gejala.');
    const rentang = RENTANG_NILAI_PAKAR[config.methodKey];
    const altIds = new Set(alts.map((a) => a.id));
    const symIds = new Set(symptoms.map((s) => s.id));
    const relevan = config.weights.filter((w) => altIds.has(w.alternativeId) && symIds.has(w.symptomId));
    if (rentang && relevan.some((w) => w.nilai < rentang.min || w.nilai > rentang.max)) {
      galat('bobot', `Terdapat ${rentang.label} di luar rentang ${rentang.min} sampai ${rentang.max}.`);
    }
    const berisi = relevan.filter((w) => w.nilai !== 0);
    if (symptoms.length > 0 && alts.length > 0 && berisi.length === 0) galat('bobot', 'Matriks bobot gejala × alternatif masih kosong.');
    else {
      for (const a of alts) {
        if (!berisi.some((w) => w.alternativeId === a.id)) {
          peringatan('bobot', `Alternatif "${a.nama}" belum memiliki bobot gejala sehingga tidak akan pernah terpilih.`);
        }
      }
      const tanpa = symptoms.filter((s) => !berisi.some((w) => w.symptomId === s.id));
      if (tanpa.length > 0) {
        peringatan('bobot', `${tanpa.length} gejala belum dikaitkan dengan alternatif mana pun (${tanpa.slice(0, 5).map((s) => s.kode).join(', ')}${tanpa.length > 5 ? ', …' : ''}).`);
      }
    }
    if (config.methodKey === 'bayesian_network') {
      const siklus = findDependencyCycle(config.dependencies);
      if (siklus) galat('dependensi', 'Dependensi antar-gejala membentuk siklus; Bayesian Network harus berupa graf tanpa siklus.');
    }
    if (config.methodKey === 'naive_bayes' || config.methodKey === 'bayesian_network') {
      const terisi = alts.filter((a) => typeof a.prior === 'number' && a.prior > 0).length;
      if (terisi > 0 && terisi < alts.length) {
        peringatan('alternatif', 'Prior hanya diisi pada sebagian alternatif sehingga diabaikan (dipakai prior seragam).');
      }
    }
  }

  if (config.category === 'C') {
    const inputs = config.variables.filter((v) => v.tipe === 'input');
    const outputs = config.variables.filter((v) => v.tipe === 'output');
    if (inputs.length === 0) galat('fuzzy-variabel', 'Belum ada variabel input.');
    if (outputs.length === 0) galat('fuzzy-variabel', 'Belum ada variabel output.');
    if (outputs.length > 1) peringatan('fuzzy-variabel', 'Terdapat lebih dari satu variabel output; disarankan satu variabel output per kasus.');
    const setIds = new Map<number, number>();
    for (const v of config.variables) {
      if (!(v.max > v.min)) galat('fuzzy-variabel', `Semesta pembicaraan variabel "${v.nama}" tidak valid.`);
      if (v.sets.length === 0) galat('fuzzy-variabel', `Variabel "${v.nama}" belum memiliki himpunan fuzzy.`);
      for (const s of v.sets) {
        setIds.set(s.id, v.id);
        const g = validateSetParams(s.fungsi, s.params);
        if (g) galat('fuzzy-variabel', `Himpunan "${s.nama}" (${v.nama}): ${g}`);
        if (config.methodKey === 'fuzzy_tsukamoto' && v.tipe === 'output' && (s.fungsi === 'segitiga' || s.fungsi === 'trapesium')) {
          peringatan('fuzzy-variabel', `Himpunan output "${s.nama}" tidak monoton; Tsukamoto menganjurkan fungsi linear naik/turun.`);
        }
      }
    }
    if (config.fuzzyRules.length === 0) galat('fuzzy-rule', 'Basis aturan fuzzy masih kosong.');
    if (config.fuzzyRulesRusak.length > 0) galat('fuzzy-rule', `${config.fuzzyRulesRusak.length} aturan fuzzy memiliki data yang rusak; simpan ulang aturan tersebut.`);
    const varTipe = new Map(config.variables.map((v) => [v.id, v.tipe]));
    config.fuzzyRules.forEach((r, i) => {
      const antesedenSah = r.anteseden.every((a) => varTipe.get(a.variableId) === 'input' && setIds.get(a.setId) === a.variableId);
      const konsekuenSah = varTipe.get(r.konsekuen.variableId) === 'output' && setIds.get(r.konsekuen.setId) === r.konsekuen.variableId;
      if (!antesedenSah || !konsekuenSah) galat('fuzzy-rule', `Aturan R${i + 1} merujuk variabel/himpunan yang sudah tidak ada.`);
      if (r.alternativeId === null) peringatan('fuzzy-rule', `Aturan R${i + 1} belum dihubungkan dengan alternatif.`);
    });
    for (const a of alts) {
      if (!config.fuzzyRules.some((r) => r.alternativeId === a.id)) {
        peringatan('fuzzy-rule', `Alternatif "${a.nama}" belum memiliki aturan sehingga tidak akan pernah terpilih.`);
      }
    }
  }

  if (config.category === 'D') {
    if (config.symptoms.length === 0) galat('gejala', 'Belum ada gejala.');
    if (config.chainRules.length === 0) galat('rule', 'Basis aturan masih kosong.');
    for (const r of config.chainRules) {
      if (r.conditions.length === 0) galat('rule', `Aturan "${r.nama}" belum memiliki kondisi.`);
    }
    for (const a of alts) {
      if (!config.chainRules.some((r) => r.alternativeId === a.id)) {
        peringatan('rule', `Alternatif "${a.nama}" belum memiliki aturan sehingga tidak akan pernah terpilih.`);
      }
    }
  }

  return { siap: !issues.some((i) => i.level === 'error'), issues };
}
