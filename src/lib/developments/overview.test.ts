import { describe, expect, it } from 'vitest'
import {
  addressSearchPattern,
  bidMoney,
  bidStatusWord,
  bidUndecided,
  headCounts,
  jobOpen,
  jobOpenOnBill,
  memberAddressKeys,
  pulseWords,
  requestIsOpen,
  sharedAddressWords,
  stateUppercased,
  sitePeople,
  splitMembers,
  type MemberBid,
  type MemberJob,
  type MemberRequest,
} from './overview'

const NOW = Date.parse('2026-10-28T12:00:00Z')

function bid(over: Partial<MemberBid> & { id: string }): MemberBid {
  return {
    bid_number: null, project_name: null, address: null, customer_id: null, estimator_id: null, account_manager_id: null,
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

describe('requestIsOpen', () => {
  it('is open with no closed stamp and no closed word', () => {
    expect(requestIsOpen({ status: 'open', closed_at: null })).toBe(true)
    expect(requestIsOpen({ status: '', closed_at: null })).toBe(true)
    expect(requestIsOpen({ status: 'open', closed_at: '2026-10-21T00:00:00Z' })).toBe(false)
    for (const s of ['closed', 'Done', 'RESOLVED']) expect(requestIsOpen({ status: s, closed_at: null })).toBe(false)
  })
})

describe('bidStatusWord, bidUndecided, bidMoney', () => {
  it('reads an outcome first, then sent, then archived, else working', () => {
    expect(bidStatusWord({ outcome: 'Won', bid_date_sent: '2026-10-01', working_board_archived_at: null })).toBe('won')
    expect(bidStatusWord({ outcome: 'started_or_complete', bid_date_sent: null, working_board_archived_at: null })).toBe('won')
    expect(bidStatusWord({ outcome: 'lost', bid_date_sent: '2026-10-01', working_board_archived_at: '2026-10-02' })).toBe('lost')
    expect(bidStatusWord({ outcome: null, bid_date_sent: '2026-10-01', working_board_archived_at: '2026-10-02' })).toBe('sent')
    expect(bidStatusWord({ outcome: null, bid_date_sent: null, working_board_archived_at: '2026-10-02' })).toBe('archived')
    expect(bidStatusWord({ outcome: null, bid_date_sent: null, working_board_archived_at: null })).toBe('working')
  })
  it('is undecided until won or lost, archived included', () => {
    expect(bidUndecided({ outcome: null })).toBe(true)
    expect(bidUndecided({ outcome: 'won' })).toBe(false)
    expect(bidUndecided({ outcome: 'lost' })).toBe(false)
    expect(bidUndecided(bid({ id: 'BP401', working_board_archived_at: '2026-10-02' }))).toBe(true)
  })
  it('shows the agreed value once won, else the bid value, else the priced revenue', () => {
    expect(bidMoney({ outcome: 'won', agreed_value: 9000, bid_value: 8500, priced_revenue_usd: 8000 })).toBe(9000)
    expect(bidMoney({ outcome: 'won', agreed_value: null, bid_value: 8500, priced_revenue_usd: 8000 })).toBe(8500)
    expect(bidMoney({ outcome: null, agreed_value: 9000, bid_value: 8500, priced_revenue_usd: 8000 })).toBe(8500)
    expect(bidMoney({ outcome: null, agreed_value: null, bid_value: null, priced_revenue_usd: 8000 })).toBe(8000)
    expect(bidMoney({ outcome: null, agreed_value: null, bid_value: null, priced_revenue_usd: null })).toBeNull()
  })
})

describe('jobOpen and jobOpenOnBill', () => {
  it('a job is open until paid; only a billed job has money open on its bill', () => {
    expect(jobOpen({ status: 'Paid' })).toBe(false)
    expect(jobOpen({ status: 'billed' })).toBe(true)
    expect(jobOpen({ status: null })).toBe(true)
    expect(jobOpenOnBill({ status: 'Billed', revenue: 5000, payments_made: 2000 })).toBe(3000)
    expect(jobOpenOnBill({ status: 'billed', revenue: 5000, payments_made: 6000 })).toBe(0)
    expect(jobOpenOnBill({ status: 'billed', revenue: null, payments_made: null })).toBe(0)
    expect(jobOpenOnBill({ status: 'working', revenue: 5000, payments_made: 0 })).toBe(0)
  })
})

describe('the site address', () => {
  const members = {
    bids: [bid({ id: 'b1', address: 'Gun Dog Trl, Neeses SC' }), bid({ id: 'b2', address: 'Gun Dog Trail, Neeses, SC' }), bid({ id: 'b3', address: '' })],
    jobs: [job({ id: 'j1', job_address: 'Gun Dog Trail, Neeses, SC' }), job({ id: 'j2', job_address: '12925 FM 20, Kingsbury, Texas 78638' })],
  }
  it('memberAddressKeys normalizes and dedupes', () => {
    expect([...memberAddressKeys(members)]).toEqual(['gun dog trail neeses sc', '12925 fm 20 kingsbury texas'])
    expect(memberAddressKeys({ bids: [], jobs: [] }).size).toBe(0)
  })
  it('sharedAddressWords prints the most common spelling of the most common key', () => {
    expect(sharedAddressWords(members)).toBe('Gun Dog Trail, Neeses, SC')
    expect(sharedAddressWords({ bids: [], jobs: [] })).toBeNull()
    expect(sharedAddressWords({ bids: [bid({ id: 'b', address: '  ' })], jobs: [] })).toBeNull()
  })

  it('sharedAddressWords prints the state in capitals however the rows typed it', () => {
    const typed = { bids: [], jobs: [job({ id: 'j1', job_address: 'Gun Dog Trail, Neeses, Sc' }), job({ id: 'j2', job_address: 'Gun Dog Trail, Neeses, Sc' })] }
    expect(sharedAddressWords(typed)).toBe('Gun Dog Trail, Neeses, SC')
    expect(stateUppercased('Gun Dog Trail, Neeses, sc 29107')).toBe('Gun Dog Trail, Neeses, SC 29107')
    expect(stateUppercased('5501 Balcones Dr, Austin, TX')).toBe('5501 Balcones Dr, Austin, TX')
    expect(stateUppercased('12921 FM 20, Kingsbury')).toBe('12921 FM 20, Kingsbury')
    expect(stateUppercased('Gun Dog Trail')).toBe('Gun Dog Trail')
  })
  it('addressSearchPattern keeps the words before the first street suffix, at most three', () => {
    expect(addressSearchPattern('gun dog trail neeses sc')).toBe('%gun%dog%')
    expect(addressSearchPattern('12925 fm 20 kingsbury texas')).toBe('%12925%fm%20%')
    expect(addressSearchPattern('road')).toBe('%road%')
    expect(addressSearchPattern('')).toBe('')
  })
  it('splitMembers keeps the members and the exact-key matches not in it', () => {
    const other = bid({ id: 'b9', development_id: 'ridgeway', address: 'gun dog trail neeses sc' })
    const elsewhere = job({ id: 'j9', development_id: null, job_address: '1 Main St' })
    const { inIt, atAddress } = splitMembers({ developmentId: 'harlow', bids: [...members.bids, other], jobs: [...members.jobs, elsewhere] })
    expect(inIt.bids.map((b) => b.id)).toEqual(['b1', 'b2', 'b3'])
    expect(inIt.jobs.map((j) => j.id)).toEqual(['j1', 'j2'])
    expect(atAddress.bids.map((b) => b.id)).toEqual(['b9'])
    expect(atAddress.jobs).toEqual([])
  })
})

describe('headCounts', () => {
  it('is all zeros with nothing', () => {
    expect(headCounts({ bids: [], jobs: [] }, [], NOW)).toEqual({
      waiting: { count: 0, oldestAgeDays: null }, bids: { total: 0, undecided: 0, sent: 0, archived: 0 },
      jobs: { total: 0, open: 0, working: 0 }, bidUndecidedUsd: 0, openOnBillsUsd: 0,
    })
  })
  it('counts the waiting one first, then the bids and the jobs', () => {
    const members = {
      bids: [
        bid({ id: 'BP401', bid_date_sent: '2026-10-25', bid_value: 12000 }),
        bid({ id: 'BP402', outcome: 'won', agreed_value: 9000, bid_value: 8000 }),
        bid({ id: 'BP403', outcome: 'lost', bid_value: 7000 }),
        bid({ id: 'BP404', working_board_archived_at: '2026-09-01', priced_revenue_usd: 500 }),
      ],
      jobs: [
        job({ id: 'JP1102', status: 'working' }),
        job({ id: 'JP1103', status: 'billed', revenue: 5000, payments_made: 1500 }),
        job({ id: 'JP1104', status: 'paid', revenue: 4000, payments_made: 4000 }),
      ],
    }
    const requests = [
      request({ id: 'r1', created_at: '2026-10-20T09:00:00Z' }),
      request({ id: 'r2', created_at: '2026-10-26T12:00:00Z' }),
      request({ id: 'r3', created_at: '2026-09-01T00:00:00Z', closed_at: '2026-09-02T00:00:00Z' }),
    ]
    expect(headCounts(members, requests, NOW)).toEqual({
      waiting: { count: 2, oldestAgeDays: 8 }, bids: { total: 4, undecided: 2, sent: 1, archived: 1 },
      jobs: { total: 3, open: 2, working: 1 }, bidUndecidedUsd: 12500, openOnBillsUsd: 3500,
    })
  })
})

describe('sitePeople', () => {
  const names = new Map([['dana', 'Dana'], ['mel', 'Mel'], ['luis', 'Luis']])
  const jobLabel = (j: MemberJob) => j.job_name ?? j.id
  it('is empty with no members', () => {
    expect(sitePeople({ members: { bids: [], jobs: [] }, names, teamMembers: [], jobLabel })).toEqual({ gcContact: null, estimating: [], onSite: null })
  })
  it('takes the GC contact from the newest bid that names one, estimators newest first, the crew of the working job', () => {
    const members = {
      bids: [
        bid({ id: 'b1', created_at: '2026-09-01', estimator_id: 'mel', gc_contact_name: 'Pat Ridgeway', gc_contact_phone: ' 555-0100 ', gc_contact_email: '' }),
        bid({ id: 'b2', created_at: '2026-10-01', estimator_id: 'dana', gc_contact_name: 'R' }),
        bid({ id: 'b3', created_at: '2026-10-15', estimator_id: 'dana' }),
      ],
      jobs: [
        job({ id: 'JP1101', job_name: 'Lot 3', status: 'working', last_work_date: '2026-10-10' }),
        job({ id: 'JP1102', job_name: 'Lot 4', status: 'working', last_work_date: '2026-10-27' }),
        job({ id: 'JP1103', job_name: 'Lot 5', status: 'billed', last_work_date: '2026-10-28' }),
      ],
    }
    const teamMembers = [
      { job_id: 'JP1102', user_id: 'luis' }, { job_id: 'JP1101', user_id: 'mel' }, { job_id: 'JP1101', user_id: 'luis' }, { job_id: 'JP1103', user_id: 'dana' },
    ]
    expect(sitePeople({ members, names, teamMembers, jobLabel })).toEqual({
      gcContact: { name: 'Pat Ridgeway', phone: '555-0100', email: null },
      estimating: ['Dana', 'Mel'],
      onSite: { names: ['Luis', 'Mel'], jobLabel: 'Lot 4', since: '2026-10-27' },
    })
  })
})

describe('pulseWords', () => {
  it('names the record, then what waits, then new plans', () => {
    expect(pulseWords({ name: 'BP401', openQuestions: 0, oldestAgeDays: null, newestPlansShort: null })).toEqual(['BP401'])
    expect(pulseWords({ name: 'BP401', openQuestions: 1, oldestAgeDays: 0, newestPlansShort: null })).toEqual(['BP401', '1 question waiting'])
    expect(pulseWords({ name: 'BP401', openQuestions: 1, oldestAgeDays: 1, newestPlansShort: null })).toEqual(['BP401', '1 question waiting · 1 day'])
    expect(pulseWords({ name: 'JP1102', openQuestions: 3, oldestAgeDays: 8, newestPlansShort: 'Oct 20' })).toEqual(['JP1102', '3 questions waiting · 8 days', 'new plans Oct 20'])
  })
})
