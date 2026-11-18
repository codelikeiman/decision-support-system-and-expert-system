import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { METHODS, type CalcStep, type EngineHasil, type EngineMeta, type EngineResult, type RankingItem, type StepBlock } from '@/lib/engines';
import type { TenantDb } from '@/lib/tenant';
import { computeConsultation } from './compute';
import type { CaseConfig } from './config';
import { describeInput, type ConsultationInput, type InputSummary } from './input';

const ALFABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Kode konsultasi acak yang tidak dapat ditebak, mis. "KS-7GQ2M4XKPA9T". */
export function buatKodeKonsultasi(): string {
  const bytes = randomBytes(12);
  let kode = '';
  for (const b of bytes) kode += ALFABET[b % ALFABET.length];
  return `KS-${kode}`;
}

/** Isi kolom `hasil_json`. */
export interface StoredHasil {
  hasil: EngineHasil;
  ranking: RankingItem[];
  meta: EngineMeta;
  metode: { key: string; nama: string; singkatan: string; kategori: string };
  mcdmMode?: 'profil' | 'preferensi';
  /** salinan deskripsi & saran alternatif saat konsultasi dilakukan */
  rekomendasi: Record<string, { deskripsi: string | null; saran: string | null }>;
}

/** Isi kolom `input_data_json`. */
export type StoredInput = ConsultationInput & { ringkasan: InputSummary };

/** Isi kolom `detail_json` pada calculation_steps. */
export interface StoredStepDetail {
  deskripsi?: string;
  blok: StepBlock[];
}

export function buildStoredHasil(config: CaseConfig, result: EngineResult): StoredHasil {
  const info = METHODS[config.methodKey];
  return {
    hasil: result.hasil,
    ranking: result.ranking,
    meta: result.meta,
    metode: { key: info.key, nama: info.nama, singkatan: info.singkatan, kategori: info.kategori },
    mcdmMode: config.category === 'A' ? config.mcdmMode : undefined,
    rekomendasi: Object.fromEntries(
      config.alternatives.map((a) => [String(a.id), { deskripsi: a.deskripsiHasil, saran: a.saranTindakan }]),
    ),
  };
}

export interface SimpanParams {
  config: CaseConfig;
  input: ConsultationInput;
  userId: number | null;
  sessionId: string | null;
  namaResponden: string | null;
}

/** Hitung lalu simpan konsultasi beserta seluruh langkah perhitungannya (satu transaksi). */
export async function hitungDanSimpan(db: TenantDb, params: SimpanParams): Promise<{ kode: string; result: EngineResult }> {
  const { config, input } = params;
  const result = computeConsultation(config, input);
  const kode = buatKodeKonsultasi();
  const stored = buildStoredHasil(config, result);
  const storedInput: StoredInput = { ...input, ringkasan: describeInput(config, input) };

  await db.$transaction(async (tx) => {
    const konsultasi = await tx.consultation.create({
      data: {
        kode,
        clientId: config.clientId,
        caseId: config.caseId,
        userId: params.userId,
        sessionId: params.sessionId,
        methodKey: config.methodKey,
        namaResponden: params.namaResponden,
        inputDataJson: storedInput as unknown as Prisma.InputJsonValue,
        hasilJson: stored as unknown as Prisma.InputJsonValue,
        hasilAlternativeId: result.hasil.alternativeId,
        skor: result.hasil.skor,
      },
    });
    await tx.calculationStep.createMany({
      data: result.steps.map((s, i) => ({
        clientId: config.clientId,
        consultationId: konsultasi.id,
        langkahKe: i + 1,
        judulLangkah: s.judul,
        detailJson: { deskripsi: s.deskripsi, blok: s.detail } as unknown as Prisma.InputJsonValue,
        rumusText: s.rumus && s.rumus.length > 0 ? s.rumus.join('\n') : null,
      })),
    });
  });

  return { kode, result };
}

/** Ubah baris calculation_steps kembali menjadi CalcStep untuk ditampilkan. */
export function stepsFromRows(
  rows: { judulLangkah: string; detailJson: unknown; rumusText: string | null }[],
): CalcStep[] {
  return rows.map((r) => {
    const d = (r.detailJson ?? {}) as Partial<StoredStepDetail>;
    return {
      judul: r.judulLangkah,
      deskripsi: typeof d.deskripsi === 'string' ? d.deskripsi : undefined,
      rumus: r.rumusText ? r.rumusText.split('\n').filter((x) => x.trim() !== '') : undefined,
      detail: Array.isArray(d.blok) ? d.blok : [],
    };
  });
}

/** Baca kolom `hasil_json` dengan nilai cadangan yang aman bila bentuknya tidak lengkap. */
export function bacaHasil(json: unknown): StoredHasil {
  const j = (json ?? {}) as Partial<StoredHasil>;
  return {
    hasil: j.hasil ?? { alternativeId: null, nama: null, skor: null, ringkasan: '' },
    ranking: Array.isArray(j.ranking) ? j.ranking : [],
    meta: j.meta ?? { skorLabel: 'Skor', skorFormat: 'desimal' },
    metode: j.metode ?? { key: '', nama: '', singkatan: '', kategori: '' },
    mcdmMode: j.mcdmMode,
    rekomendasi: j.rekomendasi ?? {},
  };
}

/** Baca ringkasan masukan dari kolom `input_data_json`. */
export function bacaRingkasanInput(json: unknown): InputSummary {
  const r = (json as { ringkasan?: Partial<InputSummary> } | null)?.ringkasan;
  return { kolom: Array.isArray(r?.kolom) ? r.kolom : [], baris: Array.isArray(r?.baris) ? r.baris : [] };
}
