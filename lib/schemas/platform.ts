import { z } from 'zod';
import { METHOD_KEYS } from '@/lib/engines/types';
import { HEX_WARNA } from '@/lib/utils';
import { passwordSchema } from './auth';

const slug = z
  .string()
  .trim()
  .min(2, 'Slug minimal 2 karakter.')
  .max(80, 'Slug maksimal 80 karakter.')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung.');

const warna = z.string().regex(HEX_WARNA, 'Warna harus berformat #RRGGBB.');

/** Slug Case yang bentrok dengan rute bawaan di bawah /c/[clientSlug]/. */
export const SLUG_CASE_TERLARANG = ['masuk', 'daftar', 'riwayat', 'akun'];
/** Awalan yang dipakai rute gambar pratinjau (opengraph-image, twitter-image). */
const AWALAN_TERLARANG = /^(opengraph-image|twitter-image|icon|apple-icon)/;

export const clientSchema = z.object({
  namaClient: z.string().trim().min(2, 'Nama client minimal 2 karakter.').max(150, 'Nama client terlalu panjang.'),
  slug,
  deskripsi: z.string().trim().max(1000, 'Deskripsi maksimal 1000 karakter.'),
  logoUrl: z.string().max(500).nullable(),
  warnaPrimary: warna,
  warnaSecondary: warna,
  warnaAccent: warna,
});
export type ClientValues = z.infer<typeof clientSchema>;

export const caseSchema = z.object({
  clientId: z.number().int().positive('Pilih client.'),
  judul: z.string().trim().min(3, 'Judul minimal 3 karakter.').max(150, 'Judul terlalu panjang.'),
  slug: slug.refine((s) => !SLUG_CASE_TERLARANG.includes(s) && !AWALAN_TERLARANG.test(s), 'Slug ini dipakai sistem; gunakan slug lain.'),
  deskripsi: z.string().trim().max(5000, 'Deskripsi terlalu panjang.'),
  methodKey: z.enum(METHOD_KEYS, { message: 'Pilih metode.' }),
  mcdmMode: z.enum(['profil', 'preferensi']),
  requiresLogin: z.boolean(),
  isActive: z.boolean(),
});
export type CaseValues = z.infer<typeof caseSchema>;

export const staffUserSchema = z
  .object({
    nama: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(100, 'Nama terlalu panjang.'),
    email: z.string().trim().toLowerCase().min(1, 'Email wajib diisi.').email('Format email tidak valid.').max(150),
    role: z.enum(['super_admin', 'admin']),
    clientId: z.number().int().positive().nullable(),
    /** kosong saat mengubah = kata sandi tidak diganti */
    password: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.role === 'admin' && !v.clientId) ctx.addIssue({ code: 'custom', path: ['clientId'], message: 'Admin harus terikat pada satu client.' });
    if (v.password !== '') {
      const p = passwordSchema.safeParse(v.password);
      if (!p.success) ctx.addIssue({ code: 'custom', path: ['password'], message: p.error.issues[0].message });
    }
  });
export type StaffUserValues = z.infer<typeof staffUserSchema>;

export const settingsSchema = z.object({
  namaPlatform: z.string().trim().min(2, 'Nama platform minimal 2 karakter.').max(60, 'Nama platform maksimal 60 karakter.'),
  deskripsiPlatform: z.string().trim().max(300, 'Deskripsi maksimal 300 karakter.'),
  presisiDesimal: z.number().int('Harus bilangan bulat.').min(0, 'Minimal 0.').max(8, 'Maksimal 8.'),
  teksDisclaimer: z.string().trim().max(1000, 'Maksimal 1000 karakter.'),
  izinkanRegistrasi: z.boolean(),
});
export type SettingsValues = z.infer<typeof settingsSchema>;
