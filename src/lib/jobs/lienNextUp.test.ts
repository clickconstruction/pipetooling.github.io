import { describe, expect, it } from 'vitest'
import type { LienDeskEntry, LienDeskPile } from './lienDesk'
import type { LienAffidavitEntry, LienAffidavitPile } from './lienDeskAffidavits'
import type { LienRetainageEntry, LienRetainagePile } from './lienDeskRetainage'
import type { LetterTwoStatus } from './lienLetterTwo'
import { buildLienNextUp, groupLienNextUp, lienNextUpCount, lienPrintedDaysWords, type LienNextUpInput } from './lienNextUp'

const TODAY = '2026-10-05'

function notice(jobId: string, pile: LienDeskPile, over: Partial<LienDeskEntry> = {}): LienDeskEntry {
  return { jobId, customerId: 'c1', gcCustomerId: 'gc1', openBalance: 1000, hasOwner: true, propertyKind: '', months: [], datedFromCreation: false, dueMonths: ['2026-08'], missedMonths: [], missedUnrecorded: [], earliestDeadline: '2026-10-15', daysLeft: 10, severity: 'amber', item: null, policy: 'ask', pile, ...over }
}
function affidavit(jobId: string, pile: LienAffidavitPile, over: Partial<LienAffidavitEntry> = {}): LienAffidavitEntry {
  return { jobId, isSub: true, lastMonth: '2026-07', lastMonthFromCreation: false, deadline: '2026-11-16', daysLeft: 42, severity: 'quiet', openBalance: 1000, customerId: 'c1', gcCustomerId: 'gc1', propertyKind: '', gates: [], ready: true, item: null, pile, ...over }
}
function retainage(jobId: string, pile: LienRetainagePile, over: Partial<LienRetainageEntry> = {}): LienRetainageEntry {
  return { jobId, retainageHeld: 500, contractEndedOn: '2026-09-20', contractEndedHow: 'complete', deadline: '2026-10-20', daysLeft: 15, severity: 'amber', noticed: false, inClaim: false, openBalance: 1000, customerId: 'c1', gcCustomerId: 'gc1', propertyKind: '', hasOwner: true, paymentBond: 'unknown', gates: [], ready: true, item: null, pile, ...over }
}
const two = (state: LetterTwoStatus['state'], words = ''): LetterTwoStatus => ({ state, day: 12, firstItemId: 'i1', firstSentAt: '2026-09-23T12:00:00Z', letterTwo: null, gcAuthorized: null, words })

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
    expect(r.sub).toBe('Approved · offer 10% by Nov 15 · ready to send')
    expect(one({ notices: [notice('j1', 'ready')] }).sub).toBe('Approved · ready to send')
  })
  it('each pile names its one move and opens the Notices pane on that job and pile', () => {
    const cases: Array<[LienDeskPile, string, string]> = [
      ['needs_owner', 'find_owner', 'Find the owner'],
      ['to_draft', 'draft', 'Draft notice'],
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

  it('ready: a single job sends from its pane; a GC with several is one Send the run row', () => {
    const single = one({ notices: [notice('j1', 'ready')] })
    expect([single.action, single.button]).toEqual(['send', 'Send'])
    expect(single.target).toEqual({ open: 'notices', jobId: 'j1', pile: 'ready' })

    const run = one({ notices: [notice('j1', 'ready', { earliestDeadline: '2026-10-20', daysLeft: 15 }), notice('j2', 'ready', { earliestDeadline: '2026-10-09', daysLeft: 4, severity: 'red' })] })
    expect([run.key, run.action, run.button, run.title, run.sub]).toEqual(['run:gc1', 'send_run', 'Send the run', 'GC gc1', '2 notices approved · ready to send'])
    expect([run.jobId, run.gcId, run.dueOn, run.daysLeft, run.severity, run.group]).toEqual([null, 'gc1', '2026-10-09', 4, 'red', 'now'])
    expect(run.target).toEqual({ open: 'run', gcId: 'gc1' })

    // Two GCs with one each are two single rows, not a run.
    expect(build({ notices: [notice('j1', 'ready'), notice('j2', 'ready', { gcCustomerId: 'gc2' })] }).map((r) => r.action)).toEqual(['send', 'send'])
  })

  it('sent: a row only when letter two is due, with letter two’s own words', () => {
    expect(build({ notices: [notice('j1', 'sent')] })).toEqual([])
    expect(build({ notices: [notice('j1', 'sent')], letterTwoByJob: { j1: two('waiting') } })).toEqual([])
    const due = one({ notices: [notice('j1', 'sent')], letterTwoByJob: { j1: two('due', 'day 12 · letter two due') } })
    expect([due.key, due.action, due.button, due.sub, due.dueOn, due.severity]).toEqual(['letter-two:j1', 'letter_two', 'Send letter two', 'day 12 · letter two due', null, 'amber'])
    expect(due.target).toEqual({ open: 'notices', jobId: 'j1', pile: 'sent' })
    expect(one({ notices: [notice('j1', 'sent')], letterTwoByJob: { j1: two('overdue') } }).group).toBe('now')
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
    expect(act('needs_property')).toEqual([['fix_property', 'Fix the property']])
    expect(act('to_draft')).toEqual([['draft', 'Draft affidavit']])
    expect(act('awaiting')).toEqual([['approve', null]])
    expect(act('awaiting', 'dev')).toEqual([['approve', 'Approve']])
    expect(act('ready')).toEqual([['file_affidavit', 'File the affidavit']])
    expect(act('held')).toEqual([['review_hold', 'Review the hold']])
    expect(act('filed')).toEqual([])
    expect(act('missed')).toEqual([])
    expect(one({ affidavits: [affidavit('j1', 'ready')] }).target).toEqual({ open: 'affidavits', jobId: 'j1' })
  })

  it('a lien filed and not served opens the job’s Lien window on the Mechanic’s lien tab', () => {
    const r = one({ serveDue: [{ jobId: 'j9', serveDue: '2026-10-07' }] })
    expect([r.key, r.kind, r.action, r.button, r.dueOn, r.daysLeft, r.group]).toEqual(['serve:j9', 'affidavit', 'record_service', 'Record service', '2026-10-07', 2, 'now'])
    expect(r.target).toEqual({ open: 'lien_window', jobId: 'j9', tab: 'affidavit' })
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
    expect(groups.map((g) => [g.label, g.rows.length])).toEqual([['Needs you now', 4], ['Coming up', 2]])
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
    expect([n.action, n.button, n.sub, n.dueOn, n.daysLeft]).toEqual(['draft_late', 'Draft it late', 'Late notice to draft · the window closed, the affidavit is still open', '2026-10-15', 10])
    expect(n.target).toEqual({ open: 'notices', jobId: 'j1', pile: 'missed' })
    const a = rows.find((r) => r.kind === 'affidavit')!
    expect([a.action, a.button]).toEqual(['send_notice', 'Send the notice first'])
    expect(a.sub).toContain('late is allowed')
    expect(a.target).toEqual({ open: 'notices', jobId: 'j1', pile: 'missed' })
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
    expect(run.sub).toBe('Mailed? Type each envelope’s number. Not mailing them? Take the run back.')
    expect([run.action, run.button]).toEqual(['record_mailing', 'Record the mailing'])
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
  it('the office: the approvals wait last, under the leader’s name, and leave the count', () => {
    const rows = build({ notices, role: 'assistant', leaderName: (id) => (id === 'j2' || id === 'j3' ? 'Sam' : null) })
    expect(rows.find((r) => r.jobId === 'j2')!.sub).toBe('Waiting on Sam · since Oct 4')
    expect(rows.find((r) => r.jobId === 'j3')!.sub).toBe('Waiting on Sam')
    const groups = groupLienNextUp(rows, { waitingOn: 'Sam' })
    expect(groups.map((g) => [g.group, g.label, g.rows.map((r) => r.jobId)])).toEqual([
      ['now', 'Needs you now', ['j1']],
      ['waiting', 'Waiting on Sam', ['j2', 'j3']],
    ])
    const plain = groupLienNextUp(rows)
    expect(plain[plain.length - 1]!.label).toBe('Waiting on the leader')
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
    expect(officeRow.sub).toBe('Approved · ready to send · unsigned, waits on Robert')
  })
})
