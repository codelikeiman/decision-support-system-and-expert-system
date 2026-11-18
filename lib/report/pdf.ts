import { existsSync } from 'node:fs';
import type { Browser } from 'puppeteer-core';

/** Kesalahan saat browser untuk ekspor PDF tidak tersedia. */
export class PdfUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfUnavailableError';
  }
}

/** Lokasi Chrome/Chromium/Edge yang umum di komputer pengembang. */
const KANDIDAT = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

/** Berjalan di lingkungan serverless (Vercel / AWS Lambda)? */
const serverless = () => Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

let browserPromise: Promise<Browser> | null = null;
let timerTutup: NodeJS.Timeout | null = null;

/**
 * Luncurkan browser headless.
 *  - Vercel/Lambda: Chromium serverless dari @sparticuz/chromium.
 *  - Lokal: PUPPETEER_EXECUTABLE_PATH, atau Chrome/Edge yang terpasang.
 */
async function luncurkan(): Promise<Browser> {
  const puppeteer = (await import('puppeteer-core')).default;
  const galat: string[] = [];

  if (serverless()) {
    try {
      const chromium = (await import('@sparticuz/chromium')).default;
      return await puppeteer.launch({
        args: await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
        executablePath: await chromium.executablePath(),
        headless: 'shell',
      });
    } catch (e) {
      galat.push(e instanceof Error ? e.message.split('\n')[0] : String(e));
    }
  } else {
    const argumen = ['--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'];
    const tanpaSandbox = process.env.PUPPETEER_NO_SANDBOX === 'true' || (typeof process.getuid === 'function' && process.getuid() === 0);
    if (tanpaSandbox) argumen.push('--no-sandbox', '--disable-setuid-sandbox');
    const percobaan = [process.env.PUPPETEER_EXECUTABLE_PATH?.trim(), ...KANDIDAT].filter((p): p is string => !!p && existsSync(p));
    for (const executablePath of [...new Set(percobaan)]) {
      try {
        return await puppeteer.launch({ headless: true, executablePath, args: argumen });
      } catch (e) {
        galat.push(e instanceof Error ? e.message.split('\n')[0] : String(e));
      }
    }
    if (percobaan.length === 0) galat.push('Chrome tidak ditemukan');
  }

  throw new PdfUnavailableError(
    `Browser untuk ekspor PDF tidak dapat dijalankan. Di komputer lokal, pasang Google Chrome atau atur PUPPETEER_EXECUTABLE_PATH. (${galat.join('; ')})`,
  );
}

async function ambilBrowser(): Promise<Browser> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b && b.connected) return b;
    browserPromise = null;
  }
  browserPromise = luncurkan();
  try {
    return await browserPromise;
  } catch (e) {
    browserPromise = null;
    throw e;
  }
}

function jadwalkanTutup() {
  if (timerTutup) clearTimeout(timerTutup);
  timerTutup = setTimeout(async () => {
    const p = browserPromise;
    browserPromise = null;
    try {
      await (await p)?.close();
    } catch {
      /* abaikan */
    }
  }, 60_000);
  timerTutup.unref?.();
}

/**
 * Render dokumen HTML mandiri menjadi PDF A4. JavaScript halaman dimatikan dan
 * seluruh permintaan jaringan ditolak — dokumen hanya boleh memakai sumber
 * daya yang tertanam (data-URI).
 */
export async function htmlToPdf(html: string, footerText: string): Promise<Uint8Array> {
  const browser = await ambilBrowser();
  const page = await browser.newPage();
  try {
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (req: import('puppeteer-core').HTTPRequest) => {
      const url = req.url();
      if (url.startsWith('data:') || url === 'about:blank') void req.continue();
      else void req.abort();
    });
    await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
    await page.evaluateHandle('document.fonts.ready').catch(() => undefined);
    const aman = footerText.replace(/[<>&"]/g, '');
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', right: '14mm', bottom: '18mm', left: '14mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;padding:0 14mm;font-size:8px;color:#64748b;display:flex;justify-content:space-between;font-family:Arial,sans-serif"><span>${aman}</span><span>Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></span></div>`,
    });
  } finally {
    await page.close().catch(() => undefined);
    jadwalkanTutup();
  }
}
