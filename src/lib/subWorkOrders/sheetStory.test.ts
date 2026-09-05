import { describe, expect, it } from 'vitest'
import { buildSheetStory, type SheetStoryInput } from './sheetStory'
import { buildSheetRail } from './sheetRail'
import type { JobWorkOrderCoverage } from './workOrderCoverage'

const TODAY = '2026-09-05'
const none: JobWorkOrderCoverage = { kind: 'none' }
const signed: JobWorkOrderCoverage = { kind: 'signed', id: 'o', subName: 'Cale Yarbrough', amount: 1208.97, signedOn: '2026-08-30', laborJobId: 's', recordId: 'WO-804-01' }
const sent: JobWorkOrderCoverage = { kind: 'sent', id: 'o', subName: 'Cale Yarbrough', amount: 1208.97, sentAt: '2026-08-29', expiresOn: '2026-09-05', expired: false }

function input(over: Partial<SheetStoryInput> & { coverage?: JobWorkOrderCoverage; stage?: string; agreed?: number; open?: number; paid?: number }): SheetStoryInput {
  const coverage = over.coverage ?? none
  const agreed = over.agreed ?? 40000
  const open = over.open ?? agreed
  const paid = over.paid ?? 0
  const unpriced = agreed === 0
  const stage = over.stage ?? 'working'
  const rail = buildSheetRail({ coverage, sheetStage: stage as 'working', agreed, open, unpriced, crewPay: over.crewPay ?? false, payableAfter: over.sheet?.payable_after ?? null })
  return {
    sheet: { assigned_to_name: 'Texas R & A Electrical LLC', job_number: '977', address: 'Hospital-415 Springtown Way', job_date: '2026-08-20', created_at: '2026-08-20T15:00:00Z', stage, items: [{ fixture: 'Electrical', is_fixed: true, direct_labor_amount: agreed }], payments: [], ...(over.sheet ?? {}) },
    money: { agreed, paid, open, unpriced },
    coverage,
    rail,
    order: over.order ?? null,
    job: over.job === undefined ? null : over.job,
    events: over.events ?? [],
    paperwork: over.paperwork ?? null,
    portal: { hasLink: true },
    crewPay: over.crewPay ?? false,
    todayYmd: TODAY,
  }
}

describe('buildSheetStory — the sheet with nothing signed (977)', () => {
  const rows = buildSheetStory(input({}))
  it('has seven rows with the office three marked as the gap', () => {
    expect(rows.map((r) => r.key)).toEqual(['drafted', 'sent', 'signed', 'work', 'inspection', 'customer_pays', 'paid'])
    expect(rows.slice(0, 3).map((r) => r.state)).toEqual(['gap', 'gap', 'gap'])
    expect(rows[0]).toMatchObject({ chip: { label: 'nothing drafted', tone: 'gap' }, actions: ['draft'] })
    expect(rows[0]!.facts[0]!.text).toContain('$40,000.00 of work is on a handshake')
  })
  it('Work is current with the days and the portal sentence; Customer pays explains the missing job', () => {
    expect(rows[3]).toMatchObject({ state: 'now', chip: { label: 'current · 16 days', tone: 'amber' }, actions: ['to_walkthrough', 'open_sheet'] })
    expect(rows[3]!.sees).toContain('My work here is done')
    expect(rows[5]!.facts[0]!.text).toContain('not in the Pipeline')
    expect(rows[6]!.facts[0]!.text).toContain('No payments yet')
  })
})

describe('buildSheetStory — a signed sheet at the walk-through (804)', () => {
  const order = { status: 'accepted', amount: 1208.97, created_at: '2026-08-28T19:10:00Z', createdByName: 'Taunya', offered_at: '2026-08-29T13:02:00Z', offer_expires_at: '2026-09-05', signed_at: '2026-08-30T23:41:00Z', accepted_at: '2026-08-30T23:41:00Z', declined_at: null, decline_reason: null, record_id: 'WO-804-01', signer_printed_name: 'Cale Yarbrough', signer_signature_mode: 'type' }
  const rows = buildSheetStory(
    input({
      coverage: signed,
      order,
      stage: 'walkthrough',
      agreed: 1208.97,
      paid: 600,
      open: 608.97,
      sheet: { assigned_to_name: 'Cale Yarbrough', job_number: '804', address: '3915 N Loop 1604 E', job_date: '2026-08-28', created_at: '2026-08-28T19:00:00Z', stage: 'walkthrough', items: [{ fixture: 'Rough-in', is_fixed: true, direct_labor_amount: 1208.97 }], payments: [{ amount: 600, memo: 'first half', payment_date: '2026-09-01' }] },
      job: { hcp_number: '804', customer_name: 'Summit General', status: 'working', revenue: 9400, billsOut: 0, billsPaid: 0 },
      events: [{ occurred_at: '2026-09-04T22:12:00Z', from: 'working', to: 'walkthrough', source: 'portal', note: 'Cleanout is behind the water heater — gate code 4471', actorName: null }],
      paperwork: { msaSignedOn: '2026-07-02', gcStanding: 'current', coiExpiresOn: '2026-12-31' },
    }),
  )
  it('the office rows carry who, when and the record', () => {
    expect(rows[0]!.facts[0]!.text).toContain('drafted by Taunya')
    expect(rows[1]!.facts[0]!.text).toContain("to Cale Yarbrough's portal · good through 2026-09-05")
    expect(rows[2]).toMatchObject({ state: 'done', chip: { label: 'WO-804-01', tone: 'green' }, actions: ['view_record'] })
    expect(rows[2]!.facts[0]!.text).toContain('typed signature “Cale Yarbrough”')
    expect(rows[2]!.facts[1]).toEqual({ k: 'Binds under', text: 'MSA signed 2026-07-02 · General Conditions current · COI through 2026-12-31' })
  })
  it('the walk-through row reads the portal event with the note, and offers the two moves', () => {
    const w = rows[4]!
    expect(w.state).toBe('now')
    expect(w.facts[0]!.text).toBe('Cale Yarbrough tapped My work here is done on the portal')
    expect(w.facts[1]).toEqual({ text: '“Cleanout is behind the water heater — gate code 4471”', quote: true })
    expect(w.actions).toEqual(['to_customer_pays', 'back_to_work'])
    expect(w.chip!.label).toBe('current · 1 day')
  })
  it('Customer pays reads the job; Paid lists the payment and the remainder', () => {
    expect(rows[5]!.facts[0]!.text).toBe('Job 804 is working · contract $9,400.00 · nothing billed yet')
    expect(rows[6]!.facts[0]).toEqual({ k: 'Sep 1', text: 'payment $600.00 · “first half”' })
    expect(rows[6]!.chip).toEqual({ label: '$608.97 to go', tone: 'gray' })
  })
})

describe('buildSheetStory — variants', () => {
  it('a live offer: Sent is current with the waiting days and a nudge', () => {
    const order = { status: 'offered', amount: 1208.97, created_at: '2026-08-28T19:10:00Z', offered_at: '2026-08-29T13:02:00Z', offer_expires_at: '2026-09-05', signed_at: null, accepted_at: null, declined_at: null, decline_reason: null, record_id: null, signer_printed_name: null, signer_signature_mode: null }
    const rows = buildSheetStory(input({ coverage: sent, order, agreed: 1208.97 }))
    expect(rows[1]).toMatchObject({ state: 'now', chip: { label: 'waiting 7 days', tone: 'amber' }, actions: ['nudge'] })
    expect(rows[2]!.facts[0]!.text).toBe('Waiting on their signature.')
  })
  it('a declined offer shows the reason and Re-offer', () => {
    const declined: JobWorkOrderCoverage = { kind: 'declined', id: 'o', subName: 'X', reason: 'price is low' }
    const order = { status: 'declined', amount: 500, created_at: '2026-09-01T00:00:00Z', offered_at: '2026-09-02T00:00:00Z', offer_expires_at: null, signed_at: null, accepted_at: null, declined_at: '2026-09-03T00:00:00Z', decline_reason: 'price is low', record_id: null, signer_printed_name: null, signer_signature_mode: null }
    const rows = buildSheetStory(input({ coverage: declined, order, agreed: 500 }))
    expect(rows[1]).toMatchObject({ chip: { label: 'declined', tone: 'gap' }, actions: ['reoffer'] })
    expect(rows[1]!.facts.some((f) => f.quote && f.text === '“price is low”')).toBe(true)
  })
  it('crew pay drops the office rows', () => {
    const rows = buildSheetStory(input({ crewPay: true, agreed: 1000, sheet: { assigned_to_name: 'Abraham | Misses Taunya TESTING', job_number: '1004', address: '162 Forest Drive', job_date: '2026-09-01', created_at: null, stage: 'working' } }))
    expect(rows.map((r) => r.key)).toEqual(['work', 'inspection', 'customer_pays', 'paid'])
  })
  it('queued for the pay run reads on Customer pays; paid in full on Paid', () => {
    const rows = buildSheetStory(input({ coverage: signed, stage: 'customer_pay', agreed: 1750, open: 1750, sheet: { assigned_to_name: 'Miguel Rodriguez', job_number: '892', address: 'x', job_date: '2026-08-01', created_at: null, stage: 'customer_pay', payable_after: '2026-09-11' } }))
    expect(rows[5]!.facts.some((f) => f.k === 'Payable after' && f.text.startsWith('2026-09-11'))).toBe(true)
    expect(rows[5]!.sees).toContain('Queued for the pay run')
    const done = buildSheetStory(input({ coverage: signed, stage: 'customer_pay', agreed: 1750, open: 0, paid: 1750, sheet: { assigned_to_name: 'Miguel Rodriguez', job_number: '892', address: 'x', job_date: '2026-08-01', created_at: null, stage: 'customer_pay', payments: [{ amount: 1750, payment_date: '2026-09-05' }] } }))
    expect(done[6]!.chip).toEqual({ label: 'paid in full', tone: 'green' })
  })
})
