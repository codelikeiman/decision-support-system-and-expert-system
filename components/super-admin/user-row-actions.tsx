'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmButton } from '@/components/confirm-button';
import { Button } from '@/components/ui/button';
import { deleteUser, setUserActive } from '@/lib/actions/super-admin';
import type { StaffUserValues } from '@/lib/schemas/platform';
import { UserDialog } from './user-dialog';

interface Props {
  user: { id: number; nama: string; isActive: boolean; role: 'super_admin' | 'admin' | 'end_user' };
  diriSendiri: boolean;
  clients: { id: number; namaClient: string }[];
  /** nilai awal dialog ubah; null untuk end-user (tidak dapat diubah dari sini) */
  edit: StaffUserValues | null;
}

export function UserRowActions({ user, diriSendiri, clients, edit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const ubahStatus = () =>
    startTransition(async () => {
      const hasil = await setUserActive(user.id, !user.isActive);
      if (hasil.ok) {
        toast.success(hasil.pesan ?? 'Tersimpan.');
        router.refresh();
      } else toast.error(hasil.error);
    });

  return (
    <div className="flex items-center justify-end gap-1">
      {edit ? (
        <UserDialog id={user.id} clients={clients} defaultValues={edit}>
          <Button variant="ghost" size="icon-sm" aria-label={`Ubah ${user.nama}`}>
            <Pencil />
          </Button>
        </UserDialog>
      ) : null}
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending || diriSendiri}
        onClick={ubahStatus}
        aria-label={user.isActive ? `Nonaktifkan ${user.nama}` : `Aktifkan ${user.nama}`}
        title={user.isActive ? 'Nonaktifkan' : 'Aktifkan'}
      >
        <Power className={user.isActive ? 'text-emerald-600' : 'text-muted-foreground'} />
      </Button>
      <ConfirmButton
        action={deleteUser.bind(null, user.id)}
        judul="Hapus akun?"
        deskripsi={
          <>
            Akun <strong>{user.nama}</strong> akan dihapus permanen. Riwayat konsultasi yang pernah dibuatnya tetap tersimpan tanpa identitas akun.
          </>
        }
      >
        <Button variant="ghost" size="icon-sm" disabled={diriSendiri} aria-label={`Hapus ${user.nama}`}>
          <Trash2 className="text-destructive" />
        </Button>
      </ConfirmButton>
    </div>
  );
}
