'use server';

import { revalidatePath } from 'next/cache';
import { RENTANG_NILAI_PAKAR } from '@/lib/constants';
import { findDependencyCycle } from '@/lib/engines/bayesian-network';
import { requireCaseAccess } from '@/lib/guards';
import { chainRuleSchema, dependencySchema, symptomSchema, weightsSchema } from '@/lib/schemas/knowledge';
import type { ActionResult } from '@/lib/utils';
import { galatTakTerduga, tidakValid } from './helpers';

const segarkan = (caseId: number) => revalidatePath(`/admin/cases/${caseId}`, 'layout');

/* ------------------------------ Gejala ----------------------------- */

export async function saveSymptom(caseId: number, id: number | null, values: unknown): Promise<ActionResult> {
  const { kasus, db } = await requireCaseAccess(caseId);
  if (kasus.category !== 'B' && kasus.category !== 'D') return { ok: false, error: 'Case ini tidak memakai daftar gejala.' };
  const parsed = symptomSchema.safeParse(values);
  if (!parsed.success) return tidakValid(parsed.error);
  const v = parsed.data;
  try {
    const bentrok = await db.symptom.findFirst({
      where: { caseId, kodeGejala: v.kodeGejala, ...(id ? { id: { not: id } } : {}) },
      select: { id: true },
    });
    if (bentrok) return { ok: false, error: 'Kode gejala sudah dipakai.', fieldErrors: { kodeGejala: ['Kode gejala sudah dipakai.'] } };
    if (id === null) {
      const terakhir = await db.symptom.aggregate({ where: { caseId }, _max: { urutan: true } });
      await db.symptom.create({
        data: { clientId: kasus.clientId, caseId, kodeGejala: v.kodeGejala, namaGejala: v.namaGejala, urutan: (terakhir._max.urutan ?? -1) + 1 },
      });
    } else {
      const hasil = await db.symptom.updateMany({ where: { id, caseId }, data: { kodeGejala: v.kodeGejala, namaGejala: v.namaGejala } });
      if (hasil.count === 0) return { ok: false, error: 'Gejala tidak ditemukan.' };
    }
    segarkan(caseId);
    return { ok: true, pesan: 'Gejala disimpan.' };
  } catch (e) {
    return galatTakTerduga(e, 'saveSymptom');
  }
}

export async function deleteSymptom(caseId: number, id: number): Promise<ActionResult> {
  const { db } = await requireCaseAccess(caseId);
  try {
    const hasil = await db.symptom.deleteMany({ where: { id, caseId } });
    if (hasil.count === 0) return { ok: false, error: 'Gejala tidak ditemukan.' };
    segarkan(caseId);
    return { ok: true, pesan: 'Gejala dihapus.' };
  } catch (e) {
    return galatTakTerduga(e, 'deleteSymptom');
  }
}

/* ----------------------- Bobot gejala × alternatif ----------------- */

/** Simpan seluruh matriks nilai pakar gejala × alternatif (mengganti isi sebelumnya). */
export async function saveWeights(caseId: number, values: unknown): Promise<ActionResult> {
  const { kasus, db } = await requireCaseAccess(caseId);
  if (kasus.category !== 'B') return { ok: false, error: 'Case ini tidak memakai metode Kategori B.' };
  const parsed = weightsSchema.safeParse(values);
  if (!parsed.success) return tidakValid(parsed.error);
  const rentang = RENTANG_NILAI_PAKAR[kasus.methodKey];
  try {
    const [alts, symptoms] = await Promise.all([
      db.alternative.findMany({ where: { caseId }, select: { id: true } }),
      db.symptom.findMany({ where: { caseId }, select: { id: true } }),
    ]);
    const altIds = new Set(alts.map((a) => a.id));
    const symIds = new Set(symptoms.map((s) => s.id));
    const terisi = new Map<string, { alternativeId: number; symptomId: number; nilaiPakar: number }>();
    for (const sel of parsed.data) {
      if (!altIds.has(sel.alternativeId) || !symIds.has(sel.symptomId)) return { ok: false, error: 'Data bobot tidak sesuai dengan Case ini.' };
      if (sel.nilai === null || sel.nilai === 0) continue;
      if (rentang && (sel.nilai < rentang.min || sel.nilai > rentang.max)) {
        return { ok: false, error: `${rentang.label} harus berada pada rentang ${rentang.min} sampai ${rentang.max}.` };
      }
      terisi.set(`${sel.alternativeId}:${sel.symptomId}`, { alternativeId: sel.alternativeId, symptomId: sel.symptomId, nilaiPakar: sel.nilai });
    }
    await db.$transaction(async (tx) => {
      await tx.alternativeSymptomWeight.deleteMany({ where: { alternativeId: { in: [...altIds] } } });
      if (terisi.size > 0) {
        await tx.alternativeSymptomWeight.createMany({ data: [...terisi.values()].map((s) => ({ ...s, clientId: kasus.clientId })) });
      }
    });
    segarkan(caseId);
    return { ok: true, pesan: 'Bobot gejala disimpan.' };
  } catch (e) {
    return galatTakTerduga(e, 'saveWeights');
  }
}

/* -------------------- Dependensi (Bayesian Network) ---------------- */

export async function saveDependency(caseId: number, id: number | null, values: unknown): Promise<ActionResult> {
  const { kasus, db } = await requireCaseAccess(caseId);
  if (kasus.methodKey !== 'bayesian_network') return { ok: false, error: 'Dependensi hanya dipakai metode Bayesian Network.' };
  const parsed = dependencySchema.safeParse(values);
  if (!parsed.success) return tidakValid(parsed.error);
  const v = parsed.data;
  try {
    const [gejala, semua] = await Promise.all([
      db.symptom.findMany({ where: { caseId, id: { in: [v.childId, v.parentId] } }, select: { id: true } }),
      db.conditionalDependency.findMany({ where: { caseId } }),
    ]);
    if (gejala.length !== 2) return { ok: false, error: 'Gejala tidak ditemukan pada Case ini.' };
    if (id !== null && !semua.some((d) => d.id === id)) return { ok: false, error: 'Dependensi tidak ditemukan.' };
    const lain = semua.filter((d) => d.id !== id);
    if (lain.some((d) => d.symptomIdChild === v.childId && d.symptomIdParent === v.parentId)) {
      return { ok: false, error: 'Dependensi tersebut sudah ada.' };
    }
    const siklus = findDependencyCycle([
      ...lain.map((d) => ({ childId: d.symptomIdChild, parentId: d.symptomIdParent })),
      { childId: v.childId, parentId: v.parentId },
    ]);
    if (siklus) return { ok: false, error: 'Dependensi ini akan membentuk siklus; Bayesian Network harus berupa graf tanpa siklus.' };

    const data = { symptomIdChild: v.childId, symptomIdParent: v.parentId, probabilitas: v.probabilitas };
    if (id === null) await db.conditionalDependency.create({ data: { ...data, clientId: kasus.clientId, caseId } });
    else await db.conditionalDependency.update({ where: { id }, data });
    segarkan(caseId);
    return { ok: true, pesan: 'Dependensi disimpan.' };
  } catch (e) {
    return galatTakTerduga(e, 'saveDependency');
  }
}

export async function deleteDependency(caseId: number, id: number): Promise<ActionResult> {
  const { db } = await requireCaseAccess(caseId);
  try {
    const hasil = await db.conditionalDependency.deleteMany({ where: { id, caseId } });
    if (hasil.count === 0) return { ok: false, error: 'Dependensi tidak ditemukan.' };
    segarkan(caseId);
    return { ok: true, pesan: 'Dependensi dihapus.' };
  } catch (e) {
    return galatTakTerduga(e, 'deleteDependency');
  }
}

/* --------------------- Aturan Forward Chaining --------------------- */

export async function saveChainRule(caseId: number, id: number | null, values: unknown): Promise<ActionResult> {
  const { kasus, db } = await requireCaseAccess(caseId);
  if (kasus.category !== 'D') return { ok: false, error: 'Case ini tidak memakai metode Kategori D.' };
  const parsed = chainRuleSchema.safeParse(values);
  if (!parsed.success) return tidakValid(parsed.error);
  const v = parsed.data;
  try {
    const [alt, gejala] = await Promise.all([
      db.alternative.findFirst({ where: { id: v.alternativeId, caseId }, select: { id: true } }),
      db.symptom.findMany({ where: { caseId, id: { in: v.conditions.map((c) => c.symptomId) } }, select: { id: true } }),
    ]);
    if (!alt) return { ok: false, error: 'Alternatif tidak ditemukan pada Case ini.' };
    const dikenal = new Set(gejala.map((g) => g.id));
    if (v.conditions.some((c) => !dikenal.has(c.symptomId))) return { ok: false, error: 'Terdapat gejala yang tidak ditemukan pada Case ini.' };

    await db.$transaction(async (tx) => {
      let ruleId: number;
      if (id === null) {
        const terakhir = await tx.ruleChaining.aggregate({ where: { caseId }, _max: { urutan: true } });
        const baru = await tx.ruleChaining.create({
          data: { clientId: kasus.clientId, caseId, alternativeId: v.alternativeId, namaRule: v.namaRule, urutan: (terakhir._max.urutan ?? -1) + 1 },
        });
        ruleId = baru.id;
      } else {
        const ada = await tx.ruleChaining.findFirst({ where: { id, caseId }, select: { id: true } });
        if (!ada) throw new Error('TIDAK_ADA');
        await tx.ruleChaining.update({ where: { id }, data: { alternativeId: v.alternativeId, namaRule: v.namaRule } });
        ruleId = id;
      }
      await tx.ruleCondition.deleteMany({ where: { ruleId } });
      await tx.ruleCondition.createMany({
        data: v.conditions.map((c, i) => ({
          clientId: kasus.clientId,
          ruleId,
          symptomId: c.symptomId,
          operator: i === 0 ? ('AND' as const) : c.operator,
          urutan: i,
        })),
      });
    });
    segarkan(caseId);
    return { ok: true, pesan: 'Aturan disimpan.' };
  } catch (e) {
    if (e instanceof Error && e.message === 'TIDAK_ADA') return { ok: false, error: 'Aturan tidak ditemukan.' };
    return galatTakTerduga(e, 'saveChainRule');
  }
}

export async function deleteChainRule(caseId: number, id: number): Promise<ActionResult> {
  const { db } = await requireCaseAccess(caseId);
  try {
    const hasil = await db.ruleChaining.deleteMany({ where: { id, caseId } });
    if (hasil.count === 0) return { ok: false, error: 'Aturan tidak ditemukan.' };
    segarkan(caseId);
    return { ok: true, pesan: 'Aturan dihapus.' };
  } catch (e) {
    return galatTakTerduga(e, 'deleteChainRule');
  }
}
