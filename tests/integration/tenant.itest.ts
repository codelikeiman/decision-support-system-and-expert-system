import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { tenantDb } from '@/lib/tenant';
import { buatCase, buatClient, hapusClient, type Fixture } from './fixtures';

/**
 * Isolasi tenant pada lapisan query: client A tidak boleh membaca, mengubah,
 * atau menghapus data client B melalui `tenantDb`, apa pun kondisi `where`
 * yang dikirim pemanggil.
 */
describe('tenantDb — isolasi data antar-client', () => {
  let a: Fixture;
  let b: Fixture;

  beforeAll(async () => {
    const [ca, cb] = await Promise.all([buatClient('Tenant A'), buatClient('Tenant B')]);
    a = await buatCase(ca.id, 'D');
    b = await buatCase(cb.id, 'D');
  });

  afterAll(async () => {
    await hapusClient(a.clientId);
    await hapusClient(b.clientId);
    await prisma.$disconnect();
  });

  it('membaca: data client lain tidak pernah ditemukan', async () => {
    const db = tenantDb(a.clientId);
    expect(await db.spkCase.findFirst({ where: { id: b.caseId } })).toBeNull();
    expect(await db.spkCase.findUnique({ where: { id: b.caseId } })).toBeNull();
    expect(await db.alternative.findMany({ where: { caseId: b.caseId } })).toEqual([]);
    expect(await db.alternative.findMany({ where: { id: { in: b.altIds } } })).toEqual([]);
    expect(await db.alternative.count({ where: { caseId: b.caseId } })).toBe(0);
    // OR pada kondisi pemanggil tidak dapat "melubangi" filter client
    const lolos = await db.alternative.findMany({ where: { OR: [{ caseId: a.caseId }, { caseId: b.caseId }] } });
    expect(lolos.length).toBe(3);
    expect(lolos.every((x) => x.clientId === a.clientId)).toBe(true);
    // tanpa where sama sekali → tetap hanya milik sendiri
    const semua = await db.alternative.findMany();
    expect(semua.every((x) => x.clientId === a.clientId)).toBe(true);
    const agg = await db.symptom.groupBy({ by: ['clientId'], _count: { _all: true } });
    expect(agg.map((g) => g.clientId)).toEqual([a.clientId]);
  });

  it('mengubah & menghapus: tidak berdampak pada client lain', async () => {
    const db = tenantDb(a.clientId);
    await expect(db.alternative.update({ where: { id: b.altIds[0] }, data: { namaAlternatif: 'DIBAJAK' } })).rejects.toThrow();
    expect((await db.alternative.updateMany({ where: { id: { in: b.altIds } }, data: { namaAlternatif: 'DIBAJAK' } })).count).toBe(0);
    await expect(db.alternative.delete({ where: { id: b.altIds[0] } })).rejects.toThrow();
    expect((await db.alternative.deleteMany({ where: { caseId: b.caseId } })).count).toBe(0);
    expect((await db.spkCase.deleteMany({ where: { id: b.caseId } })).count).toBe(0);

    const utuh = await prisma.alternative.findMany({ where: { caseId: b.caseId } });
    expect(utuh.length).toBe(3);
    expect(utuh.some((x) => x.namaAlternatif === 'DIBAJAK')).toBe(false);
  });

  it('membuat: client_id selalu ditimpa dengan tenant yang aktif', async () => {
    const db = tenantDb(a.clientId);
    const baru = await db.alternative.create({ data: { clientId: b.clientId, caseId: a.caseId, namaAlternatif: 'Sisipan' } });
    expect(baru.clientId).toBe(a.clientId);
    await db.symptom.createMany({
      data: [
        { clientId: b.clientId, caseId: a.caseId, kodeGejala: 'X1', namaGejala: 'x1' },
        { clientId: b.clientId, caseId: a.caseId, kodeGejala: 'X2', namaGejala: 'x2' },
      ],
    });
    const x = await prisma.symptom.findMany({ where: { kodeGejala: { in: ['X1', 'X2'] }, caseId: a.caseId } });
    expect(x.length).toBe(2);
    expect(x.every((s) => s.clientId === a.clientId)).toBe(true);
    const hasilUpsert = await db.alternative.upsert({
      where: { id: baru.id },
      create: { clientId: b.clientId, caseId: a.caseId, namaAlternatif: 'tidak dipakai' },
      update: { namaAlternatif: 'Sisipan 2' },
    });
    expect(hasilUpsert.clientId).toBe(a.clientId);
    expect(hasilUpsert.namaAlternatif).toBe('Sisipan 2');
    await db.alternative.delete({ where: { id: baru.id } });
  });

  it('transaksi interaktif tetap terkunci pada tenant', async () => {
    const db = tenantDb(a.clientId);
    const hasil = await db.$transaction(async (tx) => {
      const milikB = await tx.alternative.findMany({ where: { caseId: b.caseId } });
      const diubah = await tx.alternative.updateMany({ where: { caseId: b.caseId }, data: { urutan: 99 } });
      const milikA = await tx.alternative.count();
      return { milikB: milikB.length, diubah: diubah.count, milikA };
    });
    expect(hasil).toEqual({ milikB: 0, diubah: 0, milikA: 3 });
  });

  it('operasi di luar daftar yang diizinkan ditolak', async () => {
    expect(() => tenantDb(0)).toThrow();
    expect(() => tenantDb(Number.NaN)).toThrow();
  });
});
