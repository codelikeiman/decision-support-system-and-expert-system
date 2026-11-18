'use server';

import { revalidatePath } from 'next/cache';
import { ahpWeights } from '@/lib/engines/ahp';
import { requireCaseAccess } from '@/lib/guards';
import { criterionSchema, matrixSchema, pairwiseSchema } from '@/lib/schemas/knowledge';
import type { ActionResult } from '@/lib/utils';
import { galatTakTerduga, tidakValid } from './helpers';

const segarkan = (caseId: number) => revalidatePath(`/admin/cases/${caseId}`, 'layout');
const BUKAN_A: ActionResult<never> = { ok: false, error: 'Case ini tidak memakai metode Kategori A.' };

export async function saveCriterion(caseId: number, id: number | null, values: unknown): Promise<ActionResult> {
  const { kasus, db } = await requireCaseAccess(caseId);
  if (kasus.category !== 'A') return BUKAN_A;
  const parsed = criterionSchema.safeParse(values);
  if (!parsed.success) return tidakValid(parsed.error);
  const v = parsed.data;
  const ahp = kasus.methodKey === 'ahp';
  try {
    await db.$transaction(async (tx) => {
      let criteriaId: number;
      const data = { namaKriteria: v.namaKriteria, pertanyaan: v.pertanyaan || null, tipe: v.tipe };
      if (id === null) {
        const terakhir = await tx.criteriaMcdm.aggregate({ where: { caseId }, _max: { urutan: true } });
        const baru = await tx.criteriaMcdm.create({
          data: { ...data, clientId: kasus.clientId, caseId, bobot: ahp ? 1 : v.bobot, urutan: (terakhir._max.urutan ?? -1) + 1 },
        });
        criteriaId = baru.id;
      } else {
        const ada = await tx.criteriaMcdm.findFirst({ where: { id, caseId }, select: { id: true } });
        if (!ada) throw new Error('TIDAK_ADA');
        // Pada AHP bobot diturunkan dari perbandingan berpasangan, bukan dari form ini.
        await tx.criteriaMcdm.update({ where: { id }, data: ahp ? data : { ...data, bobot: v.bobot } });
        criteriaId = id;
      }
      await tx.criteriaScaleMcdm.deleteMany({ where: { criteriaId } });
      await tx.criteriaScaleMcdm.createMany({
        data: v.scales.map((s, i) => ({ clientId: kasus.clientId, criteriaId, label: s.label, nilai: s.nilai, urutan: i })),
      });
    });
    segarkan(caseId);
    return { ok: true, pesan: 'Kriteria disimpan.' };
  } catch (e) {
    if (e instanceof Error && e.message === 'TIDAK_ADA') return { ok: false, error: 'Kriteria tidak ditemukan.' };
    return galatTakTerduga(e, 'saveCriterion');
  }
}

export async function deleteCriterion(caseId: number, id: number): Promise<ActionResult> {
  const { db } = await requireCaseAccess(caseId);
  try {
    const hasil = await db.criteriaMcdm.deleteMany({ where: { id, caseId } });
    if (hasil.count === 0) return { ok: false, error: 'Kriteria tidak ditemukan.' };
    segarkan(caseId);
    return { ok: true, pesan: 'Kriteria dihapus.' };
  } catch (e) {
    return galatTakTerduga(e, 'deleteCriterion');
  }
}

/** Simpan seluruh matriks nilai alternatif × kriteria (mengganti isi sebelumnya). */
export async function saveMatrix(caseId: number, values: unknown): Promise<ActionResult> {
  const { kasus, db } = await requireCaseAccess(caseId);
  if (kasus.category !== 'A') return BUKAN_A;
  const parsed = matrixSchema.safeParse(values);
  if (!parsed.success) return tidakValid(parsed.error);
  try {
    const [alts, criteria] = await Promise.all([
      db.alternative.findMany({ where: { caseId }, select: { id: true } }),
      db.criteriaMcdm.findMany({ where: { caseId }, select: { id: true, namaKriteria: true, scales: { select: { nilai: true } } } }),
    ]);
    const altIds = new Set(alts.map((a) => a.id));
    const kriteria = new Map(criteria.map((c) => [c.id, c]));
    const terisi = new Map<string, { alternativeId: number; criteriaId: number; nilai: number }>();
    for (const sel of parsed.data) {
      // id asing (milik Case/client lain) ditolak
      const k = kriteria.get(sel.criteriaId);
      if (!altIds.has(sel.alternativeId) || !k) return { ok: false, error: 'Data matriks tidak sesuai dengan Case ini.' };
      if (sel.nilai === null) continue;
      if (kasus.mcdmMode === 'profil' && k.scales.length > 0 && !k.scales.some((s) => Math.abs(s.nilai - (sel.nilai as number)) < 1e-9)) {
        return { ok: false, error: `Nilai pada kriteria "${k.namaKriteria}" harus dipilih dari skala penilaiannya.` };
      }
      terisi.set(`${sel.alternativeId}:${sel.criteriaId}`, { alternativeId: sel.alternativeId, criteriaId: sel.criteriaId, nilai: sel.nilai });
    }
    await db.$transaction(async (tx) => {
      await tx.alternativeValueMcdm.deleteMany({ where: { alternativeId: { in: [...altIds] } } });
      if (terisi.size > 0) {
        await tx.alternativeValueMcdm.createMany({ data: [...terisi.values()].map((s) => ({ ...s, clientId: kasus.clientId })) });
      }
    });
    segarkan(caseId);
    return { ok: true, pesan: 'Matriks nilai alternatif disimpan.' };
  } catch (e) {
    return galatTakTerduga(e, 'saveMatrix');
  }
}

/**
 * Simpan perbandingan berpasangan AHP. Ditolak bila Consistency Ratio > 0,1.
 * Bobot prioritas hasil perhitungan disalin ke kolom `bobot` tiap kriteria.
 */
export async function savePairwise(caseId: number, values: unknown): Promise<ActionResult<{ cr: number }>> {
  const { kasus, db } = await requireCaseAccess(caseId);
  if (kasus.category !== 'A' || kasus.methodKey !== 'ahp') return { ok: false, error: 'Case ini tidak memakai metode AHP.' };
  const parsed = pairwiseSchema.safeParse(values);
  if (!parsed.success) return tidakValid(parsed.error);
  try {
    const criteria = await db.criteriaMcdm.findMany({ where: { caseId }, orderBy: [{ urutan: 'asc' }, { id: 'asc' }], select: { id: true } });
    const ids = criteria.map((c) => c.id);
    const n = ids.length;
    if (n < 2) return { ok: false, error: 'Perbandingan berpasangan membutuhkan minimal 2 kriteria.' };
    const posisi = new Map(ids.map((id, i) => [id, i]));

    const matriks = ids.map((_, i) => ids.map((__, j) => (i === j ? 1 : Number.NaN)));
    for (const p of parsed.data) {
      const i = posisi.get(p.a);
      const j = posisi.get(p.b);
      if (i === undefined || j === undefined || i === j) return { ok: false, error: 'Data perbandingan tidak sesuai dengan Case ini.' };
      matriks[i][j] = p.nilai;
      matriks[j][i] = 1 / p.nilai;
    }
    if (matriks.some((row) => row.some((x) => Number.isNaN(x)))) return { ok: false, error: 'Lengkapi seluruh perbandingan berpasangan.' };

    const a = ahpWeights(matriks);
    if (!a.konsisten) {
      return {
        ok: false,
        error: `Consistency Ratio = ${a.cr.toFixed(4)} melebihi 0,1. Perbandingan ditolak — tinjau kembali penilaian yang saling bertentangan.`,
      };
    }

    await db.$transaction(async (tx) => {
      await tx.ahpPairwise.deleteMany({ where: { caseId } });
      const baris: { clientId: number; caseId: number; criteriaIdA: number; criteriaIdB: number; nilaiPerbandingan: number }[] = [];
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          baris.push({ clientId: kasus.clientId, caseId, criteriaIdA: ids[i], criteriaIdB: ids[j], nilaiPerbandingan: matriks[i][j] });
        }
      }
      await tx.ahpPairwise.createMany({ data: baris });
      for (let i = 0; i < n; i++) await tx.criteriaMcdm.update({ where: { id: ids[i] }, data: { bobot: a.weights[i] } });
    });
    segarkan(caseId);
    return { ok: true, pesan: `Perbandingan disimpan (CR = ${a.cr.toFixed(4)}).`, data: { cr: a.cr } };
  } catch (e) {
    return galatTakTerduga(e, 'savePairwise');
  }
}
