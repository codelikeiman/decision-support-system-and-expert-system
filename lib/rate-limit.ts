import { prisma } from './db';

/**
 * Pembatas percobaan (login, pendaftaran, konsultasi) yang disimpan di tabel
 * `rate_limits`, sehingga berlaku sama di semua instance serverless Vercel.
 *
 * Satu pernyataan INSERT … ON CONFLICT bersifat atomik: jendela baru dibuka
 * bila jendela lama sudah lewat, selain itu hitungan ditambah satu.
 * Bila database bermasalah, pembatas "gagal terbuka" agar pengguna sah tidak
 * terkunci — galat tetap dicatat.
 */

export interface HasilBatas {
  boleh: boolean;
  tungguDetik: number;
}

/** Catat satu percobaan lalu periksa apakah masih di bawah batas. */
export async function catatDanCek(kunci: string, maksimum: number, jendelaMs: number): Promise<HasilBatas> {
  try {
    const rows = await prisma.$queryRaw<{ jumlah: number; reset_at: Date }[]>`
      INSERT INTO rate_limits (key, jumlah, reset_at)
      VALUES (${kunci}, 1, now() + (${jendelaMs}::int * interval '1 millisecond'))
      ON CONFLICT (key) DO UPDATE SET
        jumlah   = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.jumlah + 1 END,
        reset_at = CASE WHEN rate_limits.reset_at <= now() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
      RETURNING jumlah, reset_at`;
    const r = rows[0];
    if (!r) return { boleh: true, tungguDetik: 0 };
    const boleh = r.jumlah <= maksimum;
    return { boleh, tungguDetik: boleh ? 0 : Math.max(1, Math.ceil((new Date(r.reset_at).getTime() - Date.now()) / 1000)) };
  } catch (e) {
    console.error('[rate-limit]', e);
    return { boleh: true, tungguDetik: 0 };
  } finally {
    // bersihkan entri kedaluwarsa sesekali (±1% permintaan)
    if (Math.random() < 0.01) void prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } }).catch(() => undefined);
  }
}

/** Periksa tanpa mencatat (dipakai sebelum memverifikasi kata sandi). */
export async function cekBatas(kunci: string, maksimum: number): Promise<HasilBatas> {
  try {
    const r = await prisma.rateLimit.findUnique({ where: { key: kunci } });
    if (!r || r.resetAt.getTime() <= Date.now() || r.jumlah < maksimum) return { boleh: true, tungguDetik: 0 };
    return { boleh: false, tungguDetik: Math.max(1, Math.ceil((r.resetAt.getTime() - Date.now()) / 1000)) };
  } catch (e) {
    console.error('[rate-limit]', e);
    return { boleh: true, tungguDetik: 0 };
  }
}

export async function hapusCatatan(kunci: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key: kunci } }).catch(() => undefined);
}
