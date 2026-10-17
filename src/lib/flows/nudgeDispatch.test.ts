import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { QuickReply } from '../quickReplies/kernel'
import { at, day, demoPeople, demoPerson, type Seed } from './demoPeople.fixture'
import {
  appSendMode,
  NUDGE_LINE_STEPS,
  notSentWords,
  nudgeLine,
  OFFER_HELD,
  planNudgeRun,
  type AppSends,
  type NudgeNotSent,
  type NudgeRunInput,
  type NudgeSent,
  type TextNumber,
} from './nudgeDispatch'
import type { PersonFlow } from './nudges'
import { SEED_FLOWS } from './seed'
import { stepById } from './state'

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
    const def = stepById(SEED_FLOWS.trade, id) ?? stepById(SEED_FLOWS.customer, id) ?? stepById(SEED_FLOWS.arch, id)
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

  it('reads in plain words for every step that has words of its own', () => {
    const failures = NUDGE_LINE_STEPS.flatMap((id) => plainWordsFailures(nudgeLine(tom, step(id), [], 'click.co/t/7Hq2')))
    expect(failures).toEqual([])
  })
})
