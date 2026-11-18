import { readFile } from 'node:fs/promises';
import path from 'node:path';

let cache: Promise<string> | null = null;

/**
 * CSS KaTeX dengan font WOFF2 ditanam sebagai data-URI, supaya dokumen PDF
 * dapat dirender tanpa mengakses jaringan maupun berkas statis.
 */
export function katexInlineCss(): Promise<string> {
  if (!cache) {
    cache = (async () => {
      const dist = path.join(process.cwd(), 'node_modules', 'katex', 'dist');
      let css = await readFile(path.join(dist, 'katex.min.css'), 'utf8');
      const fonts = new Set<string>();
      for (const m of css.matchAll(/url\((fonts\/[^)]+\.woff2)\)/g)) fonts.add(m[1]);
      const data = new Map<string, string>();
      await Promise.all(
        [...fonts].map(async (rel) => {
          const buf = await readFile(path.join(dist, rel));
          data.set(rel, `data:font/woff2;base64,${buf.toString('base64')}`);
        }),
      );
      // sisakan hanya sumber woff2 (ditanam), buang woff/ttf
      css = css.replace(/src:([^;}]+)/g, (_all, daftar: string) => {
        const woff2 = daftar.split(',').find((s) => s.includes('.woff2'));
        if (!woff2) return `src:${daftar}`;
        const m = woff2.match(/url\((fonts\/[^)]+\.woff2)\)/);
        const uri = m ? data.get(m[1]) : undefined;
        return uri ? `src:url(${uri}) format("woff2")` : `src:${daftar}`;
      });
      return css;
    })().catch((e) => {
      cache = null;
      throw e;
    });
  }
  return cache;
}
