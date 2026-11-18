'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Field } from '@/components/field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { saveStaffUser } from '@/lib/actions/super-admin';
import { terapkanGalat } from '@/lib/form';
import { staffUserSchema, type StaffUserValues } from '@/lib/schemas/platform';

interface Props {
  id: number | null;
  clients: { id: number; namaClient: string }[];
  defaultValues: StaffUserValues;
  children: React.ReactNode;
}

/** Dialog buat/ubah akun pengelola (Admin per-client atau Super Admin). */
export function UserDialog({ id, clients, defaultValues, children }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StaffUserValues>({ resolver: zodResolver(staffUserSchema), defaultValues });
  const role = watch('role');

  const onSubmit = handleSubmit(async (values) => {
    const hasil = await saveStaffUser(id, values);
    if (!hasil.ok) {
      terapkanGalat(hasil, setError);
      toast.error(hasil.error);
      return;
    }
    toast.success(hasil.pesan ?? 'Tersimpan.');
    setOpen(false);
    router.refresh();
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset(defaultValues);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{id === null ? 'Tambah akun pengelola' : 'Ubah akun pengelola'}</DialogTitle>
            <DialogDescription>Admin hanya dapat mengelola data pada client tempat ia ditugaskan.</DialogDescription>
          </DialogHeader>
          <Field label="Nama" htmlFor="u-nama" required error={errors.nama?.message}>
            <Input id="u-nama" aria-invalid={!!errors.nama} {...register('nama')} />
          </Field>
          <Field label="Email" htmlFor="u-email" required error={errors.email?.message}>
            <Input id="u-email" type="email" autoComplete="off" aria-invalid={!!errors.email} {...register('email')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Peran" htmlFor="u-role" required error={errors.role?.message}>
              <Select id="u-role" {...register('role')}>
                <option value="admin">Admin (per-client)</option>
                <option value="super_admin">Super Admin</option>
              </Select>
            </Field>
            {role === 'admin' ? (
              <Field label="Client" htmlFor="u-client" required error={errors.clientId?.message}>
                <Controller
                  control={control}
                  name="clientId"
                  render={({ field }) => (
                    <Select
                      id="u-client"
                      aria-invalid={!!errors.clientId}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Pilih client…</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.namaClient}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              </Field>
            ) : null}
          </div>
          <Field
            label="Kata sandi"
            htmlFor="u-password"
            required={id === null}
            error={errors.password?.message}
            hint={id === null ? 'Minimal 8 karakter, memuat huruf dan angka.' : 'Kosongkan bila tidak ingin mengganti kata sandi.'}
          >
            <Input id="u-password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
