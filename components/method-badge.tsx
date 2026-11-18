import { Badge } from '@/components/ui/badge';
import { METHODS, isMethodKey } from '@/lib/engines';

/** Lencana metode + kategori untuk daftar Case. */
export function MethodBadge({ methodKey }: { methodKey: string }) {
  if (!isMethodKey(methodKey)) return <Badge variant="outline">{methodKey}</Badge>;
  const m = METHODS[methodKey];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Badge variant="secondary" title={m.nama}>
        {m.singkatan}
      </Badge>
      <span className="text-xs whitespace-nowrap text-muted-foreground">Kat. {m.kategori}</span>
    </span>
  );
}
