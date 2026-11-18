'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { moveItem } from '@/lib/actions/case-common';

interface Props {
  caseId: number;
  jenis: 'alternatif' | 'kriteria' | 'gejala';
  id: number;
  pertama: boolean;
  terakhir: boolean;
}

export function MoveButtons({ caseId, jenis, id, pertama, terakhir }: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const geser = (arah: 'naik' | 'turun') =>
    startTransition(async () => {
      const hasil = await moveItem(caseId, jenis, id, arah);
      if (hasil.ok) router.refresh();
      else toast.error(hasil.error);
    });
  return (
    <>
      <Button variant="ghost" size="icon-sm" disabled={pending || pertama} onClick={() => geser('naik')} aria-label="Geser ke atas">
        <ArrowUp />
      </Button>
      <Button variant="ghost" size="icon-sm" disabled={pending || terakhir} onClick={() => geser('turun')} aria-label="Geser ke bawah">
        <ArrowDown />
      </Button>
    </>
  );
}
