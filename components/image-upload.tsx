'use client';

import * as React from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface Props {
  clientId: number;
  value: string | null;
  onChange: (url: string | null) => void;
  /** kelas pratinjau, mis. "h-16 w-16" */
  previewClassName?: string;
  label?: string;
}

/** Unggah gambar ke /api/upload; nilai (URL) dikelola oleh form induk. */
export function ImageUpload({ clientId, value, onChange, previewClassName = 'h-20 w-20', label = 'Unggah gambar' }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [sibuk, setSibuk] = React.useState(false);

  const unggah = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran berkas melebihi 2 MB.');
      return;
    }
    setSibuk(true);
    try {
      const body = new FormData();
      body.set('clientId', String(clientId));
      body.set('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Gagal mengunggah berkas.');
      onChange(json.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengunggah berkas.');
    } finally {
      setSibuk(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted ${previewClassName}`}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Pratinjau" className="h-full w-full object-contain" />
        ) : (
          <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void unggah(f);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={sibuk} onClick={() => inputRef.current?.click()}>
            <ImagePlus />
            {sibuk ? 'Mengunggah…' : value ? 'Ganti' : label}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" disabled={sibuk} onClick={() => onChange(null)}>
              <Trash2 />
              Hapus
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, atau GIF. Maksimal 2 MB.</p>
      </div>
    </div>
  );
}
