import { describe, expect, it } from 'vitest'
import { holdLines, holdWords, LEGAL_BLOCKED_WORDS, mergedToastWords, mergeMovedTotal, parseMergePlan, ruleWords, sameJobWords } from './customerMergePlan'

describe('holdWords', () => {
  it('says each reference in words, one and many', () => {
    expect(holdWords('jobs_ledger.customer_id', 1)).toBe('1 job')
    expect(holdWords('jobs_ledger.gc_customer_id', 3)).toBe('3 jobs they are the GC on')
    expect(holdWords('customer_addresses.customer_id', 2)).toBe('2 properties')
    expect(holdWords('public_page_views.entity_id', 1)).toBe('1 portal visit')
    expect(holdWords('dispatch_requests.pending_payload', 2)).toBe('2 open dispatch requests')
  })

  it('names a table the app has no words for by its own name, so nothing counted is hidden', () => {
    expect(holdWords('merge_bed_later.customer_id', 1)).toBe('1 row in merge bed later')
    expect(holdWords('some_new_table.customer_id', 4)).toBe('4 rows in some new table')
  })
})

describe('holdLines', () => {
  it('lists the largest first, and leaves out what holds nothing', () => {
    expect(holdLines({ 'bids.customer_id': 2, 'file_index.customer_id': 9, 'estimates.customer_id': 0, 'jobs_ledger.customer_id': 2 }).map((l) => l.words)).toEqual([
      '9 files in the file index',
      '2 bids',
      '2 jobs',
    ])
  })

  it('shows a legal matter once, though two columns name it', () => {
    expect(holdLines({ 'legal_matters.customer_id': 1, 'legal_matters.payer_key': 1 })).toEqual([{ key: 'legal_matters.customer_id', count: 1, words: '1 legal matter' }])
    expect(holdLines({ 'legal_matters.payer_key': 2, 'legal_matters.customer_id': 1 }).map((l) => l.words)).toEqual(['2 legal matters'])
  })

  it('reads counts the database sends as text, and drops what is not a count', () => {
    expect(holdLines({ 'bids.customer_id': '3', 'jobs_ledger.customer_id': 'x', 'projects.customer_id': -1 }).map((l) => l.words)).toEqual(['3 bids'])
  })
})

describe('ruleWords', () => {
  it('says what each rule does, naming the portal address that stops working', () => {
    expect(ruleWords('portal_address', 1, 'kept-builders')).toBe('Their portal address kept-builders stops working. This customer’s stays.')
    expect(ruleWords('portal_address', 1, null)).toBe('Their portal address stops working. This customer’s stays.')
    expect(ruleWords('portal_link', 2, null)).toBe('2 of their portal links are turned off and kept. This customer’s stay live.')
    expect(ruleWords('week_mark', 1, null)).toBe('Both have a statement mark for one week. The older mark is dropped.')
    expect(ruleWords('property', 1, null)).toBe('One of their properties is one this customer has. It folds into this customer’s.')
  })

  it('still says something for a rule the app does not know', () => {
    expect(ruleWords('new_rule', 2, null)).toBe('2 new rule rows are settled by a rule.')
  })
})

describe('parseMergePlan', () => {
  const preview = {
    victim_counts: { bids: 1, jobs_ledger: 2, estimates: 0, projects: 0, customer_contacts: 0, customer_contact_persons: 0 },
    stripe_blocked: false,
    holds: { 'jobs_ledger.customer_id': 2, 'customer_portal_slugs.customer_id': 1, 'legal_matters.customer_id': 1, 'legal_matters.payer_key': 1 },
    left_behind: { property: 1, portal_address: 1, bid_gc_line: 2 },
    portal_address_lost: 'kept-builders-llc',
    same_job: 2,
    legal_blocked: false,
  }

  it('reads the holds, the rules in the order they are told, and the warnings', () => {
    const plan = parseMergePlan(preview)
    expect(plan?.holds.map((l) => l.words)).toEqual(['2 jobs', '1 legal matter', '1 portal address'])
    expect(plan?.rules.map((r) => r.what)).toEqual(['portal_address', 'bid_gc_line', 'property'])
    expect(plan?.rules[0]?.words).toBe('Their portal address kept-builders-llc stops working. This customer’s stays.')
    expect(plan?.sameJob).toBe(2)
    expect(plan?.legalBlocked).toBe(false)
  })

  it('reads a legal block', () => {
    expect(parseMergePlan({ ...preview, legal_blocked: true })?.legalBlocked).toBe(true)
  })

  it('is null for an answer from before the plan, so the window shows the six counts as before', () => {
    expect(parseMergePlan({ victim_counts: preview.victim_counts, stripe_blocked: false })).toBeNull()
    expect(parseMergePlan(null)).toBeNull()
    expect(parseMergePlan('x')).toBeNull()
  })

  it('reads a plan with nothing left behind', () => {
    expect(parseMergePlan({ holds: {}, left_behind: {}, same_job: 0, legal_blocked: false })).toEqual({ holds: [], rules: [], sameJob: 0, legalBlocked: false })
  })
})

describe('the words around a merge', () => {
  it('says the jobs that name both, and nothing when there are none', () => {
    expect(sameJobWords(0)).toBeNull()
    expect(sameJobWords(1)).toBe('One job names one of them as the customer and the other as the GC. After the merge it names the GC only and bills the GC.')
    expect(sameJobWords(3)).toMatch(/^3 jobs name one of them/)
  })

  it('says why two legal matters stop the merge, and what to do', () => {
    expect(LEGAL_BLOCKED_WORDS).toContain('Ask a dev')
  })

  it('counts what a merge moved, and says it after', () => {
    expect(mergeMovedTotal({ moved: { 'bids.customer_id': 2, 'jobs_ledger.customer_id': 3 } })).toBe(5)
    expect(mergeMovedTotal({ survivor_id: 'a' })).toBe(0)
    expect(mergedToastWords({ moved: { 'bids.customer_id': 1 } })).toBe('Customers merged. 1 linked record moved over.')
    expect(mergedToastWords({ moved: { 'bids.customer_id': 2, 'file_index.customer_id': 40 } })).toBe('Customers merged. 42 linked records moved over.')
    expect(mergedToastWords(null)).toBe('Customers merged')
  })
})
