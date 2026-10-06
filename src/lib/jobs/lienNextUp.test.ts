import { describe, expect, it } from 'vitest'
import type { LienDeskEntry, LienDeskPile } from './lienDesk'
import type { LienAffidavitEntry, LienAffidavitPile } from './lienDeskAffidavits'
import type { LienRetainageEntry, LienRetainagePile } from './lienDeskRetainage'
import type { LetterTwoStatus } from './lienLetterTwo'
import { buildLienNextUp, groupLienNextUp, type LienNextUpInput } from './lienNextUp'

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
  it('an approved notice with a pay offer (v2.4708) says so in its words', () => {
    const item = { id: 'i-offer', status: 'approved', offer_pct: 10, offer_by: '2026-11-15' } as unknown as LienDeskEntry['item']
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
