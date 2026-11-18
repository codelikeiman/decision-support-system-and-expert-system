import { EngineError, type Cell, type ChainRule, type ChainingInput, type EngineResult, type SymptomRef } from './types';
import { buildRanking, fmt, nearlyEqual, safe } from './utils';

/** Pecah kondisi menjadi kelompok-AND yang dipisahkan OR (AND didahulukan). */
export function ruleGroups(rule: Pick<ChainRule, 'conditions'>): number[][] {
  const groups: number[][] = [];
  rule.conditions.forEach((c, i) => {
    if (i === 0 || c.operator === 'OR') groups.push([c.symptomId]);
    else groups[groups.length - 1].push(c.symptomId);
  });
  return groups;
}

export function ruleToText(rule: ChainRule, symById: Map<number, SymptomRef>, namaAlternatif: string): string {
  const groups = ruleGroups(rule);
  const teks = groups
    .map((g) => {
      const isi = g.map((id) => symById.get(id)?.kode ?? '?').join(' DAN ');
      return groups.length > 1 && g.length > 1 ? `(${isi})` : isi;
    })
    .join(' ATAU ');
  return `JIKA ${teks} MAKA ${namaAlternatif}`;
}

/**
 * Forward Chaining (penalaran maju, data-driven).
 * Fakta awal = gejala yang dialami pengguna. Mesin inferensi mencocokkan premis
 * setiap aturan dengan memori kerja, menjalankan (fire) aturan yang seluruh
 * premisnya terpenuhi, menambahkan kesimpulannya ke memori kerja, dan mengulang
 * sampai tidak ada aturan baru yang dapat dijalankan.
 */
export function forwardChaining(input: ChainingInput): EngineResult {
  if (input.alternatives.length === 0) throw new EngineError('Forward Chaining: belum ada alternatif.');
  if (input.rules.length === 0) throw new EngineError('Forward Chaining: basis aturan (rule) masih kosong.');
  if (input.selected.length === 0) throw new EngineError('Pilih minimal satu gejala yang dialami.');

  const symById = new Map(input.symptoms.map((s) => [s.id, s]));
  const altById = new Map(input.alternatives.map((a) => [a.id, a]));
  for (const id of input.selected) {
    if (!symById.has(id)) throw new EngineError('Terdapat gejala terpilih yang tidak dikenal pada kasus ini.');
  }
  input.rules.forEach((r) => {
    if (r.conditions.length === 0) throw new EngineError(`Forward Chaining: aturan "${r.nama}" belum memiliki kondisi.`);
    if (!altById.has(r.alternativeId)) throw new EngineError(`Forward Chaining: aturan "${r.nama}" merujuk alternatif yang tidak ada.`);
    for (const c of r.conditions) {
      if (!symById.has(c.symptomId)) throw new EngineError(`Forward Chaining: aturan "${r.nama}" merujuk gejala yang tidak ada.`);
    }
  });

  const fakta = new Set(input.selected);
  const dipilih = input.symptoms.filter((s) => fakta.has(s.id));

  const steps: EngineResult['steps'] = [
    {
      judul: 'Fakta awal (gejala yang dipilih)',
      deskripsi: `Memori kerja diisi ${dipilih.length} gejala yang dialami pengguna.`,
      detail: [
        {
          type: 'table',
          kolom: ['No', 'Kode', 'Gejala'],
          baris: dipilih.map((s, i) => [i + 1, safe(s.kode), safe(s.nama)]),
        },
      ],
    },
    {
      judul: 'Basis aturan',
      deskripsi: 'Aturan produksi IF–THEN yang disusun pakar. Operator DAN dievaluasi lebih dahulu daripada ATAU.',
      rumus: ['\\text{JIKA } G_1 \\land G_2 \\land \\dots \\land G_k \\text{ MAKA } H'],
      detail: [
        {
          type: 'table',
          kolom: ['Aturan', 'Isi aturan'],
          baris: input.rules.map((r, i) => [
            `R${i + 1} — ${safe(r.nama)}`,
            safe(ruleToText(r, symById, altById.get(r.alternativeId)?.nama ?? '?')),
          ]),
        },
      ],
    },
  ];

  // Evaluasi satu aturan terhadap memori kerja.
  const evaluasi = (rule: ChainRule) => {
    const groups = ruleGroups(rule);
    let terbaik = { cocok: 0, total: groups[0].length, rasio: 0, penuh: false };
    for (const g of groups) {
      const cocok = g.filter((id) => fakta.has(id)).length;
      const kandidat = { cocok, total: g.length, rasio: cocok / g.length, penuh: cocok === g.length };
      const lebihBaik =
        (kandidat.penuh && !terbaik.penuh) ||
        (kandidat.penuh === terbaik.penuh && (kandidat.rasio > terbaik.rasio || (kandidat.rasio === terbaik.rasio && kandidat.cocok > terbaik.cocok)));
      if (lebihBaik) terbaik = kandidat;
    }
    const semua = [...new Set(groups.flat())];
    return {
      ...terbaik,
      terpenuhi: semua.filter((id) => fakta.has(id)),
      tidak: semua.filter((id) => !fakta.has(id)),
    };
  };

  const sudahJalan = new Set<number>();
  const kesimpulan: number[] = [];
  const hasilAturan = new Map<number, ReturnType<typeof evaluasi>>();
  const iterasiBlok: EngineResult['steps'][number]['detail'] = [];
  let iterasi = 0;
  let adaBaru = true;
  while (adaBaru && iterasi < input.rules.length + 2) {
    iterasi += 1;
    adaBaru = false;
    const baris: Cell[][] = [];
    input.rules.forEach((rule, i) => {
      if (sudahJalan.has(rule.id)) return;
      const ev = evaluasi(rule);
      hasilAturan.set(rule.id, ev);
      const kode = (ids: number[]) => (ids.length === 0 ? '–' : ids.map((id) => safe(symById.get(id)!.kode)).join(', '));
      if (ev.penuh) {
        sudahJalan.add(rule.id);
        if (!kesimpulan.includes(rule.alternativeId)) kesimpulan.push(rule.alternativeId);
        adaBaru = true;
      }
      baris.push([
        `R${i + 1}`,
        kode(ev.terpenuhi),
        kode(ev.tidak),
        `${ev.cocok}/${ev.total} (${fmt(ev.rasio * 100, 0)}%)`,
        ev.penuh ? `Dijalankan → ${safe(altById.get(rule.alternativeId)!.nama)}` : 'Tidak terpenuhi',
      ]);
    });
    if (baris.length === 0) break;
    iterasiBlok.push({
      type: 'table',
      judul: `Iterasi ${iterasi}`,
      kolom: ['Aturan', 'Premis terpenuhi', 'Premis tidak terpenuhi', 'Kecocokan', 'Status'],
      baris,
      sorot: baris.map((b, i) => (String(b[4]).startsWith('Dijalankan') ? i : -1)).filter((i) => i >= 0),
      catatan: adaBaru
        ? undefined
        : 'Tidak ada aturan baru yang dapat dijalankan — inferensi berhenti.',
    });
  }

  steps.push({
    judul: 'Proses inferensi (pencocokan aturan)',
    deskripsi:
      'Setiap aturan yang belum dijalankan dicocokkan dengan memori kerja. Aturan dijalankan bila seluruh premis pada salah satu kelompok DAN-nya terpenuhi.',
    detail: iterasiBlok,
  });

  // Skor alternatif = jumlah aturan yang terpenuhi; seri → jumlah premis yang cocok lebih banyak.
  const jumlah = input.alternatives.map((a) => input.rules.filter((r) => r.alternativeId === a.id && sudahJalan.has(r.id)).length);
  const premis = input.alternatives.map((a) =>
    input.rules
      .filter((r) => r.alternativeId === a.id && sudahJalan.has(r.id))
      .reduce((acc, r) => acc + (hasilAturan.get(r.id)?.cocok ?? 0), 0),
  );
  const terdekat = input.alternatives.map((a) =>
    input.rules.filter((r) => r.alternativeId === a.id).reduce((acc, r) => Math.max(acc, hasilAturan.get(r.id)?.rasio ?? 0), 0),
  );

  const ranking = buildRanking(input.alternatives, jumlah, {
    tieBreak: (a, b) => {
      if (premis[a] !== premis[b]) return premis[b] - premis[a];
      if (!nearlyEqual(terdekat[a], terdekat[b])) return terdekat[b] - terdekat[a];
      return 0;
    },
    keterangan: (i) =>
      jumlah[i] > 0 ? `${jumlah[i]} aturan terpenuhi, ${premis[i]} premis cocok` : `Kecocokan tertinggi ${fmt(terdekat[i] * 100, 0)}%`,
  });

  steps.push({
    judul: 'Kesimpulan dan peringkat',
    deskripsi:
      'Alternatif diurutkan berdasarkan jumlah aturan yang terpenuhi; bila sama, alternatif dengan premis cocok lebih banyak didahulukan. Kolom kecocokan tertinggi hanya bersifat informasi untuk aturan yang belum terpenuhi.',
    detail: [
      {
        type: 'table',
        kolom: ['Peringkat', 'Alternatif', 'Aturan terpenuhi', 'Premis cocok', 'Kecocokan aturan tertinggi'],
        baris: ranking.map((r) => {
          const i = input.alternatives.findIndex((a) => a.id === r.alternativeId);
          return [r.peringkat, `${r.kode} — ${safe(r.nama)}`, jumlah[i], premis[i], `${fmt(terdekat[i] * 100, 0)}%`];
        }),
        sorot: ranking.length > 0 && ranking[0].skor > 0 ? [0] : [],
      },
    ],
  });

  const top = ranking[0];
  const adaHasil = top !== undefined && top.skor > 0;
  const lain = ranking.filter((r) => r.skor > 0).slice(1);
  return {
    hasil: adaHasil
      ? {
          alternativeId: top.alternativeId,
          nama: top.nama,
          skor: top.skor,
          ringkasan:
            `Gejala yang dipilih memenuhi ${fmt(top.skor, 0)} aturan untuk ${top.nama}.` +
            (lain.length > 0 ? ` Kemungkinan lain: ${lain.map((r) => r.nama).join(', ')}.` : ''),
        }
      : {
          alternativeId: null,
          nama: null,
          skor: null,
          ringkasan: 'Tidak ada aturan yang seluruh premisnya terpenuhi oleh gejala yang dipilih.',
        },
    ranking,
    steps,
    meta: {
      skorLabel: 'Jumlah aturan terpenuhi',
      skorFormat: 'bulat',
      info: [{ label: 'Aturan dijalankan', nilai: `${sudahJalan.size} dari ${input.rules.length}` }],
    },
  };
}
