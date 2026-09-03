import { describe, expect, it } from 'vitest'
import { OVERHEAD_PEOPLE_NO_PERSON_LABEL, buildOverheadPeopleTable, overheadPeopleDisplayName, overheadPeopleShare } from './overheadPeopleTable'

const labor = [
  { workDate: '2026-09-02', userName: 'Taunya', bucket: 'office' as const, hours: 8, laborUsd: 200 },
  { workDate: '2026-09-01', userName: 'taunya ', bucket: 'office' as const, hours: 4, laborUsd: 100 },
  { workDate: '2026-09-02', userName: 'William', bucket: 'bid' as const, hours: 2, laborUsd: 60 },
  { workDate: '2026-08-01', userName: 'Wendi', bucket: 'office' as const, hours: 8, laborUsd: 180 },
]
const parts = [
  { workDate: '2026-09-02', amountUsd: 50, person: 'Taunya' },
  { workDate: '2026-09-02', amountUsd: 120, person: null },
  { workDate: '2026-09-01', amountUsd: 30, person: '' },
  { workDate: '2026-07-01', amountUsd: 999, person: null },
]

describe('buildOverheadPeopleTable', () => {
  it('windows by trailing days ending on endYmd, merges names case/space-insensitively, sums components', () => {
    const t = buildOverheadPeopleTable({ labor, parts, endYmd: '2026-09-02', days: 7 })
    expect(t.startYmd).toBe('2026-08-27')
    expect(t.rows.map((r) => r.name)).toEqual(['Taunya', 'William', OVERHEAD_PEOPLE_NO_PERSON_LABEL])
    expect(t.rows[0]).toMatchObject({ officeLaborUsd: 300, bidLaborUsd: 0, officePartsUsd: 50, totalUsd: 350, hours: 12, unattributed: false })
    expect(t.rows[1]).toMatchObject({ bidLaborUsd: 60, totalUsd: 60, hours: 2 })
    expect(t.rows[2]).toMatchObject({ officePartsUsd: 150, totalUsd: 150, hours: 0, unattributed: true })
    expect(t.totals).toEqual({ officeLaborUsd: 300, bidLaborUsd: 60, officePartsUsd: 200, totalUsd: 560, hours: 14 })
  })

  it('"Today" is a one-day window', () => {
    const t = buildOverheadPeopleTable({ labor, parts, endYmd: '2026-09-02', days: 1 })
    expect(t.startYmd).toBe('2026-09-02')
    expect(t.rows.find((r) => r.name === 'Taunya')).toMatchObject({ officeLaborUsd: 200, officePartsUsd: 50, hours: 8 })
    expect(t.rows.find((r) => r.unattributed)?.officePartsUsd).toBe(120)
  })

  it('90 days reaches the older rows; the no-person row always sorts last', () => {
    const t = buildOverheadPeopleTable({ labor, parts, endYmd: '2026-09-02', days: 90 })
    expect(t.rows.map((r) => r.name)).toEqual(['Taunya', 'Wendi', 'William', OVERHEAD_PEOPLE_NO_PERSON_LABEL])
    expect(t.rows[t.rows.length - 1]?.officePartsUsd).toBe(1149)
  })

  it('empty window yields no rows and zero totals', () => {
    const t = buildOverheadPeopleTable({ labor, parts, endYmd: '2026-01-01', days: 7 })
    expect(t.rows).toEqual([])
    expect(t.totals.totalUsd).toBe(0)
  })

  it('a card nickname with the last-four suffix merges into the person\'s labor row; a shared card stays its own row', () => {
    const t = buildOverheadPeopleTable({
      labor: [{ workDate: '2026-09-02', userName: 'Malachi', bucket: 'office', hours: 8, laborUsd: 200 }],
      parts: [
        { workDate: '2026-09-02', amountUsd: 54, person: 'Malachi 6783' },
        { workDate: '2026-09-02', amountUsd: 232, person: 'Taunya or Wendi' },
      ],
      endYmd: '2026-09-02',
      days: 1,
    })
    expect(t.rows.map((r) => r.name)).toEqual(['Malachi', 'Taunya or Wendi'])
    expect(t.rows[0]).toMatchObject({ officeLaborUsd: 200, officePartsUsd: 54, totalUsd: 254 })
    expect(overheadPeopleDisplayName('Michael A 4003')).toBe('Michael A')
    expect(overheadPeopleDisplayName('  Wendi ')).toBe('Wendi')
  })

  it('share of column', () => {
    expect(overheadPeopleShare(300, 600)).toBe(0.5)
    expect(overheadPeopleShare(5, 0)).toBeNull()
  })
})
