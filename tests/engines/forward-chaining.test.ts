import { describe, expect, it } from 'vitest';
import { forwardChaining, EngineError, type ChainingInput } from '@/lib/engines';
import { ruleGroups, ruleToText } from '@/lib/engines/forward-chaining';

const dasar: Omit<ChainingInput, 'selected'> = {
  symptoms: [
    { id: 1, kode: 'G1', nama: 'Gejala 1' },
    { id: 2, kode: 'G2', nama: 'Gejala 2' },
    { id: 3, kode: 'G3', nama: 'Gejala 3' },
    { id: 4, kode: 'G4', nama: 'Gejala 4' },
  ],
  alternatives: [
    { id: 10, kode: 'P1', nama: 'Penyakit 1' },
    { id: 20, kode: 'P2', nama: 'Penyakit 2' },
  ],
  rules: [
    { id: 1, nama: 'Aturan 1', alternativeId: 10, conditions: [{ symptomId: 1, operator: 'AND' }, { symptomId: 2, operator: 'AND' }] },
    { id: 2, nama: 'Aturan 2', alternativeId: 20, conditions: [{ symptomId: 1, operator: 'AND' }, { symptomId: 3, operator: 'AND' }] },
    { id: 3, nama: 'Aturan 3', alternativeId: 10, conditions: [{ symptomId: 2, operator: 'AND' }, { symptomId: 4, operator: 'OR' }] },
  ],
};

describe('Forward Chaining', () => {
  it('pengelompokan kondisi: DAN didahulukan daripada ATAU', () => {
    const rule = {
      id: 9,
      nama: 'R',
      alternativeId: 10,
      conditions: [
        { symptomId: 1, operator: 'AND' as const },
        { symptomId: 2, operator: 'AND' as const },
        { symptomId: 3, operator: 'OR' as const },
        { symptomId: 4, operator: 'AND' as const },
      ],
    };
    expect(ruleGroups(rule)).toEqual([[1, 2], [3, 4]]);
    const symById = new Map(dasar.symptoms.map((s) => [s.id, s]));
    expect(ruleToText(rule, symById, 'Penyakit 1')).toBe('JIKA (G1 DAN G2) ATAU (G3 DAN G4) MAKA Penyakit 1');
  });

  it('menjalankan aturan yang seluruh premisnya terpenuhi dan mengurutkan menurut jumlah aturan', () => {
    const h = forwardChaining({ ...dasar, selected: [1, 2] });
    expect(h.hasil.alternativeId).toBe(10);
    expect(h.hasil.skor).toBe(2); // Aturan 1 dan Aturan 3
    expect(h.ranking.map((r) => [r.alternativeId, r.skor])).toEqual([
      [10, 2],
      [20, 0],
    ]);
  });

  it('lebih dari satu penyakit cocok', () => {
    const h = forwardChaining({ ...dasar, selected: [1, 2, 3] });
    expect(h.ranking.map((r) => [r.alternativeId, r.skor])).toEqual([
      [10, 2],
      [20, 1],
    ]);
    expect(h.hasil.ringkasan).toContain('Kemungkinan lain: Penyakit 2');
  });

  it('kelompok ATAU cukup salah satu yang terpenuhi', () => {
    const h = forwardChaining({ ...dasar, selected: [4] });
    expect(h.hasil.alternativeId).toBe(10);
    expect(h.hasil.skor).toBe(1);
  });

  it('tidak ada aturan terpenuhi → tidak ada hasil, namun kecocokan parsial dilaporkan', () => {
    const h = forwardChaining({ ...dasar, selected: [3] });
    expect(h.hasil.alternativeId).toBeNull();
    expect(h.ranking[0].alternativeId).toBe(20); // Aturan 2 cocok 50%
    expect(h.ranking[0].keterangan).toContain('50%');
  });

  it('validasi', () => {
    expect(() => forwardChaining({ ...dasar, selected: [] })).toThrow(EngineError);
    expect(() => forwardChaining({ ...dasar, selected: [99] })).toThrow(EngineError);
    expect(() => forwardChaining({ ...dasar, rules: [], selected: [1] })).toThrow(EngineError);
  });
});
