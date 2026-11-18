import { mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Penyimpanan berkas unggahan (logo client, gambar ilustrasi Case).
 *
 *  - Supabase Storage bila SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY diisi
 *    (wajib di Vercel: disk serverless tidak permanen). Bucket bersifat PRIVAT
 *    dan dibuat otomatis; berkas disajikan lewat /api/files/… sehingga
 *    validasi nama berkas dan header keamanan tetap berlaku.
 *  - Folder lokal (UPLOAD_DIR) untuk pengembangan.
 *
 * Kunci objek selalu berbentuk "<clientId>/<nama-berkas>".
 */
export interface Storage {
  jenis: 'supabase' | 'lokal';
  simpan(kunci: string, data: Buffer, mime: string): Promise<void>;
  baca(kunci: string): Promise<Buffer | null>;
  hapus(kunci: string): Promise<void>;
  /** hapus seluruh objek di bawah awalan, mis. "12/" */
  hapusAwalan(awalan: string): Promise<void>;
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('Penyimpanan berkas belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY pada environment variables.');
    this.name = 'StorageNotConfiguredError';
  }
}

/* ------------------------------ Supabase ----------------------------- */

function storageSupabase(url: string, key: string, bucket: string): Storage {
  const sb: SupabaseClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let bucketSiap: Promise<void> | null = null;

  const pastikanBucket = () => {
    bucketSiap ??= (async () => {
      const { data } = await sb.storage.getBucket(bucket);
      if (data) return;
      const { error } = await sb.storage.createBucket(bucket, {
        public: false,
        fileSizeLimit: 2 * 1024 * 1024,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      });
      // bucket mungkin dibuat bersamaan oleh instance lain
      if (error && !/already exists|duplicate/i.test(error.message)) throw error;
    })().catch((e) => {
      bucketSiap = null;
      throw e;
    });
    return bucketSiap;
  };

  return {
    jenis: 'supabase',
    async simpan(kunci, data, mime) {
      await pastikanBucket();
      const { error } = await sb.storage.from(bucket).upload(kunci, data, { contentType: mime, upsert: false, cacheControl: '31536000' });
      if (error) throw error;
    },
    async baca(kunci) {
      const { data, error } = await sb.storage.from(bucket).download(kunci);
      if (error || !data) return null;
      return Buffer.from(await data.arrayBuffer());
    },
    async hapus(kunci) {
      await sb.storage.from(bucket).remove([kunci]);
    },
    async hapusAwalan(awalan) {
      const folder = awalan.replace(/\/+$/, '');
      for (;;) {
        const { data, error } = await sb.storage.from(bucket).list(folder, { limit: 100 });
        if (error || !data || data.length === 0) return;
        const kunci = data.filter((o) => o.id !== null).map((o) => `${folder}/${o.name}`);
        if (kunci.length === 0) return;
        const { error: e2 } = await sb.storage.from(bucket).remove(kunci);
        if (e2) return;
      }
    },
  };
}

/* -------------------------------- Lokal ------------------------------ */

function storageLokal(dir: string): Storage {
  const abs = (kunci: string) => {
    const p = path.resolve(dir, kunci);
    if (!p.startsWith(path.resolve(dir) + path.sep)) throw new Error('Kunci berkas tidak valid.');
    return p;
  };
  return {
    jenis: 'lokal',
    async simpan(kunci, data) {
      const p = abs(kunci);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, data);
    },
    async baca(kunci) {
      try {
        return await readFile(abs(kunci));
      } catch {
        return null;
      }
    },
    async hapus(kunci) {
      await unlink(abs(kunci)).catch(() => undefined);
    },
    async hapusAwalan(awalan) {
      await rm(abs(awalan.replace(/\/+$/, '')), { recursive: true, force: true }).catch(() => undefined);
    },
  };
}

let instance: Storage | null = null;

export function getStorage(): Storage {
  if (instance) return instance;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) {
    instance = storageSupabase(url, key, process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'spk-uploads');
  } else {
    // Di Vercel disk tidak permanen: tolak daripada menyimpan berkas yang akan hilang.
    if (process.env.VERCEL) throw new StorageNotConfiguredError();
    instance = storageLokal(path.resolve(process.cwd(), process.env.UPLOAD_DIR || './storage/uploads'));
  }
  return instance;
}

/** Hanya untuk pengujian. */
export function setStorageForTest(s: Storage | null): void {
  instance = s;
}
