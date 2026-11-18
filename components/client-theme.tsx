import { HEX_WARNA, kontrasTeks } from '@/lib/utils';

interface Props {
  warnaPrimary: string;
  warnaSecondary: string;
  warnaAccent: string;
}

const aman = (hex: string, cadangan: string) => (HEX_WARNA.test(hex) ? hex : cadangan);

/**
 * Menyuntikkan warna merek client sebagai CSS variable. Nilai divalidasi
 * sebagai hex #RRGGBB sehingga tidak dapat menyisipkan CSS lain.
 */
export function ClientTheme({ warnaPrimary, warnaSecondary, warnaAccent }: Props) {
  const p = aman(warnaPrimary, '#0f766e');
  const s = aman(warnaSecondary, '#134e4a');
  const a = aman(warnaAccent, '#f59e0b');
  const css =
    `:root{--brand-primary:${p};--brand-primary-foreground:${kontrasTeks(p)};` +
    `--brand-secondary:${s};--brand-secondary-foreground:${kontrasTeks(s)};` +
    `--brand-accent:${a};--brand-accent-foreground:${kontrasTeks(a)};` +
    `--primary:${p};--primary-foreground:${kontrasTeks(p)};--ring:${p};}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
