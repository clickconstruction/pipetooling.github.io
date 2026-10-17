import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { QuickReply } from '../quickReplies/kernel'
import {
  APP_SEND_MODE_HINT,
  APP_SEND_MODE_WORDS,
  APP_SENDS_OWNER_ONLY,
  APP_SENDS_SAVE_FIRST,
  APP_SENDS_TEXTS_ONLY,
  appSendMode,
  appSendOn,
  appSendSetWords,
  appSendsFrom,
  appSendsText,
  appSendSwitch,
  canSetAppSends,
  LAST_RUN_NONE,
  lastRunFrom,
  lastRunLine,
  runSendsStep,
  stepNudgeWords,
  withAppSend,
} from './appSends'
import { SEED_FLOWS } from './seed'
import { flat, type FlowDef, type FlowStep } from './state'

const stepOf = (flow: FlowDef, id: string): FlowStep => flat(flow).find((s) => s.id === id)!
const withNudge = (flow: FlowDef, id: string, nudge: Partial<NonNullable<FlowStep['nudge']>>): FlowDef => ({
  ...flow,
  lanes: flow.lanes.map((l) => ({ ...l, steps: l.steps.map((s) => (s.id === id ? { ...s, nudge: { ...s.nudge!, ...nudge } } : s)) })),
})

// The trade partners' Portal opened is the seed's one reminder the app sends, as a text.
const trade = SEED_FLOWS.trade
const portal = stepOf(trade, 'portal')

describe('who turns a reminder on', () => {
  it('is the owner and a dev, as the setting’s policy allows', () => {
    expect(canSetAppSends('master_technician')).toBe(true)
    expect(canSetAppSends('dev')).toBe(true)
    for (const role of ['assistant', 'controller', 'estimator', 'superintendent', 'primary'] as const) expect(canSetAppSends(role)).toBe(false)
    expect(canSetAppSends(null)).toBe(false)
  })
})

describe('the switch, nested by kind', () => {
  it('reads a step as on only under its own kind, since a step id repeats across flows', () => {
    const sends = appSendsFrom('{"trade":{"portal":true,"msa":false},"customer":{"yes":"true"}}')
    expect(appSendOn(sends, 'trade', 'portal')).toBe(true)
    expect(appSendOn(sends, 'trade', 'msa')).toBe(false)
    expect(appSendOn(sends, 'customer', 'yes')).toBe(false)
    expect(appSendOn(sends, 'customer', 'portal')).toBe(false)
  })

  it('turns one step on or off, keeps the others, drops a kind with none on, and leaves the old switch as it was', () => {
    const was = appSendsFrom({ trade: { portal: true }, customer: { yes: true } })
    const on = withAppSend(was, 'trade', 'msa', 'send')
    expect(on).toEqual({ customer: { yes: true }, trade: { msa: true, portal: true } })
    expect(was).toEqual({ trade: { portal: true }, customer: { yes: true } })
    expect(withAppSend(on, 'customer', 'yes', 'off')).toEqual({ trade: { msa: true, portal: true } })
    expect(withAppSend({}, 'trade', 'portal', 'off')).toEqual({})
  })

  it('sets a step to offers (v2.5595), reads the three ways, and words each press', () => {
    const sends = withAppSend(withAppSend({}, 'trade', 'portal', 'offer'), 'residential', 'approved', 'send')
    expect(sends).toEqual({ trade: { portal: 'offer' }, residential: { approved: true } })
    expect(appSendsFrom(appSendsText(sends))).toEqual(sends)
    expect(appSendMode(sends, 'trade', 'portal')).toBe('offer')
    expect(appSendMode(sends, 'residential', 'approved')).toBe('send')
    expect(appSendOn(sends, 'trade', 'portal')).toBe(false)
    expect(withAppSend(sends, 'trade', 'portal', 'send')).toEqual({ trade: { portal: true }, residential: { approved: true } })
    expect(appSendSetWords('Portal opened', 'offer')).toBe('The app prepares the Portal opened reminder each morning for Today’s sends on the Dashboard.')
    const words = [...Object.values(APP_SEND_MODE_WORDS), ...Object.values(APP_SEND_MODE_HINT), ...(['off', 'offer', 'send'] as const).map((m) => appSendSetWords('Portal opened', m))]
    for (const w of words) expect(plainWordsFailures(w), w).toEqual([])
  })

  it('writes the same text for the same switch, which the run reads back as it was', () => {
    const a = withAppSend(withAppSend({}, 'trade', 'portal', 'send'), 'customer', 'yes', 'send')
    const b = withAppSend(withAppSend({}, 'customer', 'yes', 'send'), 'trade', 'portal', 'send')
    expect(appSendsText(a)).toBe(appSendsText(b))
    expect(appSendsText(a)).toBe('{"customer":{"yes":true},"trade":{"portal":true}}')
    expect(appSendsFrom(appSendsText(a))).toEqual(a)
    expect(appSendsText({})).toBe('{}')
  })
})

describe('the switch on a step', () => {
  it('shows only where the app sends the reminder', () => {
    expect(appSendSwitch(stepOf(trade, 'msa'), { canSet: true, saved: trade }).show).toBe(false)
    expect(appSendSwitch({ ...portal, nudge: null }, { canSet: true, saved: trade }).show).toBe(false)
  })

  it('is live for the owner on a saved text the app sends', () => {
    expect(appSendSwitch(portal, { canSet: true, saved: trade })).toEqual({ show: true, live: true, note: null })
  })

  it('reads only for anyone else, says texts only on a call or an email, and waits for Save on a draft’s change', () => {
    expect(appSendSwitch(portal, { canSet: false, saved: trade })).toEqual({ show: true, live: false, note: APP_SENDS_OWNER_ONLY })
    const call = { ...portal, nudge: { ...portal.nudge!, how: 'call' as const } }
    expect(appSendSwitch(call, { canSet: true, saved: trade }).note).toBe(APP_SENDS_TEXTS_ONLY)
    // The draft makes MSA signed the app's; the saved flow still asks a person.
    const msa = { ...stepOf(trade, 'msa'), nudge: { ...stepOf(trade, 'msa').nudge!, send: 'app' as const } }
    expect(appSendSwitch(msa, { canSet: true, saved: trade }).note).toBe(APP_SENDS_SAVE_FIRST)
    expect(appSendSwitch(msa, { canSet: true, saved: withNudge(trade, 'msa', { send: 'app' }) }).live).toBe(true)
    // A step only in the draft is not on the saved flow at all.
    expect(appSendSwitch({ ...portal, id: 'orientation' }, { canSet: true, saved: trade }).note).toBe(APP_SENDS_SAVE_FIRST)
    expect(appSendSwitch(portal, { canSet: true, saved: null }).note).toBe(APP_SENDS_SAVE_FIRST)
  })

  it('reads the saved flow the way the run does: the app sends it, as a text', () => {
    expect(runSendsStep(trade, 'portal')).toBe(true)
    expect(runSendsStep(withNudge(trade, 'portal', { how: 'email' }), 'portal')).toBe(false)
    expect(runSendsStep(trade, 'msa')).toBe(false)
    expect(runSendsStep(trade, 'nowhere')).toBe(false)
  })
})

describe('the words beside the switch', () => {
  const line = (over: Partial<QuickReply>): QuickReply => ({
    id: 'q1',
    text: 'Hi, did the portal invite reach you?',
    for: 'trade',
    stepId: 'portal',
    scope: 'team',
    addedBy: 'u-rosa',
    addedAt: 0,
    removed: false,
    uses: {},
    lastUsed: null,
    ...over,
  })

  it('are the step’s own words to the kind’s sample person, with no link', () => {
    expect(stepNudgeWords('trade', portal)).toBe('Chris, did the invite come through?')
    expect(stepNudgeWords('customer', stepOf(SEED_FLOWS.customer, 'contract'))).toBe('Sam, the contract is in your portal to sign.')
  })

  it('are the team’s quick reply for the step when it keeps one, as the run would send it', () => {
    expect(stepNudgeWords('trade', portal, [line({})])).toBe('Hi, did the portal invite reach you?')
    expect(stepNudgeWords('trade', portal, [line({ for: 'customer' })])).toBe('Chris, did the invite come through?')
    expect(stepNudgeWords('trade', portal, [line({ removed: true })])).toBe('Chris, did the invite come through?')
  })
})

describe('the newest morning run', () => {
  // 14:00 UTC is 9 AM Central on Tuesday, October 13, 2026.
  const at = '2026-10-13T14:00:00.000Z'
  const summary = {
    at,
    dry: false,
    sent: 0,
    kept: { off: 11, 'no number': 1 },
    textsOff: 0,
    refused: [],
    refusedCount: 0,
    unread: 0,
    customersHeld: 3,
    words: ['No text went.', '11 reminders were kept back because the app does not send that step yet.'],
  }

  it('is none yet as the setting ships, or when it does not read', () => {
    expect(lastRunFrom('{}')).toBeNull()
    expect(lastRunFrom({})).toBeNull()
    expect(lastRunFrom('not json')).toBeNull()
    expect(lastRunFrom(null)).toBeNull()
    expect(lastRunFrom('[1,2]')).toBeNull()
    expect(lastRunFrom({ at: 'Tuesday', sent: 2 })).toBeNull()
  })

  it('reads the run’s summary, and keeps no reason or count it does not know', () => {
    expect(lastRunFrom(JSON.stringify(summary))).toEqual({
      at,
      dry: false,
      sent: 0,
      kept: { off: 11, 'no number': 1 },
      textsOff: 0,
      refusedCount: 0,
      unread: 0,
      prepared: 0,
      morningSent: 0,
      words: summary.words,
    })
    const odd = lastRunFrom({ at, sent: -2, kept: { off: '3', stolen: 4, snoozed: 2.6 }, words: ['', 7, 'One.'], unread: Number.NaN })
    expect(odd).toMatchObject({ sent: 0, kept: { snoozed: 2 }, unread: 0, words: ['One.'], dry: false })
  })

  it('says the run in one line, with its day and why each reminder was kept back', () => {
    const run = lastRunFrom(summary)
    expect(lastRunLine(run, '2026-10-13T16:30:00.000Z')).toBe('Last morning run today at 9:00 AM: no text went, 12 kept back. 11 are off and 1 has no number.')
    expect(lastRunLine(run, '2026-10-15T16:30:00.000Z')).toMatch(/^Last morning run Tue, Oct 13 at 9:00 AM: no text went, 12 kept back\./)
    expect(lastRunLine(null, at)).toBe(LAST_RUN_NONE)
  })

  it('says a dry run first, counts Send texts off with the kept back, and says a text that did not go', () => {
    const run = lastRunFrom({ ...summary, dry: true, sent: 2, kept: { snoozed: 1, 'opted out': 1, 'one a morning': 2 }, textsOff: 3, refusedCount: 1 })
    expect(lastRunLine(run, '2026-10-13T16:30:00.000Z')).toBe(
      'A dry run. Last morning run today at 9:00 AM: 2 texts would go, 7 kept back. 1 is snoozed, 1 sent STOP, 2 already have a text this morning and 3 wait on Send texts. 1 text did not go.',
    )
    expect(lastRunLine(lastRunFrom({ at, sent: 1 }), '2026-10-13T16:30:00.000Z')).toBe('Last morning run today at 9:00 AM: 1 text went, none kept back.')
    // Offers (v2.5595): the texts prepared for Today's sends, and a step whose text already waited.
    expect(lastRunLine(lastRunFrom({ at, sent: 1, prepared: 2, kept: { offered: 1 } }), '2026-10-13T16:30:00.000Z')).toBe(
      'Last morning run today at 9:00 AM: 1 text went, 1 kept back. 1 already waits on Today’s sends. 2 texts prepared for Today’s sends.',
    )
  })

  it('keeps to plain words', () => {
    const lines = [
      lastRunLine(lastRunFrom(summary), '2026-10-13T16:30:00.000Z'),
      lastRunLine(null, at),
      APP_SENDS_OWNER_ONLY,
      APP_SENDS_TEXTS_ONLY,
      APP_SENDS_SAVE_FIRST,
    ]
    expect(lines.flatMap(plainWordsFailures)).toEqual([])
  })
})
