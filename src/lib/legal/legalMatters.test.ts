import { describe, expect, it } from 'vitest'
import {
  buildLegalReview,
  feeModelOf,
  heldOverridesOf,
  indexMatters,
  legalRowChip,
  legalStageLabel,
  releaseRecipients,
  stageIsClosed,
  stageIsWithFirm,
  withHoldOverride,
  type LegalMatterRow,
} from './legalMatters'

const matter = (over: Partial<LegalMatterRow>): LegalMatterRow => ({
  id: 'm1',
  payer_key: 'c:tle',
  customer_id: 'tle',
  payer_name: 'The Learning Experience',
  firm_id: null,
  stage: 'review',
  ready_marked_by: null,
  ready_marked_at: null,
  released_at: null,
  handling_name: '',
  note_to_firm: '',
  review_requested_by: null,
  review_requested_at: null,
  review_request_note: '',
  held_overrides: {},
  fees_to_statement: false,
  closed_at: null,
  closed_reason: '',
  updated_at: '2026-09-11T00:00:00Z',
  ...over,
})

describe('stages and chips', () => {
  it('labels every stage and knows which ones a firm can see', () => {
    expect(legalStageLabel('review')).toBe('Under review')
    expect(legalStageLabel('demand')).toBe('With the firm · demand sent')
    expect(stageIsWithFirm('referred')).toBe(true)
    expect(stageIsWithFirm('written_down')).toBe(false)
    expect(stageIsClosed('settled')).toBe(true)
  })
  it('the row wears no chip while simply under review, a blue one when a dev was asked, the ⚖ once released', () => {
    expect(legalRowChip(null)).toBeNull()
    expect(legalRowChip(matter({}))).toBeNull()
    expect(legalRowChip(matter({ review_requested_at: '2026-09-10T00:00:00Z' }))).toEqual({ label: '⚖ review requested', tone: 'blue' })
    expect(legalRowChip(matter({ stage: 'suit' }))).toEqual({ label: '⚖ suit filed', tone: 'legal' })
    expect(legalRowChip(matter({ stage: 'written_down' }))).toEqual({ label: '⚖ Written down', tone: 'neutral' })
  })
})

describe('held overrides', () => {
  it('reads only boolean overrides and stores only the ones that differ from the default', () => {
    expect(heldOverridesOf(matter({ held_overrides: { 'contact:1': true, 'contact:2': 'no', 'call:3': false } }))).toEqual({ 'contact:1': true, 'call:3': false })
    expect(heldOverridesOf(matter({ held_overrides: null }))).toEqual({})
    let o: Record<string, boolean> = {}
    o = withHoldOverride(o, 'contact:1', true, false) // hold an entry that would go
    expect(o).toEqual({ 'contact:1': true })
    o = withHoldOverride(o, 'contact:1', false, false) // back to default → override removed
    expect(o).toEqual({})
    o = withHoldOverride(o, 'contact:0', false, true) // share a pre-bill entry
    expect(o).toEqual({ 'contact:0': false })
  })
})

describe('feeModelOf / indexMatters / releaseRecipients', () => {
  const firm = { id: 'f1', name: 'Example Law Firm, PLLC', handling_name: 'A. Attorney', email: 'attorney@example.test', phone: '', contingency_pct: 30, filing_cost: 400, active: true }
  it('turns the firm row into the packet fee model, defaulting when absent', () => {
    expect(feeModelOf(firm)).toEqual({ contingencyPct: 0.3, filingCost: 400 })
    expect(feeModelOf(null)).toEqual({ contingencyPct: 0.33, filingCost: 350 })
  })
  it('indexes matters by payer key and by job', () => {
    const idx = indexMatters([matter({}), matter({ id: 'm2', payer_key: 'n:bryan' })], [{ matter_id: 'm1', job_id: 'j1' }, { matter_id: 'm1', job_id: 'j2' }, { matter_id: 'zzz', job_id: 'j9' }])
    expect(idx.byPayerKey.get('n:bryan')?.id).toBe('m2')
    expect(idx.byJobId.get('j2')?.id).toBe('m1')
    expect(idx.jobIdsByMatter.get('m1')).toEqual(['j1', 'j2'])
    expect(idx.byJobId.has('j9')).toBe(false)
  })
  it('names the handling person as the one who always hears', () => {
    expect(releaseRecipients(firm, '')).toEqual([{ name: 'A. Attorney', email: 'attorney@example.test', why: 'handling — always hears' }])
    expect(releaseRecipients(firm, 'J. Paralegal')[0]?.name).toBe('J. Paralegal')
    expect(releaseRecipients({ ...firm, email: '' }, '')).toEqual([])
  })
})

describe('buildLegalReview', () => {
  const accounts = [
    { key: 'c:tle', name: 'The Learning Experience', reviewDays: 69, balance: 15781 },
    { key: 'c:sam', name: 'Sam Coyle', reviewDays: 69, balance: 5355 },
    { key: 'n:bryan herber', name: 'Bryan Herber', reviewDays: 21, balance: 1239 },
    { key: 'c:hill', name: 'Hilltop', reviewDays: 30, balance: 6200 },
  ]
  it('counts accounts under review, lists requested ones first, and opens on the request', () => {
    const matters = [
      matter({ payer_key: 'c:hill', stage: 'referred' }),
      matter({ id: 'm2', payer_key: 'c:sam', review_requested_by: 'u-t', review_requested_at: '2026-09-09T10:00:00Z', review_request_note: 'Ready for your eyes.' }),
    ]
    const r = buildLegalReview(accounts, matters, '2026-09-11', (id) => (id === 'u-t' ? 'Taunya' : null))
    expect(r.underReview).toBe(3)
    expect(r.withFirm).toBe(1)
    expect(r.requested).toEqual([{ key: 'c:sam', name: 'Sam Coyle', by: 'Taunya', note: 'Ready for your eyes.', days: 2 }])
    expect(r.oldestDays).toBe(69)
    expect(r.firstKey).toBe('c:sam')
    expect(r.balanceUnderReview).toBe(15781 + 5355 + 1239)
  })
  it('with no request, opens on the oldest; closed matters drop out', () => {
    const r = buildLegalReview(accounts, [matter({ payer_key: 'n:bryan herber', stage: 'written_down' })], '2026-09-11')
    expect(r.underReview).toBe(3)
    expect(r.firstKey).toBe('c:tle')
  })
})
