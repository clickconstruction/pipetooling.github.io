import { describe, expect, it } from 'vitest'
import { LIEN_DESK_PILES, type LienDeskEntry, type LienDeskPile } from './lienDesk'
import type { LienAffidavitEntry, LienAffidavitGate, LienAffidavitPile } from './lienDeskAffidavits'
import type { LienRetainageEntry, LienRetainagePile } from './lienDeskRetainage'
import { plainWordsFailures, PLAIN_WORDS_MAX_SENTENCE_WORDS } from '../plainWords'
import { lienFieldsHash } from './lienNoticeSignature'
import { LIEN_RUN_STEP } from './lienRunWords'
import {
  buildLienBoard,
  compareLienBoardChips,
  LIEN_BOARD_AFFIDAVIT_STAGES,
  LIEN_BOARD_NOTICE_STAGES,
  LIEN_BOARD_WORDS,
  LIEN_RUN_TILE_LABEL,
  lienBoardArrows,
  lienBoardStagesLeft,
  lienBoardAtRisk,
  lienBoardBinCount,
  lienBoardUnreadBinWords,
  lienBoardUnreadWords,
  lienBoardBinsShown,
  lienBoardChipFor,
  lienBoardDoorWords,
  lienBoardDayWords,
  lienBoardDots,
  lienBoardForLeader,
  lienBoardHeldBin,
  lienBoardHoldWords,
  lienBoardLeaderPick,
  lienBoardLeaderWaits,
  lienBoardPick,
  lienBoardPileWords,
  lienBoardPickWords,
  lienBoardRetainageLine,
  lienBoardRiskPapers,
  lienBoardRiskPhrase,
  lienBoardRiskPick,
  lienBoardRowInPick,
  lienBoardRowRisk,
  lienBoardRowBin,
  lienBoardRowStage,
  lienBoardStageBins,
  lienBoardTip,
  lienBoardUrgency,
  lienBoardWorkingDaysLeft,
  lienLeaderWaitWords,
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
/** An approved item the leader signed as it stands (`lienChipSigned`): the instant, his printed name, and the hash of the fields he signed. */
const signedItem = (id: string, over: Record<string, unknown> = {}) => item(id, 'approved', { signed_at: '2026-11-13T19:14:00Z', signer_printed_name: 'Malachi', signer_signature_mode: 'type', signed_fields_hash: lienFieldsHash({}), ...over })
const PRINTED = { printed_at: '2026-11-14T10:00:00Z' }

function build(over: Partial<LienBoardInput>) {
  return buildLienBoard({ notices: [], affidavits: [], retainage: [], todayYmd: TODAY, jobNumber: (id) => `JP${id}`, jobName: (id) => `Job ${id}`, gcName: (id) => `GC ${id}`, leaderName: 'Malachi', ...over })
}
const bin = (board: ReturnType<typeof build>, key: string) => [...board.notices, ...board.affidavits].find((b) => b.key === key)!

describe('buildLienBoard — the bins', () => {
  it('draws the notice column and the affidavit column in flow order, Missed beside each, and no bin named Held (v2.7783)', () => {
    const board = build({})
    expect(board.notices.map((b) => b.stage)).toEqual(LIEN_BOARD_NOTICE_STAGES)
    expect(board.affidavits.map((b) => b.stage)).toEqual(LIEN_BOARD_AFFIDAVIT_STAGES)
    expect(board.notices.map((b) => b.label)).toEqual(['Needs the owner', 'To send for Master approval', 'Awaiting Master approval', 'Approved · to sign', 'Approved · to print', 'Approved · to mail', 'Sent', 'Window closed · no notice'])
    expect(board.affidavits.map((b) => b.label)).toEqual(['Needs the property facts', 'Waiting on its notice', 'To send for Master approval', 'Awaiting Master approval', 'Ready to file', 'Filed · copies to mail', 'Served', 'Lien day passed · not filed'])
    // No bin stands beside a column: Held is drawn where its paper stopped, and the closed end stands at the column's foot.
    expect(board.notices.filter((b) => b.closed).map((b) => b.stage)).toEqual(['missed'])
    expect(board.affidavits.filter((b) => b.closed).map((b) => b.key)).toEqual(['affidavit:missed'])
    expect(board.empty).toBe(true)
  })
  it('puts every notice pile in its bin: To draft reads To send for Master approval, an approved one is Approved · to print and a printed one Approved · to mail', () => {
    const board = build({
      notices: [
        notice('1', 'needs_owner'),
        notice('2', 'to_draft'),
        notice('3', 'awaiting'),
        notice('4', 'ready', { item: signedItem('i4') }),
        notice('5', 'printed', { item: item('i5', 'approved', { printed_at: '2026-11-14T10:00:00Z' }) }),
        notice('6', 'sent'),
        notice('7', 'held'),
        notice('8', 'missed', { missedUnrecorded: ['2026-08'] }),
      ],
    })
    const at = (stage: string) => bin(board, `notice:${stage}`).chips.map((c) => c.label)
    expect(at('needs_owner')).toEqual(['JP1'])
    expect(at('to_send')).toEqual(['JP2'])
    // A held notice waits on the leader again: it stands in his bin, after the one that can move, and the count leaves it out.
    expect(at('awaiting')).toEqual(['JP3', 'JP7'])
    expect(bin(board, 'notice:awaiting').chips.map((c) => c.held ?? false)).toEqual([false, true])
    expect(lienBoardBinCount(bin(board, 'notice:awaiting'))).toBe(1)
    expect(at('to_print')).toEqual(['JP4'])
    expect(at('in_mail')).toEqual(['JP5'])
    expect(at('sent')).toEqual(['JP6'])
    expect(at('missed')).toEqual(['JP8'])
  })
  it('the closed end: a closed job stands there until its months are recorded, quiet, and one a late notice can save is marked', () => {
    const board = build({
      notices: [
        // Every month closed, one unrecorded, the lien day ahead: a late notice can still go.
        notice('1', 'missed', { missedUnrecorded: ['2026-08'], affidavitDay: '2026-12-15', affidavitDaysLeft: 30 }),
        // The lien day passed too.
        notice('2', 'missed', { missedUnrecorded: ['2026-07'], affidavitDay: '2026-11-10', affidavitDaysLeft: -5 }),
        // Someone recorded its months closed: it has its answer, so it has no chip.
        notice('3', 'missed', { missedMonths: ['2026-07'], missedUnrecorded: [] }),
      ],
      affidavits: [affidavit('2', 'missed', { deadline: '2026-11-10', daysLeft: -5 })],
    })
    const closed = bin(board, 'notice:missed')
    expect(closed.label).toBe('Window closed · no notice')
    expect(closed.closed).toBe(true)
    expect(closed.chips.map((c) => [c.label, c.urgency, c.atRisk, c.lateNotice ?? false])).toEqual([['JP1', 'later', false, true], ['JP2', 'later', false, false]])
    expect(board.notices.flatMap((b) => b.chips).map((c) => c.jobId)).not.toContain('3')
    // The affidavits' closed end: past its day, never red, never at risk.
    const gone = bin(board, 'affidavit:missed')
    expect(gone.label).toBe('Lien day passed · not filed')
    expect(gone.chips.map((c) => [c.label, c.urgency, c.atRisk, c.daysLeft])).toEqual([['JP2', 'later', false, -5]])
    // Drawn only while a job is in it.
    expect(lienBoardBinsShown(board.notices).map((b) => b.stage)).toContain('missed')
    expect(lienBoardBinsShown(build({}).notices).map((b) => b.stage)).not.toContain('missed')
    expect(lienBoardBinsShown(build({}).affidavits).map((b) => b.stage)).not.toContain('missed')
    // The tiles count papers still to send or file: none of these.
    expect(board.tiles[0]!.figure).toBe('0')
    expect(board.tiles[0]!.line).toBeNull()
    // The property card names a missed pile in the bin's words.
    expect(lienBoardPileWords('notice', 'missed')).toBe('Window closed · no notice')
    expect(lienBoardPileWords('affidavit', 'missed')).toBe('Lien day passed · not filed')
  })
  it('puts every affidavit pile in its bin', () => {
    // A filed affidavit with its copies still to mail stands apart from one that is served (punch list #366).
    const board = build({ affidavits: [affidavit('1', 'needs_property', { gates: [gate('owner', false)] }), affidavit('8', 'needs_notice', { gates: [gate('notice', false)] }), affidavit('2', 'to_draft'), affidavit('3', 'awaiting'), affidavit('4', 'ready'), affidavit('5', 'filed'), affidavit('9', 'filed'), affidavit('6', 'held'), affidavit('7', 'missed')], serve: [{ jobId: '5', serveDue: '2026-11-18' }] })
    // The one the leader held stands in Awaiting Master approval, after the one that waits (v2.7783).
    expect(board.affidavits.map((b) => b.chips.map((c) => c.label))).toEqual([['JP1'], ['JP8'], ['JP2'], ['JP3', 'JP6'], ['JP4'], ['JP5'], ['JP9'], ['JP7']])
    expect(board.affidavits.every((b) => b.chips.every((c) => c.kind === 'affidavit'))).toBe(true)
  })
  it('sorts a bin by the day, the undated last, then by the number', () => {
    const board = build({
      notices: [notice('30', 'to_draft', { earliestDeadline: '2026-12-15', daysLeft: 30 }), notice('9', 'to_draft', { earliestDeadline: null, daysLeft: null }), notice('10', 'to_draft', { earliestDeadline: '2026-11-16', daysLeft: 1 }), notice('2', 'to_draft', { earliestDeadline: '2026-11-16', daysLeft: 1 })],
    })
    expect(bin(board, 'notice:to_send').chips.map((c) => c.label)).toEqual(['JP2', 'JP10', 'JP30', 'JP9'])
    expect(compareLienBoardChips({ dueYmd: null, label: 'a' }, { dueYmd: null, label: 'b' })).toBeLessThan(0)
  })
  it('shows the closed end only while a job with an unrecorded closed month is in it, and a held paper adds no bin', () => {
    const none = build({ notices: [notice('1', 'to_draft')] })
    expect(lienBoardBinsShown(none.notices).map((b) => b.stage)).toEqual(['needs_owner', 'to_send', 'awaiting', 'to_sign', 'to_print', 'in_mail', 'sent'])
    const held = build({ notices: [notice('1', 'held')] })
    expect(lienBoardBinsShown(held.notices).map((b) => b.stage)).toEqual(['needs_owner', 'to_send', 'awaiting', 'to_sign', 'to_print', 'in_mail', 'sent'])
    const missed = build({ notices: [notice('1', 'missed', { missedUnrecorded: ['2026-08'] })] })
    // Recorded closed, the job has its answer: no chip, so no bin.
    expect(lienBoardBinsShown(build({ notices: [notice('1', 'missed')] }).notices).map((b) => b.stage)).not.toContain('missed')
    expect(lienBoardBinsShown(missed.notices).map((b) => b.stage)).toEqual(['needs_owner', 'to_send', 'awaiting', 'to_sign', 'to_print', 'in_mail', 'sent', 'missed'])
  })
  it('lights no bin as the busiest (v2.7714): the blue edge is the component’s, on a bin whose press is live', () => {
    const board = build({ notices: [notice('1', 'to_draft'), notice('2', 'to_draft')], affidavits: [affidavit('3', 'ready'), affidavit('4', 'ready')] })
    expect('lit' in board).toBe(false)
    expect([...board.notices, ...board.affidavits].some((b) => 'lit' in b)).toBe(false)
  })
})

describe('buildLienBoard — the chips', () => {
  it('names the desk door for each notice stage', () => {
    const board = build({ notices: [notice('1', 'needs_owner'), notice('2', 'to_draft'), notice('3', 'awaiting'), notice('4', 'printed', { item: item('i4', 'approved', { printed_at: '2026-11-14T10:00:00Z' }) }), notice('5', 'sent'), notice('6', 'held'), notice('7', 'missed', { missedUnrecorded: ['2026-08'] }), notice('8', 'ready', { item: signedItem('i8') }), notice('9', 'ready'), notice('10', 'ready', { item: item('i10', 'approved') })] })
    const dest = (stage: string) => bin(board, `notice:${stage}`).chips[0]!.destination
    expect(dest('needs_owner')).toEqual({ kind: 'property', jobId: '1', focus: 'owner' })
    expect(dest('to_send')).toEqual({ kind: 'paper', tab: 'notices', jobId: '2' })
    expect(dest('awaiting')).toEqual({ kind: 'paper', tab: 'notices', jobId: '3' })
    // Both bins of approved notices open the run on the notice (v2.7448); with no desk item to open it on, the notice itself.
    expect(dest('to_print')).toEqual({ kind: 'run', itemId: 'i8', jobId: '8' })
    expect(bin(board, 'notice:to_print').chips.map((c) => c.destination.kind)).toEqual(['run', 'paper'])
    // An approved notice nobody has signed opens the notice itself, where it is signed (v2.7712): the run holds it.
    expect(dest('to_sign')).toEqual({ kind: 'paper', tab: 'notices', jobId: '10' })
    expect(dest('in_mail')).toEqual({ kind: 'run', itemId: 'i4', jobId: '4' })
    expect(dest('sent')).toEqual({ kind: 'paper', tab: 'notices', jobId: '5' })
    // A held notice stands in Awaiting Master approval and opens the notice, as it did from its own bin.
    expect(bin(board, 'notice:awaiting').chips.find((c) => c.held)!.destination).toEqual({ kind: 'paper', tab: 'notices', jobId: '6' })
    expect(dest('missed')).toEqual({ kind: 'paper', tab: 'notices', jobId: '7' })
  })
  it('names the desk door for each affidavit stage: the property line that is missing, the notice when it is the one gate left, the Lien window once filed', () => {
    const board = build({
      affidavits: [
        affidavit('1', 'needs_property', { gates: [gate('owner', false), gate('legal', false)] }),
        affidavit('2', 'needs_property', { gates: [gate('owner', true), gate('legal', false)] }),
        affidavit('3', 'needs_property', { gates: [gate('owner', true), gate('homestead_answer', false)] }),
        affidavit('4', 'needs_notice', { gates: [gate('owner', true), gate('notice', false)] }),
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
  it('an affidavit that waits only on a notice already approved opens the run on that envelope, as the notice’s own chip does', () => {
    const waits = (jobId: string) => affidavit(jobId, 'needs_notice', { gates: [gate('owner', true), gate('notice', false)] })
    const board = build({
      notices: [notice('1', 'ready', { item: signedItem('i1') }), notice('2', 'printed', { item: item('i2', 'approved', { printed_at: '2026-11-14T10:00:00Z' }) }), notice('3', 'awaiting', { item: item('i3', 'awaiting_approval') }), notice('4', 'ready', { item: null })],
      affidavits: [waits('1'), waits('2'), waits('3'), waits('4'), waits('5'), affidavit('6', 'needs_property', { gates: [gate('owner', false), gate('notice', false)] })],
    })
    const dest = (jobId: string) => board.affidavits.flatMap((b) => b.chips).find((c) => c.jobId === jobId)!.destination
    expect(dest('1')).toEqual({ kind: 'run', itemId: 'i1', jobId: '1' })
    expect(dest('2')).toEqual({ kind: 'run', itemId: 'i2', jobId: '2' })
    // Not in the run yet, no item to open, or no notice on the desk: the notice itself, as before.
    expect(dest('3')).toEqual({ kind: 'paper', tab: 'notices', jobId: '3' })
    expect(dest('4')).toEqual({ kind: 'paper', tab: 'notices', jobId: '4' })
    expect(dest('5')).toEqual({ kind: 'paper', tab: 'notices', jobId: '5' })
    // A property fact also missing: the property record leads.
    expect(dest('6')).toEqual({ kind: 'property', jobId: '6', focus: 'owner' })
    // The bins by what each paper waits on (v2.7457): its notice alone, or a fact as well.
    expect(board.affidavits.find((b) => b.stage === 'needs_notice')!.chips.map((c) => c.jobId)).toEqual(['1', '2', '3', '4', '5'])
    expect(board.affidavits.find((b) => b.stage === 'needs_property')!.chips.map((c) => c.jobId)).toEqual(['6'])
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
    const board = build({ notices: [notice('1', 'awaiting', { earliestDeadline: '2026-12-15', daysLeft: 30 }), notice('2', 'sent', { earliestDeadline: '2026-11-16', daysLeft: 1 }), notice('3', 'missed', { earliestDeadline: '2026-10-15', daysLeft: -31, missedUnrecorded: ['2026-08'] })] })
    expect(bin(board, 'notice:awaiting').chips[0]!.urgency).toBe('waiting')
    // A sent notice is done: never red, whatever its month's day was.
    expect(bin(board, 'notice:sent').chips[0]!.urgency).toBe('later')
    // A closed end is quiet: nothing there can be rushed, so its chip is never red.
    expect(bin(board, 'notice:missed').chips[0]!.urgency).toBe('later')
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
    const board = build({ notices: [notice('1', 'to_draft'), notice('2', 'printed', { item: item('i2', 'approved', { printed_at: '2026-11-14T10:00:00Z' }) }), notice('3', 'ready', { item: signedItem('i3') })] })
    expect(bin(board, 'notice:to_send').chips[0]!).toMatchObject({ stepsLeft: 3, atRisk: true })
    // The print and the mail are one sitting: an approved notice has one stage left whether it has printed or not.
    expect(bin(board, 'notice:to_print').chips[0]!).toMatchObject({ stepsLeft: 1, atRisk: false })
    expect(bin(board, 'notice:in_mail').chips[0]!).toMatchObject({ stepsLeft: 1, atRisk: false })
    expect(board.atRisk).toBe(1)
  })
  it('names the stages a paper still has to pass, one name for every stage it counts (v2.7419)', () => {
    const stages = (kind: 'notice' | 'affidavit', stage: string, leader?: string | null) => lienBoardStagesLeft({ kind, stage } as Parameters<typeof lienBoardStagesLeft>[0], leader)
    expect(stages('notice', 'needs_owner', 'Sam')).toEqual(['Name the owner on the property record', 'Send it for approval', 'Sam approves and signs it', 'Print it, mail it and enter its mail number'])
    expect(stages('notice', 'to_send', 'Sam')).toEqual(['Send it for approval', 'Sam approves and signs it', 'Print it, mail it and enter its mail number'])
    expect(stages('notice', 'awaiting', 'Sam')).toEqual(['Sam approves and signs it', 'Print it, mail it and enter its mail number'])
    // Approved: the one sitting left, with the print in it until the packet has printed (v2.7448).
    expect(stages('notice', 'to_print', 'Sam')).toEqual(['Print it, mail it and enter its mail number'])
    expect(stages('notice', 'in_mail', 'Sam')).toEqual(['Mail it and enter its mail number'])
    expect(stages('affidavit', 'needs_property', 'Sam')).toEqual(['Clear what holds it', 'Send it for approval', 'Sam approves it', 'Notarize it and file it with the county'])
    // Waiting on its notice (v2.7457): the first stage names the notice, and the count is the same four.
    expect(stages('affidavit', 'needs_notice', 'Sam')).toEqual(['Mail its notice and record the mailing', 'Send it for approval', 'Sam approves it', 'Notarize it and file it with the county'])
    expect(stages('affidavit', 'ready', 'Sam')).toEqual(['Notarize it and file it with the county'])
    // A held paper waits on the leader again; with no leader known he is *The leader*.
    expect(stages('notice', 'held')).toEqual(['The leader approves and signs it', 'Print it, mail it and enter its mail number'])
    expect(stages('affidavit', 'held', '  ')).toEqual(['The leader approves it', 'Notarize it and file it with the county'])
    // Done or lost: nothing left to pass.
    for (const s of ['sent', 'missed']) expect(stages('notice', s)).toEqual([])
    for (const s of ['served', 'missed']) expect(stages('affidavit', s)).toEqual([])
    // On file, one stage is left: the copies (punch list #366).
    expect(stages('affidavit', 'filed')).toEqual(['Mail its copies and enter their mail numbers'])
    // The count the Board races against the working days is the list's own length, in every bin.
    const board = build({
      notices: [notice('1', 'needs_owner'), notice('2', 'to_draft'), notice('3', 'awaiting'), notice('4', 'ready'), notice('5', 'held'), notice('6', 'sent'), notice('7', 'printed')],
      affidavits: [affidavit('1', 'needs_property'), affidavit('2', 'to_draft'), affidavit('3', 'awaiting'), affidavit('4', 'ready'), affidavit('5', 'held'), affidavit('6', 'filed'), affidavit('7', 'filed')],
      serve: [{ jobId: '7', serveDue: '2026-11-18' }],
    })
    const chips = [...board.notices, ...board.affidavits].flatMap((b) => b.chips)
    expect(chips).toHaveLength(14)
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
  it('pairs an affidavit that waits on its notice alone with that notice, wherever the notice stands, and the one door is the notice’s (v2.7457)', () => {
    const board = build({
      notices: [notice('1', 'ready', { item: signedItem('i1') }), notice('2', 'awaiting', { item: item('i2', 'awaiting_approval') }), notice('3', 'ready', { item: item('i3', 'approved') })],
      affidavits: [affidavit('1', 'needs_notice', { gates: [gate('notice', false)] }), affidavit('2', 'needs_notice', { gates: [gate('notice', false)] }), affidavit('3', 'needs_property', { gates: [gate('legal', false), gate('notice', false)] }), affidavit('4', 'needs_notice', { gates: [gate('notice', false)] })],
    })
    expect(board.pairs).toEqual([
      { key: 'notice:1', jobId: '1', reason: 'notice', destination: { kind: 'run', itemId: 'i1', jobId: '1' } },
      { key: 'notice:2', jobId: '2', reason: 'notice', destination: { kind: 'paper', tab: 'notices', jobId: '2' } },
    ])
    const chips = [...board.notices, ...board.affidavits].flatMap((b) => b.chips)
    expect(chips.filter((c) => c.pairKey === 'notice:1').map((c) => c.bin)).toEqual(['notice:to_print', 'affidavit:needs_notice'])
    expect(chips.filter((c) => c.pairKey === 'notice:2').map((c) => c.bin)).toEqual(['notice:awaiting', 'affidavit:needs_notice'])
    // Job 3 also lacks a fact, so it stands in Needs the property facts alone; job 4 has no notice on the desk to stand beside.
    expect(chips.filter((c) => c.jobId === '3' || c.jobId === '4').every((c) => c.pairKey === null)).toBe(true)
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
  it('the waiting tile names the leader and counts what he has to approve on both columns and to sign; the third tile counts what is to print and to mail; the unpaid tile adds each job once', () => {
    const board = build({
      notices: [notice('1', 'awaiting', { openBalance: 100 }), notice('2', 'printed', { openBalance: 200, item: item('i2', 'approved', PRINTED) }), notice('3', 'ready', { openBalance: 300, item: item('i3', 'approved') })],
      affidavits: [affidavit('1', 'awaiting', { openBalance: 100 }), affidavit('4', 'to_draft', { openBalance: 1000 })],
    })
    // Two papers to approve, one on each column, and the approved notice nobody has signed (v2.7448).
    expect(board.tiles[1]).toMatchObject({ key: 'waiting', figure: '3', label: 'waiting on Malachi', line: '2 to approve · 1 to sign', tone: 'violet', destination: { kind: 'leader' } })
    // The unsigned notice is the second tile's alone since v2.7712: it stands in Approved · to sign, and the third tile counts what can print and what is printed.
    expect(board.tiles[2]).toMatchObject({ key: 'in_mail', figure: '1', label: 'to print and mail', line: '1 to mail', tone: 'amber', destination: { kind: 'run' } })
    expect(board.tiles[2]!.figure).toBe(String(bin(board, 'notice:to_print').chips.length + bin(board, 'notice:in_mail').chips.length))
    expect(board.tiles[2]!.label).toBe(LIEN_RUN_TILE_LABEL)
    expect(board.tiles[3]).toMatchObject({ key: 'unpaid', figure: '$1,600', label: 'unpaid on the desk', tone: 'quiet', destination: null })
    // A signed approved notice waits on the print alone: nothing waits on the leader, and the third tile names the one part.
    const quiet = build({ notices: [notice('3', 'ready', { item: signedItem('i3') })], leaderName: null })
    expect(quiet.tiles[1]).toMatchObject({ figure: '0', label: 'waiting on the leader', line: 'Nothing waits on the leader.', tone: 'quiet', destination: null })
    expect(quiet.tiles[2]).toMatchObject({ figure: '1', label: 'to print and mail', line: '1 to print', tone: 'amber', destination: { kind: 'run' } })
    const printed = build({ notices: [notice('2', 'printed', { item: item('i2', 'approved', PRINTED) }), notice('5', 'printed', { item: item('i5', 'approved', PRINTED) })] })
    expect(printed.tiles[2]).toMatchObject({ figure: '2', line: '2 to mail', tone: 'amber', destination: { kind: 'run' } })
    expect(build({}).tiles[2]).toMatchObject({ figure: '0', label: 'to print and mail', line: 'Nothing waits to print or mail.', tone: 'quiet', destination: null })
  })
  it('every line a person reads keeps to plain words, and every label stays short', () => {
    const boards = [
      build({}),
      build({ notices: [notice('1', 'to_draft'), notice('2', 'awaiting'), notice('3', 'printed', { item: item('i3', 'approved', { printed_at: '2026-11-14T10:00:00Z' }) })], affidavits: [affidavit('4', 'ready', { deadline: '2026-11-16', daysLeft: 1 })], retainage: [retainage('5', 'to_draft'), retainage('6', 'awaiting')] }),
      build({ notices: [notice('1', 'printed', { earliestDeadline: '2026-11-10', daysLeft: -5, item: item('i1', 'approved', { printed_at: '2026-11-09T10:00:00Z' }) })] }),
      // Both parts under the second tile and under the third (v2.7448).
      build({ notices: [notice('1', 'awaiting'), notice('2', 'ready', { item: item('i2', 'approved') }), notice('3', 'printed', { item: item('i3', 'approved', PRINTED) }), notice('4', 'ready', { item: signedItem('i4') })] }),
    ]
    expect(boards[3]!.tiles.map((t) => t.line)).toEqual([expect.any(String), '1 to approve · 1 to sign', '1 to print · 1 to mail', null])
    for (const board of boards) {
      for (const t of board.tiles) {
        // A tile's line is a sentence, or since v2.7448 its counted parts with the desk's own mark between them, as its label is.
        if (t.line) for (const part of t.line.endsWith('.') ? [t.line] : t.line.split(' · ')) expect(plainWordsFailures(part)).toEqual([])
        expect(t.label.split(/\s+/).length).toBeLessThanOrEqual(PLAIN_WORDS_MAX_SENTENCE_WORDS)
      }
      if (board.retainageLine) expect(board.retainageLine.split(/\s+/).length).toBeLessThanOrEqual(PLAIN_WORDS_MAX_SENTENCE_WORDS)
      for (const b of [...board.notices, ...board.affidavits]) expect(b.label.split(/\s+/).length).toBeLessThanOrEqual(6)
    }
  })
})

describe('the arrows, the day words, the retainage line, the dots and the leader’s view', () => {
  it('draws one arrow between each pair of bins down a column, and one across from Sent to Waiting on its notice', () => {
    const arrows = lienBoardArrows()
    expect(arrows.filter((a) => a.kind === 'down' && a.from.startsWith('notice:')).map((a) => `${a.from}>${a.to}`)).toEqual(['notice:needs_owner>notice:to_send', 'notice:to_send>notice:awaiting', 'notice:awaiting>notice:to_sign', 'notice:to_sign>notice:to_print', 'notice:to_print>notice:in_mail', 'notice:in_mail>notice:sent'])
    expect(arrows.filter((a) => a.kind === 'down' && a.from.startsWith('affidavit:')).map((a) => `${a.from}>${a.to}`)).toEqual(['affidavit:needs_property>affidavit:needs_notice', 'affidavit:needs_notice>affidavit:to_send', 'affidavit:to_send>affidavit:awaiting', 'affidavit:awaiting>affidavit:ready', 'affidavit:ready>affidavit:filed', 'affidavit:filed>affidavit:served'])
    expect(arrows.filter((a) => a.kind === 'cross')).toEqual([{ from: 'notice:sent', to: 'affidavit:needs_notice', kind: 'cross' }])
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
    expect(lienBoardRetainageLine([retainage('1', 'needs_owner'), retainage('2', 'to_draft'), retainage('3', 'to_draft'), retainage('4', 'awaiting'), retainage('5', 'held')])).toBe('Retainage · 1 needs the owner · 2 to send for approval · 1 awaiting approval · 1 held')
    expect(build({ retainage: [retainage('1', 'ready')] }).retainageLine).toBe('Retainage · 1 approved to mail')
  })
  it('counts retainage nobody recorded on that line, last, and by itself when no notice is on the desk', () => {
    expect(lienBoardRetainageLine([], 1)).toBe('Retainage · 1 looks held, not on the job')
    expect(lienBoardRetainageLine([retainage('1', 'sent'), retainage('2', 'clock_not_started')], 3)).toBe('Retainage · 3 look held, not on the job')
    expect(lienBoardRetainageLine([retainage('1', 'to_draft')], 2)).toBe('Retainage · 1 to send for approval · 2 look held, not on the job')
    expect(build({ retainage: [retainage('1', 'ready')], retainageUnrecorded: 4 }).retainageLine).toBe('Retainage · 1 approved to mail · 4 look held, not on the job')
    expect(build({ retainageUnrecorded: 0 }).retainageLine).toBeNull()
  })
  it('gives the Dashboard four dots: the tiles’ figures with a word each', () => {
    const board = build({ notices: [notice('1', 'to_draft'), notice('2', 'awaiting', { openBalance: 2000 })] })
    expect(lienBoardDots(board)).toEqual([
      { key: 'by_day', figure: '2', words: 'by tomorrow', tone: 'red' },
      { key: 'waiting', figure: '1', words: 'waiting on Malachi', tone: 'violet' },
      { key: 'in_mail', figure: '0', words: 'to print and mail', tone: 'quiet' },
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
    expect(pick).toMatchObject({ bins: ['notice:to_send'], label: 'To send for Master approval', count: 2 })
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
    expect(both).toMatchObject({ label: 'Awaiting Master approval', count: 2 })
    expect([...both.jobIds]).toEqual(['3', '4'])
    expect(lienBoardPickWords(pick, 2)).toEqual({ head: 'Showing 2 rows in To send for Master approval.', clear: 'Show every row' })
    expect(lienBoardPickWords(pick, 1).head).toBe('Showing 1 row in To send for Master approval.')
    expect(plainWordsFailures(lienBoardPickWords(both, 2).head)).toEqual([])
  })
  it('a job number stands for its chip (v2.7333): the column asked for, or the notice first, and the door words say where the press goes', () => {
    const board = build({ notices: [notice('1', 'needs_owner'), notice('2', 'printed', { item: item('i2', 'approved', { printed_at: '2026-11-14T10:00:00Z' }) })], affidavits: [affidavit('1', 'needs_property', { gates: [gate('owner', true), gate('legal', false)] }), affidavit('3', 'filed')] })
    expect(lienBoardChipFor(board, '1', 'notice')?.bin).toBe('notice:needs_owner')
    expect(lienBoardChipFor(board, '1', 'affidavit')?.bin).toBe('affidavit:needs_property')
    expect(lienBoardChipFor(board, '1', 'either')?.bin).toBe('notice:needs_owner')
    // A filed affidavit with no copies owed is served.
    expect(lienBoardChipFor(board, '3', 'either')?.bin).toBe('affidavit:served')
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
    expect(Object.keys(LIEN_BOARD_WORDS).sort()).toEqual(['awaiting', 'filed', 'held', 'in_mail', 'needs_notice', 'needs_owner', 'needs_property', 'ready', 'sent', 'served', 'to_print', 'to_send', 'to_sign'])
  })
})

describe('one name for each step from approval to mailing, on the Board and on the list (v2.7448)', () => {
  it('an approved notice not yet printed stands in notice:to_print and a printed one in notice:in_mail, each bin under the name its pile has on the list', () => {
    const board = build({ notices: [notice('4', 'ready', { item: signedItem('i4') }), notice('5', 'printed', { item: signedItem('i5', PRINTED) }), notice('6', 'ready', { item: item('i6', 'approved') })] })
    expect(bin(board, 'notice:to_print').chips.map((c) => [c.label, c.stage, c.pile])).toEqual([['JP4', 'to_print', 'ready']])
    // The approved notice nobody has signed is still in the Approved · to print pile on the list, and has its own bin on the Board (v2.7712).
    expect(bin(board, 'notice:to_sign').chips.map((c) => [c.label, c.stage, c.pile, c.unsigned])).toEqual([['JP6', 'to_sign', 'ready', true]])
    expect(bin(board, 'notice:to_sign').label).toBe('Approved · to sign')
    expect(bin(board, 'notice:in_mail').chips.map((c) => [c.label, c.stage, c.pile])).toEqual([['JP5', 'in_mail', 'printed']])
    // To print comes before to mail down the column, between the leader's bin and Sent.
    expect(LIEN_BOARD_NOTICE_STAGES.slice(2, 7)).toEqual(['awaiting', 'to_sign', 'to_print', 'in_mail', 'sent'])
    const pileLabel = (key: LienDeskPile) => LIEN_DESK_PILES.find((p) => p.key === key)!.label
    expect(bin(board, 'notice:to_print').label).toBe('Approved · to print')
    expect(bin(board, 'notice:to_print').label).toBe(LIEN_RUN_STEP.toPrint)
    expect(bin(board, 'notice:to_print').label).toBe(pileLabel('ready'))
    expect(bin(board, 'notice:in_mail').label).toBe('Approved · to mail')
    expect(bin(board, 'notice:in_mail').label).toBe(LIEN_RUN_STEP.toMail)
    expect(bin(board, 'notice:in_mail').label).toBe(pileLabel('printed'))
    expect(LIEN_BOARD_WORDS.to_print).toBe(LIEN_RUN_STEP.toPrint)
    expect(LIEN_BOARD_WORDS.in_mail).toBe(LIEN_RUN_STEP.toMail)
  })

  it('a chip is marked unsigned only for an approved, unprinted notice with no signature on it as it stands', () => {
    const board = build({
      notices: [
        notice('1', 'ready', { item: item('i1', 'approved') }),
        notice('2', 'ready', { item: signedItem('i2') }),
        // Signed, then the draft changed: the signature no longer stands.
        notice('3', 'ready', { item: signedItem('i3', { fields: { notice: { claimAmount: '100.00' } } }) }),
        // A signature with no name to print is no signature.
        notice('4', 'ready', { item: signedItem('i4', { signer_printed_name: ' ' }) }),
        // No desk item, another pile: never marked.
        notice('5', 'ready'),
        notice('6', 'printed', { item: item('i6', 'approved', PRINTED) }),
        notice('7', 'awaiting', { item: item('i7', 'awaiting') }),
      ],
    })
    const unsigned = board.notices.flatMap((b) => b.chips).filter((c) => c.unsigned).map((c) => c.label)
    expect(unsigned).toEqual(['JP1', 'JP3', 'JP4'])
    expect(lienBoardChipFor(board, '2', 'notice')!.unsigned).toBeUndefined()
  })

  it('the waiting tile counts what the leader has to approve plus what he has to sign, each part named, and only the part that holds something', () => {
    const both = build({
      notices: [notice('1', 'awaiting'), notice('2', 'ready', { item: item('i2', 'approved') }), notice('3', 'ready', { item: item('i3', 'approved') }), notice('4', 'ready', { item: signedItem('i4') }), notice('5', 'printed', { item: item('i5', 'approved', PRINTED) })],
      affidavits: [affidavit('6', 'awaiting'), affidavit('7', 'ready')],
    })
    const chipsOf = (b: ReturnType<typeof build>) => [b.notices.flatMap((x) => x.chips), b.affidavits.flatMap((x) => x.chips)] as const
    expect(lienBoardLeaderWaits(...chipsOf(both))).toEqual({ toApprove: 2, toSign: 2, total: 4 })
    expect(both.tiles[1]).toMatchObject({ key: 'waiting', figure: '4', label: 'waiting on Malachi', line: '2 to approve · 2 to sign', tone: 'violet', destination: { kind: 'leader' } })
    // To sign alone: nothing is awaiting approval, and the tile does not say *0 to approve*.
    const sign = build({ notices: [notice('2', 'ready', { item: item('i2', 'approved') }), notice('4', 'ready', { item: signedItem('i4') })] })
    expect(lienBoardLeaderWaits(...chipsOf(sign))).toEqual({ toApprove: 0, toSign: 1, total: 1 })
    expect(sign.tiles[1]).toMatchObject({ figure: '1', line: '1 to sign', tone: 'violet', destination: { kind: 'leader' } })
    // To approve alone, on the affidavits' column.
    const approve = build({ notices: [notice('4', 'ready', { item: signedItem('i4') })], affidavits: [affidavit('6', 'awaiting'), affidavit('8', 'awaiting')] })
    expect(approve.tiles[1]).toMatchObject({ figure: '2', line: '2 to approve', tone: 'violet', destination: { kind: 'leader' } })
    // Nothing of either kind: the tile is quiet and has no press.
    const none = build({ notices: [notice('4', 'ready', { item: signedItem('i4') }), notice('9', 'to_draft')], affidavits: [affidavit('7', 'ready')] })
    expect(none.tiles[1]).toMatchObject({ figure: '0', line: 'Nothing waits on Malachi.', tone: 'quiet', destination: null })
    expect(lienLeaderWaitWords({ toApprove: 1, toSign: 7 })).toBe('1 to approve · 7 to sign')
    expect(lienLeaderWaitWords({ toApprove: 3, toSign: 0 })).toBe('3 to approve')
    expect(lienLeaderWaitWords({ toApprove: 0, toSign: 7 })).toBe('7 to sign')
    expect(lienLeaderWaitWords({ toApprove: 0, toSign: 0 })).toBe('')
  })

  it('the waiting tile’s press is a pick of exactly the papers it counted: the awaiting ones and the unsigned approved notices', () => {
    const board = build({
      notices: [
        notice('1', 'awaiting'),
        notice('2', 'ready', { item: item('i2', 'approved'), gcCustomerId: 'gc2' }),
        notice('4', 'ready', { item: signedItem('i4'), gcCustomerId: 'gc4' }),
        notice('5', 'printed', { item: item('i5', 'approved', PRINTED), gcCustomerId: 'gc5' }),
        notice('8', 'to_draft', { gcCustomerId: 'gc8' }),
      ],
      affidavits: [affidavit('6', 'awaiting', { gcCustomerId: 'gc6' }), affidavit('7', 'ready', { gcCustomerId: 'gc7' }), affidavit('2', 'needs_property', { gcCustomerId: 'gc2' })],
    })
    const pick = lienBoardLeaderPick(board, 'Malachi')
    expect([...pick.papers!].sort()).toEqual(['affidavit:6', 'notice:1', 'notice:2'])
    expect(pick.count).toBe(3)
    expect(String(pick.count)).toBe(board.tiles[1]!.figure)
    // The awaiting bins are lit, and the bin of the unsigned notice, Approved · to sign (v2.7712).
    expect(pick.bins).toEqual(['notice:awaiting', 'affidavit:awaiting', 'notice:to_sign'])
    expect(pick.label).toBe('waiting on Malachi')
    expect(pick.label).toBe(board.tiles[1]!.label)
    expect(pick.words).toBe('waiting on Malachi')
    expect([...pick.jobIds].sort()).toEqual(['1', '2', '6'])
    // Only an unsigned approved notice's GC stands for a run row: a notice awaiting approval has its own row, and
    // would otherwise bring its GC's run row of signed notices in with it.
    expect([...pick.gcIds].sort()).toEqual(['gc2'])
    expect(lienBoardRowInPick(pick, { jobId: null, gcId: 'gc1', kind: 'notice' })).toBe(false)
    expect(lienBoardPickWords(pick, 1).head).toBe('Showing 1 row waiting on Malachi.')
    expect(lienBoardPickWords(pick, 3)).toEqual({ head: 'Showing 3 rows waiting on Malachi.', clear: 'Show every row' })
    expect(plainWordsFailures(lienBoardPickWords(pick, 3).head)).toEqual([])
    // The office's own row for the unsigned approved notice is in, and so are the two rows of the papers to approve.
    expect(lienBoardRowInPick(pick, { jobId: '2', gcId: 'gc2', kind: 'notice' })).toBe(true)
    expect(lienBoardRowInPick(pick, { jobId: '1', gcId: 'gc1', kind: 'notice' })).toBe(true)
    expect(lienBoardRowInPick(pick, { jobId: '6', gcId: 'gc6', kind: 'affidavit' })).toBe(true)
    // A run row that lists the unsigned notice among its jobs is in; so is its GC's own run row.
    expect(lienBoardRowInPick(pick, { jobId: null, gcId: null, kind: 'notice', jobs: [{ jobId: '4' }, { jobId: '2' }] })).toBe(true)
    expect(lienBoardRowInPick(pick, { jobId: null, gcId: 'gc2', kind: 'notice' })).toBe(true)
    // A signed approved notice waits on the print, not on the leader: its row is out, and so is a run row of signed ones.
    expect(lienBoardRowInPick(pick, { jobId: '4', gcId: 'gc4', kind: 'notice' })).toBe(false)
    expect(lienBoardRowInPick(pick, { jobId: null, gcId: 'gc4', kind: 'notice' })).toBe(false)
    expect(lienBoardRowInPick(pick, { jobId: null, gcId: null, kind: 'notice', jobs: [{ jobId: '4' }, { jobId: '5' }] })).toBe(false)
    // A printed notice, one still to send and an affidavit ready to file wait on the office.
    expect(lienBoardRowInPick(pick, { jobId: '5', gcId: 'gc5', kind: 'notice' })).toBe(false)
    expect(lienBoardRowInPick(pick, { jobId: '8', gcId: 'gc8', kind: 'notice' })).toBe(false)
    expect(lienBoardRowInPick(pick, { jobId: '7', gcId: 'gc7', kind: 'affidavit' })).toBe(false)
    // Job 2's notice is in; its affidavit, which wants the property facts, is not.
    expect(lienBoardRowInPick(pick, { jobId: '2', gcId: 'gc2', kind: 'affidavit' })).toBe(false)
    // With no leader known he is *the leader*, as on the tile.
    const unnamed = lienBoardLeaderPick(board, '  ')
    expect([unnamed.label, unnamed.words]).toEqual(['waiting on the leader', 'waiting on the leader'])
    expect(lienBoardLeaderPick(board).label).toBe(build({ leaderName: null }).tiles[1]!.label)
    // Nothing waiting: an empty pick, with the leader's three bins still named.
    const none = lienBoardLeaderPick(build({ notices: [notice('4', 'ready', { item: signedItem('i4') })] }), 'Malachi')
    expect([none.count, [...none.papers!], none.bins]).toEqual([0, [], ['notice:awaiting', 'affidavit:awaiting', 'notice:to_sign']])
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
    expect(stage('notice:2', 'notice', '2')).toBe('To send for Master approval')
    expect(stage('notice:3', 'notice', '3')).toBe('Awaiting Master approval')
    expect(stage('affidavit:5', 'affidavit', '5')).toBe('Ready to file')
    expect(stage('affidavit:6', 'affidavit', '6')).toBe('Needs the property facts')
    // Job 2 has a notice to send and an affidavit to send: each row reads its own column.
    expect(stage('affidavit:2', 'affidavit', '2')).toBe('To send for Master approval')
    // A single printed notice keeps its own row, in its own bin.
    expect(stage('notice:7', 'notice', '7')).toBe('Approved · to mail')
  })

  it('a run row stands in the bin its notices are in: a GC’s row of approved ones in Approved · to print, the printed row in Approved · to mail (v2.7448)', () => {
    const b = board()
    const stage = (key: string, jobs?: Array<{ jobId: string }>) => lienBoardRowStage(b, { key, kind: 'notice', jobId: null, jobs })
    expect(stage('run:gc1')).toBe('Approved · to print')
    expect(stage('run:gc1')).toBe(b.notices.find((x) => x.stage === 'to_print')!.label)
    expect(stage('run:gc1')).toBe(LIEN_RUN_STEP.toPrint)
    expect(stage('run:printed', [{ jobId: '7' }])).toBe('Approved · to mail')
    expect(stage('run:printed', [{ jobId: '7' }])).toBe(b.notices.find((x) => x.stage === 'in_mail')!.label)
    expect(stage('run:printed', [{ jobId: '7' }])).toBe(LIEN_RUN_STEP.toMail)
    // The key decides, not what the row lists: any GC's id reads to print.
    expect(stage('run:gc9', [{ jobId: '7' }])).toBe(LIEN_RUN_STEP.toPrint)
  })

  it('a row with no bin of its own has no stage', () => {
    const b = board()
    expect(lienBoardRowStage(b, { key: 'courtesy:1', kind: 'notice', jobId: '1' })).toBeNull()
    // A filed lien's copies have a bin of their own since v2.7497 (punch list #366).
    expect(lienBoardRowStage(b, { key: 'serve:5', kind: 'affidavit', jobId: '5' })).toBe('Filed · copies to mail')
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
  it('the first tile counts no marked chip: its day has nothing to make', () => {
    const due = { earliestDeadline: '2026-11-15', daysLeft: 0 }
    const marked = build({ notices: [notice('523', 'to_draft', due), notice('2', 'to_draft', due)], affidavits: [affidavit('883', 'ready', { deadline: '2026-11-15', daysLeft: 0 })], publicJobIds: new Set(['523', '883']) })
    expect(marked.tiles[0]).toMatchObject({ figure: '1', label: 'by today · 1 to send' })
    const plain = build({ notices: [notice('523', 'to_draft', due), notice('2', 'to_draft', due)], affidavits: [affidavit('883', 'ready', { deadline: '2026-11-15', daysLeft: 0 })] })
    expect(plain.tiles[0]).toMatchObject({ figure: '3', label: 'by today · 1 to file · 2 to send' })
  })
})

describe('buildLienBoard — a held paper stands in the bin of the stage it is stopped at (v2.7783; punch list #335 for the gate)', () => {
  const gates = [gate('owner', true), gate('legal', true), gate('contractor', true), gate('notice', true), gate('homestead_answer', false)]
  const held = () => build({ notices: [notice('5', 'held', { item: item('n5', 'held') }), notice('6', 'awaiting')], affidavits: [affidavit('7', 'held', { item: item('a7', 'approved'), ready: false, gates, deadline: '2026-11-13', daysLeft: -2 }), affidavit('8', 'held', { item: item('a8', 'held') }), affidavit('9', 'ready', { item: item('a9', 'approved') }), affidavit('10', 'awaiting')] })
  it('names the bin by who stopped it: a fact stops an approved affidavit short of the print, the leader’s hold waits on him again', () => {
    expect(lienBoardHeldBin('affidavit', true)).toBe('affidavit:ready')
    expect(lienBoardHeldBin('affidavit', false)).toBe('affidavit:awaiting')
    expect(lienBoardHeldBin('notice', false)).toBe('notice:awaiting')
    const board = held()
    expect(bin(board, 'affidavit:ready').chips.map((c) => [c.label, c.stage, c.held ?? false])).toEqual([['JP9', 'ready', false], ['JP7', 'held', true]])
    expect(bin(board, 'affidavit:awaiting').chips.map((c) => [c.label, c.stage, c.held ?? false])).toEqual([['JP10', 'awaiting', false], ['JP8', 'held', true]])
    expect(bin(board, 'notice:awaiting').chips.map((c) => [c.label, c.stage, c.held ?? false])).toEqual([['JP6', 'awaiting', false], ['JP5', 'held', true]])
    expect([...board.notices, ...board.affidavits].some((b) => (b.stage as string) === 'held')).toBe(false)
  })
  it('counts what can move, so a bin’s count is its press’s number, and a held paper past its day stands after one that is not', () => {
    const board = held()
    expect(lienBoardBinCount(bin(board, 'affidavit:ready'))).toBe(1)
    expect(lienBoardBinCount(bin(board, 'affidavit:awaiting'))).toBe(1)
    expect(lienBoardBinCount(bin(build({ affidavits: [affidavit('7', 'held', { item: item('a7', 'approved'), ready: false, gates })] }), 'affidavit:ready'))).toBe(0)
    // The held one is two days late and still stands after the one that can print: what can move comes first.
    expect(bin(board, 'affidavit:ready').chips.map((c) => c.urgency)).toEqual(['later', 'day'])
  })
  it('keeps the held paper out of the leader’s batch and out of what waits on him, and names the bin with *held* on its row', () => {
    const board = held()
    const view = lienBoardForLeader(board)
    expect(view.chips.map((c) => c.label)).toEqual(['JP10'])
    expect(view.held.map((h) => h.chip.label)).toEqual(['JP6'])
    expect(view.bins.flatMap((b) => b.chips).some((c) => c.held)).toBe(false)
    expect(board.tiles[1]).toMatchObject({ figure: '2', line: '2 to approve' })
    expect(lienBoardRowStage(board, { key: 'affidavit:7', kind: 'affidavit', jobId: '7' })).toBe('Ready to file · held')
    expect(lienBoardRowStage(board, { key: 'affidavit:9', kind: 'affidavit', jobId: '9' })).toBe('Ready to file')
    expect(lienBoardRowStage(board, { key: 'notice:5', kind: 'notice', jobId: '5' })).toBe('Awaiting Master approval · held')
    expect(lienBoardRowBin(board, { key: 'affidavit:8', kind: 'affidavit', jobId: '8' })!.key).toBe('affidavit:awaiting')
    // A pressed bin's pick takes the held paper's row too: it stands in that bin.
    expect([...lienBoardPick(board, ['affidavit:ready']).jobIds].sort()).toEqual(['7', '9'])
  })
  it('keeps the gate’s door, and what is left is the gate and the filing', () => {
    const board = held()
    const byGate = bin(board, 'affidavit:ready').chips.find((c) => c.jobId === '7')!
    const byLeader = bin(board, 'affidavit:awaiting').chips.find((c) => c.jobId === '8')!
    expect([lienBoardHoldWords(byGate), lienBoardHoldWords(byLeader), lienBoardHoldWords(bin(board, 'affidavit:ready').chips[0]!)]).toEqual(['held on a property fact', 'held by the leader', ''])
    expect(byGate.gateHeld).toBe(true)
    expect(byGate.destination).toEqual({ kind: 'property', jobId: '7', focus: 'homestead_answer' })
    expect(lienBoardStagesLeft(byGate, 'Malachi')).toEqual(['Clear what holds it', 'Notarize it and file it with the county'])
    expect(byGate.stepsLeft).toBe(2)
    expect(byLeader.gateHeld).toBeUndefined()
    expect(byLeader.destination).toEqual({ kind: 'paper', tab: 'affidavits', jobId: '8' })
    expect(lienBoardStagesLeft(byLeader, 'Malachi')).toEqual(['Malachi approves it', 'Notarize it and file it with the county'])
  })
})

describe('buildLienBoard — an affidavit nobody has read, in To send for Master approval (v2.7852)', () => {
  it('marks the papers the batch send leaves, counts the ones it takes, and stands them after those', () => {
    const board = build({
      affidavits: [
        affidavit('21', 'to_draft', { deadline: '2026-11-18', daysLeft: 3 }),
        affidavit('22', 'to_draft'),
        affidavit('23', 'to_draft', { item: item('a23', 'drafted') }),
        affidavit('24', 'ready', { item: item('a24', 'approved') }),
      ],
    })
    const toSend = bin(board, 'affidavit:to_send')
    expect(toSend.chips.map((c) => [c.jobId, c.unread ?? false])).toEqual([['23', false], ['21', true], ['22', true]])
    expect(lienBoardBinCount(toSend)).toBe(1)
    expect(lienBoardUnreadWords(toSend.chips[1]!)).toBe('nobody has read it yet')
    expect(lienBoardUnreadWords(toSend.chips[0]!)).toBe('')
    expect(lienBoardUnreadBinWords('To send for Master approval')).toBe('To send for Master approval · not read yet')
    // Its stage, its door and its stages left are what they were: only the count and the order say it waits to be read.
    expect(toSend.chips[1]!.stage).toBe('to_send')
    expect(toSend.chips[1]!.held).toBeUndefined()
    // No other bin marks a paper unread: Ready to file's is whole.
    expect(bin(board, 'affidavit:ready').chips.every((c) => !c.unread)).toBe(true)
  })
  it('a notice to send is never marked: the notices have no batch send on the Board', () => {
    const board = build({ notices: [notice('1', 'to_draft'), notice('2', 'to_draft')] })
    expect(bin(board, 'notice:to_send').chips.every((c) => !c.unread)).toBe(true)
    expect(lienBoardBinCount(bin(board, 'notice:to_send'))).toBe(2)
  })
})

describe('a filed lien’s copies on the Board (punch list #366)', () => {
  const board = build({
    affidavits: [affidavit('1', 'filed', { deadline: '2026-12-15', daysLeft: 30 }), affidavit('2', 'filed'), affidavit('3', 'filed')],
    serve: [
      { jobId: '1', serveDue: '2026-11-16' },
      { jobId: '2', serveDue: '2026-11-10' },
      // Filed long ago or outside the app: no affidavit on the desk, and its copies are still owed.
      { jobId: '9', serveDue: null },
    ],
  })
  const toMail = bin(board, 'affidavit:filed')

  it('a filed affidavit stands in Filed · copies to mail while its copies are owed, and in Served after', () => {
    expect(toMail.label).toBe('Filed · copies to mail')
    expect(toMail.chips.map((c) => c.label)).toEqual(['JP2', 'JP1', 'JP9'])
    expect(bin(board, 'affidavit:served').chips.map((c) => c.label)).toEqual(['JP3'])
    expect(bin(board, 'affidavit:served').label).toBe('Served')
  })

  it('its chip races the serve-by day, not the day it had to be filed by', () => {
    const [late, soon, undated] = toMail.chips
    expect([late!.dueYmd, late!.daysLeft, late!.urgency]).toEqual(['2026-11-10', -5, 'day'])
    expect([soon!.dueYmd, soon!.daysLeft]).toEqual(['2026-11-16', 1])
    expect([undated!.dueYmd, undated!.daysLeft, undated!.urgency]).toEqual([null, null, 'later'])
    for (const c of toMail.chips) expect([c.stepsLeft, c.atRisk, c.destination]).toEqual([1, false, { kind: 'lienWindow', jobId: c.jobId }])
    expect(bin(board, 'affidavit:served').chips[0]).toMatchObject({ stepsLeft: 0, urgency: 'later', atRisk: false })
  })

  it('a filed lien with no affidavit on the desk still gets its chip, so the bin counts every lien the list and the window do', () => {
    expect(toMail.chips.find((c) => c.jobId === '9')).toMatchObject({ kind: 'affidavit', stage: 'filed', bin: 'affidavit:filed', pile: 'filed', openBalance: 0 })
    expect(lienBoardRowBin(board, { key: 'serve:9', kind: 'affidavit', jobId: '9' })?.key).toBe('affidavit:filed')
  })

  it('neither bin moves the tiles: they count papers still to send or file', () => {
    expect(build({ affidavits: [affidavit('1', 'filed')], serve: [{ jobId: '1', serveDue: '2026-11-10' }] }).atRisk).toBe(0)
  })
})

describe('signing has its own bin, Approved · to sign (v2.7712, punch list #383)', () => {
  it('an approved notice with no signature stands there, violet as a paper that waits on the leader, with two stages left: his signature, then the print', () => {
    const board = build({ notices: [notice('1', 'ready', { item: item('i1', 'approved'), earliestDeadline: '2026-12-15', daysLeft: 30 }), notice('2', 'ready', { item: signedItem('i2'), earliestDeadline: '2026-12-15', daysLeft: 30 })] })
    const toSign = bin(board, 'notice:to_sign').chips[0]!
    const toPrint = bin(board, 'notice:to_print').chips[0]!
    expect([toSign.label, toSign.stage, toSign.urgency, toSign.stepsLeft]).toEqual(['JP1', 'to_sign', 'waiting', 2])
    expect([toPrint.label, toPrint.stage, toPrint.urgency, toPrint.stepsLeft]).toEqual(['JP2', 'to_print', 'later', 1])
    expect(lienBoardStagesLeft(toSign, 'Malachi')).toEqual(['Malachi signs it', 'Print it, mail it and enter its mail number'])
    expect(lienBoardStagesLeft(toPrint, 'Malachi')).toEqual(['Print it, mail it and enter its mail number'])
    // The bin stands in the flow, between the leader's approval and the print, so an arrow runs into it and out of it.
    expect(bin(board, 'notice:to_sign').closed).toBe(false)
  })
  it('the print bin holds exactly what the print takes, and the third tile counts the same papers', () => {
    const board = build({ notices: [notice('1', 'ready', { item: item('i1', 'approved') }), notice('2', 'ready', { item: item('i2', 'approved') }), notice('3', 'ready', { item: signedItem('i3') }), notice('4', 'printed', { item: signedItem('i4', PRINTED) })] })
    expect(bin(board, 'notice:to_sign').chips).toHaveLength(2)
    expect(bin(board, 'notice:to_print').chips).toHaveLength(1)
    expect(board.tiles[1]).toMatchObject({ figure: '2', line: '2 to sign' })
    expect(board.tiles[2]).toMatchObject({ figure: '2', line: '1 to print · 1 to mail' })
  })
  it('a GC’s run row stands in Approved · to sign while every one of its notices waits on a signature, and in Approved · to print once one can print', () => {
    const board = build({ notices: [notice('1', 'ready', { item: item('i1', 'approved') }), notice('2', 'ready', { item: item('i2', 'approved') }), notice('3', 'ready', { item: signedItem('i3') }), notice('4', 'printed', { item: signedItem('i4', PRINTED) })] })
    const row = (key: string, jobs: string[]) => lienBoardRowBin(board, { key, kind: 'run', jobId: null, jobs: jobs.map((jobId) => ({ jobId })) })?.key
    expect(row('run:gc1', ['1', '2'])).toBe('notice:to_sign')
    expect(row('run:gc1', ['1', '3'])).toBe('notice:to_print')
    expect(row('run:gc1', ['3'])).toBe('notice:to_print')
    // A row that names no job, and the printed run's row, stand where they stood.
    expect(row('run:gc1', [])).toBe('notice:to_print')
    expect(row('run:printed', ['4'])).toBe('notice:in_mail')
  })
})
