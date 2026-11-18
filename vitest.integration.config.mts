import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Prisma CLI dan Next.js memuat .env sendiri, tetapi proses uji tidak —
// muat di sini agar DATABASE_URL tersedia bagi Prisma Client.
if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
// Uji integrasi selalu memakai penyimpanan yang diatur oleh masing-masing uji.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Uji integrasi: membutuhkan database MySQL (DATABASE_URL pada .env) yang
 * skemanya sudah diterapkan. Setiap uji membuat datanya sendiri dan
 * menghapusnya kembali.
 *
 *   npm run test:integration
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.itest.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': import.meta.dirname },
  },
});
