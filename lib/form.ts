import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { ActionResult } from '@/lib/utils';

/** Tampilkan galat per kolom dari server action pada form react-hook-form. */
export function terapkanGalat<T extends FieldValues>(hasil: ActionResult<unknown>, setError: UseFormSetError<T>): void {
  if (hasil.ok || !hasil.fieldErrors) return;
  for (const [kunci, pesan] of Object.entries(hasil.fieldErrors)) {
    if (pesan && pesan[0]) setError(kunci as Path<T>, { type: 'server', message: pesan[0] });
  }
}

/** Opsi register untuk input angka: string kosong → NaN (ditolak zod dengan pesan yang jelas). */
export const sebagaiAngka = { valueAsNumber: true } as const;
