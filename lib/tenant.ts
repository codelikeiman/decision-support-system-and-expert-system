import { prisma } from './db';

/**
 * Model yang memiliki kolom `client_id`. Setiap operasi pada model-model ini
 * melalui `tenantDb(clientId)` otomatis dibatasi pada client tersebut.
 */
const TENANT_MODELS = new Set([
  'User',
  'SpkCase',
  'Alternative',
  'Consultation',
  'CalculationStep',
  'ValidationTest',
  'ValidationTestItem',
  'CriteriaMcdm',
  'CriteriaScaleMcdm',
  'AlternativeValueMcdm',
  'AhpPairwise',
  'Symptom',
  'AlternativeSymptomWeight',
  'ConditionalDependency',
  'FuzzyVariable',
  'FuzzySet',
  'FuzzyRule',
  'RuleChaining',
  'RuleCondition',
]);

const BACA_DAN_UBAH = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
]);

type Args = Record<string, unknown>;

function buatTenantDb(clientId: number) {
  return prisma.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation: op, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          const operation: string = op;
          const a = { ...(args as Args) };

          if (BACA_DAN_UBAH.has(operation)) {
            // Filter client_id ditambahkan (AND) pada kondisi apa pun dari pemanggil.
            a.where = { ...((a.where as Args) ?? {}), clientId };
          } else if (operation === 'create') {
            a.data = { ...(a.data as Args), clientId };
          } else if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const data = a.data as Args | Args[];
            a.data = Array.isArray(data) ? data.map((d) => ({ ...d, clientId })) : { ...data, clientId };
          } else if (operation === 'upsert') {
            a.where = { ...((a.where as Args) ?? {}), clientId };
            a.create = { ...(a.create as Args), clientId };
          } else {
            throw new Error(`Operasi "${operation}" pada model ${model} tidak diizinkan melalui tenantDb.`);
          }
          return query(a as typeof args);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof buatTenantDb>;

const cache = new Map<number, TenantDb>();

/**
 * Prisma client yang terkunci pada satu client (tenant).
 *
 * - baca/ubah/hapus: `where` selalu ditambah `clientId`
 * - buat: `clientId` selalu ditimpa dengan id tenant
 *
 * Catatan: gunakan kolom skalar (`caseId`, `alternativeId`, ...) saat membuat
 * data, dan sertakan `clientId` pada nested create.
 */
export function tenantDb(clientId: number): TenantDb {
  if (!Number.isInteger(clientId) || clientId <= 0) {
    throw new Error('tenantDb membutuhkan clientId yang valid.');
  }
  let db = cache.get(clientId);
  if (!db) {
    db = buatTenantDb(clientId);
    cache.set(clientId, db);
  }
  return db;
}
