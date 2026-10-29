import { describe, expect, it } from 'vitest'
import type { MemberBid, MemberJob, MemberRequest, Members } from './overview'
import { buildPieceRows, doneFoldWords } from './pieces'
import { buildPlansView } from './plans'

const NOW = Date.parse('2026-10-28T12:00:00Z')

function bid(over: Partial<MemberBid> & { id: string }): MemberBid {
  return {
    bid_number: null, project_name: 'Harlow Ranch', address: null, customer_id: null, estimator_id: null, account_manager_id: null,
    development_id: 'harlow', outcome: null, outcome_at: null, bid_value: null, agreed_value: null, priced_revenue_usd: null,
    bid_date_sent: null, bid_due_date: null, estimated_job_start_date: null, plans_link: null, design_drawing_plan_date: null,
    gc_contact_name: null, gc_contact_phone: null, gc_contact_email: null, created_at: null, updated_at: null,
    working_board_archived_at: null, service_type_id: null, last_contact: null, ...over,
  }
}

function job(over: Partial<MemberJob> & { id: string }): MemberJob {
  return {
    hcp_number: null, click_number: null, job_name: null, job_address: null, customer_id: null, customer_name: null,
    gc_customer_id: null, development_id: 'harlow', bid_id: null, status: 'working', revenue: null, payments_made: null,
    last_work_date: null, last_bill_date: null, job_plans_link: null, created_at: null, updated_at: null, service_type_id: null, ...over,
  }
}

function request(over: Partial<MemberRequest> & { id: string }): MemberRequest {
  return {
    lane: 'estimators', title: 'Which fixture?', status: 'open', priority: null, created_at: '2026-10-20T09:00:00Z', closed_at: null,
    closed_note: null, from_user_id: 'dana', bid_id: null, job_ledger_id: null, development_id: null, reference_summary: null, notes: [], ...over,
  }
}

function plansOf(members: Members) {
  return buildPlansView({ members, bidChanges: [], names: new Map(), bidLabel: (b) => b.id, jobLabel: (j) => j.id })
}

function rowsOf(members: Members, requests: MemberRequest[] = [], customerName: string | null = 'Ridgeway Builders') {
  return buildPieceRows({ members, requests, plans: plansOf(members), customerName, nowMs: NOW })
}

describe('buildPieceRows — one row per piece', () => {
  it('is empty with nothing', () => {
    expect(rowsOf({ bids: [], jobs: [] })).toEqual([])
  })
  it('pairs a bid with the job it became, the job name first; a bid or a job alone takes its own row', () => {
    const members = {
      bids: [bid({ id: 'BP401' }), bid({ id: 'BP402', project_name: '  ' }), bid({ id: 'BP403' })],
      jobs: [job({ id: 'JP1102', bid_id: 'BP401', job_name: 'Lot 4' }), job({ id: 'JP1103', bid_id: 'BP403', job_name: '' }), job({ id: 'JP1104', bid_id: 'BP403', job_name: 'Lot 6' }), job({ id: 'JP1105' })],
    }
    const rows = rowsOf(members)
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.name]))
    expect(byKey).toEqual({ 'bid:BP401:job:JP1102': 'Lot 4', 'bid:BP402': '—', 'bid:BP403:job:JP1103': 'Harlow Ranch', 'bid:BP403:job:JP1104': 'Lot 6', 'job:JP1105': '—' })
    const paired = rows.find((r) => r.key === 'bid:BP401:job:JP1102')
    expect(paired?.bid?.id).toBe('BP401')
    expect(paired?.job?.id).toBe('JP1102')
  })
})

describe('buildPieceRows — the Waiting cell', () => {
  it('reads the oldest open request first, with its lane as who', () => {
    const members = { bids: [bid({ id: 'BP401' })], jobs: [job({ id: 'JP1102', bid_id: 'BP401', status: 'billed', last_bill_date: '2026-10-01' })] }
    const requests = [
      request({ id: 'r1', bid_id: 'BP401', lane: 'dispatch', title: 'Gate code?', created_at: '2026-10-26T12:00:00Z' }),
      request({ id: 'r2', job_ledger_id: 'JP1102', title: 'Which fixture?', created_at: '2026-10-20T09:00:00Z' }),
      request({ id: 'r3', bid_id: 'BP401', title: 'Old one', created_at: '2026-09-01T00:00:00Z', status: 'closed' }),
    ]
    expect(rowsOf(members, requests)[0]?.waiting).toEqual({ kind: 'question', who: 'the estimators', what: 'Which fixture?', ageDays: 8 })
    expect(rowsOf(members, requests.filter((r) => r.id === 'r1'))[0]?.waiting).toEqual({ kind: 'question', who: 'Dispatch', what: 'Gate code?', ageDays: 2 })
  })
  it('then a billed job waits on the customer for payment, then a sent bid on the answer', () => {
    const billed = { bids: [], jobs: [job({ id: 'JP1103', status: 'billed', last_bill_date: '2026-10-01' })] }
    expect(rowsOf(billed)[0]?.waiting).toEqual({ kind: 'payment', who: 'Ridgeway Builders', what: 'payment', ageDays: 27 })
    expect(rowsOf(billed, [], null)[0]?.waiting?.who).toBe('the customer')
    const sent = { bids: [bid({ id: 'BP401', bid_date_sent: '2026-10-25' })], jobs: [] }
    expect(rowsOf(sent)[0]?.waiting).toEqual({ kind: 'answer', who: 'Ridgeway Builders', what: 'answer', ageDays: 3 })
    const won = { bids: [bid({ id: 'BP401', bid_date_sent: '2026-10-25', outcome: 'won' })], jobs: [] }
    expect(rowsOf(won)[0]?.waiting).toBeNull()
    expect(rowsOf({ bids: [bid({ id: 'BP402' })], jobs: [] })[0]?.waiting).toBeNull()
    const both = { bids: [bid({ id: 'BP401', bid_date_sent: '2026-10-25' })], jobs: [job({ id: 'JP1103', bid_id: 'BP401', status: 'billed', last_bill_date: '2026-10-01' })] }
    expect(rowsOf(both)[0]?.waiting?.kind).toBe('payment')
  })
})

describe('buildPieceRows — done, plans and the order', () => {
  it('a lost bid and a paid job are done; a paired row follows its job', () => {
    const members = {
      bids: [bid({ id: 'BP401', outcome: 'lost' }), bid({ id: 'BP402', outcome: 'lost' }), bid({ id: 'BP403', outcome: 'won' })],
      jobs: [job({ id: 'JP1102', bid_id: 'BP402', status: 'working' }), job({ id: 'JP1103', bid_id: 'BP403', status: 'paid' }), job({ id: 'JP1104', status: 'Paid' })],
    }
    const done = Object.fromEntries(rowsOf(members).map((r) => [r.key, r.done]))
    expect(done).toEqual({ 'bid:BP401': true, 'bid:BP402:job:JP1102': false, 'bid:BP403:job:JP1103': true, 'job:JP1104': true })
  })
  it('a paired row carries the job plans when it has them, else the bid plans', () => {
    const members = {
      bids: [bid({ id: 'BP401', plans_link: 'https://p/A', design_drawing_plan_date: '2026-10-20' }), bid({ id: 'BP402', plans_link: 'https://p/A' })],
      jobs: [job({ id: 'JP1102', bid_id: 'BP401', job_plans_link: 'https://p/B', updated_at: '2026-10-01T00:00:00Z' }), job({ id: 'JP1103', bid_id: 'BP402' })],
    }
    const rows = rowsOf(members)
    const a = rows.find((r) => r.key === 'bid:BP401:job:JP1102')?.plans
    const b = rows.find((r) => r.key === 'bid:BP402:job:JP1103')?.plans
    expect([a?.set?.link, a?.older]).toEqual(['https://p/B', true])
    expect([b?.set?.link, b?.older]).toEqual(['https://p/A', false])
  })
  it('waiting rows first with the oldest wait on top, then by what moved last, done rows last', () => {
    const members = {
      bids: [
        bid({ id: 'BP401', bid_date_sent: '2026-10-25', updated_at: '2026-10-26' }),
        bid({ id: 'BP402', updated_at: '2026-10-27' }),
        bid({ id: 'BP403', created_at: '2026-10-20' }),
        bid({ id: 'BP405', outcome: 'lost', outcome_at: '2026-10-28' }),
      ],
      jobs: [job({ id: 'JP1103', status: 'billed', last_bill_date: '2026-10-01', updated_at: '2026-10-02' }), job({ id: 'JP1104', status: 'paid', updated_at: '2026-10-05' })],
    }
    const rows = rowsOf(members)
    expect(rows.map((r) => r.key)).toEqual(['job:JP1103', 'bid:BP401', 'bid:BP402', 'bid:BP403', 'bid:BP405', 'job:JP1104'])
    expect(rows.map((r) => r.activityAt)).toEqual(['2026-10-02', '2026-10-26', '2026-10-27', '2026-10-20', '2026-10-28', '2026-10-05'])
  })
})

describe('doneFoldWords', () => {
  const money = (n: number) => `$${n.toLocaleString('en-US')}`
  it('is empty with nothing done', () => {
    expect(doneFoldWords([])).toBe('')
    expect(doneFoldWords(rowsOf({ bids: [bid({ id: 'BP401' })], jobs: [] }))).toBe('')
  })
  it('counts the paid jobs and the lost bids, one or many', () => {
    const members = {
      bids: [bid({ id: 'BP401', outcome: 'lost' }), bid({ id: 'BP402' })],
      jobs: [job({ id: 'JP1102', status: 'paid', revenue: 5000 }), job({ id: 'JP1103', status: 'paid', revenue: 2500 }), job({ id: 'JP1104', status: 'billed' })],
    }
    expect(doneFoldWords(rowsOf(members))).toBe('2 paid jobs and 1 lost bid')
    expect(doneFoldWords(rowsOf(members), money)).toBe('2 paid jobs · $7,500 all in and 1 lost bid')
    expect(doneFoldWords(rowsOf({ bids: [], jobs: [job({ id: 'JP1102', status: 'paid' })] }), money)).toBe('1 paid job')
    expect(doneFoldWords(rowsOf({ bids: [bid({ id: 'BP401', outcome: 'lost' }), bid({ id: 'BP402', outcome: 'lost' })], jobs: [] }))).toBe('2 lost bids')
  })
})
