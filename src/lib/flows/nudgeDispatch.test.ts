import { describe, expect, it } from 'vitest'
import { payLinkUrl } from '../billing/payLink'
import { billPapers, type PaperInvoiceRow, type PaperPaymentRow } from '../messages/papers'
import { plainWordsFailures } from '../plainWords'
import type { QuickReply } from '../quickReplies/kernel'
import { at, day, demoPeople, demoPerson, type Seed } from './demoPeople.fixture'
import type { FactId } from './facts'
import {
  appSendMode,
  blanksLeftWords,
  NUDGE_LINE_STEPS,
  notSentWords,
  nudgeLine,
  OFFER_HELD,
  offerHeldBlanks,
  planNudgeRun,
  type AppSends,
  type NudgeNotSent,
  type NudgeRunInput,
  type NudgeSent,
  type TextNumber,
} from './nudgeDispatch'
import type { PersonFlow } from './nudges'
import { SEED_FLOWS } from './seed'
import { readFlow, stepById, type FactStamp, type FlowStamps, type RoundStamp } from './state'

/** The run's morning: Fri Oct 2, 9 AM Central. */
const MORNING = new Date(at(10, 2, 9))

/**
 * Tom as the run is drawn for: invited Fri Sep 25 and on Portal opened since, with nothing from us since the
 * invitation. The prototype's Tom pressed Got it on Mon Sep 28, and we texted Tom on Wed Sep 30; either would keep a
 * three-day reminder back on Fri Oct 2.
 */
const tomOnPortal = (seed: Seed): Seed => {
  seed.steps.portal = { state: 'now', since: day(9, 25) }
  seed.steps.papers = { state: 'next' }
  return { ...seed, nowStepId: 'portal', quietDays: null, lastOutAt: at(9, 25, 10) }
}

/** The demo people's numbers, as the prototype has them. */
const NUMBERS: Record<string, TextNumber> = {
  greg: { number: '(210) 555-0113', optedOut: false },
  elena: { number: '(210) 555-0188', optedOut: false },
  priya: { number: '(210) 555-0144', optedOut: false },
  bill: { number: '(210) 555-0121', optedOut: false },
  tom: { number: '(210) 555-0130', optedOut: false },
  jonah: { number: '(210) 555-0160', optedOut: false },
  marcus: { number: '(210) 555-0177', optedOut: false },
  unk1: { number: '(830) 555-0172', optedOut: false },
}

const PORTAL_ON: AppSends = { trade: { portal: true } }

const run = (input: Partial<NudgeRunInput> = {}, change: Record<string, (seed: Seed) => Seed> = { tom: tomOnPortal }) =>
  planNudgeRun({
    people: demoPeople(change),
    now: MORNING,
    appSends: {},
    sent: [],
    numbers: NUMBERS,
    links: { tom: 'click.co/t/7Hq2' },
    ...input,
  })

/** Tom's Portal opened reminder, kept back. */
const tomKept = (why: NudgeNotSent) => ({ contactId: 'tom', stepId: 'portal', jobId: null, why, words: notSentWords(why) })

const TOMS_TEXT = {
  contactId: 'tom',
  stepId: 'portal',
  jobId: null,
  body: 'Tom, did the invite come through? Your portal is at click.co/t/7Hq2.',
  record: { contactId: 'tom', stepId: 'portal', jobId: null, at: MORNING.toISOString(), by: 'app', how: 'text' },
  event: 'The app sent the Portal opened reminder by text.',
}

describe('the morning run', () => {
  it('sends nothing while every step is off, and says which reminder it kept back', () => {
    expect(run()).toEqual({
      texts: [],
      offers: [],
      notSent: [{ contactId: 'tom', stepId: 'portal', jobId: null, why: 'off', words: 'the app does not send this step yet' }],
    })
    expect(run({}, {}).texts).toEqual([])
  })

  it('sends Tom one text once Portal opened is on, and only Tom: the other reminders are ours to send', () => {
    expect(run({ appSends: PORTAL_ON })).toEqual({ texts: [TOMS_TEXT], offers: [], notSent: [] })
  })

  it('sends none on a second run the same morning, from what the first wrote to nudge_sent', () => {
    const first = run({ appSends: PORTAL_ON })
    const second = run({ appSends: PORTAL_ON, sent: first.texts.map((t) => t.record), now: new Date(at(10, 2, 9, 5)) })
    expect(second).toEqual({ texts: [], offers: [], notSent: [tomKept('sent lately')] })
  })

  it('waits out the step’s days after one of ours sent it, then sends', () => {
    const byRosa = (d: number): NudgeSent => ({ contactId: 'tom', stepId: 'portal', jobId: null, at: at(10, d, 15), by: 'rosa', how: 'text' })
    expect(run({ appSends: PORTAL_ON, sent: [byRosa(1)] }).notSent).toEqual([tomKept('sent lately')])
    const threeDays: NudgeSent = { ...byRosa(1), at: at(9, 29, 15) }
    expect(run({ appSends: PORTAL_ON, sent: [threeDays] }).texts).toEqual([TOMS_TEXT])
  })

  it('sends a reminder with no quiet days of its own once a day at most', () => {
    const pressed = (seed: Seed): Seed => ({ ...tomOnPortal(seed), marks: [{ stepId: 'portal', jobId: null, nudgedAt: at(10, 1, 16) }] })
    const people = demoPeople({ tom: pressed }).map((p): PersonFlow => {
      if (p.id !== 'tom') return p
      const lanes = p.flow.lanes.map((l) => ({
        ...l,
        steps: l.steps.map((s) => (s.id === 'portal' && s.nudge ? { ...s, nudge: { ...s.nudge, days: 0 } } : s)),
      }))
      return { ...p, flow: { ...p.flow, lanes } }
    })
    const input = { people, now: MORNING, appSends: PORTAL_ON, sent: [] as NudgeSent[], numbers: NUMBERS }
    const first = planNudgeRun(input)
    expect(first.texts.map((t) => t.contactId)).toEqual(['tom'])
    expect(planNudgeRun({ ...input, sent: first.texts.map((t) => t.record) }).texts).toEqual([])
  })

  it('never texts a number that sent STOP, or a person with no number', () => {
    expect(run({ appSends: PORTAL_ON, numbers: { ...NUMBERS, tom: { number: '(210) 555-0130', optedOut: true } } }).notSent).toEqual([
      tomKept('opted out'),
    ])
    expect(run({ appSends: PORTAL_ON, numbers: { ...NUMBERS, tom: { number: null, optedOut: false } } }).notSent).toEqual([tomKept('no number')])
  })

  it('leaves out a person with a hold, and a reminder that is not due', () => {
    const held = (seed: Seed): Seed => ({ ...tomOnPortal(seed), marks: [{ stepId: 'portal', jobId: null, holdUntil: '2026-10-05' }] })
    expect(run({ appSends: PORTAL_ON }, { tom: held })).toEqual({ texts: [], offers: [], notSent: [] })
    const wroteYesterday = (seed: Seed): Seed => ({ ...tomOnPortal(seed), lastOutAt: at(10, 1, 15) })
    expect(run({ appSends: PORTAL_ON }, { tom: wroteYesterday })).toEqual({ texts: [], offers: [], notSent: [] })
  })

  it('keeps quiet for a person snoozed on Follow up until the snooze day: Priya, snoozed until Mon', () => {
    // Priya's open change order, with its reminder sent by the app and switched on, and no portal row to take it.
    const people = demoPeople().map((p): PersonFlow => {
      if (p.id !== 'priya') return p
      const lanes = p.flow.lanes.map((l) => ({
        ...l,
        steps: l.steps.map((s) => (s.id === 'co' && s.nudge ? { ...s, nudge: { ...s.nudge, send: 'app' as const } } : s)),
      }))
      return { ...p, flow: { ...p.flow, lanes } }
    })
    const input: NudgeRunInput = { people, now: MORNING, appSends: { customer: { co: true } }, sent: [], numbers: NUMBERS }
    expect(planNudgeRun(input).texts.map((t) => [t.contactId, t.jobId, t.body])).toEqual([
      ['priya', 'helotes', 'Priya, the change order is in your portal to sign or decline.'],
    ])
    const snoozed = planNudgeRun({ ...input, snoozed: { priya: '2026-10-05' } })
    expect(snoozed).toEqual({
      texts: [],
      offers: [],
      notSent: [{ contactId: 'priya', stepId: 'co', jobId: 'helotes', why: 'snoozed', words: 'snoozed until Mon Oct 5' }],
    })
    const monday = planNudgeRun({ ...input, snoozed: { priya: '2026-10-05' }, now: new Date(at(10, 5, 9)) })
    expect(monday.texts.map((t) => t.contactId)).toEqual(['priya'])
  })

  it('sends only a text: a step whose reminder is a call stays with us', () => {
    const people = demoPeople({ tom: tomOnPortal }).map((p): PersonFlow => {
      if (p.id !== 'tom') return p
      const lanes = p.flow.lanes.map((l) => ({
        ...l,
        steps: l.steps.map((s) => (s.id === 'portal' && s.nudge ? { ...s, nudge: { ...s.nudge, how: 'call' as const } } : s)),
      }))
      return { ...p, flow: { ...p.flow, lanes } }
    })
    expect(planNudgeRun({ people, now: MORNING, appSends: PORTAL_ON, sent: [], numbers: NUMBERS }).notSent).toEqual([tomKept('not a text')])
  })

  it('takes the team’s quick reply for the step over the step’s own words', () => {
    const line: QuickReply = {
      id: 'qr-portal',
      text: 'Did the invite come through? Your portal is at click.co/t/7Hq2.',
      for: 'trade',
      stepId: 'portal',
      scope: 'team',
      addedBy: 'robert',
      addedAt: Date.parse('2026-09-12T14:14:00Z'),
      removed: false,
      uses: {},
      lastUsed: null,
    }
    expect(run({ appSends: PORTAL_ON, quickReplies: [line] }).texts[0]?.body).toBe('Did the invite come through? Your portal is at click.co/t/7Hq2.')
  })
})

describe('the morning run’s offers (v2.5595)', () => {
  const PORTAL_OFFERS: AppSends = { trade: { portal: 'offer' } }
  const TOMS_OFFER = { ...TOMS_TEXT, event: 'The app prepared the Portal opened reminder for Today’s sends.', held: null }

  it('prepares Tom’s text for the office to press instead of sending it', () => {
    expect(run({ appSends: PORTAL_OFFERS })).toEqual({ texts: [], offers: [TOMS_OFFER], notSent: [] })
  })

  it('holds the prepared text with why when there is no number or it sent STOP, instead of keeping it back', () => {
    expect(run({ appSends: PORTAL_OFFERS, numbers: { ...NUMBERS, tom: { number: null, optedOut: false } } }).offers).toEqual([{ ...TOMS_OFFER, held: OFFER_HELD['no number'] }])
    expect(run({ appSends: PORTAL_OFFERS, numbers: { ...NUMBERS, tom: { number: '(210) 555-0130', optedOut: true } } }).offers).toEqual([{ ...TOMS_OFFER, held: OFFER_HELD['opted out'] }])
  })

  it('never prepares a second while one waits on Today’s sends, nor sends over one when the step turns to Sends', () => {
    const offered = [{ contactId: 'tom', stepId: 'portal', jobId: null }]
    expect(run({ appSends: PORTAL_OFFERS, offered })).toEqual({ texts: [], offers: [], notSent: [tomKept('offered')] })
    expect(run({ appSends: PORTAL_ON, offered })).toEqual({ texts: [], offers: [], notSent: [tomKept('offered')] })
  })

  it('reads the pressed text as sent lately, like any reminder, so the next morning waits out the step’s days', () => {
    const pressed: NudgeSent = { contactId: 'tom', stepId: 'portal', jobId: null, at: at(10, 1, 15), by: 'rosa', how: 'text' }
    expect(run({ appSends: PORTAL_OFFERS, sent: [pressed] })).toEqual({ texts: [], offers: [], notSent: [tomKept('sent lately')] })
  })

  it('holds or keeps back a text for a person who asked for email (v2.5597)', () => {
    expect(run({ appSends: PORTAL_ON, prefers: { tom: 'email' } })).toEqual({ texts: [], offers: [], notSent: [tomKept('prefers email')] })
    expect(run({ appSends: PORTAL_OFFERS, prefers: { tom: 'email' } }).offers).toEqual([{ ...TOMS_OFFER, held: OFFER_HELD['prefers email'] }])
    expect(run({ appSends: PORTAL_ON, prefers: { tom: 'text' } }).texts).toEqual([TOMS_TEXT])
    expect(run({ appSends: PORTAL_ON, prefers: { tom: 'either' } }).texts).toEqual([TOMS_TEXT])
  })

  it('reads the switch three ways, and holds and keeps back in plain words', () => {
    expect(appSendMode({ trade: { portal: true, msa: 'offer' } }, 'trade', 'portal')).toBe('send')
    expect(appSendMode({ trade: { portal: true, msa: 'offer' } }, 'trade', 'msa')).toBe('offer')
    expect(appSendMode({ trade: { portal: true } }, 'trade', 'sow')).toBe('off')
    expect(appSendMode({ trade: { portal: true } }, 'customer', 'portal')).toBe('off')
    for (const w of [...Object.values(OFFER_HELD), notSentWords('offered')]) expect(plainWordsFailures(w), w).toEqual([])
  })
})

describe('the reminder’s own line', () => {
  const tom = demoPerson('tom')
  const step = (id: string) => {
    const def = stepById(SEED_FLOWS.trade, id) ?? stepById(SEED_FLOWS.customer, id) ?? stepById(SEED_FLOWS.arch, id) ?? stepById(SEED_FLOWS.residential, id)
    if (!def) throw new Error(`no step ${id}`)
    return def
  }

  it('checks on a paper of theirs with their portal link, and checks in on a step with no words of its own', () => {
    expect(nudgeLine(tom, step('papers'), [], 'click.co/t/7Hq2')).toBe('Tom, checking on your W-9. You can upload it here: click.co/t/7Hq2')
    expect(nudgeLine(tom, step('papers'))).toBe('Tom, checking on your W-9.')
    expect(nudgeLine(tom, step('portal'))).toBe('Tom, did the invite come through?')
    expect(nudgeLine(demoPerson('elena'), step('onsite'))).toBe('Elena, checking in on on site. Anything you need from us?')
  })

  it('adds the upload line to the team’s quick reply when the step waits on a paper of theirs', () => {
    const line: QuickReply = {
      id: 'qr-papers',
      text: 'Send the W-9 when you can, and the insurance certificate too.',
      for: 'trade',
      stepId: 'papers',
      scope: 'team',
      addedBy: 'rosa',
      addedAt: Date.parse('2026-09-24T15:00:00Z'),
      removed: false,
      uses: {},
      lastUsed: null,
    }
    expect(nudgeLine(tom, step('papers'), [line], 'click.co/t/7Hq2')).toBe(
      'Send the W-9 when you can, and the insurance certificate too.\nYou can upload it here: click.co/t/7Hq2',
    )
  })

  it('has words of its own for the residential steps that wait on the customer (punch list #140 PR 4)', () => {
    const dana = { first: 'Dana', reading: { kind: 'residential' as const } }
    expect(nudgeLine(dana, step('approved'))).toBe('Dana, any word on the estimate? Happy to answer any questions.')
    expect(nudgeLine(dana, step('paid'))).toBe('Dana, checking on the bill. Need the pay page sent again?')
  })

  it('reads in plain words for every step that has words of its own', () => {
    const failures = NUDGE_LINE_STEPS.flatMap((id) => plainWordsFailures(nudgeLine(tom, step(id), [], 'click.co/t/7Hq2')))
    expect(failures).toEqual([])
  })
})

describe('a line with a blank the run cannot fill (punch list #124, v2.6079)', () => {
  const PORTAL_OFFERS: AppSends = { trade: { portal: 'offer' } }
  const portalLine = (text: string): QuickReply => ({
    id: 'qr-portal',
    text,
    for: 'trade',
    stepId: 'portal',
    scope: 'team',
    addedBy: 'robert',
    addedAt: Date.parse('2026-09-12T14:14:00Z'),
    removed: false,
    uses: {},
    lastUsed: null,
  })
  const BILL_LINE = '{first}, {amount} is still open. Pay it here: {bill}'
  const tomsBlanks = { contactId: 'tom', stepId: 'portal', jobId: null }

  it('fills their page’s link itself, as it fills the first name and the job, so a line that points at it goes', () => {
    expect(run({ appSends: PORTAL_ON, quickReplies: [portalLine('{first}, your portal is at {link}.')] }).texts[0]?.body).toBe('Tom, your portal is at click.co/t/7Hq2.')
  })

  it('keeps back a text whose line still has a blank only the box fills at a press, naming the blanks', () => {
    expect(run({ appSends: PORTAL_ON, quickReplies: [portalLine(BILL_LINE)] })).toEqual({
      texts: [],
      offers: [],
      notSent: [{ ...tomsBlanks, why: 'blanks left', words: 'the line still has {amount} and {bill}' }],
    })
    expect(run({ appSends: PORTAL_ON, quickReplies: [portalLine('{first}, your portal is at {link}.')], links: {} }).notSent).toEqual([
      { ...tomsBlanks, why: 'blanks left', words: 'the line still has {link}' },
    ])
  })

  it('holds the prepared text with why and its door instead of keeping it back, so Today’s sends shows it', () => {
    const r = run({ appSends: PORTAL_OFFERS, quickReplies: [portalLine(BILL_LINE)] })
    expect(r.notSent).toEqual([])
    expect(r.offers).toEqual([expect.objectContaining({ ...tomsBlanks, body: 'Tom, {amount} is still open. Pay it here: {bill}', held: offerHeldBlanks(['amount', 'bill']) })])
  })

  it('says the person’s reason first: no number, STOP or email before the line’s blank', () => {
    const noNumber = { ...NUMBERS, tom: { number: null, optedOut: false } }
    expect(run({ appSends: PORTAL_ON, quickReplies: [portalLine(BILL_LINE)], numbers: noNumber }).notSent).toEqual([tomKept('no number')])
    expect(run({ appSends: PORTAL_OFFERS, quickReplies: [portalLine(BILL_LINE)], numbers: noNumber }).offers[0]?.held).toBe(OFFER_HELD['no number'])
  })

  it('leaves {rate} to the edge’s mint: a review line goes with the blank in it', () => {
    const r = run({ appSends: PORTAL_ON, quickReplies: [portalLine('{first}, how did we do? {rate}')] })
    expect(r.notSent).toEqual([])
    expect(r.texts[0]?.body).toBe('Tom, how did we do? {rate}')
  })

  it('reads in plain words, and names three blanks as a list', () => {
    expect(blanksLeftWords(['amount', 'job', 'bill'])).toBe('the line still has {amount}, {job} and {bill}')
    expect(blanksLeftWords([])).toBe('the line still has a blank')
    for (const w of [offerHeldBlanks(['amount', 'bill']), offerHeldBlanks([]), notSentWords('blanks left', null, ['bill'])]) expect(plainWordsFailures(w), w).toEqual([])
  })
})

describe('the Paid reminder’s bill: {amount}, {bill} and {number} filled from the job’s newest open bill (punch list #124, v2.6224)', () => {
  const RESIDENTIAL = SEED_FLOWS.residential
  /** Wed Oct 14, 9 AM Central: the morning after Dana’s pay-by day. */
  const BILL_MORNING = new Date('2026-10-14T14:00:00Z')
  const INV = '0f4b6a1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b'
  const mark = (fact: FactId, m: 'ok' | 'wait', when: string): FactStamp => ({ fact, mark: m, at: when, by: null, until: null })
  const round = (stamps: FactStamp[], due: string | null): RoundStamp => ({ key: INV, name: 'Bill 1', opened: '2026-10-08', due, stamps })

  /** Dana on job 1312, every step done through Billed, her bill out Oct 8 and past its pay-by day, Oct 13. */
  function dana(): PersonFlow {
    const stamps: FlowStamps = {
      kind: 'residential',
      jobIds: ['1312'],
      defaultJobId: '1312',
      person: { stamps: [], rounds: {}, dues: {} },
      jobs: {
        '1312': {
          jobId: '1312',
          stamps: (['booked', 'on_way', 'arrived', 'found', 'estimate_sent', 'estimate_approved', 'working', 'done'] as FactId[]).map((f) => mark(f, 'ok', '2026-10-05')),
          rounds: { billed: [round([mark('billed', 'ok', '2026-10-08')], null)], paid: [round([mark('paid', 'wait', '2026-10-08')], '2026-10-13')] },
          dues: {},
        },
      },
      skips: [],
      waits: [],
      off: null,
    }
    return {
      id: 'dana',
      first: 'Dana',
      flow: RESIDENTIAL,
      reading: readFlow(RESIDENTIAL, stamps, BILL_MORNING),
      quietDays: 6,
      lastOutAt: '2026-10-08T16:00:00Z',
      court: 'theirs',
      owe: false,
      marks: [],
      notes: [],
      sends: {},
      portal: null,
      jobs: { '1312': 'the water heater' },
    }
  }

  /** The starter Paid line (`20261029200000_quick_replies_starter.sql`). */
  const PAID_LINE: QuickReply = {
    id: 'qr-remind',
    text: '{first}, a reminder that {amount} for {job} is still open. You can pay it here: {bill}',
    for: 'customer',
    stepId: 'paid',
    scope: 'team',
    addedBy: 'robert',
    addedAt: Date.parse('2026-10-29T14:00:00Z'),
    removed: false,
    uses: {},
    lastUsed: null,
  }
  const JOB = { id: '1312', status: 'billed', revenue: 1200, payments_made: 0, collections_at: null, uncollectible_at: null, job_name: 'the water heater', hcp_number: '1312', click_number: null, billing_only: false }
  const invoice = (p: Partial<PaperInvoiceRow> = {}): PaperInvoiceRow => ({ id: INV, job_id: '1312', status: 'billed', amount: 1200, sequence_order: 1, billed_at: '2026-10-08T15:00:00Z', stripe_invoice_id: 'in_1Q2w3e', ...p })
  const paid = (amount: number): PaperPaymentRow => ({ invoice_id: INV, job_id: '1312', amount, paid_on: '2026-10-10', sequence_order: null })
  const papersOf = (invoices: PaperInvoiceRow[], payments: PaperPaymentRow[] = []) => ({ dana: billPapers({ jobs: [JOB], invoices, payments }) })

  const runDana = (input: Partial<NudgeRunInput> = {}) =>
    planNudgeRun({
      people: [dana()],
      now: BILL_MORNING,
      appSends: { residential: { paid: true } },
      sent: [],
      numbers: { dana: { number: '(210) 555-0101', optedOut: false } },
      quickReplies: [PAID_LINE],
      ...input,
    })
  const danasPaid = { contactId: 'dana', stepId: 'paid', jobId: '1312' }

  it('fills what is left on the bill, as the box formats it, and the bill’s own pay page, so the Paid line goes on Sends', () => {
    const r = runDana({ papers: papersOf([invoice()], [paid(559.5)]) })
    expect(r.notSent).toEqual([])
    expect(r.texts.map((t) => [t.contactId, t.stepId, t.jobId, t.body])).toEqual([
      ['dana', 'paid', '1312', `Dana, a reminder that $640.50 for the water heater is still open. You can pay it here: ${payLinkUrl(INV)}`],
    ])
    expect(payLinkUrl(INV)).toBe(`https://clicktooling.com/pay/${INV}`)
  })

  it('writes whole dollars with no cents, and the job’s number for {number}', () => {
    const line = { ...PAID_LINE, text: '{first}, bill {number} for {job} has {amount} open: {bill}' }
    expect(runDana({ papers: papersOf([invoice()]), quickReplies: [line] }).texts[0]?.body).toBe(`Dana, bill 1312 for the water heater has $1,200 open: ${payLinkUrl(INV)}`)
  })

  it('keeps the v2.6079 hold, naming the blanks, for a customer with no open bill: none read, or the bill paid', () => {
    expect(runDana()).toEqual({ texts: [], offers: [], notSent: [{ ...danasPaid, why: 'blanks left', words: 'the line still has {amount} and {bill}' }] })
    expect(runDana({ papers: papersOf([invoice()], [paid(1200)]) }).notSent).toEqual([{ ...danasPaid, why: 'blanks left', words: 'the line still has {amount} and {bill}' }])
    const offers = runDana({ appSends: { residential: { paid: 'offer' } } })
    expect(offers.notSent).toEqual([])
    expect(offers.offers).toEqual([expect.objectContaining({ ...danasPaid, body: 'Dana, a reminder that {amount} for the water heater is still open. You can pay it here: {bill}', held: offerHeldBlanks(['amount', 'bill']) })])
  })

  it('fills the amount but leaves {bill} for a bill billed outside Stripe, which has no pay page, so the text waits', () => {
    const r = runDana({ papers: papersOf([invoice({ stripe_invoice_id: null })], [paid(559.5)]) })
    expect(r.texts).toEqual([])
    expect(r.notSent).toEqual([{ ...danasPaid, why: 'blanks left', words: 'the line still has {bill}' }])
    const offer = runDana({ appSends: { residential: { paid: 'offer' } }, papers: papersOf([invoice({ stripe_invoice_id: null })], [paid(559.5)]) }).offers[0]
    expect(offer?.body).toBe('Dana, a reminder that $640.50 for the water heater is still open. You can pay it here: {bill}')
    expect(offer?.held).toBe(offerHeldBlanks(['bill']))
  })

  it('speaks of the step’s job’s bill and no other job’s, as a job’s box does', () => {
    const other = invoice({ id: '7a1c2d3e-4f50-4617-8899-aabbccddeeff', job_id: '2000', amount: 300 })
    const otherJob = { ...JOB, id: '2000', revenue: 300, job_name: 'the kitchen sink' }
    const papers = { dana: billPapers({ jobs: [JOB, otherJob], invoices: [other], payments: [] }) }
    expect(runDana({ papers }).notSent).toEqual([{ ...danasPaid, why: 'blanks left', words: 'the line still has {amount} and {bill}' }])
  })

  it('fills the app’s own Paid words untouched, which carry no blank, and the person’s reason still comes first', () => {
    expect(runDana({ quickReplies: [], papers: papersOf([invoice()]) }).texts[0]?.body).toBe('Dana, checking on the bill. Need the pay page sent again?')
    expect(runDana({ numbers: { dana: { number: null, optedOut: false } } }).notSent).toEqual([{ ...danasPaid, why: 'no number', words: notSentWords('no number') }])
  })
})
