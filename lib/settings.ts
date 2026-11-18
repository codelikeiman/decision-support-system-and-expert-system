import { cache } from 'react';
import { prisma } from './db';

export interface SystemSettings {
  namaPlatform: string;
  deskripsiPlatform: string;
  /** jumlah angka desimal pada tampilan perhitungan */
  presisiDesimal: number;
  /** catatan yang tampil di halaman hasil & laporan PDF */
  teksDisclaimer: string;
  /** izinkan end-user mendaftar sendiri pada Case yang mewajibkan login */
  izinkanRegistrasi: boolean;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  namaPlatform: 'SPK Pakar',
  deskripsiPlatform: 'Platform sistem pendukung keputusan dan sistem pakar multi-tenant.',
  presisiDesimal: 4,
  teksDisclaimer:
    'Hasil ini merupakan keluaran sistem pendukung keputusan berdasarkan basis pengetahuan yang disusun pakar, dan bukan pengganti pemeriksaan maupun diagnosis oleh tenaga profesional.',
  izinkanRegistrasi: true,
};

const KUNCI: Record<keyof SystemSettings, string> = {
  namaPlatform: 'nama_platform',
  deskripsiPlatform: 'deskripsi_platform',
  presisiDesimal: 'presisi_desimal',
  teksDisclaimer: 'teks_disclaimer',
  izinkanRegistrasi: 'izinkan_registrasi',
};

export const getSettings = cache(async (): Promise<SystemSettings> => {
  let rows: { key: string; value: string }[] = [];
  try {
    rows = await prisma.systemSetting.findMany();
  } catch {
    // basis data belum siap (mis. saat build) → pakai nilai bawaan
    return DEFAULT_SETTINGS;
  }
  const peta = new Map(rows.map((r) => [r.key, r.value]));
  const presisi = Number(peta.get(KUNCI.presisiDesimal));
  return {
    namaPlatform: peta.get(KUNCI.namaPlatform) || DEFAULT_SETTINGS.namaPlatform,
    deskripsiPlatform: peta.get(KUNCI.deskripsiPlatform) ?? DEFAULT_SETTINGS.deskripsiPlatform,
    presisiDesimal: Number.isInteger(presisi) && presisi >= 0 && presisi <= 8 ? presisi : DEFAULT_SETTINGS.presisiDesimal,
    teksDisclaimer: peta.get(KUNCI.teksDisclaimer) ?? DEFAULT_SETTINGS.teksDisclaimer,
    izinkanRegistrasi: (peta.get(KUNCI.izinkanRegistrasi) ?? 'true') === 'true',
  };
});

export async function saveSettings(values: SystemSettings): Promise<void> {
  const data: [string, string][] = [
    [KUNCI.namaPlatform, values.namaPlatform],
    [KUNCI.deskripsiPlatform, values.deskripsiPlatform],
    [KUNCI.presisiDesimal, String(values.presisiDesimal)],
    [KUNCI.teksDisclaimer, values.teksDisclaimer],
    [KUNCI.izinkanRegistrasi, String(values.izinkanRegistrasi)],
  ];
  await prisma.$transaction(
    data.map(([key, value]) => prisma.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } })),
  );
}
