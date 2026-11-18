'use server';

import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { EngineError } from '@/lib/engines';
import { requireCaseAccess } from '@/lib/guards';
import { validationItemSchema, validationTestSchema } from '@/lib/schemas/knowledge';
import { computeConsultation } from '@/lib/spk/compute';
import { loadCaseConfig } from '@/lib/spk/config';
import { describeInput, validateInput } from '@/lib/spk/input';
import { checkReadiness } from '@/lib/spk/readiness';
import type { ActionResult } from '@/lib/utils';
import { galatTakTerduga, tidakValid } from './helpers';

const segarkan = (caseId: number) => revalidatePath(`/admin/cases/${caseId}/validasi`, 'layout');

export async function saveValidationTest(caseId: number, id: number | null, values: unknown): Promise<ActionResult<{ id: number }>> {
  const { kasus, db } = await requireCaseAccess(caseId);
  const parsed = validationTestSchema.safeParse(values);
  if (!parsed.success) return tidakValid(parsed.error);
  try {
    if (id === null) {
      const baru = await db.validationTest.create({ data: { clientId: kasus.clientId, caseId, namaDatasetUji: parsed.data.namaDatasetUji } });
      segarkan(caseId);
      return { ok: true, pesan: 'Dataset uji dibuat.', data: { id: baru.id } };
    }
    const hasil = await db.validationTest.updateMany({ where: { id, caseId }, data: { namaDatasetUji: parsed.data.namaDatasetUji } });
    if (hasil.count === 0) return { ok: false, error: 'Dataset uji tidak ditemukan.' };
    segarkan(caseId);
    return { ok: true, pesan: 'Nama dataset diperbarui.', data: { id } };
  } catch (e) {
    return galatTakTerduga(e, 'saveValidationTest');
  }
}

export async function deleteValidationTest(caseId: number, id: number): Promise<ActionResult> {
  const { db } = await requireCaseAccess(caseId);
  try {
    const hasil = await db.validationTest.deleteMany({ where: { id, caseId } });
    if (hasil.count === 0) return { ok: false, error: 'Dataset uji tidak ditemukan.' };
    segarkan(caseId);
    return { ok: true, pesan: 'Dataset uji dihapus.' };
  } catch (e) {
    return galatTakTerduga(e, 'deleteValidationTest');
  }
}

export async function saveValidationItem(
  caseId: number,
  testId: number,
  id: number | null,
  values: { label: string; diagnosisPakarAlternativeId: number; input: unknown },
): Promise<ActionResult> {
  const { kasus, db } = await requireCaseAccess(caseId);
  const parsed = validationItemSchema.safeParse(values);
  if (!parsed.success) return tidakValid(parsed.error);
  try {
    const [test, config] = await Promise.all([
      db.validationTest.findFirst({ where: { id: testId, caseId }, select: { id: true } }),
      loadCaseConfig(db, kasus),
    ]);
    if (!test) return { ok: false, error: 'Dataset uji tidak ditemukan.' };
    if (!config.alternatives.some((a) => a.id === parsed.data.diagnosisPakarAlternativeId)) {
      return { ok: false, error: 'Diagnosis pakar harus salah satu alternatif pada Case ini.' };
    }
    const cek = validateInput(config, values.input);
    if (!cek.ok) return { ok: false, error: cek.error };

    const data = {
      label: parsed.data.label || null,
      diagnosisPakarAlternativeId: parsed.data.diagnosisPakarAlternativeId,
      inputDataJson: { ...cek.input, ringkasan: describeInput(config, cek.input) } as unknown as Prisma.InputJsonValue,
      // data berubah → hasil pengujian sebelumnya tidak berlaku lagi
      hasilSistemAlternativeId: null,
      skor: null,
      status: null,
      catatan: null,
    };
    if (id === null) {
      await db.validationTestItem.create({ data: { ...data, clientId: kasus.clientId, validationTestId: testId } });
    } else {
      const hasil = await db.validationTestItem.updateMany({ where: { id, validationTestId: testId }, data });
      if (hasil.count === 0) return { ok: false, error: 'Data uji tidak ditemukan.' };
    }
    segarkan(caseId);
    return { ok: true, pesan: 'Data uji disimpan.' };
  } catch (e) {
    return galatTakTerduga(e, 'saveValidationItem');
  }
}

export async function deleteValidationItem(caseId: number, testId: number, id: number): Promise<ActionResult> {
  const { db } = await requireCaseAccess(caseId);
  try {
    const test = await db.validationTest.findFirst({ where: { id: testId, caseId }, select: { id: true } });
    if (!test) return { ok: false, error: 'Dataset uji tidak ditemukan.' };
    const hasil = await db.validationTestItem.deleteMany({ where: { id, validationTestId: testId } });
    if (hasil.count === 0) return { ok: false, error: 'Data uji tidak ditemukan.' };
    segarkan(caseId);
    return { ok: true, pesan: 'Data uji dihapus.' };
  } catch (e) {
    return galatTakTerduga(e, 'deleteValidationItem');
  }
}

/**
 * Jalankan seluruh data uji melalui engine metode yang sedang aktif — jalur
 * perhitungan yang sama persis dengan konsultasi end-user — lalu bandingkan
 * hasil sistem dengan diagnosis pakar.
 */
export async function runValidationTest(caseId: number, testId: number): Promise<ActionResult<{ total: number; cocok: number }>> {
  const { kasus, db } = await requireCaseAccess(caseId);
  try {
    const test = await db.validationTest.findFirst({ where: { id: testId, caseId }, include: { items: { orderBy: { id: 'asc' } } } });
    if (!test) return { ok: false, error: 'Dataset uji tidak ditemukan.' };
    if (test.items.length === 0) return { ok: false, error: 'Dataset uji belum memiliki data.' };

    const config = await loadCaseConfig(db, kasus);
    const kesiapan = checkReadiness(config);
    if (!kesiapan.siap) {
      const pertama = kesiapan.issues.find((i) => i.level === 'error');
      return { ok: false, error: `Basis pengetahuan belum lengkap: ${pertama?.pesan ?? 'periksa halaman Ringkasan.'}` };
    }

    let cocok = 0;
    const pembaruan = test.items.map((item) => {
      let hasilId: number | null = null;
      let skor: number | null = null;
      let catatan: string | null = null;
      const cek = validateInput(config, item.inputDataJson);
      if (!cek.ok) catatan = cek.error;
      else {
        try {
          const r = computeConsultation(config, cek.input);
          hasilId = r.hasil.alternativeId;
          skor = r.hasil.skor;
          if (hasilId === null) catatan = r.hasil.ringkasan;
        } catch (e) {
          if (e instanceof EngineError) catatan = e.message;
          else throw e;
        }
      }
      const sama = hasilId !== null && hasilId === item.diagnosisPakarAlternativeId;
      if (sama) cocok += 1;
      return { id: item.id, hasilSistemAlternativeId: hasilId, skor, status: sama ? ('match' as const) : ('mismatch' as const), catatan };
    });

    await db.$transaction(async (tx) => {
      for (const p of pembaruan) {
        await tx.validationTestItem.update({
          where: { id: p.id },
          data: { hasilSistemAlternativeId: p.hasilSistemAlternativeId, skor: p.skor, status: p.status, catatan: p.catatan },
        });
      }
      await tx.validationTest.update({ where: { id: testId }, data: { lastRunAt: new Date(), lastRunMethod: kasus.methodKey } });
    });
    segarkan(caseId);
    return {
      ok: true,
      pesan: `Pengujian selesai: ${cocok} dari ${test.items.length} data sesuai (${((cocok / test.items.length) * 100).toFixed(2)}%).`,
      data: { total: test.items.length, cocok },
    };
  } catch (e) {
    return galatTakTerduga(e, 'runValidationTest');
  }
}
