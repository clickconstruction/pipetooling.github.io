import { describe, expect, it } from 'vitest'
import type { PaySpeedData } from '../jobs/billedExpectedPay'
import type {
  EstimateRow,
  JobStatusEventRow,
  PipelineInvoiceRow,
  PipelineJobRow,
  PipelineMessageRow,
  PipelinePaymentRow,
  ResidentialRows,
} from './residentialLoad'
import { fillLine } from '../quickReplies/blanks'
import { nudgeLine } from './nudgeDispatch'
import { billedRounds, estimateStamps, isOnOurWayText, isReviewAskText, paidRounds, residentialStampsFor, statusStamps, visitStamps } from './residentialLoad'
import { SEED_FLOWS } from './seed'
import type { FlowReading } from './state'
import { readFlow, stepById } from './state'

const NOW = new Date('2026-10-12T17:00:00Z')
const NAMES = { 'u-luis': 'Luis', 'u-rosa': 'Rosa' }

const ON_OUR_WAY = 'Dana, this is Luis with Click Plumbing. We are on our way to 4120 Oakridge Trl, about 30 minutes out.'
const BOOKED = 'Dana, this is Click Plumbing. We have you down for Mon, Oct 5 between 9 and 11. Reply here if that changes.'
const ESTIMATE = 'Dana, your estimate for the water heater is ready. Review and approve it here: https://example.test/e/1.'
const REVIEW = 'Dana, thank you for choosing Click Plumbing. If you have a minute, a review helps us a lot: https://example.test/r.'
/** The app's own Review asked line (`nudgeDispatch.ts`'s `NUDGE_LINES.review`), filled the way the run and the press fill it. */
const APP_REVIEW = fillLine(nudgeLine({ first: 'Dana', reading: { kind: 'residential' } }, stepById(SEED_FLOWS.residential, 'review')!), { first: 'Dana', job: 'the water heater' }).text.replace('{rate}', 'https://clicktooling.com/rate?t=9mB7aa11')

const job = (p: Partial<PipelineJobRow> & Pick<PipelineJobRow, 'id'>): PipelineJobRow => ({
  created_at: '2026-10-03T13:00:00Z',
  status: 'waiting',
  revenue: null,
  customer_id: 'cust-dana',
  gc_customer_id: null,
  bill_to_party: 'customer',
  customer_name: 'Dana Whitfield',
  ...p,
})
const bill = (p: Partial<PipelineInvoiceRow> & Pick<PipelineInvoiceRow, 'id' | 'job_id'>): PipelineInvoiceRow => ({
  status: 'billed',
  amount: 1850,
  sequence_order: 1,
  billed_at: null,
  sent_to_customer_at: null,
  estimated_bill_date: null,
  created_at: '2026-10-08T22:00:00Z',
  sent_by_user_id: 'u-rosa',
  bill_to_party: null,
  bill_to_email: null,
  ...p,
})
const pay = (p: Partial<PipelinePaymentRow> & Pick<PipelinePaymentRow, 'job_id' | 'amount'>): PipelinePaymentRow => ({
  invoice_id: null,
  paid_on: null,
  sequence_order: null,
  ...p,
})
const text = (jobId: string, at: string, body: string, who = 'u-luis'): PipelineMessageRow => ({
  jobs_ledger_id: jobId,
  channel: 'text',
  direction: 'out',
  at,
  body,
  who_user_id: who,
  who_text: '',
})
const move = (jobId: string, to: string, at: string): JobStatusEventRow => ({ job_id: jobId, to_status: to, changed_at: at, changed_by_user_id: 'u-rosa' })
const estimate = (jobId: string, p: Partial<EstimateRow>): EstimateRow => ({
  job_ledger_id: jobId,
  doc_kind: 'estimate',
  status: 'sent',
  sent_at: null,
  acceptor_consented_at: null,
  ...p,
})
const PAY_SPEEDS: PaySpeedData = {
  company: { medianDays: 21, samples: 40 },
  customers: { 'cust-dana': { medianDays: 9, samples: 2 } },
  segments: { residential: null, commercial: null },
  customerTypes: {},
  receipts: {},
  quality: null,
}

const base = (): ResidentialRows => ({
  contact: { id: 'c-dana', kind: 'residential', off_since: null, off_why: null, off_by: null },
  firstName: 'Dana',
  jobs: [],
  userNames: NAMES,
  paySpeeds: PAY_SPEEDS,
})

/** Dana's August job, start to finish: paid in full and asked for a review. */
const AUGUST: Partial<ResidentialRows> = {
  blocks: [{ job_id: 'job-1290', work_date: '2026-08-04', created_at: '2026-08-01T14:00:00Z', created_by: 'u-rosa' }],
  clockSessions: [{ job_ledger_id: 'job-1290', user_id: 'u-luis', clocked_in_at: '2026-08-04T14:30:00Z', revoked_at: null, rejected_at: null }],
  reports: [{ job_ledger_id: 'job-1290', created_by_user_id: 'u-luis', created_at: '2026-08-04T16:00:00Z', field_values: { 'What did you find?': 'A slab leak under the kitchen.' } }],
  estimates: [estimate('job-1290', { status: 'customer_accepted', sent_at: '2026-08-04T18:00:00Z', acceptor_consented_at: '2026-08-05T13:00:00Z' })],
  statusEvents: [move('job-1290', 'working', '2026-08-06T13:00:00Z'), move('job-1290', 'ready_to_bill', '2026-08-07T22:00:00Z'), move('job-1290', 'billed', '2026-08-08T15:00:00Z'), move('job-1290', 'paid', '2026-08-20T15:00:00Z')],
  invoices: [bill({ id: 'inv-1290', job_id: 'job-1290', status: 'paid', amount: 3200, billed_at: '2026-08-08T15:00:00Z' })],
  payments: [pay({ job_id: 'job-1290', invoice_id: 'inv-1290', amount: 3200, paid_on: '2026-08-20' })],
  messages: [text('job-1290', '2026-08-04T14:02:00Z', ON_OUR_WAY.replace('4120 Oakridge Trl', 'the house')), text('job-1290', '2026-08-21T20:00:00Z', REVIEW, 'u-rosa')],
}

const STAGES = ['booked', 'onway', 'arrived', 'found', 'estimate', 'approved', 'working', 'done', 'billed', 'paid', 'review'] as const
type Stage = (typeof STAGES)[number]

/** Dana's rows with her water heater job (1312, the star) through `upTo`, beside her finished August job. */
function dana(upTo: Stage | null): ResidentialRows {
  const reached = (s: Stage) => upTo != null && STAGES.indexOf(s) <= STAGES.indexOf(upTo)
  const status = reached('paid') ? 'paid' : reached('billed') ? 'billed' : reached('done') ? 'ready_to_bill' : reached('working') ? 'working' : 'waiting'
  return {
    ...base(),
    jobs: [job({ id: 'job-1290', created_at: '2026-08-01T13:00:00Z', status: 'paid', revenue: 3200 }), job({ id: 'job-1312', status, revenue: 1850 })],
    contactJobs: [{ jobs_ledger_id: 'job-1312', is_default: true }],
    blocks: [...AUGUST.blocks!, ...(reached('booked') ? [{ job_id: 'job-1312', work_date: '2026-10-05', created_at: '2026-10-03T13:10:00Z', created_by: 'u-rosa' }] : [])],
    clockSessions: [
      ...AUGUST.clockSessions!,
      ...(reached('arrived') ? [{ job_ledger_id: 'job-1312', user_id: 'u-luis', clocked_in_at: '2026-10-05T14:35:00Z', revoked_at: null, rejected_at: null }] : []),
    ],
    reports: [
      ...AUGUST.reports!,
      ...(reached('found') ? [{ job_ledger_id: 'job-1312', created_by_user_id: 'u-luis', created_at: '2026-10-05T16:00:00Z', field_values: { 'What did you find?': 'The tank is leaking at the base.' } }] : []),
    ],
    estimates: [
      ...AUGUST.estimates!,
      ...(reached('approved')
        ? [estimate('job-1312', { status: 'customer_accepted', sent_at: '2026-10-05T18:00:00Z', acceptor_consented_at: '2026-10-06T13:00:00Z' })]
        : reached('estimate')
          ? [estimate('job-1312', { sent_at: '2026-10-05T18:00:00Z' })]
          : []),
    ],
    statusEvents: [
      ...AUGUST.statusEvents!,
      ...(reached('working') ? [move('job-1312', 'working', '2026-10-07T13:00:00Z')] : []),
      ...(reached('done') ? [move('job-1312', 'ready_to_bill', '2026-10-08T22:00:00Z')] : []),
      ...(reached('billed') ? [move('job-1312', 'billed', '2026-10-09T15:00:00Z')] : []),
      ...(reached('paid') ? [move('job-1312', 'paid', '2026-10-11T15:00:00Z')] : []),
    ],
    invoices: [...AUGUST.invoices!, ...(reached('billed') ? [bill({ id: 'inv-1312', job_id: 'job-1312', status: reached('paid') ? 'paid' : 'billed', billed_at: '2026-10-09T15:00:00Z' })] : [])],
    payments: [...AUGUST.payments!, ...(reached('paid') ? [pay({ job_id: 'job-1312', invoice_id: 'inv-1312', amount: 1850, paid_on: '2026-10-11' })] : [])],
    messages: [
      ...AUGUST.messages!,
      text('job-1312', '2026-10-03T13:12:00Z', BOOKED, 'u-rosa'),
      ...(reached('onway') ? [text('job-1312', '2026-10-05T14:02:00Z', ON_OUR_WAY)] : []),
      ...(reached('estimate') ? [text('job-1312', '2026-10-05T18:01:00Z', ESTIMATE, 'u-rosa')] : []),
      ...(reached('review') ? [text('job-1312', '2026-10-11T20:00:00Z', REVIEW, 'u-rosa')] : []),
    ],
  }
}

const read = (rows: ResidentialRows): FlowReading => readFlow(SEED_FLOWS.residential, residentialStampsFor(rows, NOW), NOW)
const where = (r: FlowReading) => `${r.nowStepId}@${r.nowJobId}`
const laneOn = (r: FlowReading, jobId: string) => {
  const l = r.lanes.find((x) => x.jobId === jobId)
  return l ? `head ${l.headStepId} · ${l.steps.map((s) => `${s.stepId}:${s.state}`).join(' ')}` : null
}

describe('the word rules that stand in for a quick reply step', () => {
  it('reads On our way from the greeting and the road words, never the Booked text', () => {
    expect(isOnOurWayText(ON_OUR_WAY, 'Dana')).toBe(true)
    expect(isOnOurWayText('dana,  this is Marco. On the way, 15 minutes out.', 'Dana')).toBe(true)
    expect(isOnOurWayText(BOOKED, 'Dana')).toBe(false)
    expect(isOnOurWayText('Dana, we are running behind this morning. Our new window is 11 to 1.', 'Dana')).toBe(false)
    expect(isOnOurWayText(ON_OUR_WAY, 'Kevin')).toBe(false)
    expect(isOnOurWayText(ON_OUR_WAY, '')).toBe(false)
  })

  it('reads the review ask, never the estimate text that says Review and approve', () => {
    expect(isReviewAskText(REVIEW)).toBe(true)
    expect(isReviewAskText('Would you review us on Google?')).toBe(true)
    expect(isReviewAskText(ESTIMATE)).toBe(false)
  })

  // v2.6007: the app's own line says neither "a review" nor "review us", so the fact reads the rating link it carries.
  it('reads the app’s own review line by its rating link, filled or still the blank', () => {
    expect(APP_REVIEW).toBe('Dana, thank you for paying for the water heater. Would you tell us how we did? It takes one tap: https://clicktooling.com/rate?t=9mB7aa11')
    expect(isReviewAskText(APP_REVIEW)).toBe(true)
    expect(isReviewAskText(APP_REVIEW.replace('https://clicktooling.com/rate?t=9mB7aa11', '{rate}'))).toBe(true)
    expect(isReviewAskText('Dana, thank you for paying for the water heater. Would you tell us how we did?')).toBe(false)
  })
})

describe('residentialStampsFor', () => {
  it('lists her jobs with the star first', () => {
    const s = residentialStampsFor(dana(null), NOW)
    expect(s.kind).toBe('residential')
    expect(s.jobIds).toEqual(['job-1312', 'job-1290'])
    expect(s.defaultJobId).toBe('job-1312')
  })

  it('stamps every fact on her finished August job, by whoever did it', () => {
    const s = residentialStampsFor(dana(null), NOW).jobs['job-1290']!
    expect(s.stamps.map((x) => `${x.fact} ${x.mark} ${x.at} ${x.by}`)).toEqual([
      'booked ok 2026-08-01T14:00:00Z Rosa',
      'on_way ok 2026-08-04T14:02:00Z Luis',
      'arrived ok 2026-08-04T14:30:00Z Luis',
      'found ok 2026-08-04T16:00:00Z Luis',
      'estimate_sent ok 2026-08-04T18:00:00Z null',
      'estimate_approved ok 2026-08-05T13:00:00Z null',
      'working ok 2026-08-06T13:00:00Z Rosa',
      'done ok 2026-08-07T22:00:00Z Rosa',
      'review_asked ok 2026-08-21T20:00:00Z Rosa',
    ])
    expect(s.rounds.billed?.map((r) => `${r.key} ${r.name} ${r.stamps.map((x) => `${x.fact} ${x.mark} ${x.at} ${x.by}`)}`)).toEqual([
      'inv-1290 Bill 1 billed ok 2026-08-08T15:00:00Z Rosa',
    ])
    expect(s.rounds.paid?.map((r) => `${r.key} ${r.name} ${r.opened} ${r.stamps.map((x) => `${x.fact} ${x.mark} ${x.at}`)}`)).toEqual([
      'inv-1290 Bill 1 2026-08-08T15:00:00Z paid ok 2026-08-20',
    ])
    expect(readFlow(SEED_FLOWS.residential, residentialStampsFor(dana(null), NOW), NOW).lanes.find((l) => l.jobId === 'job-1290')?.headStepId).toBeNull()
  })

  // Each stage of her water heater job, and the step the flow puts her on after it.
  it.each([
    ['booked', 'onway'],
    ['onway', 'arrived'],
    ['arrived', 'found'],
    ['found', 'estimate'],
    ['estimate', 'approved'],
    ['approved', 'working'],
    ['working', 'done'],
    ['done', 'billed'],
    ['billed', 'paid'],
    ['paid', 'review'],
  ] as const)('after %s she is on %s', (upTo, step) => {
    expect(where(read(dana(upTo)))).toBe(`${step}@job-1312`)
  })

  it('finishes her flow once the review is asked', () => {
    const r = read(dana('review'))
    expect(where(r)).toBe('null@null')
    expect(laneOn(r, 'job-1312')).toBe(
      'head null · booked:done onway:done arrived:done found:done estimate:done approved:done working:done done:done billed:done paid:done review:done',
    )
  })

  it('finishes her flow once the app’s own review text went, stamped to the app (v2.6007)', () => {
    const rows = dana('review')
    const appAsked: ResidentialRows = { ...rows, messages: rows.messages!.map((m) => (m.body === REVIEW ? { ...m, body: APP_REVIEW, who_user_id: null, who_text: 'The app' } : m)) }
    expect(residentialStampsFor(appAsked, NOW).jobs['job-1312']!.stamps.filter((x) => x.fact === 'review_asked').map((x) => `${x.fact} ${x.mark} ${x.at} ${x.by}`)).toEqual([
      'review_asked ok 2026-10-11T20:00:00Z The app',
    ])
    expect(where(read(appAsked))).toBe('null@null')
    // The same morning's text with its blank still in it, as a dry run shows it, is the ask too.
    const blank: ResidentialRows = { ...rows, messages: rows.messages!.map((m) => (m.body === REVIEW ? { ...m, body: APP_REVIEW.replace('https://clicktooling.com/rate?t=9mB7aa11', '{rate}') } : m)) }
    expect(where(read(blank))).toBe('null@null')
  })

  it('a job with a block and nothing else reads booked', () => {
    const rows: ResidentialRows = {
      ...base(),
      jobs: [job({ id: 'job-1400' })],
      blocks: [{ job_id: 'job-1400', work_date: '2026-10-14', created_at: '2026-10-12T15:00:00Z', created_by: 'u-rosa' }],
    }
    expect(laneOn(read(rows), 'job-1400')).toBe(
      'head onway · booked:done onway:now arrived:next found:later estimate:later approved:later working:later done:later billed:later paid:later review:later',
    )
  })

  it('a change order or a bid proposal that went is not the estimate', () => {
    const rows: ResidentialRows = {
      ...base(),
      jobs: [job({ id: 'job-1400' })],
      estimates: [
        estimate('job-1400', { doc_kind: 'change_order', sent_at: '2026-10-12T15:00:00Z' }),
        estimate('job-1400', { doc_kind: 'bid_proposal', status: 'customer_accepted', sent_at: '2026-10-12T15:00:00Z', acceptor_consented_at: '2026-10-12T16:00:00Z' }),
      ],
    }
    expect(estimateStamps(rows, 'job-1400')).toEqual([])
  })

  it('a job with nothing on it yet has nobody on its first step, not even Booked', () => {
    const rows: ResidentialRows = { ...base(), jobs: [job({ id: 'job-1400' })] }
    expect(where(read(rows))).toBe('null@null')
  })
})

describe('the bills', () => {
  it('an unpaid bill does not read paid: it waits on her, due the day her own pace says', () => {
    const rows = dana('billed')
    const r = read({ ...rows, payments: [...rows.payments!, pay({ job_id: 'job-1312', invoice_id: 'inv-1312', amount: 500, paid_on: '2026-10-10' })] })
    expect(where(r)).toBe('paid@job-1312')
    const paid = r.lanes.find((l) => l.jobId === 'job-1312')!.steps.find((s) => s.stepId === 'paid')!
    expect(paid.rounds.map((x) => `${x.key} ${x.state} ${x.opened} ${x.facts.map((f) => `${f.fact.id} ${f.mark}`)} due ${x.day?.due}`)).toEqual([
      'inv-1312 now 2026-10-09 paid wait due 2026-10-18',
    ])
  })

  it('her promise to pay wins over her pace; with neither the due day stays unset', () => {
    const promised = paidRounds({ ...dana('billed'), promisedPay: { 'job-1312': { promisedYmd: '2026-10-15', markedByName: 'Rosa' } } }, 'job-1312', NOW)
    expect(promised.map((x) => x.due)).toEqual(['2026-10-15'])
    expect(paidRounds({ ...dana('billed'), paySpeeds: null }, 'job-1312', NOW).map((x) => x.due)).toEqual([null])
  })

  it('money put on the job with no bill picked pays the bill, oldest first (main one rule)', () => {
    const rows = dana('billed')
    const rounds = paidRounds({ ...rows, payments: [...rows.payments!, pay({ job_id: 'job-1312', amount: 1850, paid_on: '2026-10-11' })] }, 'job-1312', NOW)
    expect(rounds.map((x) => `${x.stamps.map((s) => `${s.fact} ${s.mark} ${s.at}`)}`)).toEqual(['paid ok 2026-10-11'])
  })

  it('a second bill is its own round on each loop, a draft open on Billed until it goes', () => {
    const rows = dana('paid')
    const two: ResidentialRows = {
      ...rows,
      invoices: [...rows.invoices!, bill({ id: 'inv-1312b', job_id: 'job-1312', status: 'ready_to_bill', sequence_order: 2, amount: 400, created_at: '2026-10-12T14:00:00Z' })],
    }
    expect(billedRounds(two, 'job-1312').map((x) => `${x.key} ${x.name} ${x.stamps.length}`)).toEqual(['inv-1312 Bill 1 1', 'inv-1312b Bill 2 0'])
    expect(paidRounds(two, 'job-1312', NOW).map((x) => x.key)).toEqual(['inv-1312'])
    expect(where(read(two))).toBe('billed@job-1312')
  })
})

describe('the visit and the board', () => {
  it('a revoked clock-in is not an arrival, and a report with no words is not what we found', () => {
    const rows: ResidentialRows = {
      ...base(),
      jobs: [job({ id: 'job-1400' })],
      clockSessions: [{ job_ledger_id: 'job-1400', user_id: 'u-luis', clocked_in_at: '2026-10-12T14:00:00Z', revoked_at: '2026-10-12T15:00:00Z', rejected_at: null }],
      reports: [{ job_ledger_id: 'job-1400', created_by_user_id: 'u-luis', created_at: '2026-10-12T16:00:00Z', field_values: { 'How complete is the job?': '50', Notes: '  ' } }],
    }
    expect(visitStamps(rows, 'job-1400')).toEqual([])
  })

  it('done drops when the job moves back to Working, and working keeps its first day', () => {
    const rows: ResidentialRows = {
      ...base(),
      jobs: [job({ id: 'job-1400', status: 'working' })],
      statusEvents: [move('job-1400', 'working', '2026-10-07T13:00:00Z'), move('job-1400', 'ready_to_bill', '2026-10-08T13:00:00Z'), move('job-1400', 'working', '2026-10-09T13:00:00Z')],
    }
    expect(statusStamps(rows, 'job-1400').map((x) => `${x.fact} ${x.at}`)).toEqual(['working 2026-10-07T13:00:00Z'])
    const again = { ...rows, jobs: [job({ id: 'job-1400', status: 'ready_to_bill' })], statusEvents: [...rows.statusEvents!, move('job-1400', 'ready_to_bill', '2026-10-10T13:00:00Z')] }
    expect(statusStamps(again, 'job-1400').map((x) => `${x.fact} ${x.at}`)).toEqual(['working 2026-10-07T13:00:00Z', 'done 2026-10-10T13:00:00Z'])
  })

  it('a job past Working with no moves kept still reads working and done, with no day', () => {
    const rows: ResidentialRows = { ...base(), jobs: [job({ id: 'job-1400', status: 'billed' })] }
    expect(statusStamps(rows, 'job-1400').map((x) => `${x.fact} ${x.at}`)).toEqual(['working null', 'done null'])
  })
})
