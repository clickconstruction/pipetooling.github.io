import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'
import { buildLienBoard } from './lienBoard'
import type { LienDeskEntry, LienDeskPile } from './lienDesk'
import type { LienAffidavitEntry, LienAffidavitGate, LienAffidavitPile } from './lienDeskAffidavits'
import { buildLienGetItRight, LIEN_GET_IT_RIGHT_WORDS, lienGetItRightWithFacts, lienRunDoor, lienRunHead, lienRunPaperRight, lienRunPapers } from './lienGetItRight'
import type { LienLeftOutRow } from './lienLeftOut'
import { buildLienNextUp } from './lienNextUp'
import { lienFieldsHash } from './lienNoticeSignature'

/** A Sunday; the 15th rolls to Monday the 16th, the day the run counts to. */
const TODAY = '2026-11-15'
const RUN_DAY = '2026-11-16'

function notice(jobId: string, pile: LienDeskPile, over: Partial<LienDeskEntry> = {}): LienDeskEntry {
  return { jobId, customerId: 'c1', gcCustomerId: `gc-${jobId}`, openBalance: 1000, hasOwner: pile !== 'needs_owner', propertyKind: '', months: [], datedFromCreation: false, dueMonths: ['2026-09'], missedMonths: [], missedUnrecorded: [], affidavitDay: null, affidavitDaysLeft: null, earliestDeadline: RUN_DAY, daysLeft: 1, severity: 'red', item: null, policy: 'ask', pile, ...over }
}
const gate = (key: LienAffidavitGate['key'], ok: boolean): LienAffidavitGate => ({ key, ok, label: key })
const gates = (failing: LienAffidavitGate['key'][] = []): LienAffidavitGate[] => (['owner', 'legal', 'contractor', 'notice', 'homestead'] as const).map((k) => gate(k, !failing.includes(k)))
function affidavit(jobId: string, pile: LienAffidavitPile, over: Partial<LienAffidavitEntry> = {}): LienAffidavitEntry {
  return { jobId, isSub: true, lastMonth: '2026-07', lastMonthFromCreation: false, deadline: RUN_DAY, daysLeft: 1, severity: 'red', openBalance: 1000, customerId: 'c1', gcCustomerId: `gc-${jobId}`, propertyKind: '', gates: gates(), ready: true, item: null, pile, ...over }
}
const item = (id: string, status: string, over: Record<string, unknown> = {}) => ({ id, status, fields: {}, months: [], voided_at: null, ...over }) as unknown as LienDeskEntry['item']
const signed = (id: string, over: Record<string, unknown> = {}) => item(id, 'approved', { signed_at: '2026-11-13T19:14:00Z', signer_printed_name: 'Sam', signer_signature_mode: 'type', signed_fields_hash: lienFieldsHash({}), ...over })

let n = 0
function left(over: Partial<LienLeftOutRow> = {}): LienLeftOutRow {
  n += 1
  return { id: `r${n}`, jobId: 'a-owner', paper: 'affidavit', runDay: RUN_DAY, reason: 'fact_not_in_time', note: '', leftOutBy: 'u-rosa', leftOutAt: '2026-11-15T16:00:00Z', putBackBy: null, putBackAt: null, ...over }
}

/** A desk with a run due Monday: papers that wait, papers that are right, and one due next month. */
function desk(over: { notices?: LienDeskEntry[]; affidavits?: LienAffidavitEntry[]; leftOut?: LienLeftOutRow[]; role?: string } = {}) {
  const notices = over.notices ?? [
    notice('n-owner', 'needs_owner', { openBalance: 1900 }),
    notice('n-draft', 'to_draft', { openBalance: 700 }),
    notice('n-wait', 'awaiting', { openBalance: 1500, item: item('i-wait', 'pending_approval', { submitted_at: '2026-11-12T15:00:00Z' }) }),
    notice('n-ready', 'ready', { openBalance: 2200, item: signed('i-ready') }),
    notice('n-printed', 'printed', { openBalance: 800, item: signed('i-printed', { printed_at: '2026-11-13T15:00:00Z' }) }),
    notice('n-later', 'to_draft', { earliestDeadline: '2026-12-15', daysLeft: 30, severity: 'quiet' }),
  ]
  const affidavits = over.affidavits ?? [
    affidavit('a-owner', 'needs_property', { openBalance: 240, gates: gates(['owner']), ready: false }),
    affidavit('a-ready', 'ready', { openBalance: 9400, item: item('ia-ready', 'approved') }),
    affidavit('a-ready2', 'ready', { openBalance: 6100, item: item('ia-ready2', 'approved') }),
  ]
  const board = buildLienBoard({ notices, affidavits, retainage: [], todayYmd: TODAY, jobNumber: (id) => `ZZ-${id}`, jobName: (id) => `ZZ Job ${id}`, gcName: () => 'ZZ Builders', leaderName: 'Sam' })
  const rows = buildLienNextUp({ notices, affidavits, retainage: [], letterTwoByJob: {}, role: over.role ?? 'assistant', todayYmd: TODAY, jobTitle: (id) => `ZZ Job ${id}`, gcName: () => 'ZZ Builders', leaderName: () => 'Sam' })
  const run = buildLienGetItRight({ board, rows, leftOut: over.leftOut ?? [], todayYmd: TODAY, jobTitle: (id) => `ZZ Job ${id}`, leaderName: () => 'Sam' })
  return { board, rows, run: run! }
}
const keys = (lines: ReadonlyArray<{ key: string }>) => lines.map((l) => l.key)

describe('the run is the papers the Board’s first tile counts', () => {
  it('counts the same papers as the tile, and leaves next month’s out', () => {
    const { board, run } = desk()
    expect(run.day).toBe(RUN_DAY)
    expect(run.dayWords).toBe('tomorrow')
    expect(run.counts.papers).toBe(Number(board.tiles[0]!.figure))
    expect(run.counts.papers).toBe(8)
    expect([...keys(run.settle), ...keys(run.right)]).not.toContain('notice:n-later')
  })

  it('a paper past its day rides with the run', () => {
    const { board, run } = desk({ notices: [notice('n-late', 'to_draft', { earliestDeadline: '2026-11-10', daysLeft: -5 }), notice('n-due', 'needs_owner')], affidavits: [] })
    expect(run.counts.papers).toBe(Number(board.tiles[0]!.figure))
    expect(keys(run.settle).sort()).toEqual(['notice:n-due', 'notice:n-late'])
  })

  it('no run with nothing dated ahead, as the tile reads nothing dated', () => {
    const notices = [notice('n-late', 'to_draft', { earliestDeadline: '2026-11-10', daysLeft: -5 })]
    const board = buildLienBoard({ notices, affidavits: [], retainage: [], todayYmd: TODAY, jobNumber: (id) => id, jobName: (id) => id, gcName: () => '', leaderName: 'Sam' })
    expect(board.tiles[0]!.figure).toBe('0')
    expect(lienRunPapers(board)).toBeNull()
    expect(buildLienGetItRight({ board, rows: [], leftOut: [], todayYmd: TODAY, jobTitle: (id) => id })).toBeNull()
    expect(buildLienGetItRight({ board: null, rows: [], leftOut: [], todayYmd: TODAY, jobTitle: (id) => id })).toBeNull()
  })

  it('a paper on public property that nobody answered is not in the run, as it is not on the tile', () => {
    const notices = [notice('n-public', 'needs_owner'), notice('n-due', 'needs_owner')]
    const board = buildLienBoard({ notices, affidavits: [], retainage: [], todayYmd: TODAY, jobNumber: (id) => id, jobName: (id) => id, gcName: () => '', leaderName: 'Sam', publicJobIds: new Set(['n-public']) })
    expect(lienRunPapers(board)!.chips.map((c) => c.jobId)).toEqual(['n-due'])
    expect(board.tiles[0]!.figure).toBe('1')
  })
})

describe('what is right and what is to settle', () => {
  it('an approved signed notice, a printed notice and an affidavit ready to file are right', () => {
    const { run } = desk()
    expect(keys(run.right)).toEqual(['affidavit:a-ready', 'affidavit:a-ready2', 'notice:n-ready', 'notice:n-printed'])
    expect(run.counts).toMatchObject({ right: 4, toPrint: 3, toMail: 1, toFile: 2 })
    expect(run.rightParts).toBe('2 affidavits ready to file · 1 notice to print · 1 notice printed')
  })

  it('every other stage is a question', () => {
    expect(lienRunPaperRight({ kind: 'notice', stage: 'to_print' })).toBe(true)
    expect(lienRunPaperRight({ kind: 'notice', stage: 'in_mail' })).toBe(true)
    expect(lienRunPaperRight({ kind: 'affidavit', stage: 'ready' })).toBe(true)
    for (const stage of ['needs_owner', 'to_send', 'awaiting', 'to_sign', 'held'] as const) expect(lienRunPaperRight({ kind: 'notice', stage })).toBe(false)
    for (const stage of ['needs_property', 'needs_notice', 'to_send', 'awaiting', 'held'] as const) expect(lienRunPaperRight({ kind: 'affidavit', stage })).toBe(false)
  })

  it('a line says its bin in the Board’s words, the one thing to know, and the To do row’s own press', () => {
    const { run, rows } = desk()
    const owner = run.settle.find((l) => l.key === 'notice:n-owner')!
    expect(owner).toMatchObject({ stage: 'Needs the owner', detail: 'September 2026', press: 'Find the owner', rowKey: 'notice:n-owner', label: 'ZZ-n-owner', title: 'ZZ Job n-owner', amount: 1900 })
    const aff = run.settle.find((l) => l.key === 'affidavit:a-owner')!
    expect(aff.stage).toBe('Needs the property facts')
    expect(aff.detail).toBe(rows.find((r) => r.key === 'affidavit:a-owner')!.detail)
    expect(aff.press).toBe(rows.find((r) => r.key === 'affidavit:a-owner')!.button)
  })

  it('a paper that waits on the leader has no press for the office, and says how long it has waited', () => {
    const wait = desk().run.settle.find((l) => l.key === 'notice:n-wait')!
    expect(wait.stage).toBe('Awaiting Master approval')
    expect(wait.detail).toBe('Sent for approval Nov 12 · waiting 3 days')
    expect(wait.press).toBeNull()
  })

  it('an approved notice the leader has not signed is a question, with or without a row of its own', () => {
    // Two approved under one GC fold into the GC's run row, so neither has a row of its own.
    const { run } = desk({ notices: [notice('n-a', 'ready', { gcCustomerId: 'gc1', item: item('i-a', 'approved', { approval_mode: 'word' }) }), notice('n-b', 'ready', { gcCustomerId: 'gc1', item: signed('i-b') })], affidavits: [] })
    expect(keys(run.settle)).toEqual(['notice:n-a'])
    expect(run.settle[0]).toMatchObject({ stage: 'Approved · to sign', detail: 'Sam signs it', rowKey: null, press: null })
    expect(keys(run.right)).toEqual(['notice:n-b'])
  })

  it('the papers the Board marks come first, then by day, the largest first', () => {
    const { run } = desk()
    const risk = run.settle.filter((l) => l.atRisk).length
    expect(run.settle.slice(0, risk).every((l) => l.atRisk)).toBe(true)
    expect(run.settle.slice(risk).some((l) => l.atRisk)).toBe(false)
    const amounts = run.settle.filter((l) => l.atRisk).map((l) => l.amount)
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a))
  })

  it('a job with two papers in the run owes its money once', () => {
    const { run } = desk({ notices: [notice('j1', 'needs_owner', { openBalance: 500 })], affidavits: [affidavit('j1', 'needs_property', { openBalance: 500, gates: gates(['owner']) })] })
    expect(run.counts.papers).toBe(2)
    expect(run.totals.run).toBe(500)
    expect(run.totals.waits).toBe(500)
  })
})

describe('left out, and asked again', () => {
  it('a paper left out of this run leaves the count and the questions, and is listed with its row', () => {
    const row = left()
    const { run, board } = desk({ leftOut: [row] })
    expect(keys(run.leftOut)).toEqual(['affidavit:a-owner'])
    expect(run.leftOut[0]).toMatchObject({ standing: 'left_out', leftOut: row, rightNow: false })
    expect(keys(run.settle)).not.toContain('affidavit:a-owner')
    expect(run.counts).toMatchObject({ papers: Number(board.tiles[0]!.figure) - 1, leftOut: 1, settle: 3 })
    expect(run.totals.run).toBe(1900 + 700 + 1500 + 2200 + 800 + 9400 + 6100)
  })

  it('a paper left out of an earlier run is asked about again, first, and counts as a question', () => {
    const row = left({ runDay: '2026-10-15' })
    const { run } = desk({ leftOut: [row] })
    expect(keys(run.asked)).toEqual(['affidavit:a-owner'])
    expect(run.asked[0]).toMatchObject({ standing: 'asked_again', leftOut: row })
    expect(run.leftOut).toEqual([])
    expect(run.counts.settle).toBe(4)
    expect(run.step).toBe(1)
  })

  it('a right paper left out of an earlier run is not carried in: it is asked about, not counted right', () => {
    const { run } = desk({ leftOut: [left({ jobId: 'a-ready', runDay: '2026-10-15' })] })
    expect(keys(run.asked)).toEqual(['affidavit:a-ready'])
    expect(keys(run.right)).not.toContain('affidavit:a-ready')
    expect(run.asked[0]!.rightNow).toBe(true)
    expect(run.asked[0]!.press).toBeNull()
  })

  it('a left-out paper whose question is answered since says so', () => {
    const { run } = desk({ leftOut: [left({ jobId: 'a-ready' })] })
    expect(run.leftOut[0]).toMatchObject({ key: 'affidavit:a-ready', rightNow: true })
    expect(run.counts).toMatchObject({ right: 3, toFile: 1 })
  })

  it('a row put back counts for nothing', () => {
    const { run } = desk({ leftOut: [left({ putBackAt: '2026-11-15T18:00:00Z', putBackBy: 'u-sam' })] })
    expect(run.leftOut).toEqual([])
    expect(keys(run.settle)).toContain('affidavit:a-owner')
  })

  it('a leave-out on a paper that is not in the run is not listed', () => {
    const { run } = desk({ leftOut: [left({ jobId: 'n-later', paper: 'notice' })] })
    expect(run.leftOut).toEqual([])
    expect(run.asked).toEqual([])
  })
})

describe('the three steps and the door', () => {
  it('before: step 1 is now, and counts what waits and what is right', () => {
    const { run } = desk()
    expect(run.step).toBe(1)
    expect(run.steps.map((s) => s.state)).toEqual(['now', 'wait', 'wait'])
    expect(plainSentence(run.steps[0].line)).toBe('4 to settle · 4 of 8 papers are right')
    expect(plainSentence(run.steps[1].line)).toBe('1 notice to print · 2 affidavits for the notary')
    expect(plainSentence(run.steps[2].line)).toBe('1 to mail · 2 to file')
    expect(lienRunDoor(run)).toEqual({ line: 'This run · ⟪count|8⟫ papers due by ⟪day|tomorrow⟫ · ⟪count|4⟫ to settle', button: 'Get it right' })
  })

  it('ready: every question settled or left out, step 2 is now', () => {
    const { run } = desk({
      notices: [notice('n-ready', 'ready', { item: signed('i-ready') }), notice('n-owner', 'needs_owner')],
      affidavits: [affidavit('a-ready', 'ready', { item: item('ia', 'approved') })],
      leftOut: [left({ jobId: 'n-owner', paper: 'notice' })],
    })
    expect(run.step).toBe(2)
    expect(run.steps.map((s) => s.state)).toEqual(['done', 'now', 'wait'])
    expect(plainSentence(run.steps[0].line)).toBe('2 right · 1 left out of this run')
    expect(plainSentence(lienRunDoor(run).line)).toBe('This run · 2 papers due by tomorrow · Every paper in the run is right · 1 left out')
    expect(lienRunDoor(run).button).toBe('Open the run')
  })

  it('after the print: the notices are printed and nothing waits to print, step 3 is now', () => {
    const { run } = desk({ notices: [notice('n-p1', 'printed', { item: signed('i1', { printed_at: '2026-11-14T15:00:00Z' }) }), notice('n-p2', 'printed', { item: signed('i2', { printed_at: '2026-11-14T15:00:00Z' }) })], affidavits: [] })
    expect(run.step).toBe(3)
    expect(run.steps.map((s) => s.state)).toEqual(['done', 'done', 'now'])
    expect(plainSentence(run.steps[1].line)).toBe('Nothing waits to print')
    expect(plainSentence(run.steps[2].line)).toBe('2 to mail')
  })

  it('every paper left out: no step is now', () => {
    const { run } = desk({ notices: [notice('n-owner', 'needs_owner')], affidavits: [], leftOut: [left({ jobId: 'n-owner', paper: 'notice' })] })
    expect(run.step).toBeNull()
    expect(run.counts).toMatchObject({ papers: 0, leftOut: 1 })
  })

  it('one paper reads in the singular', () => {
    const { run } = desk({ notices: [notice('n-owner', 'needs_owner'), notice('n-ready', 'ready', { item: signed('i') })], affidavits: [], leftOut: [left({ jobId: 'n-ready', paper: 'notice' })] })
    expect(plainSentence(run.steps[0].line)).toBe('1 to settle · 0 of 1 paper is right · 1 left out of this run')
    expect(plainSentence(lienRunDoor(run).line)).toBe('This run · 1 paper due by tomorrow · 1 to settle · 1 left out')
  })

  it('the head names the day', () => {
    expect(plainSentence(lienRunHead(desk().run))).toBe('This run · papers due by tomorrow')
  })

  it('the sentences a person reads are plain', () => {
    const words = [LIEN_GET_IT_RIGHT_WORDS.lead, LIEN_GET_IT_RIGHT_WORDS.askedLead, LIEN_GET_IT_RIGHT_WORDS.allRight, LIEN_GET_IT_RIGHT_WORDS.rightNow, LIEN_GET_IT_RIGHT_WORDS.printsLead]
    expect(words.flatMap((w) => plainWordsFailures(w))).toEqual([])
  })
})

describe('the strip with what the print knows (v2.8631)', () => {
  const none = { printedAffidavitJobIds: new Set<string>(), stoppedNotices: [] }

  it('before the prints are read it is the checklist as built', () => {
    const { run } = desk()
    expect(lienGetItRightWithFacts(run, null)).toBe(run)
  })

  it('a printed affidavit is not to print, and is said apart; the lines, the door and the totals do not move', () => {
    const { run } = desk()
    const shown = lienGetItRightWithFacts(run, { ...none, printedAffidavitJobIds: new Set(['a-ready']) })
    expect(shown.counts).toMatchObject({ toPrint: 2, toFile: 1, affidavitsPrinted: 1, noticesStopped: 0, right: 4 })
    expect(plainSentence(shown.steps[1].line)).toBe('1 notice to print · 1 affidavit for the notary · 1 affidavit printed')
    // To file is what printed; the affidavit still to print is step 2's.
    expect(plainSentence(shown.steps[2].line)).toBe('1 to mail · 1 to file')
    expect(shown.rightParts).toBe('1 affidavit ready to file · 1 affidavit printed · 1 notice to print · 1 notice printed')
    expect(shown.right).toBe(run.right)
    expect(shown.settle).toBe(run.settle)
    expect(shown.totals).toBe(run.totals)
    expect(lienRunDoor(shown)).toEqual(lienRunDoor(run))
  })

  it('a right notice the run window holds is said apart, and with nothing else to print step 2 is done', () => {
    const { run } = desk({ notices: [notice('n-ready', 'ready', { item: signed('i-ready') }), notice('n-printed', 'printed', { item: signed('i-printed', { printed_at: '2026-11-13T15:00:00Z' }) })], affidavits: [] })
    expect(run.step).toBe(2)
    expect(plainSentence(run.steps[1].line)).toBe('1 notice to print')
    const shown = lienGetItRightWithFacts(run, { ...none, stoppedNotices: [{ jobId: 'n-ready', kind: 'held' }] })
    expect(shown.step).toBe(3)
    expect(shown.steps.map((s) => s.state)).toEqual(['done', 'done', 'now'])
    expect(plainSentence(shown.steps[1].line)).toBe('Nothing waits to print · 1 notice waits in the run window')
    expect(plainSentence(shown.steps[2].line)).toBe('1 to mail')
    expect(shown.counts).toMatchObject({ toPrint: 0, noticesStopped: 1, right: 2 })
    expect(shown.rightParts).toBe('1 right notice does not print here · 1 notice printed')
  })

  it('a notice with no paper copy is said as going without paper, beside what prints', () => {
    const { run } = desk({ notices: [notice('n-ready', 'ready', { item: signed('i-ready') })], affidavits: [affidavit('a-ready', 'ready', { item: item('ia-ready', 'approved') })] })
    const shown = lienGetItRightWithFacts(run, { ...none, stoppedNotices: [{ jobId: 'n-ready', kind: 'paperless' }] })
    expect(shown.step).toBe(2)
    expect(plainSentence(shown.steps[1].line)).toBe('1 affidavit for the notary · 1 notice goes without paper')
    expect(shown.rightParts).toBe('1 affidavit ready to file · 1 right notice does not print here')
  })

  it('every right affidavit printed and nothing to mail: step 3 is now, with them to file', () => {
    const { run } = desk({ notices: [], affidavits: [affidavit('a-ready', 'ready', { item: item('ia-ready', 'approved') }), affidavit('a-ready2', 'ready', { item: item('ia-ready2', 'approved') })] })
    expect(run.step).toBe(2)
    const shown = lienGetItRightWithFacts(run, { ...none, printedAffidavitJobIds: new Set(['a-ready', 'a-ready2']) })
    expect(shown.step).toBe(3)
    expect(shown.steps.map((s) => s.state)).toEqual(['done', 'done', 'now'])
    expect(plainSentence(shown.steps[1].line)).toBe('Nothing waits to print · 2 affidavits printed')
    expect(plainSentence(shown.steps[2].line)).toBe('2 to file')
    expect(shown.rightParts).toBe('2 affidavits printed')
  })

  it('a fact about a paper that is not right counts for nothing', () => {
    const { run } = desk()
    const shown = lienGetItRightWithFacts(run, { printedAffidavitJobIds: new Set(['a-owner']), stoppedNotices: [{ jobId: 'n-draft', kind: 'held' }] })
    expect(shown.counts).toMatchObject({ toPrint: 3, toFile: 0, affidavitsPrinted: 0, noticesStopped: 0 })
    expect(shown.steps.slice(0, 2).map((s) => plainSentence(s.line))).toEqual(run.steps.slice(0, 2).map((s) => plainSentence(s.line)))
    // With the facts known and no affidavit printed, nothing is to file yet: the affidavits are step 2's.
    expect(plainSentence(shown.steps[2].line)).toBe('1 to mail')
  })

  it('the strip’s new words are plain', () => {
    const { run } = desk({ notices: [notice('n-ready', 'ready', { item: signed('i-ready') }), notice('n-two', 'ready', { item: signed('i-two') })], affidavits: [affidavit('a-ready', 'ready', { item: item('ia-ready', 'approved') })] })
    const shown = lienGetItRightWithFacts(run, { printedAffidavitJobIds: new Set(['a-ready']), stoppedNotices: [{ jobId: 'n-ready', kind: 'held' }, { jobId: 'n-two', kind: 'paperless' }] })
    // The strip joins its parts with a middle dot, as the lines always have: each part is a sentence a person reads.
    const parts = [...shown.steps.map((s) => plainSentence(s.line)), shown.rightParts].flatMap((line) => line.split(' · '))
    expect(parts.flatMap((w) => plainWordsFailures(w))).toEqual([])
  })
})
