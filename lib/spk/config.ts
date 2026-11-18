import { z } from 'zod';
import type { ChainRule, FuzzyRuleDef, FuzzyVariableDef, MembershipFn, MethodKey, Category } from '@/lib/engines';
import { isMethodKey } from '@/lib/engines';
import type { TenantDb } from '@/lib/tenant';

export interface ConfigAlternative {
  id: number;
  kode: string;
  nama: string;
  deskripsiHasil: string | null;
  saranTindakan: string | null;
  prior: number | null;
}

export interface ConfigCriterion {
  id: number;
  kode: string;
  nama: string;
  pertanyaan: string | null;
  tipe: 'benefit' | 'cost';
  bobot: number;
  scales: { id: number; label: string; nilai: number }[];
}

export interface ConfigSymptom {
  id: number;
  kode: string;
  nama: string;
}

/** Seluruh konfigurasi satu SPK Case dalam bentuk data polos (tanpa Prisma). */
export interface CaseConfig {
  caseId: number;
  clientId: number;
  methodKey: MethodKey;
  category: Category;
  mcdmMode: 'profil' | 'preferensi';
  alternatives: ConfigAlternative[];
  // Kategori A
  criteria: ConfigCriterion[];
  /** `${alternativeId}:${criteriaId}` → nilai */
  values: Record<string, number>;
  /** `${criteriaIdA}:${criteriaIdB}` → nilai perbandingan */
  pairwise: Record<string, number>;
  // Kategori B & D
  symptoms: ConfigSymptom[];
  weights: { alternativeId: number; symptomId: number; nilai: number }[];
  dependencies: { id: number; childId: number; parentId: number; probabilitas: number }[];
  // Kategori C
  variables: FuzzyVariableDef[];
  fuzzyRules: FuzzyRuleDef[];
  /** aturan fuzzy yang JSON-nya rusak/tidak lengkap (id) */
  fuzzyRulesRusak: number[];
  // Kategori D
  chainRules: ChainRule[];
}

export const parameterSchema = z.object({
  a: z.number(),
  b: z.number(),
  c: z.number().optional(),
  d: z.number().optional(),
});

export const antesedenSchema = z.object({
  operator: z.enum(['AND', 'OR']),
  kondisi: z.array(z.object({ variable_id: z.number().int(), set_id: z.number().int() })).min(1),
});

export const konsekuenSchema = z.object({ variable_id: z.number().int(), set_id: z.number().int() });

export function paramsToArray(fungsi: MembershipFn, json: unknown): number[] {
  const p = parameterSchema.safeParse(json);
  if (!p.success) return [];
  const { a, b, c, d } = p.data;
  if (fungsi === 'segitiga') return [a, b, c ?? Number.NaN];
  if (fungsi === 'trapesium') return [a, b, c ?? Number.NaN, d ?? Number.NaN];
  return [a, b];
}

export function arrayToParams(params: number[]): Record<string, number> {
  const kunci = ['a', 'b', 'c', 'd'];
  return Object.fromEntries(params.map((v, i) => [kunci[i], v]));
}

export function awalanKode(category: Category): string {
  return category === 'B' || category === 'D' ? 'P' : 'A';
}

export interface CaseRef {
  id: number;
  clientId: number;
  methodKey: string;
  category: Category;
  mcdmMode: 'profil' | 'preferensi';
}

/** Muat seluruh konfigurasi Case yang relevan dengan kategori metodenya. */
export async function loadCaseConfig(db: TenantDb, kasus: CaseRef): Promise<CaseConfig> {
  if (!isMethodKey(kasus.methodKey)) throw new Error(`Metode "${kasus.methodKey}" tidak dikenal.`);
  const caseId = kasus.id;
  const kategori = kasus.category;
  const awalan = awalanKode(kategori);

  const alternatives = await db.alternative.findMany({ where: { caseId }, orderBy: [{ urutan: 'asc' }, { id: 'asc' }] });
  const config: CaseConfig = {
    caseId,
    clientId: kasus.clientId,
    methodKey: kasus.methodKey,
    category: kategori,
    mcdmMode: kasus.mcdmMode,
    alternatives: alternatives.map((a, i) => ({
      id: a.id,
      kode: `${awalan}${i + 1}`,
      nama: a.namaAlternatif,
      deskripsiHasil: a.deskripsiHasil,
      saranTindakan: a.saranTindakan,
      prior: a.prior,
    })),
    criteria: [],
    values: {},
    pairwise: {},
    symptoms: [],
    weights: [],
    dependencies: [],
    variables: [],
    fuzzyRules: [],
    fuzzyRulesRusak: [],
    chainRules: [],
  };
  const altIds = alternatives.map((a) => a.id);

  if (kategori === 'A') {
    const [criteria, values, pairwise] = await Promise.all([
      db.criteriaMcdm.findMany({
        where: { caseId },
        orderBy: [{ urutan: 'asc' }, { id: 'asc' }],
        include: { scales: { orderBy: [{ urutan: 'asc' }, { nilai: 'asc' }, { id: 'asc' }] } },
      }),
      db.alternativeValueMcdm.findMany({ where: { alternativeId: { in: altIds } } }),
      kasus.methodKey === 'ahp' ? db.ahpPairwise.findMany({ where: { caseId } }) : Promise.resolve([]),
    ]);
    config.criteria = criteria.map((c, j) => ({
      id: c.id,
      kode: `C${j + 1}`,
      nama: c.namaKriteria,
      pertanyaan: c.pertanyaan,
      tipe: c.tipe,
      bobot: c.bobot,
      scales: c.scales.map((s) => ({ id: s.id, label: s.label, nilai: s.nilai })),
    }));
    for (const v of values) config.values[`${v.alternativeId}:${v.criteriaId}`] = v.nilai;
    for (const p of pairwise) config.pairwise[`${p.criteriaIdA}:${p.criteriaIdB}`] = p.nilaiPerbandingan;
  }

  if (kategori === 'B' || kategori === 'D') {
    const symptoms = await db.symptom.findMany({ where: { caseId }, orderBy: [{ urutan: 'asc' }, { id: 'asc' }] });
    config.symptoms = symptoms.map((s) => ({ id: s.id, kode: s.kodeGejala, nama: s.namaGejala }));
  }

  if (kategori === 'B') {
    const [weights, dependencies] = await Promise.all([
      db.alternativeSymptomWeight.findMany({ where: { alternativeId: { in: altIds } } }),
      kasus.methodKey === 'bayesian_network' ? db.conditionalDependency.findMany({ where: { caseId } }) : Promise.resolve([]),
    ]);
    config.weights = weights.map((w) => ({ alternativeId: w.alternativeId, symptomId: w.symptomId, nilai: w.nilaiPakar }));
    config.dependencies = dependencies.map((d) => ({
      id: d.id,
      childId: d.symptomIdChild,
      parentId: d.symptomIdParent,
      probabilitas: d.probabilitas,
    }));
  }

  if (kategori === 'C') {
    const [variables, rules] = await Promise.all([
      db.fuzzyVariable.findMany({
        where: { caseId },
        orderBy: [{ urutan: 'asc' }, { id: 'asc' }],
        include: { sets: { orderBy: [{ urutan: 'asc' }, { id: 'asc' }] } },
      }),
      db.fuzzyRule.findMany({ where: { caseId }, orderBy: [{ urutan: 'asc' }, { id: 'asc' }] }),
    ]);
    config.variables = variables.map((v) => ({
      id: v.id,
      nama: v.namaVariabel,
      tipe: v.tipe,
      satuan: v.satuan,
      min: v.nilaiMin,
      max: v.nilaiMax,
      sets: v.sets.map((s) => ({
        id: s.id,
        nama: s.namaHimpunan,
        fungsi: s.fungsiKeanggotaan,
        params: paramsToArray(s.fungsiKeanggotaan, s.parameterJson),
      })),
    }));
    for (const r of rules) {
      const a = antesedenSchema.safeParse(r.antesedenJson);
      const k = konsekuenSchema.safeParse(r.konsekuenJson);
      if (!a.success || !k.success) {
        config.fuzzyRulesRusak.push(r.id);
        continue;
      }
      config.fuzzyRules.push({
        id: r.id,
        alternativeId: r.alternativeId,
        operator: a.data.operator,
        anteseden: a.data.kondisi.map((c) => ({ variableId: c.variable_id, setId: c.set_id })),
        konsekuen: { variableId: k.data.variable_id, setId: k.data.set_id },
      });
    }
  }

  if (kategori === 'D') {
    const rules = await db.ruleChaining.findMany({
      where: { caseId },
      orderBy: [{ urutan: 'asc' }, { id: 'asc' }],
      include: { conditions: { orderBy: [{ urutan: 'asc' }, { id: 'asc' }] } },
    });
    config.chainRules = rules.map((r) => ({
      id: r.id,
      nama: r.namaRule,
      alternativeId: r.alternativeId,
      conditions: r.conditions.map((c) => ({ symptomId: c.symptomId, operator: c.operator })),
    }));
  }

  return config;
}
