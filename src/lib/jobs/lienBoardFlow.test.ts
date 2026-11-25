import { describe, expect, it } from 'vitest'
import { buildLienBoard, lienBoardBinsShown, lienBoardPick, type LienBoardBin, type LienBoardChip, type LienBoardInput, type LienBoardTile } from './lienBoard'
import {
  LIEN_FLOW_VIEWS,
  LIEN_FLOW_VIEW_STORAGE_KEY,
  lienFlowCrossPath,
  lienFlowDayLine,
  lienFlowPickedStage,
  lienFlowRail,
  lienFlowStage,
  lienFlowUnderLine,
  lienFlowStages,
  readLienFlowView,
  writeLienFlowView,
} from './lienBoardFlow'
import type { LienDeskEntry, LienDeskPile } from './lienDesk'
import type { LienAffidavitEntry, LienAffidavitGate, LienAffidavitPile } from './lienDeskAffidavits'
import { plainWordsFailures } from '../plainWords'

// Made-up jobs and days.
const TODAY = '2026-11-15'
function notice(jobId: string, pile: LienDeskPile, over: Partial<LienDeskEntry> = {}): LienDeskEntry {
  return { jobId, customerId: 'c1', gcCustomerId: 'gc1', openBalance: 1000, hasOwner: pile !== 'needs_owner', propertyKind: '', months: [], datedFromCreation: false, dueMonths: ['2026-08'], missedMonths: [], missedUnrecorded: [], affidavitDay: null, affidavitDaysLeft: null, earliestDeadline: '2026-12-15', daysLeft: 30, severity: 'quiet', gates: [], ready: true, item: null, pile, ...over } as LienDeskEntry
}
const gate = (key: LienAffidavitGate['key'], ok: boolean): LienAffidavitGate => ({ key, ok, label: key })
function affidavit(jobId: string, pile: LienAffidavitPile, over: Partial<LienAffidavitEntry> = {}): LienAffidavitEntry {
  return { jobId, isSub: true, lastMonth: '2026-07', lastMonthFromCreation: false, deadline: '2026-12-15', daysLeft: 30, severity: 'quiet', openBalance: 1000, customerId: 'c1', gcCustomerId: 'gc1', propertyKind: '', gates: [gate('owner', true), gate('legal', true)], ready: true, item: null, pile, ...over }
}
function board(over: Partial<LienBoardInput> = {}) {
  return buildLienBoard({
    todayYmd: TODAY,
    notices: [
      notice('1', 'needs_owner'),
      notice('2', 'to_draft'),
      notice('3', 'to_draft', { earliestDeadline: '2026-11-20', daysLeft: 5 }),
      notice('4', 'awaiting'),
      notice('5', 'to_draft', { earliestDeadline: '2026-11-16', daysLeft: 1 }),
      notice('6', 'sent'),
    ],
    affidavits: [affidavit('1', 'needs_property', { gates: [gate('owner', false), gate('legal', false)] }), affidavit('8', 'ready')],
    retainage: [],
    jobNumber: (id) => `JP${id}`,
    jobName: (id) => `Job ${id}`,
    gcName: () => 'Alder Ridge Builders',
    leaderName: 'Sam',
    ...over,
  })
}

const bin = (b: ReturnType<typeof board>, key: string): LienBoardBin => [...b.notices, ...b.affidavits].find((x) => x.key === key)!
const chip = (over: Partial<LienBoardChip>): LienBoardChip => ({ jobId: 'j', label: 'JP1', kind: 'notice', stage: 'to_send', bin: 'notice:to_send', dueYmd: '2026-12-15', daysLeft: 30, stepsLeft: 3, urgency: 'later', atRisk: false, destination: { kind: 'closed', jobId: 'j' }, tip: '', pairKey: null, openBalance: 0, pile: 'to_draft', gcId: null, ...over })
const binOf = (chips: LienBoardChip[], over: Partial<LienBoardBin> = {}): LienBoardBin => ({ key: 'notice:to_send', kind: 'notice', stage: 'to_send', label: 'To send for Master approval', chips, closed: false, ...over })

describe('a phone’s view of To do', () => {
  const store = (seed: Record<string, string> = {}) => {
    const kept = { ...seed }
    return { kept, getItem: (k: string) => kept[k] ?? null, setItem: (k: string, v: string) => void (kept[k] = v) }
  }

  it('opens on the list by day the first time, as before, then on the view last used', () => {
    const s = store()
    expect(readLienFlowView(s)).toBe('day')
    writeLienFlowView(s, 'flow')
    expect(s.kept[LIEN_FLOW_VIEW_STORAGE_KEY]).toBe('flow')
    expect(readLienFlowView(s)).toBe('flow')
    writeLienFlowView(s, 'day')
    expect(readLienFlowView(s)).toBe('day')
  })

  it('reads anything else in the store as the first time, and a store that throws too', () => {
    expect(readLienFlowView(store({ [LIEN_FLOW_VIEW_STORAGE_KEY]: 'bins' }))).toBe('day')
    expect(readLienFlowView(null)).toBe('day')
    const broken = {
      getItem: () => {
        throw new Error('no store')
      },
      setItem: () => {
        throw new Error('no store')
      },
    }
    expect(readLienFlowView(broken)).toBe('day')
    expect(() => writeLienFlowView(broken, 'flow')).not.toThrow()
  })

  it('names its two presses By day and The flow, in that order', () => {
    expect(LIEN_FLOW_VIEWS).toEqual([
      { view: 'day', label: 'By day' },
      { view: 'flow', label: 'The flow' },
    ])
    for (const v of LIEN_FLOW_VIEWS) expect(plainWordsFailures(`${v.label}.`)).toEqual([])
  })
})

describe('a stage of the flow', () => {
  it('is the bin’s own name and its own count, the papers that can move', () => {
    const b = board()
    expect(lienFlowStage(bin(b, 'notice:to_send'))).toMatchObject({ key: 'notice:to_send', name: 'To send for Master approval', count: 3, empty: false, closed: false })
    expect(lienFlowStage(bin(b, 'notice:to_print'))).toMatchObject({ count: 0, empty: true, tone: null })
    // A held paper stands in its bin and is left out of the count, so the stage reads as the bin does.
    expect(lienFlowStage(binOf([chip({}), chip({ jobId: 'k', held: true }), chip({ jobId: 'm', unread: true })]))).toMatchObject({ count: 1, empty: false })
  })

  it('takes the worst of its papers’ colours, in the Board’s own meanings', () => {
    expect(lienFlowStage(binOf([chip({})])).tone).toBeNull()
    expect(lienFlowStage(binOf([chip({}), chip({ urgency: 'waiting' })])).tone).toBe('violet')
    expect(lienFlowStage(binOf([chip({ urgency: 'waiting' }), chip({ urgency: 'week' })])).tone).toBe('amber')
    expect(lienFlowStage(binOf([chip({ urgency: 'week' }), chip({ urgency: 'day' })])).tone).toBe('red')
    // At risk, or past its day and still able to move, is red whatever its urgency reads.
    expect(lienFlowStage(binOf([chip({ atRisk: true })])).tone).toBe('red')
    expect(lienFlowStage(binOf([chip({ daysLeft: -3 })])).tone).toBe('red')
  })

  it('gives no colour to a closed end, or to a stage whose only papers are held', () => {
    expect(lienFlowStage(binOf([chip({ stage: 'missed', urgency: 'day' })], { key: 'notice:missed', stage: 'missed', label: 'Window closed · no notice', closed: true }))).toMatchObject({ closed: true, tone: null })
    expect(lienFlowStage(binOf([chip({ urgency: 'day', held: true })]))).toMatchObject({ count: 0, empty: true, tone: null })
  })

  it('reads a whole column in the Board’s order, with the Board’s colours', () => {
    const b = board()
    const stages = lienFlowStages(lienBoardBinsShown(b.notices))
    expect(stages.map((s) => s.key)).toEqual(['notice:needs_owner', 'notice:to_send', 'notice:awaiting', 'notice:to_sign', 'notice:to_print', 'notice:in_mail', 'notice:sent'])
    // To send holds a notice due tomorrow: red. Awaiting waits on the leader with its day far off: violet.
    expect(stages.find((s) => s.key === 'notice:to_send')!.tone).toBe('red')
    expect(stages.find((s) => s.key === 'notice:awaiting')!.tone).toBe('violet')
    expect(stages.find((s) => s.key === 'notice:sent')).toMatchObject({ count: 1, tone: null })
  })
})

describe('the pinned line for a picked stage', () => {
  it('is a pick of exactly one bin, never the day’s red line or the leader’s papers', () => {
    const b = board()
    expect(lienFlowPickedStage(lienBoardPick(b, ['notice:to_send']))).toBe('notice:to_send')
    expect(lienFlowPickedStage(lienBoardPick(b, ['notice:awaiting', 'affidavit:awaiting']))).toBeNull()
    expect(lienFlowPickedStage({ bins: ['notice:to_send'], line: 'late' })).toBeNull()
    expect(lienFlowPickedStage({ bins: ['notice:to_sign'], words: 'waiting on Sam' })).toBeNull()
    expect(lienFlowPickedStage({ bins: [] })).toBeNull()
    expect(lienFlowPickedStage(null)).toBeNull()
  })

  it('a picked stage on a phone leaves nothing between its line and its rows (punch list #428)', () => {
    const stage = { bins: ['notice:to_send' as const] }
    expect(lienFlowUnderLine({ phone: true, pick: stage, find: '' })).toEqual({ top: false, find: false, run: false })
    // Words in the find box still narrow the rows, so the box stays where a person can see and clear it.
    expect(lienFlowUnderLine({ phone: true, pick: stage, find: ' oak ' })).toEqual({ top: false, find: true, run: false })
    // No stage picked, a tile's line, or a computer: all three stand.
    const all = { top: true, find: true, run: true }
    expect(lienFlowUnderLine({ phone: true, pick: null, find: '' })).toEqual(all)
    expect(lienFlowUnderLine({ phone: true, pick: { bins: ['notice:to_send'], line: 'late' }, find: '' })).toEqual(all)
    expect(lienFlowUnderLine({ phone: false, pick: stage, find: '' })).toEqual(all)
  })

  it('says the column, where the stage stands in it, its name and its count, and lights its cell', () => {
    const b = board()
    const columns = { notice: lienBoardBinsShown(b.notices), affidavit: lienBoardBinsShown(b.affidavits) }
    const rail = lienFlowRail(columns, 'notice:awaiting')!
    expect(rail).toMatchObject({ kind: 'notice', where: 'Monthly notices, stage 3 of 7', name: 'Awaiting Master approval', count: 1 })
    expect(rail.cells.map((c) => [c.key, c.count, c.lit, c.empty])).toEqual([
      ['notice:needs_owner', 1, false, false],
      ['notice:to_send', 3, false, false],
      ['notice:awaiting', 1, true, false],
      ['notice:to_sign', 0, false, true],
      ['notice:to_print', 0, false, true],
      ['notice:in_mail', 0, false, true],
      ['notice:sent', 1, false, false],
    ])
    expect(lienFlowRail(columns, 'affidavit:ready')).toMatchObject({ kind: 'affidavit', where: 'Lien affidavits, stage 5 of 7', name: 'Ready to file', count: 1 })
    expect(plainWordsFailures(`${rail.where}.`)).toEqual([])
  })

  it('counts the closed end as a stage while a job is in it', () => {
    const b = board({ affidavits: [affidavit('8', 'ready'), affidavit('9', 'missed', { deadline: '2026-11-10', daysLeft: -5 })] })
    const rail = lienFlowRail({ notice: lienBoardBinsShown(b.notices), affidavit: lienBoardBinsShown(b.affidavits) }, 'affidavit:missed')!
    expect(rail.where).toBe('Lien affidavits, stage 8 of 8')
    expect(rail.name).toBe('Lien day passed · not filed')
  })

  it('is nothing for no stage, or one neither column holds', () => {
    const b = board()
    const columns = { notice: lienBoardBinsShown(b.notices), affidavit: lienBoardBinsShown(b.affidavits) }
    expect(lienFlowRail(columns, null)).toBeNull()
    expect(lienFlowRail(columns, 'notice:missed')).toBeNull()
  })
})

describe('the day’s one line over the flow', () => {
  const tile = (over: Partial<LienBoardTile>): LienBoardTile => ({ key: 'by_day', figure: '14', label: 'by Dec 15 · 8 to file · 6 to send', line: null, tone: 'amber', destination: null, ...over })

  it('is the day tile’s count and its day, without the parts', () => {
    expect(lienFlowDayLine([tile({})])).toEqual({ figure: '14', words: 'by Dec 15', red: false, line: null, lineDestination: null })
    expect(lienFlowDayLine([tile({ label: 'nothing dated', figure: '0', tone: 'quiet' })])).toMatchObject({ figure: '0', words: 'nothing dated' })
  })

  it('carries the tile’s red line and where its press goes', () => {
    expect(lienFlowDayLine([tile({ tone: 'red', line: '3 are past their day.', lineDestination: { kind: 'late' } })])).toEqual({ figure: '14', words: 'by Dec 15', red: true, line: '3 are past their day.', lineDestination: { kind: 'late' } })
    expect(lienFlowDayLine([tile({ tone: 'red', line: '2 will not make Monday as they stand.', lineDestination: { kind: 'risk' } })])!.lineDestination).toEqual({ kind: 'risk' })
    // No line, no press, whatever the tile holds.
    expect(lienFlowDayLine([tile({ tone: 'red', lineDestination: { kind: 'late' } })])!.lineDestination).toBeNull()
  })

  it('reads the real Board’s day tile, and is nothing without one', () => {
    const line = lienFlowDayLine(board().tiles)!
    expect(line.words.startsWith('by ')).toBe(true)
    expect(line.words).not.toContain('·')
    expect(lienFlowDayLine([])).toBeNull()
  })
})

describe('the arrow across the flow', () => {
  it('leaves the first stage’s right edge, runs up the middle of the gutter and enters the second stage’s left edge', () => {
    const sent = { left: 0, top: 300, width: 180, height: 44 }
    const waiting = { left: 198, top: 54, width: 180, height: 44 }
    expect(lienFlowCrossPath(sent, waiting)).toBe('M 180 322 H 189 V 76 L 197 76')
  })

  it('is not drawn while a stage is missing or the two do not stand side by side', () => {
    const box = { left: 0, top: 0, width: 180, height: 44 }
    expect(lienFlowCrossPath(null, box)).toBeNull()
    expect(lienFlowCrossPath(box, undefined)).toBeNull()
    expect(lienFlowCrossPath(box, { left: 0, top: 200, width: 180, height: 44 })).toBeNull()
  })
})
