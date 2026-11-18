'use server';

import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { JUMLAH_PARAMETER, validateSetParams } from '@/lib/engines/fuzzy-common';
import { requireCaseAccess } from '@/lib/guards';
import { fuzzyRuleSchema, fuzzyVariableSchema } from '@/lib/schemas/knowledge';
import { antesedenSchema, arrayToParams, konsekuenSchema } from '@/lib/spk/config';
import type { TenantDb } from '@/lib/tenant';
import type { ActionResult } from '@/lib/utils';
import { galatTakTerduga, tidakValid } from './helpers';

const segarkan = (caseId: number) => revalidatePath(`/admin/cases/${caseId}`, 'layout');
const BUKAN_C: ActionResult<never> = { ok: false, error: 'Case ini tidak memakai metode Kategori C.' };

type Tx = Parameters<Parameters<TenantDb['$transaction']>[0]>[0];

interface RujukanAturan {
  id: number;
  variableIds: number[];
  setIds: number[];
}

/** Variabel & himpunan yang dirujuk tiap aturan fuzzy pada sebuah Case. */
async function rujukanAturan(db: TenantDb | Tx, caseId: number): Promise<RujukanAturan[]> {
  const rules = await db.fuzzyRule.findMany({ where: { caseId }, select: { id: true, antesedenJson: true, konsekuenJson: true } });
  return rules.map((r) => {
    const a = antesedenSchema.safeParse(r.antesedenJson);
    const k = konsekuenSchema.safeParse(r.konsekuenJson);
    const kondisi = a.success ? a.data.kondisi : [];
    return {
      id: r.id,
      variableIds: [...kondisi.map((c) => c.variable_id), ...(k.success ? [k.data.variable_id] : [])],
      setIds: [...kondisi.map((c) => c.set_id), ...(k.success ? [k.data.set_id] : [])],
    };
  });
}

/** Susun ulang `rule_text` seluruh aturan (nama variabel/himpunan bisa berubah). */
async function perbaruiTeksAturan(tx: Tx, caseId: number): Promise<void> {
  const [variables, rules] = await Promise.all([
    tx.fuzzyVariable.findMany({ where: { caseId }, include: { sets: true } }),
    tx.fuzzyRule.findMany({ where: { caseId } }),
  ]);
  const namaVar = new Map(variables.map((v) => [v.id, v.namaVariabel]));
  const namaSet = new Map(variables.flatMap((v) => v.sets.map((s) => [s.id, s.namaHimpunan] as const)));
  for (const r of rules) {
    const a = antesedenSchema.safeParse(r.antesedenJson);
    const k = konsekuenSchema.safeParse(r.konsekuenJson);
    if (!a.success || !k.success) continue;
    const teks = susunTeks(a.data.operator, a.data.kondisi, k.data, namaVar, namaSet);
    if (teks !== r.ruleText) await tx.fuzzyRule.update({ where: { id: r.id }, data: { ruleText: teks } });
  }
}

function susunTeks(
  operator: 'AND' | 'OR',
  kondisi: { variable_id: number; set_id: number }[],
  konsekuen: { variable_id: number; set_id: number },
  namaVar: Map<number, string>,
  namaSet: Map<number, string>,
): string {
  const bagian = kondisi.map((c) => `${namaVar.get(c.variable_id) ?? '?'} ${namaSet.get(c.set_id) ?? '?'}`);
  return `JIKA ${bagian.join(operator === 'OR' ? ' ATAU ' : ' DAN ')} MAKA ${namaVar.get(konsekuen.variable_id) ?? '?'} ${namaSet.get(konsekuen.set_id) ?? '?'}`;
}

/* ----------------------- Variabel & himpunan ----------------------- */

export async function saveFuzzyVariable(caseId: number, id: number | null, values: unknown): Promise<ActionResult> {
  const { kasus, db } = await requireCaseAccess(caseId);
  if (kasus.category !== 'C') return BUKAN_C;
  const parsed = fuzzyVariableSchema.safeParse(values);
  if (!parsed.success) return tidakValid(parsed.error);
  const v = parsed.data;

  for (const s of v.sets) {
    const params = s.params.slice(0, JUMLAH_PARAMETER[s.fungsiKeanggotaan]);
    const galat = s.params.length !== JUMLAH_PARAMETER[s.fungsiKeanggotaan] ? 'Jumlah parameter tidak sesuai fungsi keanggotaan.' : validateSetParams(s.fungsiKeanggotaan, params);
    if (galat) return { ok: false, error: `Himpunan "${s.namaHimpunan}": ${galat}` };
    if (params.some((p) => p < v.nilaiMin || p > v.nilaiMax)) {
      return { ok: false, error: `Himpunan "${s.namaHimpunan}": parameter harus berada di dalam semesta pembicaraan (${v.nilaiMin} sampai ${v.nilaiMax}).` };
    }
  }
  const nama = v.sets.map((s) => s.namaHimpunan.toLowerCase());
  if (new Set(nama).size !== nama.length) return { ok: false, error: 'Nama himpunan dalam satu variabel tidak boleh sama.' };

  try {
    let aturanTerhapus = 0;
    await db.$transaction(async (tx) => {
      let variableId: number;
      const data = { namaVariabel: v.namaVariabel, tipe: v.tipe, satuan: v.satuan || null, nilaiMin: v.nilaiMin, nilaiMax: v.nilaiMax };
      const rujukan = await rujukanAturan(tx, caseId);

      if (id === null) {
        const terakhir = await tx.fuzzyVariable.aggregate({ where: { caseId }, _max: { urutan: true } });
        const baru = await tx.fuzzyVariable.create({ data: { ...data, clientId: kasus.clientId, caseId, urutan: (terakhir._max.urutan ?? -1) + 1 } });
        variableId = baru.id;
      } else {
        const lama = await tx.fuzzyVariable.findFirst({ where: { id, caseId }, select: { id: true, tipe: true } });
        if (!lama) throw new Error('TIDAK_ADA');
        if (lama.tipe !== v.tipe && rujukan.some((r) => r.variableIds.includes(id))) throw new Error('TIPE_DIPAKAI');
        await tx.fuzzyVariable.update({ where: { id }, data });
        variableId = id;
      }

      const lamaSets = await tx.fuzzySet.findMany({ where: { variableId }, select: { id: true } });
      const idLama = new Set(lamaSets.map((s) => s.id));
      const dipertahankan = new Set<number>();
      for (let i = 0; i < v.sets.length; i++) {
        const s = v.sets[i];
        const isi = {
          namaHimpunan: s.namaHimpunan,
          fungsiKeanggotaan: s.fungsiKeanggotaan,
          parameterJson: arrayToParams(s.params) as Prisma.InputJsonValue,
          urutan: i,
        };
        if (s.id !== null && idLama.has(s.id)) {
          await tx.fuzzySet.update({ where: { id: s.id }, data: isi });
          dipertahankan.add(s.id);
        } else {
          await tx.fuzzySet.create({ data: { ...isi, clientId: kasus.clientId, variableId } });
        }
      }
      const dihapus = [...idLama].filter((x) => !dipertahankan.has(x));
      if (dihapus.length > 0) {
        // aturan yang memakai himpunan terhapus tidak lagi bermakna → ikut dihapus
        const aturan = rujukan.filter((r) => r.setIds.some((sid) => dihapus.includes(sid))).map((r) => r.id);
        if (aturan.length > 0) {
          await tx.fuzzyRule.deleteMany({ where: { id: { in: aturan } } });
          aturanTerhapus = aturan.length;
        }
        await tx.fuzzySet.deleteMany({ where: { id: { in: dihapus } } });
      }
      await perbaruiTeksAturan(tx, caseId);
    });
    segarkan(caseId);
    return {
      ok: true,
      pesan: aturanTerhapus > 0 ? `Variabel disimpan. ${aturanTerhapus} aturan yang memakai himpunan terhapus ikut dihapus.` : 'Variabel disimpan.',
    };
  } catch (e) {
    if (e instanceof Error && e.message === 'TIDAK_ADA') return { ok: false, error: 'Variabel tidak ditemukan.' };
    if (e instanceof Error && e.message === 'TIPE_DIPAKAI') {
      return { ok: false, error: 'Tipe variabel tidak dapat diubah karena variabel ini dipakai pada basis aturan.' };
    }
    return galatTakTerduga(e, 'saveFuzzyVariable');
  }
}

export async function deleteFuzzyVariable(caseId: number, id: number): Promise<ActionResult> {
  const { db } = await requireCaseAccess(caseId);
  try {
    let jumlah = 0;
    await db.$transaction(async (tx) => {
      const ada = await tx.fuzzyVariable.findFirst({ where: { id, caseId }, select: { id: true } });
      if (!ada) throw new Error('TIDAK_ADA');
      const aturan = (await rujukanAturan(tx, caseId)).filter((r) => r.variableIds.includes(id)).map((r) => r.id);
      if (aturan.length > 0) await tx.fuzzyRule.deleteMany({ where: { id: { in: aturan } } });
      jumlah = aturan.length;
      await tx.fuzzyVariable.delete({ where: { id } });
    });
    segarkan(caseId);
    return { ok: true, pesan: jumlah > 0 ? `Variabel dan ${jumlah} aturan yang memakainya dihapus.` : 'Variabel dihapus.' };
  } catch (e) {
    if (e instanceof Error && e.message === 'TIDAK_ADA') return { ok: false, error: 'Variabel tidak ditemukan.' };
    return galatTakTerduga(e, 'deleteFuzzyVariable');
  }
}

/* --------------------------- Aturan fuzzy -------------------------- */

export async function saveFuzzyRule(caseId: number, id: number | null, values: unknown): Promise<ActionResult> {
  const { kasus, db } = await requireCaseAccess(caseId);
  if (kasus.category !== 'C') return BUKAN_C;
  const parsed = fuzzyRuleSchema.safeParse(values);
  if (!parsed.success) return tidakValid(parsed.error);
  const v = parsed.data;
  try {
    const [variables, alt] = await Promise.all([
      db.fuzzyVariable.findMany({ where: { caseId }, include: { sets: { select: { id: true, namaHimpunan: true } } } }),
      db.alternative.findFirst({ where: { id: v.alternativeId, caseId }, select: { id: true } }),
    ]);
    if (!alt) return { ok: false, error: 'Alternatif tidak ditemukan pada Case ini.' };
    const varById = new Map(variables.map((x) => [x.id, x]));
    const punyaSet = (variableId: number, setId: number) => varById.get(variableId)?.sets.some((s) => s.id === setId) ?? false;

    const terlihat = new Set<string>();
    for (const k of v.kondisi) {
      if (varById.get(k.variableId)?.tipe !== 'input' || !punyaSet(k.variableId, k.setId)) {
        return { ok: false, error: 'Kondisi aturan merujuk variabel/himpunan input yang tidak valid.' };
      }
      const kunci = `${k.variableId}:${k.setId}`;
      if (terlihat.has(kunci)) return { ok: false, error: 'Terdapat kondisi yang sama lebih dari sekali.' };
      terlihat.add(kunci);
    }
    if (varById.get(v.konsekuen.variableId)?.tipe !== 'output' || !punyaSet(v.konsekuen.variableId, v.konsekuen.setId)) {
      return { ok: false, error: 'Konsekuen aturan merujuk variabel/himpunan output yang tidak valid.' };
    }

    const kondisi = v.kondisi.map((k) => ({ variable_id: k.variableId, set_id: k.setId }));
    const konsekuen = { variable_id: v.konsekuen.variableId, set_id: v.konsekuen.setId };
    const namaVar = new Map(variables.map((x) => [x.id, x.namaVariabel]));
    const namaSet = new Map(variables.flatMap((x) => x.sets.map((s) => [s.id, s.namaHimpunan] as const)));
    const data = {
      alternativeId: v.alternativeId,
      ruleText: susunTeks(v.operator, kondisi, konsekuen, namaVar, namaSet),
      antesedenJson: { operator: v.operator, kondisi } as Prisma.InputJsonValue,
      konsekuenJson: konsekuen as Prisma.InputJsonValue,
    };

    if (id === null) {
      const terakhir = await db.fuzzyRule.aggregate({ where: { caseId }, _max: { urutan: true } });
      await db.fuzzyRule.create({ data: { ...data, clientId: kasus.clientId, caseId, urutan: (terakhir._max.urutan ?? -1) + 1 } });
    } else {
      const hasil = await db.fuzzyRule.updateMany({ where: { id, caseId }, data });
      if (hasil.count === 0) return { ok: false, error: 'Aturan tidak ditemukan.' };
    }
    segarkan(caseId);
    return { ok: true, pesan: 'Aturan disimpan.' };
  } catch (e) {
    return galatTakTerduga(e, 'saveFuzzyRule');
  }
}

export async function deleteFuzzyRule(caseId: number, id: number): Promise<ActionResult> {
  const { db } = await requireCaseAccess(caseId);
  try {
    const hasil = await db.fuzzyRule.deleteMany({ where: { id, caseId } });
    if (hasil.count === 0) return { ok: false, error: 'Aturan tidak ditemukan.' };
    segarkan(caseId);
    return { ok: true, pesan: 'Aturan dihapus.' };
  } catch (e) {
    return galatTakTerduga(e, 'deleteFuzzyRule');
  }
}
