import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { MemberBid, MemberJob, Members } from './overview'
import { buildPlansView, olderOrNoneLine, planCellFor, plansNeedWords, type PlansLinkChange, type PlansView } from './plans'

function bid(over: Partial<MemberBid> & { id: string }): MemberBid {
  return {
    bid_number: over.id, project_name: null, address: null, customer_id: null, estimator_id: null, account_manager_id: null,
    development_id: 'harlow', outcome: null, outcome_at: null, bid_value: null, agreed_value: null, priced_revenue_usd: null,
    bid_date_sent: null, bid_due_date: null, estimated_job_start_date: null, plans_link: null, design_drawing_plan_date: null,
    gc_contact_name: null, gc_contact_phone: null, gc_contact_email: null, created_at: null, updated_at: null,
    working_board_archived_at: null, service_type_id: null, last_contact: null, ...over,
  }
}

function job(over: Partial<MemberJob> & { id: string }): MemberJob {
  return {
    hcp_number: null, click_number: null, job_name: over.id, job_address: null, customer_id: null, customer_name: null,
    gc_customer_id: null, development_id: 'harlow', bid_id: null, status: 'working', revenue: null, payments_made: null,
    last_work_date: null, last_bill_date: null, job_plans_link: null, created_at: null, updated_at: null, service_type_id: null, ...over,
  }
}

const names = new Map([['dana', 'Dana'], ['mel', 'Mel']])
function view(members: Members, bidChanges: PlansLinkChange[] = []): PlansView {
  return buildPlansView({ members, bidChanges, names, bidLabel: (b) => b.bid_number ?? b.id, jobLabel: (j) => j.job_name ?? j.id })
}

const site: Members = {
  bids: [
    bid({ id: 'BP401', plans_link: 'https://p/A', design_drawing_plan_date: '2026-10-20' }),
    bid({ id: 'BP402', plans_link: ' https://p/A ', design_drawing_plan_date: '2026-10-01' }),
    bid({ id: 'BP403' }),
  ],
  jobs: [
    job({ id: 'JP1102', job_plans_link: 'https://p/A', updated_at: '2026-10-25T00:00:00Z' }),
    job({ id: 'JP1103', job_plans_link: 'https://p/B', updated_at: '2026-10-26T00:00:00Z' }),
    job({ id: 'JP1104', job_plans_link: '  ' }),
  ],
}
const changes: PlansLinkChange[] = [
  { bid_id: 'BP401', changed_at: '2026-10-05T00:00:00Z', changed_by: 'dana', changed: ['plans_link'] },
  { bid_id: 'BP402', changed_at: '2026-10-07T00:00:00Z', changed_by: 'mel', changed: ['notes', 'plans_link'] },
  { bid_id: 'BP402', changed_at: '2026-10-09T00:00:00Z', changed_by: 'mel', changed: ['notes'] },
]

describe('buildPlansView', () => {
  it('is empty with no members', () => {
    expect(view({ bids: [], jobs: [] })).toEqual({ sets: [], newest: null, none: [], olderOrNone: [] })
  })
  it('one link is one set: dated by the newest plan date, filed by the newest plans_link change, jobs join it', () => {
    const v = view(site, changes)
    expect(v.sets.map((s) => s.key)).toEqual(['https://p/A', 'https://p/B'])
    const [a, b] = v.sets
    expect(a).toEqual({
      key: 'https://p/A', link: 'https://p/A', dated: '2026-10-20', filedAt: '2026-10-07T00:00:00Z', filedBy: 'Mel',
      carriers: [{ kind: 'bid', id: 'BP401', label: 'BP401' }, { kind: 'bid', id: 'BP402', label: 'BP402' }, { kind: 'job', id: 'JP1102', label: 'JP1102' }],
    })
    expect(b).toEqual({ key: 'https://p/B', link: 'https://p/B', dated: null, filedAt: '2026-10-26T00:00:00Z', filedBy: null, carriers: [{ kind: 'job', id: 'JP1103', label: 'JP1103' }] })
    expect(v.newest).toBe(a)
    expect(v.none.map((c) => c.id)).toEqual(['BP403', 'JP1104'])
    expect(v.olderOrNone.map((c) => c.id)).toEqual(['BP403', 'JP1104', 'JP1103'])
  })
  it('a set with no name for its filer, and a job update that does not overwrite a bid filing', () => {
    const v = view(site, [{ bid_id: 'BP401', changed_at: '2026-10-05T00:00:00Z', changed_by: 'nobody', changed: ['plans_link'] }])
    expect([v.sets[0]?.filedAt, v.sets[0]?.filedBy]).toEqual(['2026-10-05T00:00:00Z', null])
  })
  it('orders dated sets by date, then undated by the day filed', () => {
    const v = view({
      bids: [bid({ id: 'BP401', plans_link: 'C', design_drawing_plan_date: '2026-10-01' }), bid({ id: 'BP402', plans_link: 'D', design_drawing_plan_date: '2026-10-15' })],
      jobs: [job({ id: 'JP1102', job_plans_link: 'E', updated_at: '2026-10-27' }), job({ id: 'JP1103', job_plans_link: 'F', updated_at: '2026-10-10' }), job({ id: 'JP1104', job_plans_link: 'G' })],
    })
    expect(v.sets.map((s) => s.key)).toEqual(['D', 'C', 'E', 'F', 'G'])
    expect(v.none).toEqual([])
    expect(v.olderOrNone.map((c) => c.id)).toEqual(['BP401', 'JP1102', 'JP1103', 'JP1104'])
  })
})

describe('planCellFor', () => {
  const v = view(site, changes)
  it('finds the set a record carries and whether it is older than the newest', () => {
    expect(planCellFor(v, 'bid', 'BP401')).toEqual({ set: v.sets[0], older: false })
    expect(planCellFor(v, 'job', 'JP1103')).toEqual({ set: v.sets[1], older: true })
    expect(planCellFor(v, 'bid', 'BP403')).toEqual({ set: null, older: false })
    expect(planCellFor(v, 'job', 'BP401')).toEqual({ set: null, older: false })
  })
})

describe('plansNeedWords and olderOrNoneLine', () => {
  const stub = (older: number, none: number, newest: boolean): PlansView => {
    const c = (i: number) => ({ kind: 'bid' as const, id: `b${i}`, label: `b${i}` })
    const noneList = Array.from({ length: none }, (_, i) => c(i))
    const olderList = Array.from({ length: older }, (_, i) => c(100 + i))
    const set: PlansView['sets'][number] = { key: 'A', link: 'A', dated: '2026-10-20', filedAt: null, filedBy: null, carriers: [c(900)] }
    return { sets: newest ? [set] : [], newest: newest ? set : null, none: noneList, olderOrNone: [...noneList, ...olderList] }
  }
  it('plansNeedWords: null when every piece is on the newest, else the count and what it lacks', () => {
    expect(plansNeedWords(stub(0, 0, true))).toBeNull()
    expect(plansNeedWords(stub(0, 3, true))).toBe('3 without plans')
    expect(plansNeedWords(stub(2, 0, true))).toBe('2 not on the newest')
    expect(plansNeedWords(stub(2, 1, true))).toBe('3 not on the newest')
  })
  it('olderOrNoneLine: a lead and a sentence with its subject, by what the pieces lack', () => {
    expect(olderOrNoneLine(stub(0, 0, true), 'Oct 20')).toBeNull()
    expect(olderOrNoneLine(stub(0, 2, false), null)).toEqual({ lead: '2 without plans', sentence: '2 pieces have no plans filed. No set is filed on this site.' })
    expect(olderOrNoneLine(stub(0, 1, true), 'Oct 20')).toEqual({ lead: '1 without plans', sentence: 'One piece has no plans filed. The newest set is Oct 20.' })
    expect(olderOrNoneLine(stub(3, 0, true), 'Oct 20')).toEqual({ lead: '3 on an older set', sentence: '3 pieces are on an older set than Oct 20.' })
    expect(olderOrNoneLine(stub(1, 0, true), 'the one filed Oct 28')).toEqual({ lead: '1 on an older set', sentence: 'One piece is on an older set than the one filed Oct 28.' })
    expect(olderOrNoneLine(stub(2, 1, true), 'Oct 20')).toEqual({ lead: '3 not on the newest', sentence: '2 pieces are on an older set than Oct 20, and one has no plans filed.' })
    expect(olderOrNoneLine(stub(1, 2, true), 'Oct 20')?.sentence).toBe('One piece is on an older set than Oct 20, and 2 have no plans filed.')
  })
  it('every sentence keeps to plain words', () => {
    const lines = [olderOrNoneLine(stub(0, 2, false), null), olderOrNoneLine(stub(0, 1, true), 'Oct 20'), olderOrNoneLine(stub(3, 0, true), 'Oct 20'), olderOrNoneLine(stub(2, 1, true), 'Oct 20')]
    for (const line of lines) expect(plainWordsFailures(line?.sentence ?? '')).toEqual([])
  })
})
