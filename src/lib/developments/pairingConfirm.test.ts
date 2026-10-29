import { describe, expect, it } from 'vitest'
import type { MemberBid, MemberJob } from './overview'
import type { PairSuggestion } from './pairing'
import { PAIRING_PREVIEW_CAP, bidSide, jobSide, markWonConfirm, markedWonBack, pairAllConfirm, pairConfirm, pairedAllBack, pairedWords, unpairConfirm, unpairedWords } from './pairingConfirm'

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

const labels = { bidLabel: (b: MemberBid) => `BP${b.bid_number}`, jobLabel: (j: MemberJob) => `JP${j.click_number}` }
const lot12 = bid({ id: '161', project_name: 'Lot 12 Lodge', bid_value: 12000, bid_date_sent: '2026-09-01' })
const lot12Job = job({ id: '956', job_name: 'Lot 12 Lodge', status: 'working', revenue: 12000, customer_name: 'Ridgeway Builders', job_address: '400 Harlow Ranch Rd' })
const likely: PairSuggestion = { bidId: '161', jobId: '956', shared: ['lot', '12'], sameValue: true, bidFirst: true, score: 46 }
const changed = (rows: { label: string; changes: boolean }[]) => rows.filter((r) => r.changes).map((r) => r.label)

describe('bidSide and jobSide — a Pieces row as words', () => {
  it('reads the number, the name, the status and the money', () => {
    expect(bidSide(lot12, labels)).toBe('BP161 Lot 12 Lodge · sent · $12,000')
    expect(jobSide(lot12Job, labels)).toBe('JP956 Lot 12 Lodge · Working · $12,000')
  })
  it('says no price yet, a dash for no stage and $0 when the figures are missing, and leaves a blank name out', () => {
    expect(bidSide(bid({ id: '9' }), labels)).toBe('BP9 · working · no price yet')
    expect(jobSide(job({ id: '8' }), labels)).toBe('JP8 · — · $0')
  })
})

describe('pairConfirm — one pair', () => {
  it('names the act, marks the two links that change, shows the rest as same and the row as it will read', () => {
    const w = pairConfirm({ bid: lot12, job: lot12Job, bidJobs: [], suggestion: likely, customerName: null, developmentName: 'Harlow Ranch', labels })
    expect(w.title).toBe('Pair BP161 with JP956?')
    expect(w.confirmLabel).toBe('Pair BP161 with JP956')
    expect(w.rows.map((r) => [r.label, r.before, r.after])).toEqual([
      ['JP956 came from', 'no bid', 'BP161 Lot 12 Lodge'],
      ['BP161 became', 'no job yet', 'JP956'],
      ['Bid status', 'sent · $12,000', null],
      ['Job stage', 'Working · $12,000', null],
      ['Customer', 'Ridgeway Builders', null],
      ['Development', 'Harlow Ranch', null],
    ])
    expect(changed(w.rows)).toEqual(['JP956 came from', 'BP161 became'])
    expect(w.previewCaption).toBe('As the row will read in Pieces')
    expect(w.previewLines).toEqual(['BP161 Lot 12 Lodge · sent · $12,000 ↔ JP956 Lot 12 Lodge · Working · $12,000', 'likely match · shares lot, 12 · same value · bid first'])
    expect(w.previewMore).toBe(0)
  })
  it('a second job joins the first in the became row, a picked pair carries no why line, and the site customer stands in for a job with none', () => {
    const first = job({ id: '900', job_name: 'Lot 12 pad' })
    const w = pairConfirm({ bid: lot12, job: job({ id: '956' }), bidJobs: [first], suggestion: null, customerName: 'Ridgeway Builders', developmentName: 'Harlow Ranch', labels })
    expect(w.rows[1]).toEqual({ label: 'BP161 became', before: 'JP900', after: 'JP900, JP956', changes: true })
    expect(w.rows[4]?.before).toBe('Ridgeway Builders')
    expect(w.previewLines).toHaveLength(1)
  })
  it('the toast names the pair and its way back', () => {
    expect(pairedWords(lot12, lot12Job, labels)).toEqual({ line: 'Paired BP161 with JP956.', back: 'Unpair', undone: 'Unpaired BP161 from JP956 again.' })
  })
})

describe('pairAllConfirm — the strip\'s counted press', () => {
  const pairs = Array.from({ length: 10 }, (_, i) => ({
    bid: bid({ id: `b${i}`, project_name: `Lot ${i}` }),
    job: job({ id: `j${i}`, job_name: `Lot ${i}` }),
    suggestion: { bidId: `b${i}`, jobId: `j${i}`, shared: ['lot', String(i)], sameValue: false, bidFirst: false, score: 20 } as PairSuggestion,
  }))
  it('counts the pairs on record and the gaps before and after, lists the pairs with why, caps the list and counts its button', () => {
    const w = pairAllConfirm({ pairs, pairedNow: 3, unpairedBids: 12, unpairedJobs: 30, developmentName: 'Harlow Ranch', labels })
    expect(w.title).toBe('Pair the 10 likely pairs?')
    expect(w.confirmLabel).toBe('Pair the 10')
    expect(w.rows.map((r) => [r.label, r.before, r.after, r.changes])).toEqual([
      ['Pairs on record', '3', '13', true],
      ['Bids with no job', '12', '2', true],
      ['Jobs with no bid', '30', '20', true],
      ['Development', 'Harlow Ranch', null, false],
    ])
    expect(w.previewLines).toHaveLength(PAIRING_PREVIEW_CAP)
    expect(w.previewLines[0]).toBe('BPb0 Lot 0 ↔ JPj0 Lot 0 · likely match · shares lot, 0')
    expect(w.previewMore).toBe(2)
  })
  it('one pair reads in the singular and a gap count never goes under zero', () => {
    const w = pairAllConfirm({ pairs: pairs.slice(0, 1), pairedNow: 0, unpairedBids: 0, unpairedJobs: 1, developmentName: 'H', labels })
    expect(w.title).toBe('Pair the 1 likely pair?')
    expect(w.rows[1]).toEqual({ label: 'Bids with no job', before: '0', after: '0', changes: true })
  })
  it('the way back counts what took', () => {
    expect(pairedAllBack(3)).toEqual({ back: 'Unpair the 3', undone: '3 pairs unpaired again.' })
    expect(pairedAllBack(1)).toEqual({ back: 'Unpair the 1', undone: '1 pair unpaired again.' })
  })
})

describe('unpairConfirm — one pair taken apart', () => {
  it('clears the two links, keeps the outcome and the rest, and reads the two rows the table will show', () => {
    const won = bid({ ...lot12, outcome: 'won', agreed_value: 12500 })
    const w = unpairConfirm({ bid: won, job: lot12Job, bidJobs: [lot12Job], customerName: null, developmentName: 'Harlow Ranch', labels })
    expect(w.title).toBe('Unpair BP161 from JP956?')
    expect(w.confirmLabel).toBe('Unpair BP161 from JP956')
    expect(w.rows.map((r) => [r.label, r.before, r.after])).toEqual([
      ['JP956 came from', 'BP161 Lot 12 Lodge', 'no bid'],
      ['BP161 became', 'JP956', 'no job yet'],
      ['Bid status', 'won · $12,500', null],
      ['Job stage', 'Working · $12,000', null],
      ['Customer', 'Ridgeway Builders', null],
      ['Address', '400 Harlow Ranch Rd', null],
      ['Development', 'Harlow Ranch', null],
    ])
    expect(changed(w.rows)).toEqual(['JP956 came from', 'BP161 became'])
    expect(w.previewCaption).toBe('As the rows will read in Pieces')
    expect(w.previewLines).toEqual(['BP161 Lot 12 Lodge · won · $12,500 ↔ no job yet', 'no bid here ↔ JP956 Lot 12 Lodge · Working · $12,000'])
  })
  it('a bid with two jobs keeps the other one', () => {
    const other = job({ id: '900', job_name: 'Lot 12 pad' })
    const w = unpairConfirm({ bid: lot12, job: lot12Job, bidJobs: [other, lot12Job], customerName: null, developmentName: 'H', labels })
    expect(w.rows[1]).toEqual({ label: 'BP161 became', before: 'JP900, JP956', after: 'JP900', changes: true })
    expect(w.previewLines[0]).toBe('BP161 Lot 12 Lodge · sent · $12,000 ↔ JP900')
  })
  it('the toast says what the job keeps and offers the way back', () => {
    expect(unpairedWords(lot12, lot12Job, labels)).toEqual({ line: 'Unpaired BP161 from JP956. The job keeps its customer, address and development.', back: 'Put it back', undone: 'Put back: BP161 with JP956.' })
  })
})

describe('markWonConfirm — the counted won press', () => {
  it('moves the outcome and the counts, keeps the pairs and the price, and reads each bid as the Bid Board will', () => {
    const w = markWonConfirm({ bids: [{ bid: lot12, jobs: [lot12Job] }], wonNow: 2, undecidedNow: 5, labels })
    expect(w.title).toBe('Mark the 1 paired bid won?')
    expect(w.confirmLabel).toBe('Mark the 1 paired bid won')
    expect(w.rows.map((r) => [r.label, r.before, r.after, r.changes])).toEqual([
      ['Outcome', 'undecided', 'won', true],
      ['Won on', '—', 'today', true],
      ['Bids won here', '2', '3', true],
      ['Bids undecided', '5', '4', true],
      ['Pairs', 'BP161 ↔ JP956', null, false],
      ['Price', '$12,000', null, false],
    ])
    expect(w.previewCaption).toBe('As it will read on the Bid Board')
    expect(w.previewLines).toEqual(['BP161 Lot 12 Lodge · won · $12,000 · JP956'])
  })
  it('several bids read in the plural, the agreed value shows once won, and many pairs are counted', () => {
    const bids = Array.from({ length: 4 }, (_, i) => ({ bid: bid({ id: `b${i}`, project_name: `Lot ${i}`, bid_value: 100, agreed_value: 90 }), jobs: [job({ id: `j${i}` })] }))
    const w = markWonConfirm({ bids, wonNow: 0, undecidedNow: 4, labels })
    expect(w.title).toBe('Mark the 4 paired bids won?')
    expect(w.rows[4]).toEqual({ label: 'Pairs', before: '4 pairs', after: null, changes: false })
    expect(w.rows[5]).toEqual({ label: 'Prices', before: 'as priced', after: null, changes: false })
    expect(w.previewCaption).toBe('As they will read on the Bid Board')
    expect(w.previewLines[0]).toBe('BPb0 Lot 0 · won · $90 · JPj0')
  })
  it('the way back reads for one and for many', () => {
    expect(markedWonBack(1)).toEqual({ back: 'Undo', undone: 'The bid is undecided again.' })
    expect(markedWonBack(2)).toEqual({ back: 'Undo', undone: '2 bids are undecided again.' })
  })
})
