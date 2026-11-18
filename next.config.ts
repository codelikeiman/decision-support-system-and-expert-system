import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Dijalankan langsung oleh Node.js (tidak di-bundle).
  serverExternalPackages: ['@prisma/client', 'puppeteer-core', '@sparticuz/chromium'],
  // Berkas yang dibaca saat runtime oleh fungsi laporan PDF harus ikut dikemas
  // ke fungsi serverless Vercel: CSS & font KaTeX serta biner Chromium.
  outputFileTracingIncludes: {
    '/api/consultations/[kode]/pdf': [
      './node_modules/katex/dist/katex.min.css',
      './node_modules/katex/dist/fonts/*.woff2',
      './node_modules/@sparticuz/chromium/bin/**',
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
