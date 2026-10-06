import { describe, expect, it } from 'vitest'
import type { StaleStaffRow } from './teamPurchaseRows'
import { suggestTallyDay, type TallyCharge } from './tallySortSuggestion'
import type { TallyQueueCard } from './tallyTeamQueue'
import {
  dayChipPressed,
  dayChipTargets,
  pickDayChip,
  pickLineChoice,
  rowsForSelection,
  toggleLineByHours,
  type TallyLineSelection,
} from './tallyTeamSelections'

// A made-up two-job day with an Advertising charge (its own likely: Office) and two store charges.
const at = (hm: string) => `2026-09-30T${hm}:00-05:00`
const charges: TallyCharge[] = [
  { id: 'fuel', holderId: 'h', madeAt: at('06:00'), amount: -40, counterparty: 'Corner Fuel', category: 'FuelAndGas' },
  { id: 'parts', holderId: 'h', madeAt: at('09:00'), amount: -88.2, counterparty: 'Ridge Supply', category: 'Retail' },
  { id: 'sign', holderId: 'h', madeAt: at('10:00'), amount: -120, counterparty: 'Bright Signs', category: 'Advertising' },
]
const suggestion = suggestTallyDay({
  holderId: 'h',
  ymd: '2026-09-30',
  charges,
  sessions: [
    { workDate: '2026-09-30', jobId: 'job-c', clockedInAt: at('07:02'), clockedOutAt: at('11:30') },
    { workDate: '2026-09-30', jobId: 'job-d', clockedInAt: at('12:40'), clockedOutAt: at('16:15') },
  ],
  scheduled: [],
  history: [],
  officeJobId: 'job-office',
  nowMs: Date.parse(at('17:00')),
})
const card: TallyQueueCard = {
  holderId: 'h',
  holderName: 'Ann',
  ymd: '2026-09-30',
  charges: charges.map((charge) => ({ row: { mercury_transaction_id: charge.id } as StaleStaffRow, charge })),
  total: -248.2,
  suggestion,
  sorted: [],
}
const chip = (rule: string) => suggestion.chips.find((c) => c.rule === rule)!
const empty = new Map<string, TallyLineSelection>()

describe('day chips', () => {
  it('pick for every line without a likely suggestion of its own', () => {
    expect(dayChipTargets(card)).toEqual(['fuel', 'parts'])
    const next = pickDayChip(empty, card, chip('clock-job'))
    expect([...next.keys()]).toEqual(['fuel', 'parts'])
    expect(next.get('fuel')).toEqual({ choice: { kind: 'job', jobId: 'job-c' }, byHours: false })
    expect(next.has('sign')).toBe(false)
    expect(dayChipPressed(next, card, chip('clock-job'))).toBe(true)
  })

  it('a second tap clears what the chip picked', () => {
    const once = pickDayChip(empty, card, chip('split-even'))
    expect(pickDayChip(once, card, chip('split-even')).size).toBe(0)
  })

  it('nothing is pressed until the sorter taps', () => {
    for (const c of suggestion.chips) expect(dayChipPressed(empty, card, c)).toBe(false)
  })
})

describe('line picks', () => {
  it('pick for one line, and picking the same again clears it', () => {
    const office = { kind: 'job', jobId: 'job-office' } as const
    const one = pickLineChoice(empty, 'sign', office)
    expect(one.get('sign')).toEqual({ choice: office, byHours: false })
    expect(pickLineChoice(one, 'sign', office).has('sign')).toBe(false)
    expect(pickLineChoice(one, 'sign', null).has('sign')).toBe(false)
  })

  it('a split line swaps to by hours and back; a job line does not', () => {
    const split = pickDayChip(empty, card, chip('split-even'))
    expect(toggleLineByHours(split, 'parts').get('parts')!.byHours).toBe(true)
    const job = pickLineChoice(empty, 'sign', { kind: 'job', jobId: 'job-office' })
    expect(toggleLineByHours(job, 'sign').get('sign')!.byHours).toBe(false)
  })
})

describe('rowsForSelection', () => {
  const line = (id: string) => suggestion.lines.find((l) => l.chargeId === id)!

  it('writes the whole charge to a job', () => {
    expect(rowsForSelection(line('sign'), { choice: { kind: 'job', jobId: 'job-office' }, byHours: false })).toEqual([
      { jobId: 'job-office', amount: -120 },
    ])
  })

  it('writes the even split, or the split by hours, in cents that add up', () => {
    const even = rowsForSelection(line('parts'), { choice: { kind: 'split', how: 'even', jobIds: ['job-c', 'job-d'] }, byHours: false })
    expect(even).toEqual([
      { jobId: 'job-c', amount: -44.1 },
      { jobId: 'job-d', amount: -44.1 },
    ])
    const byHours = rowsForSelection(line('parts'), { choice: { kind: 'split', how: 'even', jobIds: ['job-c', 'job-d'] }, byHours: true })
    expect(byHours).toEqual([
      { jobId: 'job-c', amount: -48.94 },
      { jobId: 'job-d', amount: -39.26 },
    ])
  })
})
