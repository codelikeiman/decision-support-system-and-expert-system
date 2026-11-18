import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { METHODS, type Category, type MethodKey } from '@/lib/engines';
import type { ConsultationInput } from '@/lib/spk/input';

export const acak = () => randomBytes(4).toString('hex');

export async function buatClient(nama: string) {
  return prisma.client.create({ data: { namaClient: nama, slug: `uji-${acak()}` } });
}

export async function hapusClient(id: number) {
  await prisma.client.deleteMany({ where: { id } });
}

export interface Fixture {
  clientId: number;
  caseId: number;
  altIds: number[];
  /** masukan contoh yang sah untuk Case ini */
  input: ConsultationInput;
}

const METODE_AWAL: Record<Category, MethodKey> = { A: 'saw', B: 'certainty_factor', C: 'fuzzy_mamdani', D: 'forward_chaining' };

/** Bangun satu Case lengkap (basis pengetahuan minimal) untuk kategori tertentu. */
export async function buatCase(clientId: number, kategori: Category): Promise<Fixture> {
  const methodKey = METODE_AWAL[kategori];
  const kasus = await prisma.spkCase.create({
    data: { clientId, judul: `Uji ${kategori}`, slug: `uji-${kategori.toLowerCase()}-${acak()}`, methodKey, category: METHODS[methodKey].kategori },
  });
  const caseId = kasus.id;
  const alts: { id: number }[] = [];
  for (let i = 0; i < 3; i++) {
    alts.push(await prisma.alternative.create({ data: { clientId, caseId, namaAlternatif: `Alternatif ${i + 1}`, saranTindakan: `Saran ${i + 1}`, urutan: i } }));
  }
  const altIds = alts.map((a) => a.id);

  if (kategori === 'A') {
    const crits: { id: number }[] = [];
    for (let j = 0; j < 3; j++) {
      crits.push(
        await prisma.criteriaMcdm.create({
          data: {
            clientId,
            caseId,
            namaKriteria: `Kriteria ${j + 1}`,
            tipe: j === 1 ? 'cost' : 'benefit',
            bobot: 3 - j,
            urutan: j,
            scales: { create: [1, 2, 3, 4, 5].map((n) => ({ clientId, label: `Skala ${n}`, nilai: n, urutan: n })) },
          },
        }),
      );
    }
    const profil = [
      [1, 2, 1],
      [3, 3, 3],
      [5, 4, 5],
    ];
    await prisma.alternativeValueMcdm.createMany({
      data: profil.flatMap((row, i) => row.map((v, j) => ({ clientId, alternativeId: altIds[i], criteriaId: crits[j].id, nilai: v }))),
    });
    await prisma.ahpPairwise.createMany({
      data: [
        { clientId, caseId, criteriaIdA: crits[0].id, criteriaIdB: crits[1].id, nilaiPerbandingan: 3 },
        { clientId, caseId, criteriaIdA: crits[0].id, criteriaIdB: crits[2].id, nilaiPerbandingan: 5 },
        { clientId, caseId, criteriaIdA: crits[1].id, criteriaIdB: crits[2].id, nilaiPerbandingan: 3 },
      ],
    });
    return { clientId, caseId, altIds, input: { kategori: 'A', jawaban: Object.fromEntries(crits.map((c, j) => [String(c.id), [5, 4, 5][j]])) } };
  }

  if (kategori === 'B' || kategori === 'D') {
    const gejala: { id: number }[] = [];
    for (let k = 0; k < 4; k++) {
      gejala.push(await prisma.symptom.create({ data: { clientId, caseId, kodeGejala: `G0${k + 1}`, namaGejala: `Gejala ${k + 1}`, urutan: k } }));
    }
    if (kategori === 'B') {
      const bobot: [number, number, number][] = [
        [0, 0, 0.8],
        [0, 1, 0.6],
        [1, 1, 0.6],
        [1, 2, 0.7],
        [2, 2, 0.7],
        [2, 3, 0.9],
        [0, 3, 0.2],
      ];
      await prisma.alternativeSymptomWeight.createMany({
        data: bobot.map(([a, g, nilai]) => ({ clientId, alternativeId: altIds[a], symptomId: gejala[g].id, nilaiPakar: nilai })),
      });
      await prisma.conditionalDependency.create({
        data: { clientId, caseId, symptomIdChild: gejala[1].id, symptomIdParent: gejala[0].id, probabilitas: 0.5 },
      });
      return { clientId, caseId, altIds, input: { kategori: 'B', gejala: [{ id: gejala[0].id, keyakinan: 0.8 }, { id: gejala[1].id }] } };
    }
    await prisma.ruleChaining.create({
      data: {
        clientId,
        caseId,
        alternativeId: altIds[0],
        namaRule: 'Aturan 1',
        conditions: { create: [{ clientId, symptomId: gejala[0].id, operator: 'AND', urutan: 0 }, { clientId, symptomId: gejala[1].id, operator: 'AND', urutan: 1 }] },
      },
    });
    await prisma.ruleChaining.create({
      data: {
        clientId,
        caseId,
        alternativeId: altIds[1],
        namaRule: 'Aturan 2',
        urutan: 1,
        conditions: { create: [{ clientId, symptomId: gejala[2].id, operator: 'AND', urutan: 0 }, { clientId, symptomId: gejala[3].id, operator: 'OR', urutan: 1 }] },
      },
    });
    return { clientId, caseId, altIds, input: { kategori: 'D', gejala: [gejala[0].id, gejala[1].id] } };
  }

  // Kategori C — himpunan output linear agar sah untuk Tsukamoto maupun Mamdani
  const buatVar = (nama: string, tipe: 'input' | 'output', urutan: number) =>
    prisma.fuzzyVariable.create({
      data: {
        clientId,
        caseId,
        namaVariabel: nama,
        tipe,
        nilaiMin: 0,
        nilaiMax: 100,
        urutan,
        sets: {
          create: [
            { clientId, namaHimpunan: 'Rendah', fungsiKeanggotaan: 'linear_turun', parameterJson: { a: 20, b: 80 }, urutan: 0 },
            { clientId, namaHimpunan: 'Tinggi', fungsiKeanggotaan: 'linear_naik', parameterJson: { a: 20, b: 80 }, urutan: 1 },
          ],
        },
      },
      include: { sets: { orderBy: { urutan: 'asc' } } },
    });
  const x = await buatVar('X', 'input', 0);
  const y = await buatVar('Y', 'input', 1);
  const z = await buatVar('Z', 'output', 2);
  let urutan = 0;
  for (const a of [0, 1]) {
    for (const b of [0, 1]) {
      const tinggi = a + b >= 1 ? 1 : 0;
      await prisma.fuzzyRule.create({
        data: {
          clientId,
          caseId,
          alternativeId: altIds[tinggi === 1 ? 2 : 0],
          ruleText: `R${urutan + 1}`,
          antesedenJson: { operator: 'AND', kondisi: [{ variable_id: x.id, set_id: x.sets[a].id }, { variable_id: y.id, set_id: y.sets[b].id }] },
          konsekuenJson: { variable_id: z.id, set_id: z.sets[tinggi].id },
          urutan: urutan++,
        },
      });
    }
  }
  return { clientId, caseId, altIds, input: { kategori: 'C', nilai: { [String(x.id)]: 65, [String(y.id)]: 40 } } };
}
