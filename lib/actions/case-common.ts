'use server';

import { revalidatePath } from 'next/cache';
import { requireCaseAccess } from '@/lib/guards';
import { alternativeSchema, tampilanSchema } from '@/lib/schemas/knowledge';
import { hapusBerkas, milikClient } from '@/lib/uploads';
import type { ActionResult } from '@/lib/utils';
import { galatTakTerduga, tidakValid } from './helpers';

const segarkan = (caseId: number) => revalidatePath(`/admin/cases/${caseId}`, 'layout');
const PAKAI_PRIOR = new Set(['naive_bayes', 'bayesian_network']);

/* ---------------------------- Alternatif --------------------------- */

export async function saveAlternative(caseId: number, id: number | null, values: unknown): Promise<ActionResult> {
  const { kasus, db } = await requireCaseAccess(caseId);
  const parsed = alternativeSchema.safeParse(values);
  if (!parsed.success) return tidakValid(parsed.error);
  const v = parsed.data;
  const pakaiPrior = PAKAI_PRIOR.has(kasus.methodKey);
  try {
    const data = {
      namaAlternatif: v.namaAlternatif,
      deskripsiHasil: v.deskripsiHasil || null,
      saranTindakan: v.saranTindakan || null,
    };
    if (id === null) {
      const terakhir = await db.alternative.aggregate({ where: { caseId }, _max: { urutan: true } });
      await db.alternative.create({
        data: { ...data, clientId: kasus.clientId, caseId, prior: pakaiPrior ? v.prior : null, urutan: (terakhir._max.urutan ?? -1) + 1 },
      });
    } else {
      const ada = await db.alternative.findFirst({ where: { id, caseId }, select: { id: true } });
      if (!ada) return { ok: false, error: 'Alternatif tidak ditemukan.' };
      // prior hanya diubah bila metodenya memakai prior, agar nilai lama tidak hilang
      await db.alternative.update({ where: { id }, data: pakaiPrior ? { ...data, prior: v.prior } : data });
    }
    segarkan(caseId);
    return { ok: true, pesan: 'Alternatif disimpan.' };
  } catch (e) {
    return galatTakTerduga(e, 'saveAlternative');
  }
}

export async function deleteAlternative(caseId: number, id: number): Promise<ActionResult> {
  const { db } = await requireCaseAccess(caseId);
  try {
    const hasil = await db.alternative.deleteMany({ where: { id, caseId } });
    if (hasil.count === 0) return { ok: false, error: 'Alternatif tidak ditemukan.' };
    segarkan(caseId);
    return { ok: true, pesan: 'Alternatif dihapus.' };
  } catch (e) {
    return galatTakTerduga(e, 'deleteAlternative');
  }
}

type Jenis = 'alternatif' | 'kriteria' | 'gejala';

/** Geser urutan sebuah item (alternatif/kriteria/gejala) satu langkah naik atau turun. */
export async function moveItem(caseId: number, jenis: Jenis, id: number, arah: 'naik' | 'turun'): Promise<ActionResult> {
  const { db } = await requireCaseAccess(caseId);
  try {
    const urut = [{ urutan: 'asc' as const }, { id: 'asc' as const }];
    const daftar =
      jenis === 'alternatif'
        ? await db.alternative.findMany({ where: { caseId }, orderBy: urut, select: { id: true } })
        : jenis === 'kriteria'
          ? await db.criteriaMcdm.findMany({ where: { caseId }, orderBy: urut, select: { id: true } })
          : await db.symptom.findMany({ where: { caseId }, orderBy: urut, select: { id: true } });
    const ids = daftar.map((d) => d.id);
    const i = ids.indexOf(id);
    const j = arah === 'naik' ? i - 1 : i + 1;
    if (i === -1) return { ok: false, error: 'Data tidak ditemukan.' };
    if (j < 0 || j >= ids.length) return { ok: true };
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await db.$transaction(async (tx) => {
      for (let k = 0; k < ids.length; k++) {
        const where = { id: ids[k] };
        const data = { urutan: k };
        if (jenis === 'alternatif') await tx.alternative.update({ where, data });
        else if (jenis === 'kriteria') await tx.criteriaMcdm.update({ where, data });
        else await tx.symptom.update({ where, data });
      }
    });
    segarkan(caseId);
    return { ok: true };
  } catch (e) {
    return galatTakTerduga(e, 'moveItem');
  }
}

/* ----------------------------- Tampilan ---------------------------- */

export async function saveTampilan(caseId: number, values: unknown): Promise<ActionResult> {
  const { kasus, db } = await requireCaseAccess(caseId);
  const parsed = tampilanSchema.safeParse(values);
  if (!parsed.success) return tidakValid(parsed.error);
  const v = parsed.data;
  if (v.gambarUrl !== null && !milikClient(v.gambarUrl, kasus.clientId)) return { ok: false, error: 'Berkas gambar tidak valid.' };
  try {
    await db.spkCase.update({
      where: { id: caseId },
      data: { judul: v.judul, deskripsi: v.deskripsi || null, instruksi: v.instruksi || null, gambarUrl: v.gambarUrl },
    });
    if (kasus.gambarUrl && kasus.gambarUrl !== v.gambarUrl) await hapusBerkas(kasus.gambarUrl);
    segarkan(caseId);
    revalidatePath('/super-admin', 'layout');
    return { ok: true, pesan: 'Tampilan disimpan.' };
  } catch (e) {
    return galatTakTerduga(e, 'saveTampilan');
  }
}

/* ------------------------ Riwayat konsultasi ----------------------- */

export async function deleteConsultation(caseId: number, kode: string): Promise<ActionResult> {
  const { db } = await requireCaseAccess(caseId);
  try {
    const hasil = await db.consultation.deleteMany({ where: { kode, caseId } });
    if (hasil.count === 0) return { ok: false, error: 'Konsultasi tidak ditemukan.' };
    segarkan(caseId);
    return { ok: true, pesan: 'Riwayat konsultasi dihapus.' };
  } catch (e) {
    return galatTakTerduga(e, 'deleteConsultation');
  }
}
