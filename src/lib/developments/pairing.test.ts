import { describe, expect, it } from 'vitest'
import type { MemberBid, MemberJob } from './overview'
import { nameTokens, siteDropWords, suggestPairs, suggestionConfidence, suggestionWhy, type PairSuggestion } from './pairing'

function bid(over: Partial<MemberBid> & { id: string }): MemberBid {
  return {
    bid_number: over.id, project_name: null, address: null, customer_id: null, estimator_id: null, account_manager_id: null, development_id: 'harlow',
    outcome: null, outcome_at: null, bid_value: null, agreed_value: null, priced_revenue_usd: null, bid_date_sent: null, bid_due_date: null,
    estimated_job_start_date: null, plans_link: null, design_drawing_plan_date: null, gc_contact_name: null, gc_contact_phone: null, gc_contact_email: null,
    created_at: null, updated_at: null, working_board_archived_at: null, service_type_id: null, last_contact: null, ...over,
  }
}

function job(over: Partial<MemberJob> & { id: string }): MemberJob {
  return {
    hcp_number: null, click_number: over.id, job_name: null, job_address: null, customer_id: null, customer_name: null, gc_customer_id: null,
    development_id: 'harlow', bid_id: null, status: null, revenue: null, payments_made: null, last_work_date: null, last_bill_date: null,
    job_plans_link: null, created_at: null, updated_at: null, service_type_id: null, ...over,
  }
}

const harlow = siteDropWords({ developmentName: 'Harlow Ranch', address: '400 Harlow Ranch Rd, Lott, TX 76656', customerName: 'Ridgeway Builders LLC' })
const none = new Set<string>()

describe('siteDropWords', () => {
  it('holds the development, the normalized street words and the customer, with each plural also singular', () => {
    for (const w of ['harlow', 'ranch', '400', 'road', 'lott', 'tx', 'ridgeway', 'builders', 'builder', 'llc']) expect(harlow.has(w), w).toBe(true)
    expect(harlow.has('rd')).toBe(false)
    expect(harlow.has('76656')).toBe(false)
  })

  it('singularizes only a word over four letters, and is empty with nothing to drop', () => {
    const cedars = siteDropWords({ developmentName: 'Cedars Crossing at the Oaks', address: null, customerName: null })
    expect([...cedars].sort()).toEqual(['at', 'cedar', 'cedars', 'crossing', 'oaks', 'the'])
    expect(siteDropWords({ developmentName: null, address: null, customerName: null }).size).toBe(0)
  })
})

describe('nameTokens', () => {
  it('keeps the telling words: lowercase, no punctuation, stop words and the site words gone, plurals trimmed', () => {
    expect(nameTokens('Harlow Ranch — Bldg 12 Exhaust Fans & Fixtures', harlow)).toEqual(['12', 'exhaust', 'fans', 'fixture'])
    expect(nameTokens('The new water heater install for Ridgeway Builders', harlow)).toEqual(['water', 'heater'])
  })

  it('drops a word under three letters unless it is a number, and says each word once', () => {
    expect(nameTokens('AC in Rm 7', none)).toEqual(['7'])
    expect(nameTokens('Pumps pump PUMPS', none)).toEqual(['pump'])
  })

  it('is empty for no name', () => {
    expect(nameTokens(null, none)).toEqual([])
    expect(nameTokens('', none)).toEqual([])
    expect(nameTokens('the and of', none)).toEqual([])
  })
})

describe('suggestPairs', () => {
  it('is empty with nothing to pair', () => {
    expect(suggestPairs({ bids: [], jobs: [], drop: harlow })).toEqual([])
    expect(suggestPairs({ bids: [bid({ id: 'BP401', project_name: 'Exhaust fans' })], jobs: [], drop: harlow })).toEqual([])
  })

  it('pairs by the words the names share, and says the bid came first when its send day is on or before the job', () => {
    const out = suggestPairs({
      bids: [bid({ id: 'BP401', project_name: 'Harlow Ranch Bldg 12 Exhaust Fans', bid_date_sent: '2026-03-02' })],
      jobs: [job({ id: 'JP1102', job_name: 'Bldg 12 exhaust fans rough-in', created_at: '2026-04-15T14:00:00Z' })],
      drop: harlow,
    })
    expect(out).toEqual([{ bidId: 'BP401', jobId: 'JP1102', shared: ['12', 'exhaust', 'fans'], sameValue: false, bidFirst: true, score: 31 }])
  })

  it('suggests nothing for names with no word in common and no matching value', () => {
    expect(suggestPairs({ bids: [bid({ id: 'BP402', project_name: 'Pool heater' })], jobs: [job({ id: 'JP1103', job_name: 'Gas line to the shop' })], drop: harlow })).toEqual([])
  })

  it('the same value to the dollar is enough on its own; a job with no revenue never matches by value', () => {
    const out = suggestPairs({
      bids: [bid({ id: 'BP403', project_name: 'Pool heater', bid_value: 12_500.4, created_at: '2026-05-01T00:00:00Z' })],
      jobs: [job({ id: 'JP1104', job_name: 'Gas line', revenue: 12_500, created_at: '2026-04-01T00:00:00Z' })],
      drop: harlow,
    })
    expect(out).toEqual([{ bidId: 'BP403', jobId: 'JP1104', shared: [], sameValue: true, bidFirst: false, score: 25 }])
    expect(suggestPairs({ bids: [bid({ id: 'BP404', bid_value: 0 })], jobs: [job({ id: 'JP1105', revenue: 0 }), job({ id: 'JP1106', revenue: null })], drop: none })).toEqual([])
  })

  it('reads the agreed value before the bid value', () => {
    const bids = [bid({ id: 'BP404', agreed_value: 7_000, bid_value: 9_000 })]
    expect(suggestPairs({ bids, jobs: [job({ id: 'JP1105', revenue: 9_000 })], drop: none })).toEqual([])
    expect(suggestPairs({ bids, jobs: [job({ id: 'JP1105', revenue: 7_000 })], drop: none })[0]?.sameValue).toBe(true)
  })

  it('bid first: the send day, else the created day; the same day counts; no dates do not', () => {
    const first = (b: Partial<MemberBid>, j: Partial<MemberJob>) =>
      suggestPairs({ bids: [bid({ id: 'BP401', project_name: 'exhaust fans', ...b })], jobs: [job({ id: 'JP1102', job_name: 'exhaust fans', ...j })], drop: none })[0]?.bidFirst
    expect(first({ bid_date_sent: '2026-04-15', created_at: '2026-01-01' }, { created_at: '2026-04-15T23:00:00Z' })).toBe(true)
    expect(first({ bid_date_sent: null, created_at: '2026-04-16T00:00:00Z' }, { created_at: '2026-04-15T23:00:00Z' })).toBe(false)
    expect(first({ bid_date_sent: null, created_at: '2026-04-01T00:00:00Z' }, { created_at: '2026-04-15T23:00:00Z' })).toBe(true)
    expect(first({}, { created_at: '2026-04-15T23:00:00Z' })).toBe(false)
    expect(first({ bid_date_sent: '2026-04-01' }, {})).toBe(false)
  })

  it('keeps the best pair per job and per bid, strongest first', () => {
    const out = suggestPairs({
      bids: [bid({ id: 'BP405', project_name: 'Bldg 12 plumbing stub' }), bid({ id: 'BP401', project_name: 'Bldg 12 exhaust fans' })],
      jobs: [job({ id: 'JP1105', job_name: 'Bldg 12 plumbing' }), job({ id: 'JP1102', job_name: 'Bldg 12 exhaust fans' })],
      drop: harlow,
    })
    expect(out.map((s) => [s.bidId, s.jobId, s.score])).toEqual([['BP401', 'JP1102', 30], ['BP405', 'JP1105', 20]])
  })

  it('on a tie the lower bid number takes the job and the other bid waits', () => {
    const out = suggestPairs({
      bids: [bid({ id: 'BP402', project_name: 'Exhaust fans' }), bid({ id: 'BP401', project_name: 'Exhaust fans' })],
      jobs: [job({ id: 'JP1102', job_name: 'exhaust fans' })],
      drop: none,
    })
    expect(out.map((s) => s.bidId)).toEqual(['BP401'])
  })
})

describe('suggestionConfidence and suggestionWhy', () => {
  const s = (over: Partial<PairSuggestion>): PairSuggestion => ({ bidId: 'BP401', jobId: 'JP1102', shared: [], sameValue: false, bidFirst: false, score: 0, ...over })

  it('is likely with the same value or two shared words, else maybe', () => {
    expect(suggestionConfidence(s({ sameValue: true }))).toBe('likely')
    expect(suggestionConfidence(s({ shared: ['exhaust', 'fans'] }))).toBe('likely')
    expect(suggestionConfidence(s({ shared: ['exhaust'], bidFirst: true }))).toBe('maybe')
  })

  it('says why, one reason after another', () => {
    expect(suggestionWhy(s({ shared: ['exhaust', 'fans'], sameValue: true, bidFirst: true }))).toBe('shares exhaust, fans · same value · bid first')
    expect(suggestionWhy(s({ shared: ['12'] }))).toBe('shares 12')
    expect(suggestionWhy(s({ sameValue: true }))).toBe('same value')
    expect(suggestionWhy(s({}))).toBe('')
  })
})
