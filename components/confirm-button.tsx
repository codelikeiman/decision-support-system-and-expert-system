'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { ActionResult } from '@/lib/utils';

interface Props {
  /** server action yang sudah di-bind dengan argumennya */
  action: () => Promise<ActionResult<unknown>>;
  judul: string;
  deskripsi: React.ReactNode;
  labelKonfirmasi?: string;
  variant?: 'destructive' | 'default';
  /** tujuan navigasi setelah berhasil (opsional) */
  redirectTo?: string;
  children: React.ReactNode;
}

/** Tombol dengan dialog konfirmasi untuk tindakan yang tidak dapat dibatalkan. */
export function ConfirmButton({ action, judul, deskripsi, labelKonfirmasi = 'Hapus', variant = 'destructive', redirectTo, children }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const jalankan = () =>
    startTransition(async () => {
      const hasil = await action();
      if (hasil.ok) {
        toast.success(hasil.pesan ?? 'Berhasil.');
        setOpen(false);
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } else {
        toast.error(hasil.error);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{judul}</DialogTitle>
          <DialogDescription asChild>
            <div>{deskripsi}</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Batal
            </Button>
          </DialogClose>
          <Button variant={variant} onClick={jalankan} disabled={pending}>
            {pending ? 'Memproses…' : labelKonfirmasi}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
