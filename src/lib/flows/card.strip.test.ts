import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { stepStrip, type StepStrip, type StripOptions } from './card'
import { FLOW_FIXTURE_NOW, flowFixture } from './flowFixtures'
import { residentialStampsFor, type PipelineJobRow, type ResidentialRows } from './residentialLoad'
import type { PersonFlow } from './nudges'
import { SEED_FLOWS } from './seed'
import { readFlow } from './state'

const NOW = new Date('2026-10-12T17:00:00Z')
const OPTS: StripOptions = { me: 'Rosa' }

const job = (p: Partial<PipelineJobRow> & Pick<PipelineJobRow, 'id'>): PipelineJobRow => ({
  created_at: '2026-10-03T13:00:00Z',
  status: 'waiting',
  revenue: 1850,
  customer_id: 'cust-dana',
  gc_customer_id: null,
  bill_to_party: 'customer',
  customer_name: 'Dana Whitfield',
  ...p,
})

/** Dana's water heater job: booked, visited, the estimate out since Saturday. */
const VISITED: ResidentialRows = {
  contact: { id: 'c-dana', kind: 'residential', off_since: null, off_why: null, off_by: null },
  firstName: 'Dana',
  jobs: [job({ id: 'job-1312' })],
  userNames: { 'u-luis': 'Luis', 'u-rosa': 'Rosa' },
  blocks: [{ job_id: 'job-1312', work_date: '2026-10-09', created_at: '2026-10-07T15:00:00Z', created_by: 'u-rosa' }],
  clockSessions: [{ job_ledger_id: 'job-1312', user_id: 'u-luis', clocked_in_at: '2026-10-09T14:30:00Z', revoked_at: null, rejected_at: null }],
  reports: [{ job_ledger_id: 'job-1312', created_by_user_id: 'u-luis', created_at: '2026-10-09T16:00:00Z', field_values: { 'What did you find?': 'The tank is leaking at the base.' } }],
  messages: [
    {
      jobs_ledger_id: 'job-1312',
      channel: 'text',
      direction: 'out',
      at: '2026-10-09T14:02:00Z',
      body: 'Dana, this is Luis with Click Plumbing. We are on our way to 4120 Oakridge Trl, about 30 minutes out.',
      who_user_id: 'u-luis',
      who_text: '',
    },
  ],
  estimates: [{ job_ledger_id: 'job-1312', doc_kind: 'estimate', status: 'sent', sent_at: '2026-10-10T15:00:00Z', acceptor_consented_at: null }],
}
const APPROVED: ResidentialRows = {
  ...VISITED,
  estimates: [{ ...VISITED.estimates![0]!, status: 'customer_accepted', acceptor_consented_at: '2026-10-11T13:00:00Z' }],
}
const BILLED: ResidentialRows = {
  ...APPROVED,
  jobs: [job({ id: 'job-1312', status: 'billed' })],
  statusEvents: [
    { job_id: 'job-1312', to_status: 'working', changed_at: '2026-10-11T14:00:00Z', changed_by_user_id: 'u-rosa' },
    { job_id: 'job-1312', to_status: 'ready_to_bill', changed_at: '2026-10-11T20:00:00Z', changed_by_user_id: 'u-rosa' },
  ],
  invoices: [
    {
      id: 'inv-1312',
      job_id: 'job-1312',
      status: 'billed',
      amount: 1850,
      sequence_order: 1,
      billed_at: '2026-10-12T14:00:00Z',
      sent_to_customer_at: null,
      estimated_bill_date: null,
      created_at: '2026-10-11T20:00:00Z',
      sent_by_user_id: 'u-rosa',
      bill_to_party: null,
      bill_to_email: null,
    },
  ],
}
const PAID: ResidentialRows = {
  ...BILLED,
  jobs: [job({ id: 'job-1312', status: 'paid' })],
  invoices: [{ ...BILLED.invoices![0]!, status: 'paid' }],
  payments: [{ job_id: 'job-1312', invoice_id: 'inv-1312', amount: 1850, paid_on: '2026-10-12', sequence_order: null }],
}

const personOf = (id: string, first: string, flow: PersonFlow['flow'], reading: PersonFlow['reading']): PersonFlow => ({
  id,
  first,
  flow,
  reading,
  quietDays: null,
  lastOutAt: null,
  court: null,
  owe: false,
  marks: [],
  notes: [],
  sends: {},
  portal: null,
})
const dana = (rows: ResidentialRows): PersonFlow =>
  personOf('c-dana', 'Dana', SEED_FLOWS.residential, readFlow(SEED_FLOWS.residential, residentialStampsFor(rows, NOW), NOW))
/** The strip on the step they are on now. */
const stripOn = (person: PersonFlow, now = NOW, opts = OPTS) => stepStrip(person, person.reading.nowStepId ?? '', person.reading.nowJobId, now, opts)
const shape = (s: StepStrip | null) => s && { parts: [s.name, s.move, s.days], presses: s.presses.map((p) => `${p.id}:${p.label}:${p.opens ?? '-'}`) }
/** Every word a strip shows, its hover cards included. */
const wordsOf = (s: StepStrip) => [s.name, s.move, s.days ?? '', ...s.presses.flatMap((p) => [p.label, p.tip?.name ?? '', p.tip?.does ?? '', p.tip?.changes ?? ''])]

describe('stepStrip, a residential customer', () => {
  it('on Approved, two days since the estimate went: their yes, their day, the estimate again, their no', () => {
    const s = stripOn(dana(VISITED))
    expect(shape(s)).toEqual({
      parts: ['Approved', "Dana's move", '2 days'],
      presses: ['approveFor:Approve for Dana:-', 'moveTheDay:Move the day:dispatch', 'sendAgain:Send it again:send_estimate', 'declined:Dana declined:-'],
    })
    expect(s!.presses[0]!.primary).toBe(true)
    expect(s!.presses[0]!.writes).toEqual({ kind: 'accept_estimate', jobId: 'job-1312', printedName: 'Rosa', auditNote: 'by phone', how: 'office' })
    expect(s!.presses[0]!.tip?.changes).toBe('The step is done. The record says Rosa pressed it by phone.')
    expect(s!.presses[3]!.writes).toEqual({ kind: 'decline_estimate', jobId: 'job-1312', by: 'Rosa', how: 'office' })
    expect(wordsOf(s!).flatMap(plainWordsFailures)).toEqual([])
  })

  it('on Working, after their yes: Move the day alone', () => {
    expect(shape(stripOn(dana(APPROVED)))).toEqual({ parts: ['Working', 'Our move', '1 day'], presses: ['moveTheDay:Move the day:dispatch'] })
  })

  it('on Paid with a bill out: the bill again, or a check marked against that bill', () => {
    const s = stripOn(dana(BILLED))
    expect(shape(s)).toEqual({
      parts: ['Paid', "Dana's move", '0 days'],
      presses: ['sendBillAgain:Send the bill again:send_bill', 'markPaidByCheck:Mark paid by check:record_payment'],
    })
    expect(s!.presses[1]!.writes).toEqual({ kind: 'mark_invoice_paid', invoiceId: 'inv-1312', paymentType: 'check' })
    expect(wordsOf(s!).flatMap(plainWordsFailures)).toEqual([])
  })

  it('once paid, the review ask while the app does not send it, and nothing when it does', () => {
    expect(shape(stripOn(dana(PAID)))?.presses).toEqual(['askForReview:Ask for a review:reply_box'])
    expect(shape(stripOn(dana(PAID), NOW, { ...OPTS, appSends: { residential: { review: true } } }))?.presses).toEqual([])
  })

  it('off the flow: no strip', () => {
    const off = dana({ ...VISITED, contact: { ...VISITED.contact, off_since: '2026-10-11', off_why: 'Moved away.', off_by: 'u-rosa' } })
    expect(stepStrip(off, 'approved', 'job-1312', NOW, OPTS)).toBeNull()
  })

  it('a step that is not on now has no strip', () => {
    expect(stepStrip(dana(VISITED), 'working', 'job-1312', NOW, OPTS)).toBeNull()
    expect(stepStrip(dana(VISITED), 'booked', 'job-1312', NOW, OPTS)).toBeNull()
  })
})

describe('stepStrip, a GC customer', () => {
  it("on Our bid: the card's own press that moves the step, folded", () => {
    // Oak Hills Veterinary, a demo customer who asked us on Sep 28 and has no bid yet.
    const vet = personOf('g8', 'Oak Hills', SEED_FLOWS.customer, readFlow(SEED_FLOWS.customer, flowFixture('g8').stamps, FLOW_FIXTURE_NOW))
    const s = stripOn(vet, FLOW_FIXTURE_NOW)
    expect(s?.name).toBe('Our bid')
    expect(s?.move).toBe('Our move')
    expect(s?.presses.map((p) => `${p.id}:${p.paper ?? '-'}:${p.opens ?? '-'}:${p.writes ?? '-'}`)).toEqual(['sendIt:bid:-:-'])
    expect(wordsOf(s!).flatMap(plainWordsFailures)).toEqual([])
  })
})
