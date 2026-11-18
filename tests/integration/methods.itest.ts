import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { METHOD_LIST, type Category } from '@/lib/engines';
import { renderSteps } from '@/lib/report/render';
import { buildReportHtml } from '@/lib/report/document';
import { loadCaseConfig } from '@/lib/spk/config';
import { bacaHasil, bacaRingkasanInput, hitungDanSimpan, stepsFromRows } from '@/lib/spk/consultation';
import { validateInput } from '@/lib/spk/input';
import { checkReadiness } from '@/lib/spk/readiness';
import { tenantDb } from '@/lib/tenant';
import { buatCase, buatClient, hapusClient, type Fixture } from './fixtures';

/**
 * Ke-15 metode dijalankan melalui jalur yang sama dengan konsultasi end-user:
 * muat konfigurasi dari database → cek kesiapan → validasi input → hitung →
 * simpan hasil & langkah → baca kembali → render HTML (web & laporan PDF).
 */
describe('15 metode — pipeline konsultasi dengan database', () => {
  let clientId: number;
  const fx = {} as Record<Category, Fixture>;

  beforeAll(async () => {
    clientId = (await buatClient('Uji Metode')).id;
    for (const k of ['A', 'B', 'C', 'D'] as Category[]) fx[k] = await buatCase(clientId, k);
  });

  afterAll(async () => {
    await hapusClient(clientId);
    await prisma.$disconnect();
  });

  for (const metode of METHOD_LIST) {
    it(`${metode.singkatan} (${metode.key})`, async () => {
      const f = fx[metode.kategori];
      const db = tenantDb(clientId);
      const kasus = await db.spkCase.update({ where: { id: f.caseId }, data: { methodKey: metode.key } });
      const config = await loadCaseConfig(db, kasus);

      const kesiapan = checkReadiness(config);
      expect(kesiapan.issues.filter((i) => i.level === 'error')).toEqual([]);

      const cek = validateInput(config, f.input);
      expect(cek.ok).toBe(true);
      if (!cek.ok) return;

      const { kode, result } = await hitungDanSimpan(db, { config, input: cek.input, userId: null, sessionId: 'a'.repeat(32), namaResponden: 'Uji <i>integrasi</i>' });
      expect(kode).toMatch(/^KS-[0-9A-Z]{12}$/);
      expect(result.ranking).toHaveLength(3);
      expect(result.hasil.alternativeId).not.toBeNull();
      result.ranking.forEach((r) => expect(Number.isFinite(r.skor)).toBe(true));

      const tersimpan = await db.consultation.findFirstOrThrow({ where: { kode }, include: { steps: { orderBy: { langkahKe: 'asc' } } } });
      expect(tersimpan.clientId).toBe(clientId);
      expect(tersimpan.methodKey).toBe(metode.key);
      expect(tersimpan.hasilAlternativeId).toBe(result.hasil.alternativeId);
      expect(tersimpan.steps.length).toBe(result.steps.length);
      expect(tersimpan.steps.length).toBeGreaterThanOrEqual(4);
      expect(tersimpan.steps.map((s) => s.langkahKe)).toEqual(tersimpan.steps.map((_, i) => i + 1));
      expect(tersimpan.steps.every((s) => s.clientId === clientId)).toBe(true);

      // baca kembali → identik dengan hasil engine
      const steps = stepsFromRows(tersimpan.steps);
      expect(steps.map((s) => s.judul)).toEqual(result.steps.map((s) => s.judul));
      const stored = bacaHasil(tersimpan.hasilJson);
      expect(stored.metode.key).toBe(metode.key);
      expect(stored.rekomendasi[String(result.hasil.alternativeId)]?.saran).toMatch(/^Saran /);
      expect(bacaRingkasanInput(tersimpan.inputDataJson).baris.length).toBeGreaterThan(0);

      // render web: tidak ada rumus yang gagal, setiap langkah punya isi
      const html = renderSteps(steps, { digits: 4, collapsible: true });
      expect(html).not.toContain('katex-error');
      expect(html).not.toContain('NaN');
      expect(html.match(/<details class="calc-step"/g)?.length).toBe(steps.length);
      expect(html).toContain('class="katex');

      // dokumen laporan (HTML untuk PDF): mandiri & nama responden di-escape
      const doc = await buildReportHtml({
        namaPlatform: 'Uji',
        client: { nama: 'Uji Metode', warnaPrimary: '#0f766e', logoDataUri: null },
        kasus: { judul: kasus.judul },
        konsultasi: { kode, createdAt: tersimpan.createdAt, namaResponden: tersimpan.namaResponden },
        input: bacaRingkasanInput(tersimpan.inputDataJson),
        stored,
        steps,
        digits: 4,
        disclaimer: 'Catatan.',
      });
      expect(doc).toContain('Uji &lt;i&gt;integrasi&lt;/i&gt;');
      expect(doc).not.toContain('<i>integrasi</i>');
      expect(doc).not.toMatch(/url\(fonts\//); // font KaTeX tertanam, tidak merujuk berkas luar
      expect(doc).not.toContain('katex-error');
    });
  }
});
