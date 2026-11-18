import { z } from 'zod';
import type { ActionResult } from '@/lib/utils';

/** Ubah galat zod menjadi ActionResult dengan pesan per kolom. */
export function tidakValid(error: z.ZodError): ActionResult<never> {
  const flat = z.flattenError(error);
  const pertama = flat.formErrors[0] ?? Object.values(flat.fieldErrors as Record<string, string[] | undefined>).flat()[0];
  return {
    ok: false,
    error: pertama ?? 'Periksa kembali isian form.',
    fieldErrors: flat.fieldErrors as Record<string, string[] | undefined>,
  };
}

/** Pesan galat yang aman ditampilkan; detail teknis hanya dicatat di log server. */
export function galatTakTerduga(e: unknown, konteks: string): ActionResult<never> {
  console.error(`[${konteks}]`, e);
  return { ok: false, error: 'Terjadi kesalahan pada server. Silakan coba lagi.' };
}
