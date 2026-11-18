import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { catatDanCek, cekBatas, hapusCatatan } from '@/lib/rate-limit';
import { getStorage, setStorageForTest } from '@/lib/storage';
import { bacaBerkas, hapusBerkas, hapusBerkasClient, simpanGambar } from '@/lib/uploads';

describe('Keamanan basis data (Supabase)', () => {
  afterAll(() => prisma.$disconnect());

  it('RLS aktif pada SEMUA tabel di skema public (Data API tertutup)', async () => {
    const tanpaRls = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity`;
    expect(tanpaRls.map((t) => t.tablename)).toEqual([]);
  });

  it('peran anon/authenticated (bila ada) tidak punya hak atas tabel aplikasi', async () => {
    const hak = await prisma.$queryRaw<{ grantee: string; table_name: string }[]>`
      SELECT grantee, table_name FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')`;
    expect(hak).toEqual([]);
  });
});

describe('Pembatas percobaan berbasis database', () => {
  const kunci = `uji:${Date.now()}:${Math.random()}`;
  afterAll(() => hapusCatatan(kunci));

  it('mengizinkan sampai batas lalu menolak, dan dapat direset', async () => {
    for (let i = 1; i <= 3; i++) expect((await catatDanCek(kunci, 3, 60_000)).boleh).toBe(true);
    const ke4 = await catatDanCek(kunci, 3, 60_000);
    expect(ke4.boleh).toBe(false);
    expect(ke4.tungguDetik).toBeGreaterThan(0);
    expect((await cekBatas(kunci, 3)).boleh).toBe(false);
    await hapusCatatan(kunci);
    expect((await cekBatas(kunci, 3)).boleh).toBe(true);
  });

  it('atomik: percobaan bersamaan tidak melewati batas', async () => {
    const k = `${kunci}:paralel`;
    const hasil = await Promise.all(Array.from({ length: 20 }, () => catatDanCek(k, 5, 60_000)));
    expect(hasil.filter((h) => h.boleh).length).toBe(5);
    await hapusCatatan(k);
  });

  it('jendela yang sudah lewat dibuka ulang', async () => {
    const k = `${kunci}:lewat`;
    await catatDanCek(k, 1, 1);
    await new Promise((r) => setTimeout(r, 20));
    expect((await catatDanCek(k, 1, 60_000)).boleh).toBe(true);
    await hapusCatatan(k);
  });
});

/**
 * Server tiruan Supabase Storage REST API (subset yang dipakai supabase-js):
 * memverifikasi bahwa driver memakai service role key, membuat bucket privat,
 * mengunggah, mengunduh, dan menghapus objek dengan benar.
 */
describe('Driver Supabase Storage', () => {
  const objek = new Map<string, { data: Buffer; mime: string }>();
  const bucket: { id?: string; public?: boolean } = {};
  const log: string[] = [];
  let server: http.Server;
  const KEY = 'service-role-uji';

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        const url = new URL(req.url ?? '/', 'http://x');
        const p = decodeURIComponent(url.pathname);
        log.push(`${req.method} ${p}`);
        const json = (status: number, o: unknown) => {
          res.writeHead(status, { 'content-type': 'application/json' });
          res.end(JSON.stringify(o));
        };
        if (req.headers.authorization !== `Bearer ${KEY}`) return json(401, { message: 'unauthorized' });
        let m: RegExpMatchArray | null;
        if (req.method === 'GET' && (m = p.match(/^\/storage\/v1\/bucket\/([^/]+)$/))) {
          return bucket.id === m[1] ? json(200, { id: bucket.id, name: bucket.id, public: bucket.public }) : json(400, { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' });
        }
        if (req.method === 'POST' && p === '/storage/v1/bucket') {
          const b = JSON.parse(body.toString());
          bucket.id = b.id ?? b.name;
          bucket.public = b.public;
          return json(200, { name: bucket.id });
        }
        if (req.method === 'POST' && (m = p.match(/^\/storage\/v1\/object\/list\/([^/]+)$/))) {
          const { prefix } = JSON.parse(body.toString());
          const isi = [...objek.keys()].filter((k) => k.startsWith(`${m![1]}/${prefix}/`)).map((k) => ({ id: k, name: k.split('/').pop() }));
          return json(200, isi);
        }
        if (req.method === 'POST' && (m = p.match(/^\/storage\/v1\/object\/(.+)$/))) {
          objek.set(m[1], { data: body, mime: String(req.headers['content-type']) });
          return json(200, { Key: m[1] });
        }
        if (req.method === 'GET' && (m = p.match(/^\/storage\/v1\/object\/(?:authenticated\/)?(.+)$/))) {
          const o = objek.get(m[1]);
          if (!o) return json(400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
          res.writeHead(200, { 'content-type': o.mime });
          return res.end(o.data);
        }
        if (req.method === 'DELETE' && (m = p.match(/^\/storage\/v1\/object\/([^/]+)$/))) {
          const { prefixes } = JSON.parse(body.toString()) as { prefixes: string[] };
          for (const k of prefixes) objek.delete(`${m[1]}/${k}`);
          return json(200, prefixes.map((k) => ({ name: k })));
        }
        json(404, { message: `rute tidak dikenal: ${req.method} ${p}` });
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    process.env.SUPABASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = KEY;
    process.env.SUPABASE_STORAGE_BUCKET = 'uji-bucket';
    setStorageForTest(null);
  });

  afterAll(async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    setStorageForTest(null);
    await new Promise((r) => server.close(r));
  });

  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC', 'base64');

  it('unggah → bucket privat dibuat otomatis → unduh → hapus', async () => {
    expect(getStorage().jenis).toBe('supabase');
    const hasil = await simpanGambar(PNG, 7);
    if ('error' in hasil) throw new Error(hasil.error);
    expect(hasil.url).toMatch(/^\/api\/files\/7\/[a-z0-9]+-[a-f0-9]{16}\.png$/);
    expect(bucket).toEqual({ id: 'uji-bucket', public: false });
    expect(objek.size).toBe(1);
    expect([...objek.values()][0].mime).toBe('image/png');

    const baca = await bacaBerkas(hasil.url);
    expect(baca?.mime).toBe('image/png');
    expect(baca?.data.equals(PNG)).toBe(true);

    await hapusBerkas(hasil.url);
    expect(objek.size).toBe(0);
    expect(await bacaBerkas(hasil.url)).toBeNull();
  });

  it('menolak berkas bukan gambar tanpa mengunggah apa pun', async () => {
    const r = await simpanGambar(Buffer.from('<svg onload=alert(1)>'), 7);
    expect('error' in r).toBe(true);
    expect(objek.size).toBe(0);
  });

  it('hapus seluruh berkas satu client tanpa menyentuh client lain', async () => {
    const a1 = await simpanGambar(PNG, 8);
    const a2 = await simpanGambar(PNG, 8);
    const b1 = await simpanGambar(PNG, 9);
    expect(objek.size).toBe(3);
    await hapusBerkasClient(8);
    expect([...objek.keys()]).toEqual([`uji-bucket/${('url' in b1 ? b1.url : '').replace('/api/files/', '')}`]);
    expect('url' in a1 && 'url' in a2).toBe(true);
  });

  it('URL yang bukan buatan sistem tidak pernah diteruskan ke storage', async () => {
    const sebelum = log.length;
    expect(await bacaBerkas('/api/files/../../rahasia.png')).toBeNull();
    expect(await bacaBerkas('https://contoh.test/x.png')).toBeNull();
    expect(log.length).toBe(sebelum);
  });
});
