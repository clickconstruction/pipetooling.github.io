import { describe, expect, it } from 'vitest'
import { needsReply, type QueueContact, type QueueMessage } from '../followUp/queue'
import { plainWordsFailures } from '../plainWords'
import type { QuickReply } from '../quickReplies/kernel'
import { residentialStampsFor, type PipelineJobRow, type ResidentialRows } from './residentialLoad'
import type { AppSends, NudgeSent, TextNumber } from './nudgeDispatch'
import { SEED_FLOWS } from './seed'
import { readFlow } from './state'
import {
  boardDot,
  feltStep,
  stageNotSentWords,
  stageSendFor,
  type BoardDotMessage,
  type StageEvent,
  type StageNotSent,
  type StageSendSettings,
} from './stageSends'

const NOW = new Date('2026-10-12T17:00:00Z')
const ON: AppSends = { residential: { booked: true, working: true, done: true, billed: true, paid: true } }
const NUMBER: TextNumber = { number: '+15125550101', optedOut: false }

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

/** Dana's water heater job, booked by Rosa and moved to Working this morning. */
const DANA: ResidentialRows = {
  contact: { id: 'c-dana', kind: 'residential', off_since: null, off_why: null, off_by: null },
  firstName: 'Dana',
  jobs: [job({ id: 'job-1312', status: 'working' })],
  userNames: { 'u-rosa': 'Rosa' },
  blocks: [{ job_id: 'job-1312', work_date: '2026-10-12', created_at: '2026-10-09T15:00:00Z', created_by: 'u-rosa' }],
  statusEvents: [{ job_id: 'job-1312', to_status: 'working', changed_at: '2026-10-12T13:15:00Z', changed_by_user_id: 'u-rosa' }],
}
const readingOf = (rows: ResidentialRows) => readFlow(SEED_FLOWS.residential, residentialStampsFor(rows, NOW), NOW)

const line = (id: string, stepId: string, text: string): QuickReply => ({
  id,
  text,
  for: 'customer',
  stepId,
  scope: 'team',
  addedBy: 'u-rosa',
  addedAt: 1,
  removed: false,
  uses: { 'u-rosa': 3 },
  lastUsed: null,
})
const LINES: QuickReply[] = [
  line('qr-booked', 'booked', '{first}, you are on our schedule for {job}. Luis will text when he is on the way.'),
  line('qr-working', 'working', '{first}, we started on {job} this morning. We will text you when we are done.'),
  line('qr-paid', 'paid', '{first}, your payment came through. Thank you for choosing Click Plumbing.'),
]

const settings = (p: Partial<StageSendSettings> = {}): StageSendSettings => ({
  contactId: 'c-dana',
  first: 'Dana',
  jobName: 'the water heater',
  flow: SEED_FLOWS.residential,
  appSends: ON,
  sent: [],
  number: NUMBER,
  now: NOW,
  ...p,
})
const WORKING: StageEvent = { kind: 'move', jobId: 'job-1312', toStatus: 'working' }
const why = (s: ReturnType<typeof stageSendFor>) => s.kept?.why ?? 'sent'

describe('the moves the customer feels', () => {
  it('names the step each move turns true, and nothing for Waiting', () => {
    expect(feltStep({ kind: 'block', jobId: 'j' })).toBe('booked')
    expect(['working', 'ready_to_bill', 'billed', 'paid', 'waiting'].map((to) => feltStep({ kind: 'move', jobId: 'j', toStatus: to }))).toEqual([
      'working',
      'done',
      'billed',
      'paid',
      null,
    ])
  })
})

describe('stageSendFor', () => {
  it('an offers step (v2.5595) prepares the Working line for Today’s sends instead of sending it', () => {
    const s = stageSendFor(WORKING, readingOf(DANA), LINES, settings({ appSends: { residential: { working: 'offer' } } }))
    expect(s.kept).toBeNull()
    expect(s.kept === null ? [s.mode, s.text.event] : null).toEqual(['offer', 'The app prepared the Working line for Today’s sends.'])
    const sent = stageSendFor(WORKING, readingOf(DANA), LINES, settings())
    expect(sent.kept === null ? sent.mode : null).toBe('send')
  })

  it('Waiting to Working, the step on: sends the Working line once, and not twice that day', () => {
    const first = stageSendFor(WORKING, readingOf(DANA), LINES, settings())
    expect(first.text).toEqual({
      contactId: 'c-dana',
      stepId: 'working',
      jobId: 'job-1312',
      body: 'Dana, we started on the water heater this morning. We will text you when we are done.',
      record: { contactId: 'c-dana', stepId: 'working', jobId: 'job-1312', at: NOW.toISOString(), by: 'app', how: 'text' },
      event: 'The app sent the Working line by text.',
    })
    const again = stageSendFor(WORKING, readingOf(DANA), LINES, settings({ sent: [first.text!.record] }))
    expect(again.kept).toEqual({ stepId: 'working', jobId: 'job-1312', why: 'sent today', words: 'this step went today already' })
    const tomorrow = new Date('2026-10-13T14:00:00Z')
    expect(why(stageSendFor(WORKING, readingOf(DANA), LINES, settings({ sent: [first.text!.record], now: tomorrow })))).toBe('sent')
  })

  it('a reminder one of ours sent today for the step counts too', () => {
    const rosa: NudgeSent = { contactId: 'c-dana', stepId: 'working', jobId: 'job-1312', at: '2026-10-12T14:00:00Z', by: 'u-rosa', how: 'text' }
    expect(why(stageSendFor(WORKING, readingOf(DANA), LINES, settings({ sent: [rosa] })))).toBe('sent today')
    const otherJob = { ...rosa, jobId: 'job-1298' }
    expect(why(stageSendFor(WORKING, readingOf(DANA), LINES, settings({ sent: [otherJob] })))).toBe('sent')
  })

  it('sends nothing for a step that is off', () => {
    expect(why(stageSendFor(WORKING, readingOf(DANA), LINES, settings({ appSends: {} })))).toBe('off')
    expect(why(stageSendFor(WORKING, readingOf(DANA), LINES, settings({ appSends: { residential: { paid: true } } })))).toBe('off')
  })

  it('sends nothing to a number that sent STOP, or with no number', () => {
    expect(why(stageSendFor(WORKING, readingOf(DANA), LINES, settings({ number: { ...NUMBER, optedOut: true } })))).toBe('opted out')
    expect(why(stageSendFor(WORKING, readingOf(DANA), LINES, settings({ number: null })))).toBe('no number')
  })

  it('scheduled: dispatch block sends the Booked line', () => {
    const booked = stageSendFor({ kind: 'block', jobId: 'job-1312' }, readingOf(DANA), LINES, settings())
    expect(booked.text?.body).toBe('Dana, you are on our schedule for the water heater. Luis will text when he is on the way.')
    expect(booked.text?.event).toBe('The app sent the Booked line by text.')
  })

  it('a line with a blank the app cannot fill yet sends nothing, and says which', () => {
    const daily = [line('qr-booked', 'booked', '{first}, we have you down for {day} between {window}. Reply here if that changes.')]
    const s = stageSendFor({ kind: 'block', jobId: 'job-1312' }, readingOf(DANA), daily, settings())
    expect(s.kept).toEqual({ stepId: 'booked', jobId: 'job-1312', why: 'blanks left', words: 'the line still has {day} and {window}' })
  })

  it('sends nothing the flow does not read done, a move nobody feels, a step with no line, or someone off the flow', () => {
    expect(why(stageSendFor({ kind: 'move', jobId: 'job-1312', toStatus: 'billed' }, readingOf(DANA), LINES, settings()))).toBe('not done')
    expect(why(stageSendFor({ kind: 'move', jobId: 'job-1312', toStatus: 'waiting' }, readingOf(DANA), LINES, settings()))).toBe('not felt')
    const done: ResidentialRows = {
      ...DANA,
      jobs: [job({ id: 'job-1312', status: 'ready_to_bill' })],
      statusEvents: [...DANA.statusEvents!, { job_id: 'job-1312', to_status: 'ready_to_bill', changed_at: '2026-10-12T16:30:00Z', changed_by_user_id: 'u-rosa' }],
    }
    expect(why(stageSendFor({ kind: 'move', jobId: 'job-1312', toStatus: 'ready_to_bill' }, readingOf(done), LINES, settings()))).toBe('no line')
    const off: ResidentialRows = { ...DANA, contact: { ...DANA.contact, off_since: '2026-10-10', off_why: 'Moved away.', off_by: 'u-rosa' } }
    expect(why(stageSendFor(WORKING, readingOf(off), LINES, settings()))).toBe('off the flow')
  })

  it('Paid sends once her bill is covered', () => {
    const paid: ResidentialRows = {
      ...DANA,
      jobs: [job({ id: 'job-1312', status: 'paid' })],
      invoices: [
        {
          id: 'inv-1312',
          job_id: 'job-1312',
          status: 'paid',
          amount: 1850,
          sequence_order: 1,
          billed_at: '2026-10-09T15:00:00Z',
          sent_to_customer_at: null,
          estimated_bill_date: null,
          created_at: '2026-10-08T22:00:00Z',
          sent_by_user_id: 'u-rosa',
          bill_to_party: null,
          bill_to_email: null,
        },
      ],
      payments: [{ job_id: 'job-1312', invoice_id: 'inv-1312', amount: 1850, paid_on: '2026-10-12', sequence_order: null }],
    }
    const s = stageSendFor({ kind: 'move', jobId: 'job-1312', toStatus: 'paid' }, readingOf(paid), LINES, settings())
    expect(s.text?.body).toBe('Dana, your payment came through. Thank you for choosing Click Plumbing.')
  })

  it('every word it writes passes the plain words rules', () => {
    const reasons: StageNotSent[] = ['not felt', 'off the flow', 'off', 'not done', 'sent today', 'no number', 'opted out', 'no line', 'blanks left']
    const words = [...reasons.map((r) => stageNotSentWords(r, r === 'blanks left' ? ['day', 'window'] : [])), 'The app sent the Working line by text.']
    expect(words.flatMap(plainWordsFailures)).toEqual([])
  })
})

describe('boardDot', () => {
  const contact: QueueContact = { id: 'c-dana', kind: 'customer', name: 'Dana Whitfield', state: 'waiting' }
  const msg = (p: Partial<BoardDotMessage & QueueMessage> & Pick<BoardDotMessage, 'id' | 'direction' | 'at' | 'body'>): BoardDotMessage & QueueMessage => ({
    contactId: 'c-dana',
    jobId: 'job-1312',
    channel: 'text',
    subject: null,
    backOn: null,
    backBy: null,
    ...p,
  })
  const ASK = msg({ id: 'm-ask', direction: 'in', at: '2026-10-12T14:05:00Z', body: 'Can you do Thursday?\nAlso is the water heater quote still good?' })
  const dotFor = (contacts: QueueContact[], messages: Array<BoardDotMessage & QueueMessage>, jobId = 'job-1312') =>
    boardDot(needsReply(contacts, messages, [], '2026-10-12'), messages, { 'c-dana': 'Dana' }, jobId, NOW)

  it('a customer line waiting with nobody answered shows the dot, its hover in parts', () => {
    const hover = dotFor([contact], [ASK])
    expect(hover).toEqual({ who: 'Dana', channel: 'text', when: '9:05 AM', line: 'Can you do Thursday?', status: 'Nobody has answered.' })
    expect(Object.values(hover!).flatMap(plainWordsFailures)).toEqual([])
  })

  it('an older line says its day', () => {
    expect(dotFor([contact], [{ ...ASK, at: '2026-10-11T21:05:00Z' }])?.when).toBe('yesterday')
  })

  it('no dot once one of ours answered, once the row is done, or on another job', () => {
    const reply = msg({ id: 'm-reply', direction: 'out', at: '2026-10-12T15:00:00Z', body: 'Dana, Thursday works.' })
    expect(dotFor([contact], [ASK, reply])).toBeNull()
    expect(dotFor([{ ...contact, state: 'done' }], [ASK])).toBeNull()
    expect(dotFor([contact], [ASK], 'job-1298')).toBeNull()
  })
})
