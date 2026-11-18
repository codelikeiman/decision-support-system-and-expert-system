import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Prisma client TANPA filter tenant. Hanya boleh dipakai untuk:
 *  - operasi Super Admin (lintas client),
 *  - autentikasi dan resolusi slug client,
 *  - membentuk `tenantDb(clientId)`.
 * Kode Admin/End-User wajib memakai `tenantDb` dari lib/tenant.ts.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
