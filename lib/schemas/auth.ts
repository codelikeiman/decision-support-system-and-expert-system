import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email wajib diisi.').email('Format email tidak valid.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const passwordSchema = z
  .string()
  .min(8, 'Kata sandi minimal 8 karakter.')
  .max(72, 'Kata sandi maksimal 72 karakter.')
  .regex(/[A-Za-z]/, 'Kata sandi harus memuat huruf.')
  .regex(/[0-9]/, 'Kata sandi harus memuat angka.');

export const registerSchema = z
  .object({
    nama: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(100, 'Nama terlalu panjang.'),
    email: z.string().trim().toLowerCase().min(1, 'Email wajib diisi.').email('Format email tidak valid.').max(150),
    password: passwordSchema,
    konfirmasi: z.string(),
  })
  .refine((v) => v.password === v.konfirmasi, { path: ['konfirmasi'], message: 'Konfirmasi kata sandi tidak sama.' });
export type RegisterValues = z.infer<typeof registerSchema>;
