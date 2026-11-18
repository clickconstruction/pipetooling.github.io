import { describe, expect, it } from 'vitest'
import type { LienDeskEntry, LienDeskPile } from './lienDesk'
import type { LienAffidavitEntry, LienAffidavitPile } from './lienDeskAffidavits'
import type { LienRetainageEntry, LienRetainagePile } from './lienDeskRetainage'
import type { LetterTwoStatus } from './lienLetterTwo'
import type { CourtesyStatus } from './lienCourtesyNotice'
import { buildLienNextUp, lienRunEntriesFor, lienViewerLeadsJob, groupLienNextUp, lienGateHoldWords, lienNextUpCount, lienNextUpNowHead, lienPrintedDaysWords, lienWaitedWords, type LienNextUpInput, type LienNextUpRow } from './lienNextUp'

const TODAY = '2026-10-05'

function notice(jobId: string, pile: LienDeskPile, over: Partial<LienDeskEntry> = {}): LienDeskEntry {
  return { jobId, customerId: 'c1', gcCustomerId: 'gc1', openBalance: 1000, hasOwner: true, propertyKind: '', months: [], datedFromCreation: false, dueMonths: ['2026-08'], missedMonths: [], missedUnrecorded: [], affidavitDay: null, affidavitDaysLeft: null, earliestDeadline: '2026-10-15', daysLeft: 10, severity: 'amber', item: null, policy: 'ask', pile, ...over }
}
function affidavit(jobId: string, pile: LienAffidavitPile, over: Partial<LienAffidavitEntry> = {}): LienAffidavitEntry {
  return { jobId, isSub: true, lastMonth: '2026-07', lastMonthFromCreation: false, deadline: '2026-11-16', daysLeft: 42, severity: 'quiet', openBalance: 1000, customerId: 'c1', gcCustomerId: 'gc1', propertyKind: '', gates: [], ready: true, item: null, pile, ...over }
}
function retainage(jobId: string, pile: LienRetainagePile, over: Partial<LienRetainageEntry> = {}): LienRetainageEntry {
  return { jobId, retainageHeld: 500, contractEndedOn: '2026-09-20', contractEndedHow: 'complete', deadline: '2026-10-20', daysLeft: 15, severity: 'amber', noticed: false, inClaim: false, openBalance: 1000, customerId: 'c1', gcCustomerId: 'gc1', propertyKind: '', hasOwner: true, paymentBond: 'unknown', gates: [], ready: true, item: null, pile, ...over }
}
const two = (state: LetterTwoStatus['state'], words = ''): LetterTwoStatus => ({ state, day: 12, clock: null, firstItemId: 'i1', firstSentAt: '2026-09-23T12:00:00Z', letterTwo: null, gcAuthorized: null, words })

function build(over: Partial<LienNextUpInput>) {
  return buildLienNextUp({ notices: [], affidavits: [], retainage: [], letterTwoByJob: {}, role: 'assistant', todayYmd: TODAY, jobTitle: (id) => `Job ${id}`, gcName: (id) => `GC ${id}`, ...over })
}
const one = (over: Partial<LienNextUpInput>) => {
  const rows = build(over)
  expect(rows).toHaveLength(1)
  return rows[0]!
}

describe('buildLienNextUp — notices', () => {
  it('an approved notice with a pay offer (v2.4713) says so in its words', () => {
    // Signed (v2.5087): an unsigned approved notice is the leader's Sign row, and the office's row says it waits.
    const item = { id: 'i-offer', status: 'approved', offer_pct: 10, offer_by: '2026-11-15', fields: {}, signed_at: '2026-10-05T19:14:00Z', signer_printed_name: 'Robert Douglas', signer_signature_mode: 'type' } as unknown as LienDeskEntry['item']
    const r = one({ notices: [notice('j1', 'ready', { item })] })
    // v2.7448: the line is the pile's name, then the offer. A computer's row starts with its bin, so its detail never repeats it.
    expect([r.sub, r.detail]).toEqual(['Approved · to print · offer 10% by Nov 15', 'not printed · offer 10% by Nov 15'])
    const plain = one({ notices: [notice('j1', 'ready')] })
    expect([plain.sub, plain.detail]).toEqual(['Approved · to print', 'not printed'])
  })
  it('each pile names its one move and opens the Notices pane on that job and pile', () => {
    const cases: Array<[LienDeskPile, string, string]> = [
      ['needs_owner', 'find_owner', 'Find the owner'],
      ['to_draft', 'draft', 'Open the notice'],
      ['printed', 'add_tracking', 'Add tracking'],
      ['held', 'review_hold', 'Review the hold'],
    ]
    for (const [pile, action, button] of cases) {
      const r = one({ notices: [notice('j1', pile)] })
      expect([r.kind, r.action, r.button, r.title, r.dueOn]).toEqual(['notice', action, button, 'Job j1', '2026-10-15'])
      expect(r.target).toEqual({ open: 'notices', jobId: 'j1', pile })
    }
  })

  it('awaiting approval: the leader gets Approve, the office waits with no button', () => {
    const leader = one({ notices: [notice('j1', 'awaiting')], role: 'master_technician' })
    expect([leader.action, leader.button, leader.sub]).toEqual(['approve', 'Approve', 'Waiting on your approval'])
    const office = one({ notices: [notice('j1', 'awaiting')], role: 'assistant' })
    expect([office.action, office.button, office.sub]).toEqual(['approve', null, 'Waiting on the leader'])
    expect(office.target).toEqual({ open: 'notices', jobId: 'j1', pile: 'awaiting' })
  })

  it('ready: a single job is Print and mail on the run of its GC; a GC with several is one Print and mail N row (v2.7442)', () => {
    const single = one({ notices: [notice('j1', 'ready')] })
    expect([single.action, single.button]).toEqual(['send', 'Print and mail'])
    expect(single.target).toEqual({ open: 'run', gcId: 'gc1' })
    // A notice with no GC on record keeps its pane.
    expect(one({ notices: [notice('j1', 'ready', { gcCustomerId: null })] }).target).toEqual({ open: 'notices', jobId: 'j1', pile: 'ready' })

    const run = one({ notices: [notice('j1', 'ready', { earliestDeadline: '2026-10-20', daysLeft: 15 }), notice('j2', 'ready', { earliestDeadline: '2026-10-09', daysLeft: 4, severity: 'red' })] })
    expect([run.key, run.action, run.button, run.title, run.sub]).toEqual(['run:gc1', 'send_run', 'Print and mail 2', 'GC gc1', '2 notices approved · to print'])
    // A computer's row starts with the bin Approved · to print, so the GC row's detail says only the count and the tick they lack.
    expect(run.detail).toBe('2 notices · not printed')
    // One of the two approved on a rule and never signed: the row says how many the leader has yet to sign.
    const ruled = { id: 'i-rule', status: 'approved', approval_mode: 'rule', fields: {}, signed_at: null } as unknown as LienDeskEntry['item']
    const held = one({ notices: [notice('j1', 'ready', { item: ruled }), notice('j2', 'ready')] })
    expect(held.detail).toBe('2 notices · not printed · 1 not signed')
    expect([run.jobId, run.gcId, run.dueOn, run.daysLeft, run.severity, run.group]).toEqual([null, 'gc1', '2026-10-09', 4, 'red', 'now'])
    expect(run.target).toEqual({ open: 'run', gcId: 'gc1' })

    // The run a GC's row opens holds that GC's approved notices alone; the desk's own door holds every approved and printed one.
    const ready = [notice('a', 'ready'), notice('b', 'ready', { gcCustomerId: 'gc2' }), notice('c', 'ready')]
    const printed = [notice('p', 'printed')]
    expect(lienRunEntriesFor(ready, printed, 'gc1').map((e) => e.jobId)).toEqual(['a', 'c'])
    expect(lienRunEntriesFor(ready, printed, 'gc2').map((e) => e.jobId)).toEqual(['b'])
    expect(lienRunEntriesFor(ready, printed, null).map((e) => e.jobId)).toEqual(['a', 'b', 'c', 'p'])

    // Just this one (v2.7512): the run holds one notice by its desk item, found in either pile, whatever GC is passed.
    const item = (id: string) => ({ id }) as NonNullable<LienDeskEntry['item']>
    const readyItems = [notice('a', 'ready', { item: item('ia') }), notice('b', 'ready', { item: item('ib') })]
    const printedItems = [notice('p', 'printed', { item: item('ip') })]
    expect(lienRunEntriesFor(readyItems, printedItems, null, 'ib').map((e) => e.jobId)).toEqual(['b'])
    expect(lienRunEntriesFor(readyItems, printedItems, 'gc1', 'ip').map((e) => e.jobId)).toEqual(['p'])
    expect(lienRunEntriesFor(readyItems, printedItems, null, 'gone')).toEqual([])
    expect(lienRunEntriesFor(readyItems, printedItems, null, null).map((e) => e.jobId)).toEqual(['a', 'b', 'p'])

    // Two GCs with one each are two single rows, not a run.
    expect(build({ notices: [notice('j1', 'ready'), notice('j2', 'ready', { gcCustomerId: 'gc2' })] }).map((r) => r.action)).toEqual(['send', 'send'])
  })

  it('sent: a row only when the attorney’s letter is due, with the attorney’s letter’s own words', () => {
    expect(build({ notices: [notice('j1', 'sent')] })).toEqual([])
    expect(build({ notices: [notice('j1', 'sent')], letterTwoByJob: { j1: two('waiting') } })).toEqual([])
    const due = one({ notices: [notice('j1', 'sent')], letterTwoByJob: { j1: two('due', 'day 12 · the attorney’s letter due') } })
    expect([due.key, due.action, due.button, due.sub, due.dueOn, due.severity]).toEqual(['letter-two:j1', 'letter_two', 'Send the attorney’s letter', 'day 12 · the attorney’s letter due', null, 'amber'])
    expect(due.target).toEqual({ open: 'notices', jobId: 'j1', pile: 'sent' })
    expect(one({ notices: [notice('j1', 'sent')], letterTwoByJob: { j1: two('overdue') } }).group).toBe('now')
  })

  it('an envelope mailed through Docsmit that came back is the office’s red row under Needs you now, opening the notice under Sent (the Docsmit train, 6b-2)', () => {
    const r = one({ mailNeedsYou: [{ jobId: 'j1', pieceId: 'p2', who: 'Original contractor', words: 'returned to sender' }] })
    expect([r.key, r.kind, r.action, r.button, r.title, r.sub, r.group, r.severity, r.dueOn]).toEqual(['mail:p2', 'notice', 'mail_needs_you', 'Open the notice', 'Job j1', 'Docsmit · original contractor · returned to sender', 'now', 'red', null])
    expect(r.target).toEqual({ open: 'notices', jobId: 'j1', pile: 'sent' })
    expect(one({ role: 'estimator', mailNeedsYou: [{ jobId: 'j1', pieceId: 'p2', who: 'Owner of record', words: 'notice left, unclaimed so far' }] }).button).toBeNull()
    // Dated rows of the same group come first; the envelope's row has no day of its own.
    const rows = build({ notices: [notice('j3', 'to_draft', { earliestDeadline: '2026-10-08', daysLeft: 3, severity: 'red' })], mailNeedsYou: [{ jobId: 'j1', pieceId: 'p2', who: 'Owner of record', words: 'returned to sender' }] })
    expect(rows.map((x) => x.key)).toEqual(['notice:j3', 'mail:p2'])
  })

  it('missed: open months are drafted; a closed window nobody wrote down is noted; a noted one asks nothing', () => {
    expect(one({ notices: [notice('j1', 'missed', { dueMonths: ['2026-08'], missedUnrecorded: ['2026-06'] })] }).action).toBe('draft')
    const note = one({ notices: [notice('j1', 'missed', { dueMonths: [], missedUnrecorded: ['2026-06'] })] })
    expect([note.action, note.button, note.group]).toEqual(['note_missed', 'Note it', 'now'])
    expect(build({ notices: [notice('j1', 'missed', { dueMonths: [], missedUnrecorded: [] })] })).toEqual([])
  })
})

describe('buildLienNextUp — affidavits and retainage', () => {
  it('affidavit piles: fix the property, draft, approve, file, review; filed and missed ask nothing', () => {
    const act = (pile: LienAffidavitPile, role = 'assistant') => build({ affidavits: [affidavit('j1', pile)], role }).map((r) => [r.action, r.button])
    expect(act('needs_property')).toEqual([['fix_property', 'Fix the property record']])
    expect(act('to_draft')).toEqual([['draft', 'Open the affidavit']])
    expect(act('awaiting')).toEqual([['approve', null]])
    expect(act('awaiting', 'dev')).toEqual([['approve', 'Approve']])
    expect(act('ready')).toEqual([['file_affidavit', 'File the affidavit']])
    expect(act('held')).toEqual([['review_hold', 'Review the hold']])
    expect(act('filed')).toEqual([])
    expect(act('missed')).toEqual([])
    expect(one({ affidavits: [affidavit('j1', 'ready')] }).target).toEqual({ open: 'affidavits', jobId: 'j1' })
  })

  it('a lien filed and not served opens the job’s Lien window on the Lien affidavit tab', () => {
    const r = one({ serveDue: [{ jobId: 'j9', serveDue: '2026-10-07' }] })
    expect([r.key, r.kind, r.action, r.button, r.dueOn, r.daysLeft, r.group]).toEqual(['serve:j9', 'affidavit', 'record_service', 'Print the copies to mail', '2026-10-07', 2, 'now'])
    expect(r.target).toEqual({ open: 'lien_window', jobId: 'j9', tab: 'affidavit' })
    // Once its copies are printed the same row's press names the other half (`lienServeStage.ts`).
    const printed = one({ serveDue: [{ jobId: 'j9', serveDue: '2026-10-07', stage: 'record' }] })
    expect([printed.button, printed.serveStage, r.serveStage]).toEqual(['Enter mail numbers', 'record', 'print'])
  })

  it('a filed lien’s row says what is owed and by when, and turns red the day before its day (punch list #366)', () => {
    const row = (serveDue: string) => one({ serveDue: [{ jobId: 'j9', serveDue }] })
    // Today is 2026-10-05 in this file's rows.
    expect([row('2026-10-07').sub, row('2026-10-07').severity]).toEqual(['Lien filed · mail its copies by Oct 7', 'amber'])
    expect([row('2026-10-06').sub, row('2026-10-06').severity, row('2026-10-06').daysLeft]).toEqual(['Lien filed · mail its copies by Oct 6', 'red', 1])
    expect([row('2026-10-05').sub, row('2026-10-05').severity]).toEqual(['Lien filed · mail its copies today', 'red'])
    expect([row('2026-10-01').sub, row('2026-10-01').severity, row('2026-10-01').daysLeft]).toEqual(['Lien filed · its copies were due Oct 1. Mail them today.', 'red', -4])
  })

  it('retainage piles: find the owner, draft, approve, send, review; the rest ask nothing', () => {
    const act = (pile: LienRetainagePile) => build({ retainage: [retainage('j1', pile)] }).map((r) => r.action)
    expect(act('needs_owner')).toEqual(['find_owner'])
    expect(act('to_draft')).toEqual(['draft'])
    expect(act('awaiting')).toEqual(['approve'])
    expect(act('ready')).toEqual(['send'])
    expect(act('held')).toEqual(['review_hold'])
    expect(act('clock_not_started')).toEqual([])
    expect(act('sent')).toEqual([])
    expect(act('missed')).toEqual([])
    expect(one({ retainage: [retainage('j1', 'ready')] }).target).toEqual({ open: 'retainage', jobId: 'j1' })
    // A retainage notice has no print pile of its own (v2.7448): approved, it waits to mail with the monthly notices.
    expect(one({ retainage: [retainage('j1', 'ready')] }).sub).toBe('Retainage notice approved · to mail')
  })

  it('retainage nobody recorded is a row under Needs you now with no day, the office’s press, opening the list at that job', () => {
    const unrecorded = [{ jobId: 'j7', title: 'C2041 · Cedar Hollow Clinic', why: '$2,460.00 looks held · 3 bills paid at 90%' }]
    const row = one({ retainageUnrecorded: unrecorded })
    expect(row).toMatchObject({
      key: 'retainage-unrecorded:j7',
      kind: 'retainage',
      jobId: 'j7',
      title: 'C2041 · Cedar Hollow Clinic',
      sub: 'Retainage not on the job · $2,460.00 looks held · 3 bills paid at 90%',
      detail: '$2,460.00 looks held · 3 bills paid at 90%',
      dueOn: null,
      daysLeft: null,
      severity: 'amber',
      group: 'now',
      action: 'record_retainage',
      button: 'Record the retainage',
      target: { open: 'retainage_unrecorded', jobId: 'j7' },
    })
    // The answer is the office's to record, and a master is office too; any other role reads the row.
    expect(one({ role: 'master_technician', retainageUnrecorded: unrecorded }).button).toBe('Record the retainage')
    expect(one({ role: 'estimator', retainageUnrecorded: unrecorded }).button).toBeNull()
    // It stands with the dated rows of Needs you now, after them: it has no day of its own.
    const both = build({ retainageUnrecorded: unrecorded, retainage: [retainage('j1', 'to_draft', { daysLeft: 3, deadline: '2026-10-08', severity: 'red' })] })
    expect(both.map((r) => [r.key, r.group])).toEqual([
      ['retainage:j1', 'now'],
      ['retainage-unrecorded:j7', 'now'],
    ])
    expect(build({})).toEqual([])
  })
})

describe('buildLienNextUp — who may act, and the order', () => {
  it('a role that is neither office nor leader sees every row and no button', () => {
    const rows = build({ role: 'estimator', notices: [notice('j1', 'to_draft'), notice('j2', 'ready', { gcCustomerId: 'gc2' })], affidavits: [affidavit('j3', 'ready')], retainage: [retainage('j4', 'to_draft')], serveDue: [{ jobId: 'j5', serveDue: '2026-10-07' }] })
    expect(rows).toHaveLength(5)
    expect(rows.every((r) => r.button === null)).toBe(true)
  })

  it('overdue first, then by the last day; Needs you now is seven days or less, the rest Coming up; undated rows close their group', () => {
    const rows = build({
      notices: [
        notice('late', 'to_draft', { earliestDeadline: '2026-10-01', daysLeft: -4, severity: 'red' }),
        notice('soon', 'to_draft', { earliestDeadline: '2026-10-12', daysLeft: 7, severity: 'red' }),
        notice('later', 'to_draft', { earliestDeadline: '2026-10-30', daysLeft: 25, severity: 'quiet' }),
        notice('two', 'sent'),
      ],
      affidavits: [affidavit('aff', 'ready', { deadline: '2026-10-08', daysLeft: 3, severity: 'red' })],
      retainage: [retainage('ret', 'to_draft')],
      letterTwoByJob: { two: two('overdue') },
    })
    expect(rows.map((r) => `${r.group}:${r.jobId}`)).toEqual(['now:late', 'now:aff', 'now:soon', 'now:two', 'coming:ret', 'coming:later'])
    const groups = groupLienNextUp(rows)
    // The letter-two row keeps `now` for its day but reads under Reminders (punch list #262), so the red group holds dated work.
    expect(groups.map((g) => [g.label, g.rows.length])).toEqual([['Needs you now', 3], ['Reminders', 1], ['Coming up', 2]])
    expect(groupLienNextUp([])).toEqual([])
  })
})

describe('buildLienNextUp — the late notice (v2.4708)', () => {
  const gates = (noticeOk: boolean, ownerOk = true) => [
    { key: 'owner' as const, ok: ownerOk, label: '' },
    { key: 'legal' as const, ok: true, label: '' },
    { key: 'notice' as const, ok: noticeOk, label: '' },
    { key: 'homestead' as const, ok: true, label: '' },
  ]
  const closedOnly = (over: Partial<LienDeskEntry> = {}) => notice('j1', 'missed', { dueMonths: [], missedMonths: ['2026-07'], missedUnrecorded: ['2026-07'], earliestDeadline: null, daysLeft: null, severity: 'red', ...over })
  it('every window closed, the affidavit still open: the notice row drafts it late, the affidavit row says send the notice first', () => {
    const rows = build({ notices: [closedOnly()], affidavits: [affidavit('j1', 'needs_property', { deadline: '2026-10-15', daysLeft: 10, severity: 'amber', gates: gates(false) })] })
    const n = rows.find((r) => r.kind === 'notice')!
    expect([n.action, n.button, n.sub, n.dueOn, n.daysLeft]).toEqual(['draft_late', 'Draft it late', 'Late notice to send · the window closed, the affidavit is still open', '2026-10-15', 10])
    expect(n.target).toEqual({ open: 'notices', jobId: 'j1', pile: 'missed' })
    const a = rows.find((r) => r.kind === 'affidavit')!
    expect([a.action, a.button]).toEqual(['send_notice', 'Send the notice first'])
    expect(a.sub).toContain('late is allowed')
    expect(a.target).toEqual({ open: 'notices', jobId: 'j1', pile: 'missed' })
  })
  it('the affidavit row says where its notice stands, and its press goes to the step that is next', () => {
    const aff = () => affidavit('j1', 'needs_property', { deadline: '2026-10-15', daysLeft: 10, severity: 'amber', gates: gates(false) })
    const row = (n: LienDeskEntry, over: Partial<LienNextUpInput> = {}) => build({ notices: [n], affidavits: [aff()], ...over }).find((r) => r.kind === 'affidavit')!
    // Approved and standing in the run: Print and mail, on the run of its GC, as the notice's own row does.
    const approved = row(notice('j1', 'ready'))
    expect([approved.action, approved.button, approved.sub, approved.detail]).toEqual(['send_notice', 'Print and mail', 'Affidavit · its § 53.056 notice is approved and not mailed yet', 'Its § 53.056 notice is approved and not mailed yet.'])
    expect(approved.target).toEqual({ open: 'run', gcId: 'gc1' })
    expect(row(notice('j1', 'ready', { gcCustomerId: null })).target).toEqual({ open: 'notices', jobId: 'j1', pile: 'ready' })
    // A role outside the office reads the row and has no press.
    expect(row(notice('j1', 'ready'), { role: 'estimator' }).button).toBeNull()
    expect(row(notice('j1', 'awaiting'), { role: 'estimator' }).button).toBeNull()
    // Printed: the run waits on the envelope's numbers.
    const printed = row(notice('j1', 'printed'))
    expect([printed.button, printed.detail]).toEqual(['Enter mail numbers', 'Its § 53.056 notice is printed and not mailed yet.'])
    expect(printed.target).toEqual({ open: 'run', gcId: null })
    // Earlier stages: the notice itself, on its own pile.
    const cases: Array<[LienDeskPile, string]> = [
      ['awaiting', 'Its § 53.056 notice waits on the leader’s approval.'],
      ['to_draft', 'Its § 53.056 notice is not sent for approval yet.'],
      ['held', 'Its § 53.056 notice is held.'],
      ['needs_owner', 'Its § 53.056 notice needs the owner of record.'],
      ['sent', 'Its § 53.056 notice is marked sent with no mailing on record.'],
    ]
    for (const [pile, detail] of cases) {
      const r = row(notice('j1', pile))
      expect([r.action, r.button, r.detail]).toEqual(['send_notice', 'Open the notice', detail])
      expect(r.target).toEqual({ open: 'notices', jobId: 'j1', pile })
    }
    expect(row(notice('j1', 'awaiting'), { leaderName: () => 'Sam' }).detail).toBe('Its § 53.056 notice waits on Sam’s approval.')
    // A window closed with a month still open: the notice is still to send, on the pile it stands in.
    const open = row(notice('j1', 'missed', { dueMonths: ['2026-08'] }))
    expect([open.button, open.detail]).toEqual(['Open the notice', 'Its § 53.056 notice is not sent for approval yet.'])
    expect(open.target).toEqual({ open: 'notices', jobId: 'j1', pile: 'missed' })
    // No notice row on the desk at all: the late notice, as before.
    const none = build({ affidavits: [aff()] }).find((r) => r.kind === 'affidavit')!
    expect([none.button, none.detail]).toEqual(['Send the notice first', 'Send the § 53.056 notice first. Late is allowed while this window is open.'])
    expect(none.target).toEqual({ open: 'notices', jobId: 'j1', pile: 'missed' })
  })
  it('a public owner: the row says no lien attaches and offers no press (punch list #314)', () => {
    const r = build({ affidavits: [affidavit('j1', 'needs_property', { gates: [...gates(true), { key: 'public_owner' as const, ok: false, label: '' }] })] }).find((x) => x.kind === 'affidavit')!
    expect([r.action, r.button, r.sub]).toEqual(['fix_property', null, 'Affidavit · public property, no lien attaches. Ask the attorney about the bond'])
  })
  it('the GC has no address on file and the property record is whole: the row names it and offers Add the address (punch list #305)', () => {
    const contractor = (ok: boolean) => ({ key: 'contractor' as const, ok, label: '' })
    const only = build({ affidavits: [affidavit('j1', 'needs_property', { gates: [...gates(true), contractor(false)] })] }).find((r) => r.kind === 'affidavit')!
    expect([only.action, only.button, only.sub]).toEqual(['fix_property', 'Add the address', 'Affidavit · the general contractor has no address on file'])
    expect(only.target).toEqual({ open: 'affidavits', jobId: 'j1' })
    // A property fact also missing: the property record leads, as before.
    const both = build({ affidavits: [affidavit('j1', 'needs_property', { gates: [...gates(true, false), contractor(false)] })] }).find((r) => r.kind === 'affidavit')!
    expect([both.button, both.sub]).toEqual(['Fix the property record', 'Affidavit · the affidavit still needs the owner of record and the GC’s address'])
  })
  it('the affidavit window closed too: the notice row is Note it, as before; a property gate still failing keeps Fix the property', () => {
    const rows = build({ notices: [closedOnly()], affidavits: [affidavit('j1', 'needs_property', { deadline: '2026-09-15', daysLeft: -20, severity: 'red', gates: gates(false, false) })] })
    expect(rows.find((r) => r.kind === 'notice')!.action).toBe('note_missed')
    expect(rows.find((r) => r.kind === 'affidavit')!.action).toBe('fix_property')
  })
})

describe('buildLienNextUp — the printed run is one row (punch list #101)', () => {
  const printedItem = (at: string) => ({ id: `i-${at}`, status: 'approved', printed_at: at }) as unknown as LienDeskEntry['item']
  it('two or more printed notices fold into one run row, dated by the earliest, naming its jobs in order', () => {
    const rows = build({
      notices: [
        notice('j1', 'printed', { item: printedItem('2026-10-07T16:00:00Z'), earliestDeadline: '2026-11-15', daysLeft: 41, severity: 'quiet' }),
        notice('j2', 'printed', { item: printedItem('2026-10-07T17:00:00Z'), earliestDeadline: '2026-10-15', daysLeft: 5, severity: 'red' }),
        notice('j3', 'printed', { item: printedItem('2026-10-07T18:00:00Z'), earliestDeadline: null, daysLeft: null }),
        notice('j4', 'ready'),
      ],
    })
    expect(rows.map((r) => r.key).sort()).toEqual(['notice:j4', 'run:printed'])
    const run = rows.find((r) => r.key === 'run:printed')!
    expect([run.kind, run.jobId, run.gcId, run.title, run.dueOn, run.daysLeft, run.severity, run.group]).toEqual(['notice', null, null, '3 notices printed Oct 7', '2026-10-15', 5, 'red', 'now'])
    expect(run.sub).toBe('A checklist: tick Printed, Signed and Mailed on each. Mailed? Type each envelope’s number. Not mailing them? Take the print back.')
    expect([run.action, run.button]).toEqual(['record_mailing', 'Enter mail numbers'])
    expect(run.target).toEqual({ open: 'run', gcId: null })
    expect(run.secondary).toEqual({ words: 'Take back…', target: { open: 'run', gcId: null, takeBack: true } })
    expect(run.jobs).toEqual([
      { jobId: 'j2', title: 'Job j2', dueOn: '2026-10-15' },
      { jobId: 'j1', title: 'Job j1', dueOn: '2026-11-15' },
      { jobId: 'j3', title: 'Job j3', dueOn: null },
    ])
  })
  it('one printed notice keeps its own row; a role that cannot act gets no buttons', () => {
    expect(one({ notices: [notice('j1', 'printed')] }).action).toBe('add_tracking')
    const run = one({ notices: [notice('j1', 'printed'), notice('j2', 'printed')], role: 'estimator' })
    expect([run.button, run.secondary]).toEqual([null, null])
  })
  it('the printed days: one, a span, or none', () => {
    expect(lienPrintedDaysWords(['2026-10-07T16:00:00Z', '2026-10-07T20:00:00Z'])).toBe('printed Oct 7')
    expect(lienPrintedDaysWords(['2026-10-08T16:00:00Z', null, '2026-10-07T16:00:00Z'])).toBe('printed Oct 7 to Oct 8')
    expect(lienPrintedDaysWords([null])).toBe('printed')
  })
})

describe('groupLienNextUp — only you can approve, first (punch list #101 PR 3)', () => {
  const submitted = { id: 'i1', status: 'awaiting_approval', submitted_at: '2026-10-04T15:00:00Z' } as unknown as LienDeskEntry['item']
  const notices = [notice('j1', 'to_draft', { earliestDeadline: '2026-10-08', daysLeft: 3, severity: 'red' }), notice('j2', 'awaiting', { item: submitted }), notice('j3', 'awaiting', { earliestDeadline: '2026-11-15', daysLeft: 41 })]
  it('the leader: his approvals lead, whatever their day; the rest run by day', () => {
    const rows = build({ notices, role: 'master_technician' })
    const groups = groupLienNextUp(rows)
    expect(groups.map((g) => [g.group, g.label, g.rows.map((r) => r.jobId)])).toEqual([
      ['mine', 'Only you can approve', ['j2', 'j3']],
      ['now', 'Needs you now', ['j1']],
    ])
    expect(lienNextUpCount(rows)).toBe(3)
  })
  it('the office: the approvals wait under the leader’s name, above the rows on track, and leave the count (v2.7371; last until then)', () => {
    const rows = build({ notices, role: 'assistant', leaderName: (id) => (id === 'j2' || id === 'j3' ? 'Sam' : null) })
    expect(rows.find((r) => r.jobId === 'j2')!.sub).toBe('Waiting on Sam · since Oct 4')
    expect(rows.find((r) => r.jobId === 'j3')!.sub).toBe('Waiting on Sam')
    const groups = groupLienNextUp(rows, { waitingOn: 'Sam' })
    expect(groups.map((g) => [g.group, g.label, g.rows.map((r) => r.jobId), g.part ?? false])).toEqual([
      ['waiting', 'Waiting on Sam to approve', ['j2', 'j3'], true],
      ['now', 'On track', ['j1'], true],
    ])
    expect(lienNextUpNowHead(groups)).toEqual({ label: 'Needs you now', count: 1, waiting: '2 waiting on Sam to approve' })
    const plain = groupLienNextUp(rows)
    expect(plain[0]!.label).toBe('Waiting on the leader to approve')
    expect(lienNextUpCount(rows)).toBe(1)
  })
  it('an affidavit or retainage notice waiting on the leader names him too', () => {
    const rows = build({ affidavits: [affidavit('j5', 'awaiting')], retainage: [retainage('j6', 'awaiting')], role: 'assistant', leaderName: () => 'Sam' })
    expect(rows.map((r) => r.sub).sort()).toEqual(['Affidavit · waiting on Sam', 'Retainage · waiting on Sam'])
  })
})

describe('Only you can sign (v2.5087)', () => {
  it('an approved notice the leader has not signed is his own Sign row, first on the list and in his count; the office’s row says it waits on him', () => {
    const unsigned = { id: 'i-word', status: 'approved', approval_mode: 'word', fields: {}, signed_at: null } as unknown as LienDeskEntry['item']
    const signed = { id: 'i-signed', status: 'approved', approval_mode: 'leader', fields: {}, signed_at: '2026-10-05T19:14:00Z', signer_printed_name: 'Robert Douglas', signer_signature_mode: 'type' } as unknown as LienDeskEntry['item']
    const leaderRows = build({ role: 'master_technician', notices: [notice('j1', 'ready', { item: unsigned }), notice('j2', 'ready', { item: signed, gcCustomerId: 'gc2' })] })
    const sign = leaderRows.find((r) => r.jobId === 'j1')!
    expect(sign.action).toBe('sign')
    expect(sign.button).toBe('Sign')
    expect(sign.sub).toBe('Approved on your word · unsigned')
    expect(sign.target).toEqual({ open: 'notices', jobId: 'j1', pile: 'ready' })
    expect(leaderRows.find((r) => r.jobId === 'j2')!.action).toBe('send')
    const groups = groupLienNextUp(leaderRows)
    expect(groups[0]!.group).toBe('sign')
    expect(groups[0]!.label).toBe('Only you can sign')
    expect(groups[0]!.rows.map((r) => r.jobId)).toEqual(['j1'])
    expect(lienNextUpCount(leaderRows)).toBe(2)
    // Two unsigned for one GC are two Sign rows, never one run row.
    const twoUnsigned = build({ role: 'master_technician', notices: [notice('j1', 'ready', { item: unsigned }), notice('j3', 'ready', { item: unsigned })] })
    expect(twoUnsigned.filter((r) => r.action === 'sign')).toHaveLength(2)
    const officeRow = one({ role: 'assistant', notices: [notice('j1', 'ready', { item: unsigned })], leaderName: () => 'Robert' })
    expect(officeRow.action).toBe('send')
    expect(officeRow.sub).toBe('Approved · to print · not signed, waits on Robert')
    expect(officeRow.detail).toBe('not printed · not signed, waits on Robert')
  })
})

describe('Signed by pen, as recorded (the pen train, PR 3)', () => {
  it('a pen record the leader has not confirmed is his own row, first after Only you can sign, with Yes, I signed it; the office sees the ready row', () => {
    const pen = { id: 'i-pen', status: 'approved', approval_mode: 'word', fields: {}, signed_at: '2026-10-09T17:00:00Z', signer_printed_name: 'Robert Douglas', signer_signature_mode: 'pen', signed_recorded_by: 'u-taunya', signed_witness_how: 'watched', signed_leader_confirmed_at: null } as unknown as LienDeskEntry['item']
    const leaderRows = build({ role: 'master_technician', notices: [notice('j1', 'ready', { item: pen })], userName: (id) => (id === 'u-taunya' ? 'Taunya' : null) })
    const row = leaderRows.find((r) => r.jobId === 'j1')!
    expect(row.action).toBe('confirm_pen')
    expect(row.button).toBe('Yes, I signed it')
    expect(row.sub).toBe('Signed by pen Oct 9 · recorded by Taunya')
    expect(row.target).toEqual({ open: 'notices', jobId: 'j1', pile: 'ready' })
    const groups = groupLienNextUp(leaderRows)
    expect(groups[0]!.group).toBe('pen')
    expect(groups[0]!.label).toBe('Signed by pen, as recorded')
    const confirmed = { ...(pen as object), signed_leader_confirmed_at: '2026-10-12T22:00:00Z' } as unknown as LienDeskEntry['item']
    expect(build({ role: 'master_technician', notices: [notice('j1', 'ready', { item: confirmed })] }).find((r) => r.jobId === 'j1')!.action).toBe('send')
    expect(build({ role: 'assistant', notices: [notice('j1', 'ready', { item: pen })] }).find((r) => r.jobId === 'j1')!.action).toBe('send')
  })
})

describe('Signed with your code, as recorded (v2.5791)', () => {
  it('a code signature the leader has not confirmed is his own row with Yes, I signed it, naming whose screen; the group label says code', () => {
    const code = { id: 'i-code', status: 'approved', approval_mode: 'leader', fields: {}, signed_at: '2026-10-23T19:14:00Z', signer_printed_name: 'Malachi', signer_signature_mode: 'code', signed_on_device_of: 'u-robert', signed_leader_confirmed_at: null } as unknown as LienDeskEntry['item']
    const rows = build({ role: 'master_technician', notices: [notice('j1', 'ready', { item: code })], userName: (id) => (id === 'u-robert' ? 'Robert' : null) })
    const row = rows.find((r) => r.jobId === 'j1')!
    expect(row.action).toBe('confirm_pen')
    expect(row.sub).toBe('Signed with your code Oct 23 · on Robert’s screen')
    const groups = groupLienNextUp(rows)
    expect(groups[0]!.group).toBe('pen')
    expect(groups[0]!.label).toBe('Signed with your code, as recorded')
    expect(build({ role: 'assistant', notices: [notice('j1', 'ready', { item: code })] }).find((r) => r.jobId === 'j1')!.action).toBe('send')
  })
})

describe('another master’s jobs read as the office reads them (v2.6734, punch list #150 residual B)', () => {
  const master = (id: string) => (id === 'j1' ? 'u-malachi' : id === 'j2' ? 'u-robert' : null)
  const names = { leaderName: (id: string) => (id === 'j1' ? 'Malachi' : id === 'j2' ? 'Robert' : null) }
  const submitted = { id: 'i1', status: 'awaiting_approval', submitted_at: '2026-10-04T15:00:00Z' } as unknown as LienDeskEntry['item']

  it('awaiting approval: the dev’s own job and a job with no master say your approval; Malachi’s job waits on Malachi with no button, last on the list and out of the count', () => {
    const rows = build({ role: 'dev', viewerUserId: 'u-robert', masterUserId: master, ...names, notices: [notice('j1', 'awaiting', { item: submitted }), notice('j2', 'awaiting'), notice('j3', 'awaiting')] })
    const by = (id: string) => rows.find((r) => r.jobId === id)!
    expect([by('j1').sub, by('j1').button]).toEqual(['Waiting on Malachi · since Oct 4', null])
    expect([by('j2').sub, by('j2').button]).toEqual(['Waiting on your approval', 'Approve'])
    expect([by('j3').sub, by('j3').button]).toEqual(['Waiting on your approval', 'Approve'])
    const groups = groupLienNextUp(rows, { waitingOn: 'Malachi' })
    expect(groups.map((g) => [g.label, g.rows.map((r) => r.jobId)])).toEqual([
      ['Only you can approve', ['j2', 'j3']],
      ['Waiting on Malachi to approve', ['j1']],
    ])
    expect(lienNextUpCount(rows)).toBe(2)
    // Without a viewer, every leader leads every job, as before.
    expect(build({ role: 'dev', masterUserId: master, notices: [notice('j1', 'awaiting', { item: submitted })] })[0]!.sub).toBe('Waiting on your approval')
    expect(lienViewerLeadsJob({ role: 'dev', viewerUserId: 'u-robert', masterUserId: master }, 'j1')).toBe(false)
    expect(lienViewerLeadsJob({ role: 'dev', viewerUserId: 'u-robert', masterUserId: master }, 'j2')).toBe(true)
    expect(lienViewerLeadsJob({ role: 'dev', viewerUserId: 'u-robert', masterUserId: master }, null)).toBe(true)
    expect(lienViewerLeadsJob({ role: 'assistant', viewerUserId: 'u-wendi', masterUserId: master }, 'j2')).toBe(false)
  })

  it('ready: an unsigned notice on Malachi’s job is the office’s send row that waits on him, not the dev’s Sign row; his unconfirmed code signature there is the send row too', () => {
    const unsigned = { id: 'i-word', status: 'approved', approval_mode: 'word', fields: {}, signed_at: null } as unknown as LienDeskEntry['item']
    const code = { id: 'i-code', status: 'approved', approval_mode: 'leader', fields: {}, signed_at: '2026-10-23T19:14:00Z', signer_printed_name: 'Malachi', signer_signature_mode: 'code', signed_on_device_of: 'u-robert', signed_leader_confirmed_at: null } as unknown as LienDeskEntry['item']
    const rows = build({ role: 'dev', viewerUserId: 'u-robert', masterUserId: master, ...names, notices: [notice('j1', 'ready', { item: unsigned }), notice('j2', 'ready', { item: unsigned, gcCustomerId: 'gc2' })] })
    const his = rows.find((r) => r.jobId === 'j1')!
    expect([his.action, his.button, his.sub]).toEqual(['send', 'Print and mail', 'Approved · to print · not signed, waits on Malachi'])
    const mine = rows.find((r) => r.jobId === 'j2')!
    expect([mine.action, mine.button, mine.sub]).toEqual(['sign', 'Sign', 'Approved on your word · unsigned'])
    const codeRow = one({ role: 'dev', viewerUserId: 'u-robert', masterUserId: master, ...names, notices: [notice('j1', 'ready', { item: code })] })
    expect(codeRow.action).toBe('send')
    expect(one({ role: 'dev', viewerUserId: 'u-malachi', masterUserId: master, ...names, notices: [notice('j1', 'ready', { item: code })] }).action).toBe('confirm_pen')
  })

  it('an affidavit or retainage notice on Malachi’s job waits on him by name for the dev too', () => {
    const rows = build({ role: 'dev', viewerUserId: 'u-robert', masterUserId: () => 'u-malachi', leaderName: () => 'Malachi', affidavits: [affidavit('j5', 'awaiting')], retainage: [retainage('j6', 'awaiting')] })
    expect(rows.map((r) => [r.sub, r.button]).sort()).toEqual([['Affidavit · waiting on Malachi', null], ['Retainage · waiting on Malachi', null]])
  })
})

describe('a sent job with new months due (v2.6624, punch list #248)', () => {
  const sentItem = { id: 'sent1', status: 'sent', sent_at: '2026-09-23T12:00:00Z', months: ['2026-07'], fields: {} } as unknown as LienDeskEntry['item']
  it('To do shows the draft row and the attorney’s-letter row for one job, the reminder opening the To draft pane', () => {
    const rows = build({ notices: [notice('j1', 'to_draft', { sentItem })], letterTwoByJob: { j1: two('overdue', 'day 21 · the attorney’s letter overdue') } })
    expect(rows.map((r) => [r.key, r.action])).toEqual([
      ['letter-two:j1', 'letter_two'],
      ['notice:j1', 'draft'],
    ])
    expect(rows[0]!.target).toEqual({ open: 'notices', jobId: 'j1', pile: 'to_draft' })
    expect(rows[1]!.target).toEqual({ open: 'notices', jobId: 'j1', pile: 'to_draft' })
    // Ten days out the draft row is Coming up; the reminder keeps its own heading between.
    expect(groupLienNextUp(rows).map((g) => [g.group, g.rows.map((r) => r.key)])).toEqual([
      ['reminders', ['letter-two:j1']],
      ['coming', ['notice:j1']],
    ])
  })
  it('a To draft row with no sent notice has the draft row alone, as before', () => {
    expect(build({ notices: [notice('j1', 'to_draft')], letterTwoByJob: { j1: two('overdue') } }).map((r) => r.key)).toEqual(['notice:j1'])
  })
})

describe('the REMINDERS ladder (punch list #262)', () => {
  const courtesy = (over: Partial<CourtesyStatus> = {}): CourtesyStatus => ({ state: 'due', day: 21, words: 'day 21 · nothing since the packet', reason: '', lastSentAt: null, waitingForAnswer: false, lienDay: '2026-11-16', records: [], ...over })
  it('a courtesy row stands on step 1, the attorney’s-letter row after the one courtesy and a quiet week on step 3; with no courtesy status the rung is null and the row still reads under Reminders', () => {
    const due = one({ notices: [notice('j1', 'sent')], letterTwoByJob: { j1: two('overdue', 'day 21 · the attorney’s letter overdue') }, courtesyByJob: { j1: courtesy() } })
    expect([due.action, due.reminder?.step, due.reminder?.state]).toEqual(['courtesy', 1, 'due'])
    // v2.6594: after the one courtesy and a week of silence the attorney's letter leads, on step 3.
    const quiet = one({ notices: [notice('j1', 'sent')], letterTwoByJob: { j1: two('overdue', 'day 21 · the attorney’s letter overdue') }, courtesyByJob: { j1: courtesy({ state: 'sent', lastSentAt: '2026-09-28T12:00:00Z', words: 'day 21 · courtesy sent Sep 28 by email · nothing since · the attorney’s letter next' }) } })
    expect([quiet.action, quiet.reminder?.step, quiet.reminder?.state]).toEqual(['letter_two', 3, 'two_due'])
    const bare = one({ notices: [notice('j1', 'sent')], letterTwoByJob: { j1: two('due') } })
    expect(bare.reminder).toBeNull()
    expect(groupLienNextUp([bare]).map((g) => g.group)).toEqual(['reminders'])
  })
  it('paying it down (PR 3 of #274): no reminder leads; the row asks what they promised, amber until a promise is on record, under Reminders on step 2', () => {
    const paying = courtesy({ state: 'paying', words: 'paying it down · $4,000 paid Nov 3 · $8,045 still owed', paying: { lastPaidYmd: '2026-11-03', lastAmount: 4000, stillOwed: 8045, until: '2026-11-10', promisedYmd: null, promise: null } })
    const row = one({ notices: [notice('j1', 'sent')], letterTwoByJob: { j1: two('overdue', 'day 21 · the attorney’s letter overdue') }, courtesyByJob: { j1: paying } })
    expect([row.key, row.action, row.button, row.sub, row.severity, row.reminder?.step, row.reminder?.state]).toEqual(['promise:j1', 'promise', 'Record what they promised', paying.words, 'amber', 2, 'paying'])
    expect(groupLienNextUp([row]).map((g) => g.group)).toEqual(['reminders'])
    const promised = one({ notices: [notice('j1', 'sent')], letterTwoByJob: { j1: two('overdue') }, courtesyByJob: { j1: courtesy({ ...paying, paying: { ...paying.paying!, until: '2026-11-20', promisedYmd: '2026-11-20' } }) } })
    expect(promised.severity).toBe('quiet')
    // A role that is neither office nor leader sees the row and no button.
    expect(one({ role: 'technician', notices: [notice('j1', 'sent')], letterTwoByJob: { j1: two('overdue') }, courtesyByJob: { j1: paying } }).button).toBeNull()
  })
})

describe('buildLienNextUp — a notice on record that still owes a month (punch list #353, part 2)', () => {
  const named = { j1: ['2026-04', '2026-06', '2026-07', '2026-08'] }
  it('the To draft row names the owed month beside the months on record, and offers the two ways it may be wrong', () => {
    const r = one({ notices: [notice('j1', 'to_draft', { dueMonths: ['2026-09'] })], noticeMonthsByJob: named })
    expect(r.sub).toBe('September 2026 has no notice. The one on record names April, June, July and August 2026.')
    expect([r.action, r.button]).toEqual(['draft', 'Open the notice'])
    expect(r.doors).toEqual([
      { words: 'The paper named September 2026 too', target: { open: 'notice_record_months', jobId: 'j1', months: ['2026-09'] } },
      { words: 'Change the last day of work…', target: { open: 'lien_window', jobId: 'j1', tab: 'notice', openLastWork: true } },
    ])
  })
  it('with no notice on record, or no months handed in, the row keeps its plain words and no doors', () => {
    expect(one({ notices: [notice('j1', 'to_draft', { dueMonths: ['2026-09'] })], noticeMonthsByJob: {} })).toMatchObject({ sub: 'Notice to send' })
    expect(one({ notices: [notice('j1', 'to_draft', { dueMonths: ['2026-09'] })] }).doors).toBeUndefined()
  })
  it('a viewer with no press gets the words and no doors', () => {
    const r = one({ notices: [notice('j1', 'to_draft', { dueMonths: ['2026-09'] })], noticeMonthsByJob: named, role: 'estimator' })
    expect(r.sub).toContain('has no notice')
    expect(r.button).toBeNull()
    expect(r.doors).toBeUndefined()
  })
})

describe('Needs you now in three parts (v2.7371, punch list #362 step 2)', () => {
  const awaiting = { id: 'i-w', status: 'awaiting_approval', submitted_at: '2026-10-02T15:00:00Z' } as unknown as LienDeskEntry['item']
  const soon = { earliestDeadline: '2026-10-06', daysLeft: 1, severity: 'red' as const }
  const rows = () =>
    build({
      leaderName: () => 'Sam',
      notices: [notice('owner', 'needs_owner', soon), notice('send', 'to_draft', soon), notice('wait', 'awaiting', { ...soon, item: awaiting }), notice('later', 'to_draft', { earliestDeadline: '2026-11-15', daysLeft: 41, severity: 'quiet' })],
      affidavits: [
        affidavit('big', 'ready', { deadline: '2026-10-06', daysLeft: 1, severity: 'red' }),
        affidavit('small', 'ready', { deadline: '2026-10-06', daysLeft: 1, severity: 'red' }),
        affidavit('facts', 'needs_property', { deadline: '2026-10-06', daysLeft: 1, severity: 'red', gates: [{ key: 'homestead_answer', ok: false, label: '' }] }),
      ],
    })
  // The Board's rule, handed in: the stages a paper still has to pass when it will not make its day.
  const risk = (r: LienNextUpRow) => ({ 'notice:owner': 4, 'notice:send': 3, 'affidavit:facts': 4 })[r.key] ?? null
  const amount = (r: LienNextUpRow) => ({ big: 9400, small: 610, owner: 1900, send: 900, facts: 240, later: 700 })[r.jobId ?? ''] ?? null

  it('the rows that will not make their day come first, the longest road first; then the approvals the office waits on; then the rest, on track', () => {
    const groups = groupLienNextUp(rows(), { waitingOn: 'Sam', risk, riskLabel: (n) => `Will not make tomorrow as ${n === 1 ? 'it stands' : 'they stand'}`, amount })
    expect(groups.map((g) => [g.group, g.label, g.rows.map((r) => r.key), g.part ?? false])).toEqual([
      // Four stages each for the owner and the facts; the day and the kind settle it: the affidavit's key sorts first.
      ['risk', 'Will not make tomorrow as they stand', ['affidavit:facts', 'notice:owner', 'notice:send'], true],
      ['waiting', 'Waiting on Sam to approve', ['notice:wait'], true],
      ['now', 'On track', ['affidavit:big', 'affidavit:small'], true],
      ['coming', 'Coming up', ['notice:later'], false],
    ])
    expect(lienNextUpNowHead(groups)).toEqual({ label: 'Needs you now', count: 5, waiting: '1 waiting on Sam to approve' })
  })

  it('inside a day the kinds stay together and the largest comes first; with no money the desk’s own order stands', () => {
    const track = (opts: Parameters<typeof groupLienNextUp>[1]) => groupLienNextUp(rows(), opts).find((g) => g.group === 'now')!.rows.map((r) => r.key)
    expect(track({ risk, amount })).toEqual(['affidavit:big', 'affidavit:small'])
    expect(track({ risk, amount: (r) => (r.jobId === 'small' ? 5000 : r.jobId === 'big' ? 100 : null) })).toEqual(['affidavit:small', 'affidavit:big'])
    expect(track({ risk })).toEqual(['affidavit:big', 'affidavit:small'])
  })

  it('with nothing at risk and nothing waiting the list keeps its one group, and has no head of parts', () => {
    const plain = groupLienNextUp(build({ affidavits: [affidavit('big', 'ready', { deadline: '2026-10-06', daysLeft: 1, severity: 'red' })] }), { risk: () => null })
    expect(plain.map((g) => [g.group, g.label, g.part ?? false])).toEqual([['now', 'Needs you now', false]])
    expect(lienNextUpNowHead(plain)).toBeNull()
  })

  it('a row at risk alone is still a part, under the head, and names itself without the Board’s words when none are given', () => {
    const groups = groupLienNextUp(build({ notices: [notice('owner', 'needs_owner', soon)] }), { risk: () => 4 })
    expect(groups.map((g) => [g.group, g.label, g.part ?? false])).toEqual([['risk', 'Will not make its day as it stands', true]])
    expect(lienNextUpNowHead(groups)).toEqual({ label: 'Needs you now', count: 1, waiting: null })
  })

  it('approvals waiting with nothing else to do stand alone, above what is coming', () => {
    const groups = groupLienNextUp(build({ leaderName: () => 'Sam', notices: [notice('wait', 'awaiting', { item: awaiting }), notice('later', 'to_draft', { earliestDeadline: '2026-11-15', daysLeft: 41, severity: 'quiet' })] }), { waitingOn: 'Sam' })
    expect(groups.map((g) => [g.group, g.part ?? false])).toEqual([['waiting', false], ['coming', false]])
    expect(lienNextUpNowHead(groups)).toBeNull()
  })
})

describe('a row’s one thing to know, once its kind and stage are said beside it (v2.7372, punch list #362 step 3)', () => {
  const gate = (key: 'owner' | 'legal' | 'contractor' | 'notice' | 'homestead' | 'homestead_answer', ok: boolean) => ({ key, ok, label: '' })
  const whole = () => [gate('owner', true), gate('legal', true), gate('contractor', true), gate('notice', true), gate('homestead', true)]

  it('an affidavit held by one fact names it, on the row and on its button; until now every hold read the property record is not complete', () => {
    const r = one({ affidavits: [affidavit('j1', 'needs_property', { gates: [...whole(), gate('homestead_answer', false)] })] })
    expect([r.action, r.button]).toEqual(['fix_property', 'Answer the homestead question'])
    expect(r.sub).toBe('Affidavit · nobody has answered whether this home is a homestead')
    expect(r.detail).toBe('Nobody has answered whether this home is a homestead.')
    const legal = one({ affidavits: [affidavit('j1', 'needs_property', { gates: [gate('owner', true), gate('legal', false)] })] })
    expect([legal.button, legal.detail]).toEqual(['Add the legal description', 'The property record has no county and legal description.'])
    const owner = one({ affidavits: [affidavit('j1', 'needs_property', { gates: [gate('owner', false), gate('legal', true)] })] })
    expect([owner.button, owner.detail]).toEqual(['Find the owner', 'The affidavit needs the owner of record with a mailing address.'])
    // A viewer with no move still reads the fact, and has no button.
    expect(one({ role: 'estimator', affidavits: [affidavit('j1', 'needs_property', { gates: [gate('homestead_answer', false)] })] }).button).toBeNull()
  })

  it('a held affidavit’s row offers the office Not lienable…, the door that takes the one job off the lien path (v2.7526)', () => {
    const door = [{ words: 'Not lienable…', target: { open: 'job_path', jobId: 'j1' } }]
    // A homestead, the fact that started this: the row keeps its own press and gains the quiet door.
    const homestead = one({ affidavits: [affidavit('j1', 'needs_property', { gates: [...whole().slice(0, 4), gate('homestead', false)] })] })
    expect(homestead.button).toBe('Open the property record')
    expect(homestead.doors).toEqual(door)
    // Held by its notice alone, and held for the GC's address: the same door.
    expect(one({ affidavits: [affidavit('j1', 'needs_notice', { gates: [gate('owner', true), gate('legal', true), gate('notice', false)] })] }).doors).toEqual(door)
    expect(one({ affidavits: [affidavit('j1', 'needs_property', { gates: [gate('owner', true), gate('legal', true), gate('contractor', false)] })] }).doors).toEqual(door)
    // The leader is the lien office too. A reader with no move has no door.
    expect(one({ role: 'master_technician', affidavits: [affidavit('j1', 'needs_property', { gates: [gate('homestead', false)] })] }).doors).toEqual(door)
    expect(one({ role: 'estimator', affidavits: [affidavit('j1', 'needs_property', { gates: [gate('homestead', false)] })] }).doors).toBeUndefined()
    // Public property is the property's answer, with its own window: no door on that row. A paper nothing holds has none.
    expect(one({ affidavits: [affidavit('j1', 'needs_property', { gates: [{ key: 'public_owner' as const, ok: false, label: '' }] })] }).doors).toBeUndefined()
    expect(one({ affidavits: [affidavit('j1', 'ready')] }).doors).toBeUndefined()
  })

  it('several facts missing are each named, and the press opens the record', () => {
    expect(lienGateHoldWords(['owner', 'legal'])).toEqual({ sub: 'the affidavit still needs the owner of record and the legal description', detail: 'The affidavit still needs the owner of record and the legal description.', button: 'Fix the property record' })
    expect(lienGateHoldWords(['owner', 'legal', 'homestead_answer']).detail).toBe('The affidavit still needs the owner of record, the legal description and the homestead answer.')
    // A homestead and public property keep the act's own words: neither is a list of facts to fill in.
    expect(lienGateHoldWords(['homestead', 'legal'])).toEqual({ sub: 'the property is marked as a homestead', detail: 'The property is marked as a homestead. A lien there needs a contract signed before the work began.', button: 'Open the property record' })
    expect(lienGateHoldWords([]).detail).toBe('The property record is missing facts the affidavit needs.')
  })

  it('a notice says the months it is for; a paper waiting on approval says when it was sent and how long it has waited', () => {
    const owner = one({ notices: [notice('j1', 'needs_owner', { dueMonths: ['2026-08', '2026-09'] })] })
    expect([owner.sub, owner.detail]).toEqual(['Needs the owner of record', 'August and September 2026'])
    expect(one({ notices: [notice('j1', 'to_draft', { dueMonths: ['2026-09'] })] }).detail).toBe('September 2026')
    const submitted = { id: 'i1', status: 'awaiting_approval', submitted_at: '2026-10-02T15:00:00Z' } as unknown as LienDeskEntry['item']
    const waits = one({ leaderName: () => 'Sam', notices: [notice('j1', 'awaiting', { item: submitted })] })
    expect([waits.sub, waits.detail]).toEqual(['Waiting on Sam · since Oct 2', 'Sent for approval Oct 2 · waiting 3 days'])
    expect(one({ notices: [notice('j1', 'awaiting')] }).detail).toBe('Sent for approval')
    expect(one({ leaderName: () => 'Sam', affidavits: [affidavit('j1', 'awaiting', { item: submitted })] }).detail).toBe('Sent for approval Oct 2 · waiting 3 days')
    expect([lienWaitedWords(0), lienWaitedWords(1), lienWaitedWords(39)]).toEqual(['today', 'waiting 1 day', 'waiting 39 days'])
  })

  it('a stage that says it all leaves nothing more to say, and a row with no stage of its own keeps its words', () => {
    expect(one({ affidavits: [affidavit('j1', 'ready')] }).detail).toBe('')
    expect(one({ affidavits: [affidavit('j1', 'to_draft')] }).detail).toBe('')
    expect(one({ notices: [notice('j1', 'held')] }).detail).toBe('')
    expect(one({ retainage: [retainage('j1', 'to_draft')] }).detail).toBeUndefined()
    expect(one({ retainage: [retainage('j1', 'ready')] }).detail).toBeUndefined()
    // An approved notice stands in Approved · to print (v2.7448): past its bin, the row says the tick it lacks.
    expect(one({ notices: [notice('j1', 'ready')] }).detail).toBe('not printed')
  })
})

describe('an approved affidavit a gate moved to Held (punch list #335)', () => {
  const closed = (key: 'homestead_answer' | 'notice' | 'contractor' | 'public_owner') => [{ key, ok: false, label: key }]
  const approved = { id: 'a1', status: 'approved', fields: {} } as unknown as LienAffidavitEntry['item']
  it('asks the gate’s one question, with its press, and says the approval stands', () => {
    const r = one({ affidavits: [affidavit('j1', 'held', { item: approved, ready: false, gates: closed('homestead_answer') })] })
    const plain = one({ affidavits: [affidavit('j1', 'needs_property', { ready: false, gates: closed('homestead_answer') })] })
    expect(r.action).toBe('fix_property')
    expect(r.button).toBe(plain.button)
    expect(r.sub).toBe(plain.sub.replace(/^Affidavit · /, 'Affidavit approved, held · '))
    expect(r.detail).toBe(`${plain.detail} The approval stands.`)
    expect(r.target).toEqual({ open: 'affidavits', jobId: 'j1' })
  })
  it('a late notice as the one gate left opens the notices; a public owner offers no press', () => {
    const late = one({ affidavits: [affidavit('j1', 'held', { item: approved, ready: false, gates: closed('notice') })] })
    expect(late).toMatchObject({ action: 'send_notice', target: { open: 'notices', jobId: 'j1', pile: 'missed' } })
    expect(late.detail).toBe('Send the § 53.056 notice first. Late is allowed while this window is open. The approval stands.')
    const pub = one({ affidavits: [affidavit('j1', 'held', { item: approved, ready: false, gates: closed('public_owner') })] })
    expect(pub).toMatchObject({ action: 'fix_property', button: null, sub: 'Affidavit approved, held · public property, no lien attaches. Ask the attorney about the bond' })
  })
  it('held by a notice that is already approved, it says where the notice stands and still says the approval stands (v2.7457)', () => {
    const rows = build({ notices: [notice('j1', 'ready')], affidavits: [affidavit('j1', 'held', { item: approved, ready: false, gates: closed('notice') })] })
    const r = rows.find((x) => x.kind === 'affidavit')!
    expect(r.sub).toBe('Affidavit approved, held · its § 53.056 notice is approved and not mailed yet')
    expect(r.detail).toBe('Its § 53.056 notice is approved and not mailed yet. The approval stands.')
    expect(r.action).toBe('send_notice')
    // The press is the notice's own next step, never the Missed pile.
    expect(r.target).not.toEqual({ open: 'notices', jobId: 'j1', pile: 'missed' })
    expect(r.detail).not.toContain('Send the § 53.056 notice first')
  })
  it('a paper the leader holds still reads Affidavit held, his hold to review', () => {
    const r = one({ affidavits: [affidavit('j1', 'held', { item: { id: 'a1', status: 'held', fields: {} } as unknown as LienAffidavitEntry['item'] })] })
    expect(r).toMatchObject({ sub: 'Affidavit held', action: 'review_hold' })
  })
})
