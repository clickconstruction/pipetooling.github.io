import { describe, expect, it } from 'vitest'
import type { LienDeskEntry, LienDeskPile } from './lienDesk'
import type { LienAffidavitEntry, LienAffidavitGate, LienAffidavitPile } from './lienDeskAffidavits'
import type { LienRetainageEntry, LienRetainagePile } from './lienDeskRetainage'
import { plainWordsFailures, PLAIN_WORDS_MAX_SENTENCE_WORDS } from '../plainWords'
import {
  buildLienBoard,
  compareLienBoardChips,
  LIEN_BOARD_AFFIDAVIT_STAGES,
  LIEN_BOARD_NOTICE_STAGES,
  LIEN_BOARD_WORDS,
  lienBoardArrows,
  lienBoardStagesLeft,
  lienBoardAtRisk,
  lienBoardBinsShown,
  lienBoardChipFor,
  lienBoardDoorWords,
  lienBoardDayWords,
  lienBoardDots,
  lienBoardForLeader,
  lienBoardLitBin,
  lienBoardPick,
  lienBoardPickWords,
  lienBoardRetainageLine,
  lienBoardRiskPapers,
  lienBoardRiskPhrase,
  lienBoardRiskPick,
  lienBoardRowInPick,
  lienBoardRowRisk,
  lienBoardRowStage,
  lienBoardStageBins,
  lienBoardTip,
  lienBoardUrgency,
  lienBoardWorkingDaysLeft,
  type LienBoardInput,
} from './lienBoard'

/** A Sunday: the owner read the desk on 2026-11-15, and the 15th rolls to Monday the 16th. */
const TODAY = '2026-11-15'

function notice(jobId: string, pile: LienDeskPile, over: Partial<LienDeskEntry> = {}): LienDeskEntry {
  return { jobId, customerId: 'c1', gcCustomerId: 'gc1', openBalance: 1000, hasOwner: pile !== 'needs_owner', propertyKind: '', months: [], datedFromCreation: false, dueMonths: ['2026-08'], missedMonths: [], missedUnrecorded: [], affidavitDay: null, affidavitDaysLeft: null, earliestDeadline: '2026-11-16', daysLeft: 1, severity: 'red', item: null, policy: 'ask', pile, ...over }
}
const gate = (key: LienAffidavitGate['key'], ok: boolean): LienAffidavitGate => ({ key, ok, label: key })
const wholeGates = (): LienAffidavitGate[] => [gate('owner', true), gate('legal', true), gate('contractor', true), gate('notice', true), gate('homestead', true)]
function affidavit(jobId: string, pile: LienAffidavitPile, over: Partial<LienAffidavitEntry> = {}): LienAffidavitEntry {
  return { jobId, isSub: true, lastMonth: '2026-07', lastMonthFromCreation: false, deadline: '2026-12-15', daysLeft: 30, severity: 'quiet', openBalance: 1000, customerId: 'c1', gcCustomerId: 'gc1', propertyKind: '', gates: wholeGates(), ready: true, item: null, pile, ...over }
}
function retainage(jobId: string, pile: LienRetainagePile, over: Partial<LienRetainageEntry> = {}): LienRetainageEntry {
  return { jobId, retainageHeld: 500, contractEndedOn: '2026-09-20', contractEndedHow: 'complete', deadline: '2026-10-20', daysLeft: 15, severity: 'amber', noticed: false, inClaim: false, openBalance: 1000, customerId: 'c1', gcCustomerId: 'gc1', propertyKind: '', hasOwner: true, paymentBond: 'unknown', gates: [], ready: true, item: null, pile, ...over }
}
const item = (id: string, status: string, over: Record<string, unknown> = {}) => ({ id, status, fields: {}, months: [], voided_at: null, ...over }) as unknown as LienDeskEntry['item']

function build(over: Partial<LienBoardInput>) {
  return buildLienBoard({ notices: [], affidavits: [], retainage: [], todayYmd: TODAY, jobNumber: (id) => `JP${id}`, jobName: (id) => `Job ${id}`, gcName: (id) => `GC ${id}`, leaderName: 'Malachi', ...over })
}
const bin = (board: ReturnType<typeof build>, key: string) => [...board.notices, ...board.affidavits].find((b) => b.key === key)!

describe('buildLienBoard — the bins', () => {
  it('draws the notice column and the affidavit column in flow order, Held and Missed beside each', () => {
    const board = build({})
    expect(board.notices.map((b) => b.stage)).toEqual(LIEN_BOARD_NOTICE_STAGES)
    expect(board.affidavits.map((b) => b.stage)).toEqual(LIEN_BOARD_AFFIDAVIT_STAGES)
    expect(board.notices.map((b) => b.label)).toEqual(['Needs the owner', 'To send', 'Awaiting approval', 'In the run', 'Sent', 'Held', 'Missed'])
    expect(board.affidavits.map((b) => b.label)).toEqual(['Needs the property facts', 'To send', 'Awaiting approval', 'Ready to file', 'Filed · Served', 'Held', 'Missed'])
    expect(board.notices.filter((b) => b.beside).map((b) => b.stage)).toEqual(['held', 'missed'])
    expect(board.empty).toBe(true)
    expect(board.lit).toBeNull()
  })
  it('puts every notice pile in its bin: To draft reads To send, approved and printed are both in the mail', () => {
    const board = build({
      notices: [
        notice('1', 'needs_owner'),
        notice('2', 'to_draft'),
        notice('3', 'awaiting'),
        notice('4', 'ready', { item: item('i4', 'approved') }),
        notice('5', 'printed', { item: item('i5', 'approved', { printed_at: '2026-11-14T10:00:00Z' }) }),
        notice('6', 'sent'),
        notice('7', 'held'),
        notice('8', 'missed'),
      ],
    })
    const at = (stage: string) => bin(board, `notice:${stage}`).chips.map((c) => c.label)
    expect(at('needs_owner')).toEqual(['JP1'])
    expect(at('to_send')).toEqual(['JP2'])
    expect(at('awaiting')).toEqual(['JP3'])
    expect(at('in_mail')).toEqual(['JP4', 'JP5'])
    expect(at('sent')).toEqual(['JP6'])
    expect(at('held')).toEqual(['JP7'])
    expect(at('missed')).toEqual(['JP8'])
  })
  it('puts every affidavit pile in its bin', () => {
    const board = build({ affidavits: [affidavit('1', 'needs_property', { gates: [gate('owner', false)] }), affidavit('2', 'to_draft'), affidavit('3', 'awaiting'), affidavit('4', 'ready'), affidavit('5', 'filed'), affidavit('6', 'held'), affidavit('7', 'missed')] })
    expect(board.affidavits.map((b) => b.chips.map((c) => c.label))).toEqual([['JP1'], ['JP2'], ['JP3'], ['JP4'], ['JP5'], ['JP6'], ['JP7']])
    expect(board.affidavits.every((b) => b.chips.every((c) => c.kind === 'affidavit'))).toBe(true)
  })
  it('sorts a bin by the day, the undated last, then by the number', () => {
    const board = build({
      notices: [notice('30', 'to_draft', { earliestDeadline: '2026-12-15', daysLeft: 30 }), notice('9', 'to_draft', { earliestDeadline: null, daysLeft: null }), notice('10', 'to_draft', { earliestDeadline: '2026-11-16', daysLeft: 1 }), notice('2', 'to_draft', { earliestDeadline: '2026-11-16', daysLeft: 1 })],
    })
    expect(bin(board, 'notice:to_send').chips.map((c) => c.label)).toEqual(['JP2', 'JP10', 'JP30', 'JP9'])
    expect(compareLienBoardChips({ dueYmd: null, label: 'a' }, { dueYmd: null, label: 'b' })).toBeLessThan(0)
  })
  it('shows Held and Missed only while a job is in one', () => {
    const none = build({ notices: [notice('1', 'to_draft')] })
    expect(lienBoardBinsShown(none.notices).map((b) => b.stage)).toEqual(['needs_owner', 'to_send', 'awaiting', 'in_mail', 'sent'])
    const held = build({ notices: [notice('1', 'held')] })
    expect(lienBoardBinsShown(held.notices).map((b) => b.stage)).toEqual(['needs_owner', 'to_send', 'awaiting', 'in_mail', 'sent', 'held'])
  })
  it('lights the busiest bin, the first in column order on a tie', () => {
    const board = build({ notices: [notice('1', 'to_draft'), notice('2', 'to_draft')], affidavits: [affidavit('3', 'ready'), affidavit('4', 'ready')] })
    expect(board.lit).toBe('notice:to_send')
    expect(bin(board, 'notice:to_send').lit).toBe(true)
    expect(bin(board, 'affidavit:ready').lit).toBe(false)
    const more = build({ notices: [notice('1', 'to_draft')], affidavits: [affidavit('3', 'ready'), affidavit('4', 'ready')] })
    expect(more.lit).toBe('affidavit:ready')
    expect(lienBoardLitBin([])).toBeNull()
  })
})

describe('buildLienBoard — the chips', () => {
  it('names the desk door for each notice stage', () => {
    const board = build({ notices: [notice('1', 'needs_owner'), notice('2', 'to_draft'), notice('3', 'awaiting'), notice('4', 'printed', { item: item('i4', 'approved', { printed_at: '2026-11-14T10:00:00Z' }) }), notice('5', 'sent'), notice('6', 'held'), notice('7', 'missed')] })
    const dest = (stage: string) => bin(board, `notice:${stage}`).chips[0]!.destination
    expect(dest('needs_owner')).toEqual({ kind: 'property', jobId: '1', focus: 'owner' })
    expect(dest('to_send')).toEqual({ kind: 'paper', tab: 'notices', jobId: '2' })
    expect(dest('awaiting')).toEqual({ kind: 'paper', tab: 'notices', jobId: '3' })
    expect(dest('in_mail')).toEqual({ kind: 'run', itemId: 'i4', jobId: '4' })
    expect(dest('sent')).toEqual({ kind: 'paper', tab: 'notices', jobId: '5' })
    expect(dest('held')).toEqual({ kind: 'paper', tab: 'notices', jobId: '6' })
    expect(dest('missed')).toEqual({ kind: 'paper', tab: 'notices', jobId: '7' })
  })
  it('names the desk door for each affidavit stage: the property line that is missing, the notice when it is the one gate left, the Lien window once filed', () => {
    const board = build({
      affidavits: [
        affidavit('1', 'needs_property', { gates: [gate('owner', false), gate('legal', false)] }),
        affidavit('2', 'needs_property', { gates: [gate('owner', true), gate('legal', false)] }),
        affidavit('3', 'needs_property', { gates: [gate('owner', true), gate('homestead_answer', false)] }),
        affidavit('4', 'needs_property', { gates: [gate('owner', true), gate('notice', false)] }),
        affidavit('5', 'needs_property', { gates: [gate('owner', true), gate('contractor', false)] }),
        affidavit('6', 'to_draft'),
        affidavit('7', 'awaiting'),
        affidavit('8', 'ready'),
        affidavit('9', 'filed'),
      ],
    })
    const dest = (jobId: string) => [...board.affidavits].flatMap((b) => b.chips).find((c) => c.jobId === jobId)!.destination
    expect(dest('1')).toEqual({ kind: 'property', jobId: '1', focus: 'owner' })
    expect(dest('2')).toEqual({ kind: 'property', jobId: '2', focus: 'legal' })
    expect(dest('3')).toEqual({ kind: 'property', jobId: '3', focus: 'homestead_answer' })
    expect(dest('4')).toEqual({ kind: 'paper', tab: 'notices', jobId: '4' })
    expect(dest('5')).toEqual({ kind: 'paper', tab: 'affidavits', jobId: '5' })
    expect(dest('6')).toEqual({ kind: 'paper', tab: 'affidavits', jobId: '6' })
    expect(dest('7')).toEqual({ kind: 'paper', tab: 'affidavits', jobId: '7' })
    expect(dest('8')).toEqual({ kind: 'paper', tab: 'affidavits', jobId: '8' })
    expect(dest('9')).toEqual({ kind: 'lienWindow', jobId: '9' })
  })
  it('colours a chip by how soon its day is: red within a day or past, amber this week, purple while it waits on the leader, grey later', () => {
    expect(lienBoardUrgency(0, false)).toBe('day')
    expect(lienBoardUrgency(1, false)).toBe('day')
    expect(lienBoardUrgency(-3, false)).toBe('day')
    expect(lienBoardUrgency(2, false)).toBe('week')
    expect(lienBoardUrgency(7, false)).toBe('week')
    expect(lienBoardUrgency(8, true)).toBe('waiting')
    expect(lienBoardUrgency(8, false)).toBe('later')
    expect(lienBoardUrgency(null, false)).toBe('later')
    // The day wins over the wait: the bin already says it waits.
    expect(lienBoardUrgency(1, true)).toBe('day')
    const board = build({ notices: [notice('1', 'awaiting', { earliestDeadline: '2026-12-15', daysLeft: 30 }), notice('2', 'sent', { earliestDeadline: '2026-11-16', daysLeft: 1 }), notice('3', 'missed', { earliestDeadline: '2026-10-15', daysLeft: -31 })] })
    expect(bin(board, 'notice:awaiting').chips[0]!.urgency).toBe('waiting')
    // A sent notice is done: never red, whatever its month's day was.
    expect(bin(board, 'notice:sent').chips[0]!.urgency).toBe('later')
    expect(bin(board, 'notice:missed').chips[0]!.urgency).toBe('day')
  })
  it('counts the working days left from today through the day, and marks a chip at risk when its stages outrun them', () => {
    // Friday the 13th to Monday the 16th: Friday and Monday.
    expect(lienBoardWorkingDaysLeft('2026-11-13', '2026-11-16')).toBe(2)
    // Sunday the 15th to Monday the 16th: Monday alone.
    expect(lienBoardWorkingDaysLeft('2026-11-15', '2026-11-16')).toBe(1)
    expect(lienBoardWorkingDaysLeft('2026-11-16', '2026-11-16')).toBe(1)
    expect(lienBoardWorkingDaysLeft('2026-11-16', '2026-11-20')).toBe(5)
    expect(lienBoardWorkingDaysLeft('2026-11-17', '2026-11-16')).toBe(0)
    expect(lienBoardAtRisk(3, '2026-11-13', '2026-11-16')).toBe(true)
    expect(lienBoardAtRisk(2, '2026-11-13', '2026-11-16')).toBe(false)
    expect(lienBoardAtRisk(1, '2026-11-15', '2026-11-16')).toBe(false)
    expect(lienBoardAtRisk(2, '2026-11-15', '2026-11-16')).toBe(true)
    // Nothing left to pass, or no day: never at risk. Past its day: the Missed bin says it, not the mark.
    expect(lienBoardAtRisk(0, '2026-11-15', '2026-11-16')).toBe(false)
    expect(lienBoardAtRisk(3, '2026-11-15', null)).toBe(false)
    // On the Board: a notice still to send due Monday from a Sunday has three stages and one day.
    const board = build({ notices: [notice('1', 'to_draft'), notice('2', 'printed', { item: item('i2', 'approved', { printed_at: '2026-11-14T10:00:00Z' }) })] })
    expect(bin(board, 'notice:to_send').chips[0]!).toMatchObject({ stepsLeft: 3, atRisk: true })
    expect(bin(board, 'notice:in_mail').chips[0]!).toMatchObject({ stepsLeft: 1, atRisk: false })
    expect(board.atRisk).toBe(1)
  })
  it('names the stages a paper still has to pass, one name for every stage it counts (v2.7419)', () => {
    const stages = (kind: 'notice' | 'affidavit', stage: string, leader?: string | null) => lienBoardStagesLeft({ kind, stage } as Parameters<typeof lienBoardStagesLeft>[0], leader)
    expect(stages('notice', 'needs_owner', 'Sam')).toEqual(['Name the owner on the property record', 'Send it for approval', 'Sam approves and signs it', 'Mail it and record the mailing'])
    expect(stages('notice', 'to_send', 'Sam')).toEqual(['Send it for approval', 'Sam approves and signs it', 'Mail it and record the mailing'])
    expect(stages('notice', 'awaiting', 'Sam')).toEqual(['Sam approves and signs it', 'Mail it and record the mailing'])
    expect(stages('notice', 'in_mail', 'Sam')).toEqual(['Mail it and record the mailing'])
    expect(stages('affidavit', 'needs_property', 'Sam')).toEqual(['Clear what holds it', 'Send it for approval', 'Sam approves it', 'Notarize it and file it with the county'])
    expect(stages('affidavit', 'ready', 'Sam')).toEqual(['Notarize it and file it with the county'])
    // A held paper waits on the leader again; with no leader known he is *The leader*.
    expect(stages('notice', 'held')).toEqual(['The leader approves and signs it', 'Mail it and record the mailing'])
    expect(stages('affidavit', 'held', '  ')).toEqual(['The leader approves it', 'Notarize it and file it with the county'])
    // Done or lost: nothing left to pass.
    for (const s of ['sent', 'missed']) expect(stages('notice', s)).toEqual([])
    for (const s of ['filed', 'missed']) expect(stages('affidavit', s)).toEqual([])
    // The count the Board races against the working days is the list's own length, in every bin.
    const board = build({
      notices: [notice('1', 'needs_owner'), notice('2', 'to_draft'), notice('3', 'awaiting'), notice('4', 'ready'), notice('5', 'held'), notice('6', 'sent')],
      affidavits: [affidavit('1', 'needs_property'), affidavit('2', 'to_draft'), affidavit('3', 'awaiting'), affidavit('4', 'ready'), affidavit('5', 'held'), affidavit('6', 'filed')],
    })
    const chips = [...board.notices, ...board.affidavits].flatMap((b) => b.chips)
    expect(chips).toHaveLength(12)
    for (const c of chips) expect([c.kind, c.stage, lienBoardStagesLeft(c).length]).toEqual([c.kind, c.stage, c.stepsLeft])
    for (const c of chips) for (const s of lienBoardStagesLeft(c, 'Sam')) expect(plainWordsFailures(s)).toEqual([])
  })
  it('carries the job number, the day, what it owes and a hover of the job’s name, its GC and its money', () => {
    const board = build({ notices: [notice('650', 'to_draft', { openBalance: 12345 })] })
    const chip = bin(board, 'notice:to_send').chips[0]!
    expect(chip).toMatchObject({ jobId: '650', label: 'JP650', dueYmd: '2026-11-16', daysLeft: 1, openBalance: 12345, pile: 'to_draft', gcId: 'gc1', tip: 'Job 650 · GC gc1 · $12,345' })
    expect(lienBoardTip({ jobName: 'AXO Schertz', gcName: '', openBalance: 0 })).toBe('AXO Schertz')
    expect(lienBoardTip({ jobName: '', gcName: 'Byrne', openBalance: 500 })).toBe('Byrne · $500')
  })
  it('pairs a job that stands in both columns for the one reason, no owner of record, and gives both chips the same key and the one door', () => {
    const board = build({
      notices: [notice('1', 'needs_owner'), notice('2', 'needs_owner'), notice('3', 'to_draft')],
      affidavits: [affidavit('1', 'needs_property', { gates: [gate('owner', false), gate('legal', false)] }), affidavit('2', 'needs_property', { gates: [gate('owner', true), gate('legal', false)] }), affidavit('3', 'needs_property', { gates: [gate('owner', false)] })],
    })
    expect(board.pairs).toEqual([{ key: 'owner:1', jobId: '1', reason: 'owner', destination: { kind: 'property', jobId: '1', focus: 'owner' } }])
    const chips = [...board.notices, ...board.affidavits].flatMap((b) => b.chips)
    expect(chips.filter((c) => c.pairKey === 'owner:1').map((c) => c.bin)).toEqual(['notice:needs_owner', 'affidavit:needs_property'])
    // Job 2's affidavit wants the legal description, not the owner; job 3's notice is already drafting. Neither is a pair.
    expect(chips.filter((c) => c.jobId !== '1').every((c) => c.pairKey === null)).toBe(true)
  })
})

describe('buildLienBoard — the tiles', () => {
  it('the top tile counts to the next day and says what will not make it as it stands', () => {
    const board = build({
      notices: [notice('1', 'to_draft'), notice('2', 'awaiting'), notice('3', 'to_draft', { earliestDeadline: '2026-12-15', daysLeft: 30 }), notice('4', 'sent')],
      affidavits: [affidavit('5', 'ready', { deadline: '2026-11-16', daysLeft: 1 }), affidavit('6', 'to_draft', { deadline: '2026-11-16', daysLeft: 1 })],
    })
    const top = board.tiles[0]!
    expect(board.dayWords).toBe('tomorrow')
    expect(top).toMatchObject({ key: 'by_day', figure: '4', label: 'by tomorrow · 2 to file · 2 to send', tone: 'red' })
    // Job 1 (3 stages, 1 working day), job 2 (2 stages) and job 6 (3 stages) will not make it; job 5 has one stage and one day.
    expect(top.line).toBe('3 will not make tomorrow as they stand.')
    expect(board.atRisk).toBe(3)
  })
  it('the top tile reads quiet with nothing dated, and names a chip past its day when nothing is at risk', () => {
    expect(build({}).tiles[0]).toMatchObject({ figure: '0', label: 'nothing dated', line: null, tone: 'quiet' })
    const late = build({ notices: [notice('1', 'printed', { earliestDeadline: '2026-11-10', daysLeft: -5, item: item('i1', 'approved', { printed_at: '2026-11-09T10:00:00Z' }) }), notice('2', 'printed', { earliestDeadline: '2026-11-20', daysLeft: 5, item: item('i2', 'approved', { printed_at: '2026-11-09T10:00:00Z' }) })] })
    expect(late.dayWords).toBe('Friday')
    expect(late.tiles[0]).toMatchObject({ figure: '2', label: 'by Friday · 2 to send', line: '1 is past its day.', tone: 'red' })
  })
  it('the waiting tile names the leader and counts both columns; the mail tile asks for the tracking numbers; the unpaid tile adds each job once', () => {
    const board = build({
      notices: [notice('1', 'awaiting', { openBalance: 100 }), notice('2', 'printed', { openBalance: 200, item: item('i2', 'approved', { printed_at: '2026-11-14T10:00:00Z' }) }), notice('3', 'ready', { openBalance: 300, item: item('i3', 'approved') })],
      affidavits: [affidavit('1', 'awaiting', { openBalance: 100 }), affidavit('4', 'to_draft', { openBalance: 1000 })],
    })
    expect(board.tiles[1]).toMatchObject({ key: 'waiting', figure: '2', label: 'waiting on Malachi', line: null, tone: 'violet', destination: { kind: 'stage', stage: 'awaiting' } })
    expect(board.tiles[2]).toMatchObject({ key: 'in_mail', figure: '2', label: 'in the run', line: 'Type the tracking number.', tone: 'amber', destination: { kind: 'run' } })
    expect(board.tiles[3]).toMatchObject({ key: 'unpaid', figure: '$1,600', label: 'unpaid on the desk', tone: 'quiet', destination: null })
    const quiet = build({ notices: [notice('3', 'ready', { item: item('i3', 'approved') })], leaderName: null })
    expect(quiet.tiles[1]).toMatchObject({ figure: '0', label: 'waiting on the leader', line: 'Nothing waits on the leader.', tone: 'quiet', destination: null })
    expect(quiet.tiles[2]).toMatchObject({ figure: '1', line: 'Print the run.' })
    expect(build({}).tiles[2]).toMatchObject({ figure: '0', line: 'Nothing is in the run.', tone: 'quiet', destination: null })
  })
  it('every line a person reads keeps to plain words, and every label stays short', () => {
    const boards = [
      build({}),
      build({ notices: [notice('1', 'to_draft'), notice('2', 'awaiting'), notice('3', 'printed', { item: item('i3', 'approved', { printed_at: '2026-11-14T10:00:00Z' }) })], affidavits: [affidavit('4', 'ready', { deadline: '2026-11-16', daysLeft: 1 })], retainage: [retainage('5', 'to_draft'), retainage('6', 'awaiting')] }),
      build({ notices: [notice('1', 'printed', { earliestDeadline: '2026-11-10', daysLeft: -5, item: item('i1', 'approved', { printed_at: '2026-11-09T10:00:00Z' }) })] }),
    ]
    for (const board of boards) {
      for (const t of board.tiles) {
        if (t.line) expect(plainWordsFailures(t.line)).toEqual([])
        expect(t.label.split(/\s+/).length).toBeLessThanOrEqual(PLAIN_WORDS_MAX_SENTENCE_WORDS)
      }
      if (board.retainageLine) expect(board.retainageLine.split(/\s+/).length).toBeLessThanOrEqual(PLAIN_WORDS_MAX_SENTENCE_WORDS)
      for (const b of [...board.notices, ...board.affidavits]) expect(b.label.split(/\s+/).length).toBeLessThanOrEqual(5)
    }
  })
})

describe('the arrows, the day words, the retainage line, the dots and the leader’s view', () => {
  it('draws one arrow between each pair of bins down a column, and one across from Sent to Needs the property facts', () => {
    const arrows = lienBoardArrows()
    expect(arrows.filter((a) => a.kind === 'down' && a.from.startsWith('notice:')).map((a) => `${a.from}>${a.to}`)).toEqual(['notice:needs_owner>notice:to_send', 'notice:to_send>notice:awaiting', 'notice:awaiting>notice:in_mail', 'notice:in_mail>notice:sent'])
    expect(arrows.filter((a) => a.kind === 'down' && a.from.startsWith('affidavit:'))).toHaveLength(4)
    expect(arrows.filter((a) => a.kind === 'cross')).toEqual([{ from: 'notice:sent', to: 'affidavit:needs_property', kind: 'cross' }])
    expect(build({}).arrows).toEqual(arrows)
  })
  it('names a day as a person would: today, tomorrow, its weekday inside the week, else the date', () => {
    expect(lienBoardDayWords('2026-11-15', '2026-11-15')).toBe('today')
    expect(lienBoardDayWords('2026-11-15', '2026-11-16')).toBe('tomorrow')
    expect(lienBoardDayWords('2026-11-15', '2026-11-18')).toBe('Wednesday')
    expect(lienBoardDayWords('2026-11-15', '2026-11-21')).toBe('Saturday')
    expect(lienBoardDayWords('2026-11-15', '2026-11-22')).toBe('Nov 22')
    expect(lienBoardDayWords('2026-11-15', '2026-11-10')).toBe('today')
  })
  it('writes retainage as one line under the notices, each pile with a job in it, and none when its desk is quiet', () => {
    expect(lienBoardRetainageLine([])).toBeNull()
    expect(lienBoardRetainageLine([retainage('1', 'sent'), retainage('2', 'clock_not_started')])).toBeNull()
    expect(lienBoardRetainageLine([retainage('1', 'needs_owner'), retainage('2', 'to_draft'), retainage('3', 'to_draft'), retainage('4', 'awaiting'), retainage('5', 'held')])).toBe('Retainage · 1 needs the owner · 2 to send · 1 awaiting approval · 1 held')
    expect(build({ retainage: [retainage('1', 'ready')] }).retainageLine).toBe('Retainage · 1 ready to send')
  })
  it('gives the Dashboard four dots: the tiles’ figures with a word each', () => {
    const board = build({ notices: [notice('1', 'to_draft'), notice('2', 'awaiting', { openBalance: 2000 })] })
    expect(lienBoardDots(board)).toEqual([
      { key: 'by_day', figure: '2', words: 'by tomorrow', tone: 'red' },
      { key: 'waiting', figure: '1', words: 'waiting on Malachi', tone: 'violet' },
      { key: 'in_mail', figure: '0', words: 'in the run', tone: 'quiet' },
      { key: 'unpaid', figure: '$3,000', words: 'unpaid on the desk', tone: 'quiet' },
    ])
    expect(lienBoardDots(build({}))[0]).toEqual({ key: 'by_day', figure: '0', words: 'nothing dated', tone: 'quiet' })
  })
  it('the leader’s view keeps his two bins, the jobs he leads, and one counted press: the affidavits approve, a notice is held for his signature, a late paper with its day', () => {
    const board = build({ notices: [notice('1', 'awaiting'), notice('2', 'to_draft'), notice('3', 'awaiting', { earliestDeadline: '2026-11-10', daysLeft: -5 })], affidavits: [affidavit('4', 'awaiting', { deadline: '2026-11-16', daysLeft: 1 }), affidavit('5', 'ready'), affidavit('6', 'awaiting')] })
    const view = lienBoardForLeader(board)
    expect(view.bins.map((b) => b.key)).toEqual(['notice:awaiting', 'affidavit:awaiting'])
    expect(view.chips.map((c) => c.label)).toEqual(['JP4', 'JP6'])
    expect(view.held.map((h) => [h.chip.label, h.reason])).toEqual([['JP3', 'is past its day'], ['JP1', 'needs your signature']])
    expect(view.press).toEqual({ button: 'Approve 2 affidavits · 2 are held ▸', foot: '2 are held. They stay here with the reason. The 2 ready ones approve now.', dead: false })
    // Only his jobs: another master's paper is not in his bins or his press.
    const mine = lienBoardForLeader(board, { leads: (jobId) => jobId !== '6' })
    expect(mine.bins.map((b) => b.chips.map((c) => c.label))).toEqual([['JP3', 'JP1'], ['JP4']])
    expect(mine.press.button).toBe('Approve 1 affidavit · 2 are held ▸')
    // Every hold the same reason: the button says it.
    const notices = lienBoardForLeader(build({ notices: [notice('1', 'awaiting'), notice('2', 'awaiting')], affidavits: [affidavit('4', 'awaiting')] }))
    expect(notices.press.button).toBe('Approve 1 affidavit · 2 need your signature ▸')
    const clean = lienBoardForLeader(build({ affidavits: [affidavit('4', 'awaiting')] }))
    expect(clean.press).toEqual({ button: 'Approve 1 affidavit', foot: null, dead: false })
    const onlyNotices = lienBoardForLeader(build({ notices: [notice('1', 'awaiting')] }))
    expect(onlyNotices.press).toEqual({ button: 'Approve ▸', foot: 'Nothing is ready to approve. Fix what is marked in red, then approve.', dead: true })
    const none = lienBoardForLeader(build({ notices: [notice('1', 'to_draft')] }))
    expect(none.press.dead).toBe(true)
    expect(none.chips).toEqual([])
    for (const v of [view, mine, notices]) if (v.press.foot) expect(plainWordsFailures(v.press.foot)).toEqual([])
  })
  it('a pressed bin narrows the list to its jobs, a run row for one of their GCs, and the words say what shows (the picture and the queue)', () => {
    const board = build({ notices: [notice('1', 'to_draft'), notice('2', 'to_draft', { gcCustomerId: 'gc9' }), notice('3', 'awaiting')], affidavits: [affidavit('4', 'awaiting'), affidavit('5', 'ready')] })
    const pick = lienBoardPick(board, ['notice:to_send'])
    expect(pick).toMatchObject({ bins: ['notice:to_send'], label: 'To send', count: 2 })
    expect([...pick.jobIds]).toEqual(['1', '2'])
    expect([...pick.gcIds]).toEqual(['gc1', 'gc9'])
    expect(lienBoardRowInPick(pick, { jobId: '1', gcId: 'gc1' })).toBe(true)
    expect(lienBoardRowInPick(pick, { jobId: '3', gcId: 'gc1' })).toBe(false)
    // A GC's run row names no job; it is in when one of its notices is. A printed run row lists its jobs.
    expect(lienBoardRowInPick(pick, { jobId: null, gcId: 'gc9' })).toBe(true)
    expect(lienBoardRowInPick(pick, { jobId: null, gcId: null, jobs: [{ jobId: '2' }] })).toBe(true)
    expect(lienBoardRowInPick(pick, { jobId: null, gcId: null })).toBe(false)
    // A tile's stage is both columns' bins of that name.
    expect(lienBoardStageBins(board, 'awaiting')).toEqual(['notice:awaiting', 'affidavit:awaiting'])
    const both = lienBoardPick(board, lienBoardStageBins(board, 'awaiting'))
    expect(both).toMatchObject({ label: 'Awaiting approval', count: 2 })
    expect([...both.jobIds]).toEqual(['3', '4'])
    expect(lienBoardPickWords(pick, 2)).toEqual({ head: 'Showing 2 rows in To send.', clear: 'Show every row' })
    expect(lienBoardPickWords(pick, 1).head).toBe('Showing 1 row in To send.')
    expect(plainWordsFailures(lienBoardPickWords(both, 2).head)).toEqual([])
  })
  it('a job number stands for its chip (v2.7333): the column asked for, or the notice first, and the door words say where the press goes', () => {
    const board = build({ notices: [notice('1', 'needs_owner'), notice('2', 'printed', { item: item('i2', 'approved', { printed_at: '2026-11-14T10:00:00Z' }) })], affidavits: [affidavit('1', 'needs_property', { gates: [gate('owner', true), gate('legal', false)] }), affidavit('3', 'filed')] })
    expect(lienBoardChipFor(board, '1', 'notice')?.bin).toBe('notice:needs_owner')
    expect(lienBoardChipFor(board, '1', 'affidavit')?.bin).toBe('affidavit:needs_property')
    expect(lienBoardChipFor(board, '1', 'either')?.bin).toBe('notice:needs_owner')
    expect(lienBoardChipFor(board, '3', 'either')?.bin).toBe('affidavit:filed')
    expect(lienBoardChipFor(board, '3', 'notice')).toBeNull()
    expect(lienBoardChipFor(board, '9', 'either')).toBeNull()
    expect(lienBoardDoorWords({ kind: 'property', jobId: '1', focus: 'owner' })).toBe('Open the property record at the owner')
    expect(lienBoardDoorWords({ kind: 'property', jobId: '1', focus: 'legal' })).toBe('Open the property record at the legal description')
    expect(lienBoardDoorWords({ kind: 'property', jobId: '1', focus: 'homestead_answer' })).toBe('Open the property record at the homestead question')
    expect(lienBoardDoorWords({ kind: 'paper', tab: 'notices', jobId: '1' })).toBe('Open the notice')
    expect(lienBoardDoorWords({ kind: 'paper', tab: 'affidavits', jobId: '1' })).toBe('Open the affidavit')
    expect(lienBoardDoorWords({ kind: 'run', itemId: 'i2', jobId: '2' })).toBe('Open the run on this envelope')
    expect(lienBoardDoorWords({ kind: 'lienWindow', jobId: '3' })).toBe('Open the job’s Lien window')
  })
  it('the words constant holds every bin name once', () => {
    expect(Object.keys(LIEN_BOARD_WORDS).sort()).toEqual(['awaiting', 'filed', 'held', 'in_mail', 'missed', 'needs_owner', 'needs_property', 'ready', 'sent', 'to_send'])
  })
})

describe('the papers that will not make their day, as one rule for the tile, the chips and the list (v2.7371)', () => {
  const board = () =>
    build({
      notices: [notice('1', 'to_draft'), notice('2', 'awaiting'), notice('3', 'to_draft', { earliestDeadline: '2026-12-15', daysLeft: 30 }), notice('4', 'sent'), notice('7', 'printed', { item: { id: 'i7', status: 'approved', fields: {}, months: [], voided_at: null, printed_at: '2026-11-14T10:00:00Z' } as unknown as LienDeskEntry['item'] })],
      affidavits: [affidavit('5', 'ready', { deadline: '2026-11-16', daysLeft: 1 }), affidavit('6', 'to_draft', { deadline: '2026-11-16', daysLeft: 1 }), affidavit('1', 'ready', { deadline: '2026-11-16', daysLeft: 1 })],
    })

  it('the day tile’s red line is a press of its own, and only while a paper is at risk', () => {
    expect(board().tiles[0]!.lineDestination).toEqual({ kind: 'risk' })
    expect(board().tiles[0]!.destination).toBeNull()
    const calm = build({ affidavits: [affidavit('5', 'ready', { deadline: '2026-11-16', daysLeft: 1 })] })
    expect(calm.tiles[0]!.line).toBeNull()
    expect(calm.tiles[0]!.lineDestination).toBeNull()
    expect(board().tiles.slice(1).every((t) => !t.lineDestination)).toBe(true)
  })

  it('the papers are keyed by their kind and job, each with the stages it still has to pass', () => {
    const papers = lienBoardRiskPapers(board())
    // Job 1's notice (3 stages), job 2's (2) and job 6's affidavit (3) will not make tomorrow. Job 1's ready affidavit will.
    expect([...papers.entries()].sort()).toEqual([['affidavit:6', 3], ['notice:1', 3], ['notice:2', 2]])
    expect(papers.size).toBe(board().atRisk)
  })

  it('a To do row reads its own paper: the notice row of job 1 is at risk, its affidavit row is not', () => {
    const papers = lienBoardRiskPapers(board())
    expect(lienBoardRowRisk(papers, { key: 'notice:1', kind: 'notice', jobId: '1' })).toBe(3)
    expect(lienBoardRowRisk(papers, { key: 'affidavit:1', kind: 'affidavit', jobId: '1' })).toBeNull()
    expect(lienBoardRowRisk(papers, { key: 'affidavit:6', kind: 'affidavit', jobId: '6' })).toBe(3)
    // A reminder, a served copy and a returned envelope ride on the job's key in another form: never at risk here.
    expect(lienBoardRowRisk(papers, { key: 'courtesy:1', kind: 'notice', jobId: '1' })).toBeNull()
    expect(lienBoardRowRisk(papers, { key: 'serve:6', kind: 'affidavit', jobId: '6' })).toBeNull()
    expect(lienBoardRowRisk(papers, { key: 'mail:p1', kind: 'notice', jobId: '1' })).toBeNull()
    expect(lienBoardRowRisk(papers, { key: 'retainage:1', kind: 'retainage', jobId: '1' })).toBeNull()
    // A run row stands for several notices and takes the longest road among them.
    expect(lienBoardRowRisk(papers, { key: 'run:gc1', kind: 'notice', jobId: null, jobs: [{ jobId: '7' }, { jobId: '2' }, { jobId: '1' }] })).toBe(3)
    expect(lienBoardRowRisk(papers, { key: 'run:printed', kind: 'notice', jobId: null, jobs: [{ jobId: '7' }] })).toBeNull()
  })

  it('a press on the line is a pick of those papers, with no bin lit, and the list says so in the tile’s words', () => {
    const pick = lienBoardRiskPick(board())
    expect(pick.bins).toEqual([])
    expect(pick.count).toBe(3)
    expect([...pick.papers!].sort()).toEqual(['affidavit:6', 'notice:1', 'notice:2'])
    expect(lienBoardPickWords(pick, 3)).toEqual({ head: 'Showing 3 rows that will not make tomorrow as they stand.', clear: 'Show every row' })
    expect(plainWordsFailures(lienBoardPickWords(pick, 3).head)).toEqual([])
    // The row's own paper decides: job 1's notice row is in, its affidavit row is out.
    expect(lienBoardRowInPick(pick, { jobId: '1', gcId: 'gc1', kind: 'notice' })).toBe(true)
    expect(lienBoardRowInPick(pick, { jobId: '1', gcId: 'gc1', kind: 'affidavit' })).toBe(false)
    expect(lienBoardRowInPick(pick, { jobId: '5', gcId: 'gc1', kind: 'affidavit' })).toBe(false)
    expect(lienBoardRowInPick(pick, { jobId: null, gcId: null, kind: 'notice', jobs: [{ jobId: '7' }, { jobId: '2' }] })).toBe(true)
    expect(lienBoardRowInPick(pick, { jobId: null, gcId: null, kind: 'notice', jobs: [{ jobId: '7' }] })).toBe(false)
  })

  it('the phrase is the tile’s, for one paper and for many', () => {
    expect(lienBoardRiskPhrase('tomorrow', 3)).toBe('will not make tomorrow as they stand')
    expect(lienBoardRiskPhrase('Monday', 1)).toBe('will not make Monday as it stands')
    expect(lienBoardRiskPhrase(null, 2)).toBe('will not make their day as they stand')
  })
})

describe('a To do row’s stage, in the Board’s own words (v2.7372)', () => {
  const board = () =>
    build({
      notices: [notice('1', 'needs_owner'), notice('2', 'to_draft'), notice('3', 'awaiting'), notice('7', 'printed', { item: { id: 'i7', status: 'approved', fields: {}, months: [], voided_at: null, printed_at: '2026-11-14T10:00:00Z' } as unknown as LienDeskEntry['item'] })],
      affidavits: [affidavit('5', 'ready', { deadline: '2026-11-16', daysLeft: 1 }), affidavit('6', 'needs_property', { gates: [gate('owner', true), gate('legal', false)] }), affidavit('2', 'to_draft')],
    })

  it('a row is named by the bin its paper stands in', () => {
    const b = board()
    const stage = (key: string, kind: string, jobId: string | null, jobs?: Array<{ jobId: string }>) => lienBoardRowStage(b, { key, kind, jobId, jobs })
    expect(stage('notice:1', 'notice', '1')).toBe(LIEN_BOARD_WORDS.needs_owner)
    expect(stage('notice:2', 'notice', '2')).toBe('To send')
    expect(stage('notice:3', 'notice', '3')).toBe('Awaiting approval')
    expect(stage('affidavit:5', 'affidavit', '5')).toBe('Ready to file')
    expect(stage('affidavit:6', 'affidavit', '6')).toBe('Needs the property facts')
    // Job 2 has a notice to send and an affidavit to send: each row reads its own column.
    expect(stage('affidavit:2', 'affidavit', '2')).toBe('To send')
    // A run row stands in the notices' mail bin, whatever it lists.
    expect(stage('run:printed', 'notice', null, [{ jobId: '7' }])).toBe(b.notices.find((x) => x.stage === 'in_mail')!.label)
  })

  it('a row with no bin of its own has no stage', () => {
    const b = board()
    expect(lienBoardRowStage(b, { key: 'courtesy:1', kind: 'notice', jobId: '1' })).toBeNull()
    expect(lienBoardRowStage(b, { key: 'serve:5', kind: 'affidavit', jobId: '5' })).toBeNull()
    expect(lienBoardRowStage(b, { key: 'retainage:1', kind: 'retainage', jobId: '1' })).toBeNull()
    expect(lienBoardRowStage(b, { key: 'notice:99', kind: 'notice', jobId: '99' })).toBeNull()
  })
})

describe('a chip on a property that reads as public, unanswered (v2.7443)', () => {
  it('carries the mark and loses its red day and its risk, in both columns; any other chip is as before', () => {
    const b = build({
      notices: [notice('523', 'to_draft', { earliestDeadline: '2026-11-15', daysLeft: 0 }), notice('2', 'to_draft', { earliestDeadline: '2026-11-15', daysLeft: 0 })],
      affidavits: [affidavit('883', 'ready', { deadline: '2026-11-16', daysLeft: 1 })],
      publicJobIds: new Set(['523', '883']),
    })
    const chip = (key: string, jobId: string) => bin(b, key).chips.find((c) => c.jobId === jobId)!
    expect(chip('notice:to_send', '523')).toMatchObject({ publicMark: true, urgency: 'later', atRisk: false })
    expect(chip('affidavit:ready', '883')).toMatchObject({ publicMark: true, urgency: 'later', atRisk: false })
    expect(chip('notice:to_send', '2').publicMark).toBeUndefined()
    expect(chip('notice:to_send', '2').urgency).toBe('day')
    expect(build({ notices: [notice('523', 'to_draft', { earliestDeadline: '2026-11-15', daysLeft: 0 })] }).notices.flatMap((x) => x.chips)[0]!.publicMark).toBeUndefined()
  })
})
