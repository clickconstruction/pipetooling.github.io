import { describe, expect, it } from 'vitest'
import { COUNT_CARD_CAP, buildAtAddressCard, buildCountCard, type CountCardInputs } from './countCards'
import type { MemberBid, MemberJob, MemberRequest } from './overview'

const NOW = Date.parse('2026-10-29T12:00:00Z')
const STAGES: Record<string, string> = { waiting: 'Waiting', working: 'Working', ready_to_bill: 'Ready to Bill', billed: 'Billed Awaiting Payment', paid: 'Paid' }

function bid(over: Partial<MemberBid> & { id: string }): MemberBid {
  return { bid_number: over.id.replace(/^b/, ''), project_name: null, address: null, customer_id: null, estimator_id: null, account_manager_id: null, development_id: 'harlow', outcome: null, outcome_at: null, bid_value: null, agreed_value: null, priced_revenue_usd: null, bid_date_sent: null, bid_due_date: null, estimated_job_start_date: null, plans_link: null, design_drawing_plan_date: null, gc_contact_name: null, gc_contact_phone: null, gc_contact_email: null, created_at: null, updated_at: null, working_board_archived_at: null, service_type_id: null, last_contact: null, ...over }
}
function job(over: Partial<MemberJob> & { id: string }): MemberJob {
  return { hcp_number: over.id.replace(/^j/, ''), click_number: null, job_name: null, job_address: null, customer_id: null, customer_name: null, gc_customer_id: null, development_id: 'harlow', bid_id: null, status: null, revenue: null, payments_made: null, last_work_date: null, last_bill_date: null, job_plans_link: null, created_at: null, updated_at: null, service_type_id: null, ...over }
}
function request(over: Partial<MemberRequest> & { id: string }): MemberRequest {
  return { lane: 'estimators', title: 'Which plans?', status: 'open', priority: null, created_at: '2026-10-26T12:00:00Z', closed_at: null, closed_note: null, from_user_id: 'u-dana', bid_id: null, job_ledger_id: null, reference_summary: null, notes: [], ...over }
}
function inputs(over: Partial<CountCardInputs> = {}): CountCardInputs {
  return {
    members: { bids: [], jobs: [] },
    atAddress: { bids: [], jobs: [] },
    requests: [],
    names: new Map([['u-dana', 'Dana'], ['u-mel', 'Mel'], ['u-luis', 'Luis']]),
    teamMembers: [],
    bidLabel: (b) => `BP${b.bid_number}`,
    jobLabel: (j) => `JP${j.hcp_number}`,
    stageLabel: (s) => STAGES[(s ?? '').toLowerCase()] ?? '—',
    money: (n) => `$${n.toLocaleString('en-US')}`,
    shortDay: (s) => (s ?? '').slice(0, 10),
    nowMs: NOW,
    siteName: 'Harlow Ranch',
    ...over,
  }
}

const sentBid = bid({ id: 'b401', project_name: 'Phase 2 water', bid_date_sent: '2026-10-24', bid_value: 42000, estimator_id: 'u-dana' })
const workingBid = bid({ id: 'b402', project_name: 'Lift station', estimator_id: 'u-luis', priced_revenue_usd: 48000 })
const wonBid = bid({ id: 'b403', project_name: 'Clubhouse', outcome: 'won', outcome_at: '2026-10-25T15:00:00Z', agreed_value: 61000, bid_value: 59000 })
const archivedBid = bid({ id: 'b404', project_name: 'Sign', working_board_archived_at: '2026-09-30T10:00:00Z' })
const lostBid = bid({ id: 'b405', project_name: 'Pool house', outcome: 'lost', outcome_at: '2026-10-10T15:00:00Z', bid_value: 9000 })
const billedJob = job({ id: 'j1101', job_name: 'Lot 3', status: 'billed', revenue: 5000, payments_made: 3000 })
const workingJob = job({ id: 'j1102', job_name: 'Lot 7', status: 'working', last_work_date: '2026-10-27', revenue: 12000, payments_made: 2000, pct_complete: 50 })
const olderWorkingJob = job({ id: 'j1103', job_name: 'Lot 9', status: 'working', last_work_date: '2026-10-20', revenue: 9000 })
const paidJob = job({ id: 'j1104', job_name: 'Lot 1', status: 'paid', revenue: 8000, payments_made: 8000 })
const waitingJob = job({ id: 'j1105', job_name: 'Lot 2', status: 'waiting', revenue: 4000 })
const manyJobs = (n: number, status: string) => Array.from({ length: n }, (_, i) => job({ id: `j${status}${i}`, status, revenue: 100 }))

describe('buildCountCard waiting — the three kinds a site waits on', () => {
  it('open questions oldest first, each with its lane, its age and its asker, then the bids out and the bills unpaid', () => {
    const card = buildCountCard('waiting', inputs({
      members: { bids: [sentBid, workingBid], jobs: [billedJob, workingJob] },
      requests: [
        request({ id: 'r2', created_at: '2026-10-28T12:00:00Z', lane: 'dispatch', job_ledger_id: 'j1102', title: 'Crew for Friday', from_user_id: 'u-mel' }),
        request({ id: 'r1', created_at: '2026-10-26T12:00:00Z', bid_id: 'b401', title: ' Which plans? ' }),
        request({ id: 'r3', created_at: '2026-10-29T06:00:00Z', title: 'Gate code', from_user_id: 'u-ghost' }),
        request({ id: 'r0', created_at: '2026-10-01T00:00:00Z', closed_at: '2026-10-02T00:00:00Z' }),
      ],
    }))
    expect(card.head).toBe('3 questions waiting')
    expect(card.headMeta).toBe('oldest first')
    expect(card.groups.map((g) => [g.label, g.state, g.rows.length])).toEqual([['Questions', '3 open', 3], ['Answers from the customer', '1 bid out', 1], ['Payments', '1 bill unpaid', 1]])
    expect(card.groups[0]!.rows.map((r) => [r.key, r.number, r.name, r.meta])).toEqual([
      ['request:r1', 'BP401', 'Which plans?', 'the estimators · 3 days · Dana'],
      ['request:r2', 'JP1102', 'Crew for Friday', 'Dispatch · 1 day · Mel'],
      ['request:r3', 'Harlow Ranch', 'Gate code', 'the estimators · today · someone'],
    ])
    expect(card.groups[0]!.rows.map((r) => r.door)).toEqual([{ kind: 'bid', id: 'b401' }, { kind: 'job', id: 'j1102' }, { kind: 'questions' }])
    expect(card.groups[1]!.rows[0]).toMatchObject({ key: 'bid:b401', number: 'BP401', name: 'Phase 2 water', value: '$42,000', meta: 'sent, 5 days', door: { kind: 'bid', id: 'b401' } })
    expect(card.groups[2]!.rows[0]).toMatchObject({ key: 'job:j1101', number: 'JP1101', name: 'Lot 3', value: '$2,000 open', meta: '$5,000 billed · $3,000 paid' })
    expect(card.more).toBe(0)
    expect(card.folded).toBeNull()
    expect(card.foot).toEqual({ door: 'questions', label: 'Go to Questions ›', note: 'answered in the inbox, kept here' })
  })

  it('none open and nothing out: the two presses that start a question, and each kind says its state', () => {
    const card = buildCountCard('waiting', inputs())
    expect(card.head).toBe('Nothing waiting')
    expect(card.headMeta).toBe('what a site waits on')
    expect(card.groups.map((g) => [g.label, g.state, g.rows.length])).toEqual([['Questions', 'none open', 2], ['Answers from the customer', 'no bid is out', 0], ['Payments', 'nothing billed is unpaid', 0]])
    expect(card.groups[0]!.rows).toEqual([
      { key: 'kind:estimators', door: null, number: 'To the estimators', name: 'a bid, its plans, its price', value: null, meta: null, press: { label: 'Ask the estimators', action: 'askEstimators' } },
      { key: 'kind:dispatch', door: null, number: 'To Dispatch', name: 'a crew, a day on site', value: null, meta: null, press: { label: 'Ask Dispatch', action: 'askDispatch' } },
    ])
    expect(card.empty).toBeNull()
  })

  it('none open with a bid out or a bill unpaid: nothing waits on us', () => {
    expect(buildCountCard('waiting', inputs({ members: { bids: [sentBid], jobs: [] } })).head).toBe('Nothing waiting on us')
    expect(buildCountCard('waiting', inputs({ members: { bids: [], jobs: [billedJob] } })).groups[2]!.state).toBe('1 bill unpaid')
  })
})

describe('buildCountCard bids — by status in the board’s order', () => {
  it('groups in order with their counts, drops an empty status, and each row says where it stands', () => {
    const card = buildCountCard('bids', inputs({ members: { bids: [wonBid, archivedBid, workingBid, sentBid], jobs: [] } }))
    expect(card.head).toBe('4 bids on Harlow Ranch')
    expect(card.headMeta).toBe('by status · 3 undecided')
    expect(card.groups.map((g) => g.label)).toEqual(['Sent · 1', 'Working · 1', 'Archived · 1', 'Won · 1'])
    expect(card.groups[0]!.rows[0]).toMatchObject({ number: 'BP401', value: '$42,000', meta: 'sent 2026-10-24 · Dana' })
    expect(card.groups[1]!.rows[0]).toMatchObject({ number: 'BP402', value: '$48,000', meta: 'Luis' })
    expect(card.groups[2]!.rows[0]).toMatchObject({ number: 'BP404', value: 'no price yet', meta: 'archived 2026-09-30' })
    expect(card.groups[3]!.rows[0]).toMatchObject({ number: 'BP403', value: '$61,000', meta: 'won 2026-10-25' })
    expect(card.foot).toEqual({ door: 'bids', label: 'Open on the Bid Board ›', note: null })
    expect(buildCountCard('bids', inputs({ members: { bids: [wonBid, lostBid], jobs: [] } })).headMeta).toBe('by status')
  })

  it('with none in the development: the ones at the address and the one press that puts them in', () => {
    const none = buildCountCard('bids', inputs())
    expect(none.head).toBe('No bid in Harlow Ranch')
    expect(none.headMeta).toBeNull()
    expect(none.groups.map((g) => [g.label, g.state, g.rows.length])).toEqual([['In Harlow Ranch', 'none yet', 0], ['At this address, not in it', 'none', 0]])
    const two = buildCountCard('bids', inputs({ atAddress: { bids: [sentBid, workingBid], jobs: [] } }))
    expect(two.groups.map((g) => [g.label, g.state, g.rows.length])).toEqual([['In Harlow Ranch', 'none yet', 0], ['At this address, not in it', '2 bids', 2], ['One press', 'soon', 1]])
    expect(two.groups[2]!.rows[0]).toEqual({ key: 'kind:putin', door: null, number: 'Put the 2 in', name: 'Harlow Ranch', value: null, meta: null, press: { label: 'Put the 2 in Harlow Ranch', action: 'putIn' } })
  })
})

describe('buildCountCard jobs — by stage, the paid ones folded', () => {
  it('stages in the Pipeline’s order, newest work first, crew and last work on the row, paid as one line', () => {
    const card = buildCountCard('jobs', inputs({
      members: { bids: [], jobs: [billedJob, olderWorkingJob, paidJob, workingJob, waitingJob] },
      teamMembers: [{ job_id: 'j1102', user_id: 'u-mel' }, { job_id: 'j1102', user_id: 'u-luis' }, { job_id: 'j1102', user_id: 'u-mel' }, { job_id: 'j1103', user_id: 'u-nobody' }],
    }))
    expect(card.head).toBe('5 jobs on Harlow Ranch')
    expect(card.headMeta).toBe('by stage')
    expect(card.groups.map((g) => [g.label, g.rows.map((r) => r.number)])).toEqual([['Working · 2', ['JP1102', 'JP1103']], ['Waiting · 1', ['JP1105']], ['Billed Awaiting Payment · 1', ['JP1101']]])
    expect(card.groups[0]!.rows[0]).toMatchObject({ door: { kind: 'job', id: 'j1102' }, name: 'Lot 7', value: '$12,000', meta: 'Mel, +1 · last work 2026-10-27' })
    expect(card.groups[0]!.rows[1]!.meta).toBe('last work 2026-10-20')
    expect(card.groups[1]!.rows[0]!.meta).toBe('not scheduled')
    expect(card.groups[2]!.rows[0]).toMatchObject({ value: '$2,000 open', meta: null })
    expect(card.folded).toBe('1 paid job, $8,000 all in · folded in Pieces')
    expect(card.foot).toEqual({ door: 'jobs', label: 'Open on the Pipeline ›', note: null })
    expect(buildCountCard('jobs', inputs({ members: { bids: [], jobs: [workingJob] } })).folded).toBeNull()
  })

  it('with none in the development: the ones at the address and the press', () => {
    const card = buildCountCard('jobs', inputs({ atAddress: { bids: [], jobs: [workingJob] } }))
    expect(card.head).toBe('No job in Harlow Ranch')
    expect(card.groups.map((g) => [g.label, g.state])).toEqual([['In Harlow Ranch', 'none yet'], ['At this address, not in it', '1 job'], ['One press', 'soon']])
    expect(card.groups[2]!.rows[0]!.press).toEqual({ label: 'Put the 1 in Harlow Ranch', action: 'putIn' })
    expect(buildCountCard('jobs', inputs()).groups.map((g) => g.state)).toEqual(['none yet', 'none'])
  })

  it('caps the rows at eight across the groups and counts the rest as more', () => {
    const one = buildCountCard('jobs', inputs({ members: { bids: [], jobs: [...manyJobs(10, 'working'), ...manyJobs(3, 'billed')] } }))
    expect(COUNT_CARD_CAP).toBe(8)
    expect(one.groups.map((g) => [g.label, g.rows.length])).toEqual([['Working · 10', 8]])
    expect(one.more).toBe(5)
    const split = buildCountCard('jobs', inputs({ members: { bids: [], jobs: [...manyJobs(6, 'working'), ...manyJobs(5, 'waiting')] } }))
    expect(split.groups.map((g) => [g.label, g.rows.length])).toEqual([['Working · 6', 6], ['Waiting · 5', 2]])
    expect(split.more).toBe(3)
  })
})

describe('buildCountCard bidUndecided — the bids still in play, biggest first', () => {
  it('adds up the priced ones, says which were not counted, and dates each', () => {
    const today = bid({ id: 'b406', project_name: 'Gate', bid_date_sent: '2026-10-29', bid_value: 1000 })
    const card = buildCountCard('bidUndecided', inputs({ members: { bids: [sentBid, wonBid, archivedBid, workingBid, today], jobs: [] } }))
    expect(card.head).toBe('$91,000 bid, undecided')
    expect(card.headMeta).toBe('4 bids')
    expect(card.groups.map((g) => g.label)).toEqual(['Undecided · 4'])
    expect(card.groups[0]!.rows.map((r) => [r.number, r.value, r.meta])).toEqual([
      ['BP402', '$48,000', 'working'],
      ['BP401', '$42,000', 'sent, 5 days'],
      ['BP406', '$1,000', 'sent, today'],
      ['BP404', 'no price yet', 'archived 2026-09-30 · not counted'],
    ])
    expect(card.foot).toEqual({ door: 'bids', label: 'Bid Board ›', note: 'the 3 with a price add up to the figure' })
    expect(buildCountCard('bidUndecided', inputs({ members: { bids: [sentBid, workingBid], jobs: [] } })).foot.note).toBe('they add up to the figure')
  })

  it('every bid decided: the won and the lost, each a group; no bid at all says so', () => {
    const card = buildCountCard('bidUndecided', inputs({ members: { bids: [wonBid, lostBid], jobs: [] } }))
    expect(card.head).toBe('Every bid is decided')
    expect(card.headMeta).toBe('2 bids')
    expect(card.groups.map((g) => [g.label, g.state, g.rows.length])).toEqual([['Undecided', 'none', 0], ['Won', '1 bid', 1], ['Lost', '1 bid', 1]])
    expect(card.groups[2]!.rows[0]).toMatchObject({ number: 'BP405', value: '$9,000', meta: 'lost 2026-10-10' })
    const none = buildCountCard('bidUndecided', inputs())
    expect(none.head).toBe('No bid in Harlow Ranch')
    expect(none.headMeta).toBeNull()
    expect(none.groups.map((g) => g.state)).toEqual(['none', 'none', 'none'])
  })
})

describe('buildCountCard openOnBills — what is billed and not paid', () => {
  it('the open jobs biggest first, each saying billed and paid', () => {
    const bigger = job({ id: 'j1106', job_name: 'Lot 12', status: 'billed', revenue: 9000, payments_made: 4000 })
    const settled = job({ id: 'j1107', status: 'billed', revenue: 3000, payments_made: 3000 })
    const card = buildCountCard('openOnBills', inputs({ members: { bids: [], jobs: [billedJob, workingJob, bigger, settled] } }))
    expect(card.head).toBe('$7,000 open on bills')
    expect(card.headMeta).toBe('2 jobs')
    expect(card.groups.map((g) => [g.label, g.rows.map((r) => r.number)])).toEqual([['Billed, not yet paid · 2', ['JP1106', 'JP1101']]])
    expect(card.groups[0]!.rows[0]).toMatchObject({ value: '$5,000 open', meta: '$9,000 billed · $4,000 paid' })
    expect(card.foot).toEqual({ door: 'gcReview', label: 'GC Review ›', note: 'the statement and Find a check' })
  })

  it('nothing open: what is nearest a bill, the working ones with what is done and not billed', () => {
    const ready = job({ id: 'j1108', job_name: 'Lot 4', status: 'ready_to_bill', revenue: 6000 })
    const over = job({ id: 'j1109', status: 'working', revenue: 1000, pct_complete: 150 })
    const under = job({ id: 'j1110', status: 'working', revenue: 1000, payments_made: 900, pct_complete: 10 })
    const card = buildCountCard('openOnBills', inputs({ members: { bids: [], jobs: [paidJob, ready, workingJob, olderWorkingJob, over, under] } }))
    expect(card.head).toBe('Nothing billed is unpaid')
    expect(card.headMeta).toBe('what is nearest a bill')
    expect(card.groups.map((g) => [g.label, g.state, g.rows.length])).toEqual([['Billed, not yet paid', 'none', 0], ['Ready to bill', '1 job', 1], ['Working, toward a bill', '4 jobs', 4]])
    expect(card.groups[1]!.rows[0]).toMatchObject({ number: 'JP1108', value: '$6,000' })
    expect(card.groups[2]!.rows.map((r) => r.value)).toEqual(['$4,000 done, not billed', 'no percent yet', '$1,000 done, not billed', '$0 done, not billed'])
    expect(buildCountCard('openOnBills', inputs()).groups.map((g) => g.state)).toEqual(['none', 'none', 'none'])
  })
})

describe('buildAtAddressCard — the pieces at the address that are not in it', () => {
  it('jobs by stage with the paid folded, the foot the page’s own door', () => {
    const inp = inputs({ atAddress: { bids: [], jobs: [workingJob, paidJob, billedJob] } })
    const card = buildAtAddressCard('jobs', inp, '400 Harlow Ranch Rd', false)
    expect(card.head).toBe('3 jobs at 📍 400 Harlow Ranch Rd')
    expect(card.headMeta).toBe('not in Harlow Ranch · by stage')
    expect(card.groups.map((g) => g.label)).toEqual(['Working · 1', 'Billed Awaiting Payment · 1'])
    expect(card.folded).toBe('1 paid job, $8,000 all in')
    expect(card.foot).toEqual({ door: 'pieces', label: 'Show all 3 in Pieces ›', note: 'drawn there as not in Harlow Ranch' })
    expect(buildAtAddressCard('jobs', inp, '400 Harlow Ranch Rd', true).foot.label).toBe('See them in Pieces ›')
    expect(buildAtAddressCard('jobs', inputs(), null, false).head).toBe('0 jobs at 📍 this address')
  })
  it('bids by status, nothing folded', () => {
    const card = buildAtAddressCard('bids', inputs({ atAddress: { bids: [wonBid, sentBid], jobs: [] } }), null, true)
    expect(card.head).toBe('2 bids at 📍 this address')
    expect(card.headMeta).toBe('not in Harlow Ranch · by status')
    expect(card.groups.map((g) => g.label)).toEqual(['Sent · 1', 'Won · 1'])
    expect(card.folded).toBeNull()
    expect(card.foot.label).toBe('See them in Pieces ›')
  })
})
