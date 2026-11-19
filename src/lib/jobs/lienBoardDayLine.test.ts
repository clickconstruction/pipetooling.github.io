import { describe, expect, it } from 'vitest'
import { buildLienBoard, lienBoardChipLate, lienBoardLatePhrase, lienBoardPickWords, lienBoardRiskPick, lienBoardRowInPick, type LienBoardInput } from './lienBoard'
import { LIEN_BOARD_DAY_LINE_DOOR, lienBoardLatePick } from './lienBoardDayLine'
import type { LienDeskEntry, LienDeskPile } from './lienDesk'
import type { LienAffidavitEntry, LienAffidavitPile } from './lienDeskAffidavits'

function notice(jobId: string, pile: LienDeskPile, over: Partial<LienDeskEntry> = {}): LienDeskEntry {
  return { jobId, customerId: 'c1', gcCustomerId: 'gc1', openBalance: 1000, hasOwner: true, propertyKind: '', months: [], datedFromCreation: false, dueMonths: ['2026-08'], missedMonths: [], missedUnrecorded: [], affidavitDay: null, affidavitDaysLeft: null, earliestDeadline: '2026-12-15', daysLeft: 30, severity: 'quiet', item: null, policy: 'ask', pile, ...over }
}
function affidavit(jobId: string, pile: LienAffidavitPile, over: Partial<LienAffidavitEntry> = {}): LienAffidavitEntry {
  return { jobId, isSub: true, lastMonth: '2026-07', lastMonthFromCreation: false, deadline: '2026-12-15', daysLeft: 30, severity: 'quiet', openBalance: 1000, customerId: 'c1', gcCustomerId: 'gc1', propertyKind: '', gates: [{ key: 'owner', ok: true, label: 'owner' }], ready: true, item: null, pile, ...over }
}
const printed = (id: string) => ({ id, status: 'approved', fields: {}, months: [], voided_at: null, printed_at: '2026-11-09T10:00:00Z' }) as unknown as LienDeskEntry['item']
const LATE = { earliestDeadline: '2026-11-10', daysLeft: -5 }
function build(over: Partial<LienBoardInput> = {}) {
  return buildLienBoard({
    todayYmd: '2026-11-15',
    notices: [],
    affidavits: [],
    retainage: [],
    jobNumber: (id) => id,
    jobName: (id) => `Job ${id}`,
    gcName: () => 'Alder Ridge Builders',
    leaderName: 'Sam',
    ...over,
  })
}
/** Two printed notices five days late under two GCs, one on time, and an affidavit a day late. */
const lateBoard = () =>
  build({
    notices: [notice('2104', 'printed', { ...LATE, item: printed('i1') }), notice('2111', 'printed', { ...LATE, gcCustomerId: 'gc2', item: printed('i2') }), notice('2118', 'printed', { earliestDeadline: '2026-11-20', daysLeft: 5, item: printed('i3') })],
    affidavits: [affidavit('2125', 'awaiting', { deadline: '2026-11-14', daysLeft: -1 })],
  })

describe('the day tile’s line · past their day', () => {
  it('is a press to the late papers when no paper is at risk', () => {
    const b = lateBoard()
    expect(b.atRisk).toBe(0)
    expect(b.tiles[0]).toMatchObject({ line: '3 are past their day.', tone: 'red', destination: null, lineDestination: { kind: 'late' } })
  })

  it('agrees with one paper, and has no door with none late', () => {
    const one = build({ notices: [notice('2104', 'printed', { ...LATE, item: printed('i1') })] })
    expect(one.tiles[0]).toMatchObject({ line: '1 is past its day.', lineDestination: { kind: 'late' } })
    const none = build({ notices: [notice('2118', 'printed', { earliestDeadline: '2026-11-20', daysLeft: 5, item: printed('i3') })] })
    expect(none.tiles[0]!.line).toBeNull()
    expect(none.tiles[0]!.lineDestination).toBeNull()
    expect(lienBoardLatePhrase(1)).toBe('is past its day')
    expect(lienBoardLatePhrase(4)).toBe('are past their day')
  })

  it('keeps the at-risk door while a paper is at risk, even with others late', () => {
    // A notice still to send, due tomorrow, has more stages left than working days: at risk. Another is late.
    const b = build({ notices: [notice('2104', 'to_draft', { earliestDeadline: '2026-11-16', daysLeft: 1 }), notice('2111', 'printed', { ...LATE, item: printed('i2') })] })
    expect(b.atRisk).toBeGreaterThan(0)
    expect(b.tiles[0]!.line).toMatch(/will not make/)
    expect(b.tiles[0]!.lineDestination).toEqual({ kind: 'risk' })
  })

  it('names its door Show them', () => {
    expect(LIEN_BOARD_DAY_LINE_DOOR).toBe('Show them')
  })
})

describe('lienBoardChipLate — the one rule for a paper past its day', () => {
  const chipsOf = (b: ReturnType<typeof build>) => [...b.notices, ...b.affidavits].flatMap((bin) => bin.chips)
  it('counts a paper past its day that can still move, and the tile counts the same ones', () => {
    const b = lateBoard()
    const late = chipsOf(b).filter(lienBoardChipLate)
    expect(late.map((c) => `${c.kind}:${c.jobId}`).sort()).toEqual(['affidavit:2125', 'notice:2104', 'notice:2111'])
    expect(b.tiles[0]!.line).toBe(`${late.length} are past their day.`)
  })

  it('leaves out a sent notice, a closed end and a job on public property', () => {
    const b = build({
      notices: [notice('2104', 'sent', LATE), notice('2111', 'printed', { ...LATE, item: printed('i2') }), notice('2118', 'printed', { ...LATE, item: printed('i3') })],
      affidavits: [affidavit('2132', 'missed', { deadline: '2026-11-10', daysLeft: -5 })],
      publicJobIds: new Set(['2118']),
    })
    expect(chipsOf(b).filter(lienBoardChipLate).map((c) => c.jobId)).toEqual(['2111'])
    expect(b.tiles[0]!.line).toBe('1 is past its day.')
  })
})

describe('lienBoardLatePick — what a press on the line narrows the list to', () => {
  it('holds the late papers by kind and job, lights no bin, and counts what the tile counts', () => {
    const b = lateBoard()
    const pick = lienBoardLatePick(b)
    expect(pick.bins).toEqual([])
    expect(pick.count).toBe(3)
    expect([...pick.papers!].sort()).toEqual(['affidavit:2125', 'notice:2104', 'notice:2111'])
    expect([...pick.jobIds].sort()).toEqual(['2104', '2111', '2125'])
    // Only a notice brings its GC's run row: the affidavit's GC is not in on its account.
    expect([...pick.gcIds].sort()).toEqual(['gc1', 'gc2'])
  })

  it('says what the list shows, and the press that puts it back', () => {
    const pick = lienBoardLatePick(lateBoard())
    expect(lienBoardPickWords(pick, 3)).toEqual({ head: 'Showing 3 rows with a paper past its day.', clear: 'Show every row' })
    // Two late notices of one GC stand in one run row: the words still agree.
    expect(lienBoardPickWords(pick, 1).head).toBe('Showing 1 row with a paper past its day.')
  })

  it('takes a late paper’s own row and a run row that holds a late notice, and leaves the rest', () => {
    const pick = lienBoardLatePick(lateBoard())
    expect(lienBoardRowInPick(pick, { jobId: '2125', gcId: 'gc1', kind: 'affidavit' })).toBe(true)
    expect(lienBoardRowInPick(pick, { jobId: '2104', gcId: 'gc1', kind: 'notice' })).toBe(true)
    // The on-time notice's own row, and that job's affidavit row, are out.
    expect(lienBoardRowInPick(pick, { jobId: '2118', gcId: 'gc1', kind: 'notice' })).toBe(false)
    expect(lienBoardRowInPick(pick, { jobId: '2104', gcId: 'gc1', kind: 'affidavit' })).toBe(false)
    // A run row names no job: it is in when it lists a late notice.
    expect(lienBoardRowInPick(pick, { jobId: null, gcId: null, kind: 'notice', jobs: [{ jobId: '2118' }, { jobId: '2111' }] })).toBe(true)
    expect(lienBoardRowInPick(pick, { jobId: null, gcId: null, kind: 'notice', jobs: [{ jobId: '2118' }] })).toBe(false)
  })

  it('is empty with nothing late, and is not the at-risk pick', () => {
    const calm = build({ notices: [notice('2118', 'printed', { earliestDeadline: '2026-11-20', daysLeft: 5, item: printed('i3') })] })
    expect(lienBoardLatePick(calm).count).toBe(0)
    const b = lateBoard()
    expect(lienBoardRiskPick(b).count).toBe(0)
    expect(lienBoardLatePick(b).label).not.toBe(lienBoardRiskPick(b).label)
  })
})
