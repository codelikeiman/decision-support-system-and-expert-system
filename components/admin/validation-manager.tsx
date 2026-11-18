'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmButton } from '@/components/confirm-button';
import { ConsultationFields } from '@/components/consultation-fields';
import { Field } from '@/components/field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { deleteValidationItem, deleteValidationTest, runValidationTest, saveValidationItem, saveValidationTest } from '@/lib/actions/validation';
import { inputKosong, type FormConfig } from '@/lib/spk/form-config';
import type { ConsultationInput } from '@/lib/spk/input';

type Alternatif = { id: number; kode: string; nama: string };

/** Dialog buat / ganti nama dataset uji. */
export function TestDialog({ caseId, id, namaAwal, children }: { caseId: number; id: number | null; namaAwal: string; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [nama, setNama] = React.useState(namaAwal);
  const [galat, setGalat] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const simpan = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const hasil = await saveValidationTest(caseId, id, { namaDatasetUji: nama });
      if (!hasil.ok) {
        setGalat(hasil.error);
        return;
      }
      toast.success(hasil.pesan ?? 'Tersimpan.');
      setOpen(false);
      if (id === null && hasil.data) router.push(`/admin/cases/${caseId}/validasi/${hasil.data.id}`);
      else router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setNama(namaAwal);
          setGalat(null);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <form onSubmit={simpan} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{id === null ? 'Buat dataset uji' : 'Ganti nama dataset uji'}</DialogTitle>
            <DialogDescription>Dataset uji berisi kasus-kasus yang diagnosis pakarnya sudah diketahui.</DialogDescription>
          </DialogHeader>
          <Field label="Nama dataset" htmlFor="vt-nama" required error={galat}>
            <Input id="vt-nama" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Data rekam medis 2025" autoFocus />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteTestButton({ caseId, id, nama }: { caseId: number; id: number; nama: string }) {
  return (
    <ConfirmButton
      action={deleteValidationTest.bind(null, caseId, id)}
      judul={`Hapus dataset “${nama}”?`}
      deskripsi="Seluruh data uji di dalam dataset ini ikut terhapus."
      redirectTo={`/admin/cases/${caseId}/validasi`}
    >
      <Button variant="outline">
        <Trash2 className="text-destructive" /> Hapus dataset
      </Button>
    </ConfirmButton>
  );
}

export function RunTestButton({ caseId, testId, disabled }: { caseId: number; testId: number; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const jalankan = () =>
    startTransition(async () => {
      const hasil = await runValidationTest(caseId, testId);
      if (hasil.ok) {
        toast.success(hasil.pesan ?? 'Pengujian selesai.');
        router.refresh();
      } else toast.error(hasil.error);
    });
  return (
    <Button onClick={jalankan} disabled={pending || disabled}>
      <Play />
      {pending ? 'Menjalankan…' : 'Jalankan pengujian'}
    </Button>
  );
}

interface ItemDialogProps {
  caseId: number;
  testId: number;
  id: number | null;
  form: FormConfig;
  alternatives: Alternatif[];
  awal: { label: string; diagnosisPakarAlternativeId: number; input: ConsultationInput | null };
  children: React.ReactNode;
}

/** Dialog tambah/ubah satu data uji — memakai form generator yang sama dengan halaman publik. */
export function ItemDialog({ caseId, testId, id, form, alternatives, awal, children }: ItemDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const mulai = React.useCallback(() => (awal.input && awal.input.kategori === form.kategori ? awal.input : inputKosong(form)), [awal.input, form]);
  const [input, setInput] = React.useState<ConsultationInput>(mulai);
  const [label, setLabel] = React.useState(awal.label);
  const [pakar, setPakar] = React.useState(awal.diagnosisPakarAlternativeId);
  const [galat, setGalat] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const simpan = (lanjut: boolean) => {
    setGalat(null);
    if (!pakar) {
      setGalat('Pilih diagnosis pakar.');
      return;
    }
    startTransition(async () => {
      const hasil = await saveValidationItem(caseId, testId, id, { label, diagnosisPakarAlternativeId: pakar, input });
      if (!hasil.ok) {
        setGalat(hasil.error);
        return;
      }
      toast.success(hasil.pesan ?? 'Tersimpan.');
      router.refresh();
      if (lanjut) {
        setInput(inputKosong(form));
        setLabel('');
        setPakar(0);
      } else setOpen(false);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setInput(mulai());
          setLabel(awal.label);
          setPakar(awal.diagnosisPakarAlternativeId);
          setGalat(null);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{id === null ? 'Tambah data uji' : 'Ubah data uji'}</DialogTitle>
          <DialogDescription>Isi masukan seperti yang diisi pengguna, lalu pilih diagnosis menurut pakar untuk kasus tersebut.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Label / keterangan" htmlFor="vi-label" hint="Opsional, mis. nomor rekam medis atau nama kasus.">
            <Input id="vi-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <Field label="Diagnosis pakar" htmlFor="vi-pakar" required>
            <Select id="vi-pakar" value={pakar || ''} onChange={(e) => setPakar(Number(e.target.value))}>
              <option value="" disabled>
                Pilih alternatif…
              </option>
              {alternatives.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.kode} — {a.nama}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Masukan kasus</p>
          <div className="max-h-[45dvh] overflow-y-auto rounded-xl border bg-background p-3">
            <ConsultationFields form={form} value={input} onChange={setInput} idPrefix={`vi-${id ?? 'baru'}`} />
          </div>
        </div>
        {galat ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
            {galat}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Batal
          </Button>
          {id === null ? (
            <Button type="button" variant="secondary" onClick={() => simpan(true)} disabled={pending}>
              Simpan &amp; tambah lagi
            </Button>
          ) : null}
          <Button type="button" onClick={() => simpan(false)} disabled={pending}>
            {pending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ItemActions(props: Omit<ItemDialogProps, 'children'> & { nomor: number }) {
  const { nomor, ...dialog } = props;
  return (
    <div className="flex justify-end gap-0.5">
      <ItemDialog {...dialog}>
        <Button variant="ghost" size="icon-sm" aria-label={`Ubah data uji ${nomor}`}>
          <Pencil />
        </Button>
      </ItemDialog>
      <ConfirmButton
        action={deleteValidationItem.bind(null, props.caseId, props.testId, props.id as number)}
        judul={`Hapus data uji ${nomor}?`}
        deskripsi="Data uji ini akan dihapus dari dataset."
      >
        <Button variant="ghost" size="icon-sm" aria-label={`Hapus data uji ${nomor}`}>
          <Trash2 className="text-destructive" />
        </Button>
      </ConfirmButton>
    </div>
  );
}

export function AddItemButton(props: Omit<ItemDialogProps, 'children' | 'id' | 'awal'>) {
  return (
    <ItemDialog {...props} id={null} awal={{ label: '', diagnosisPakarAlternativeId: 0, input: null }}>
      <Button variant="outline">
        <Plus /> Tambah data uji
      </Button>
    </ItemDialog>
  );
}
