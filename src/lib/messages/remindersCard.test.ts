import { describe, expect, it } from 'vitest'
import { APP_SEND_MODE_HINT, APP_SENDS_LABEL, appSendsFrom, appSendsText, withAppSend } from '../flows/appSends'
import { SEED_FLOWS } from '../flows/seed'
import { flat, type FlowDef, type FlowStep } from '../flows/state'
import { plainWordsFailures } from '../plainWords'
import type { QuickReply } from '../quickReplies/kernel'
import {
  appCanText,
  pressWords,
  pressWrites,
  REMINDER_FLOW_KINDS,
  REMINDER_LEGEND,
  REMINDERS_CARD_WORDS,
  reminderControlLabel,
  reminderRows,
  rowsByFlow,
} from './remindersCard'
import { switchStates } from './switchCard'

const stepOf = (flow: FlowDef, id: string): FlowStep => flat(flow).find((s) => s.id === id)!
const ALL_SEEDS = Object.fromEntries(REMINDER_FLOW_KINDS.map((k) => [k, SEED_FLOWS[k]]))

describe('the Reminders the app offers card (v2.5720)', () => {
  it('reads the flows Settings → Flows edits, in its tab row’s order', () => {
    expect(REMINDER_FLOW_KINDS).toEqual(['customer', 'trade', 'arch', 'residential', 'sub'])
  })

  it('knows a step the app can text: the app sends it, and it is a text', () => {
    expect(appCanText(stepOf(SEED_FLOWS.residential, 'approved'))).toBe(true)
    expect(appCanText(stepOf(SEED_FLOWS.residential, 'paid'))).toBe(true)
    expect(appCanText(stepOf(SEED_FLOWS.trade, 'portal'))).toBe(true)
    // A person sends these after the app asks.
    expect(appCanText(stepOf(SEED_FLOWS.trade, 'msa'))).toBe(false)
    // A call is not the app's to send, even on an app step.
    expect(appCanText({ nudge: { days: 3, how: 'call', send: 'app', dayFact: null } })).toBe(false)
    expect(appCanText({ nudge: null })).toBe(false)
  })

  it('lists every step the app can text, flow by flow, with its mode under its own kind and the morning line', () => {
    const sends = appSendsFrom('{"residential":{"approved":"offer","paid":true},"trade":{"approved":true}}')
    const rows = reminderRows(ALL_SEEDS, sends)
    expect(rows.map((r) => `${r.kind}:${r.step.id}:${r.mode}`)).toEqual(['trade:portal:off', 'residential:approved:offer', 'residential:paid:send'])
    expect(rows.map((r) => r.flowName)).toEqual(['Trade partner', 'Residential customer', 'Residential customer'])
    expect(rows[1]!.sample).toBe('Dana, any word on the estimate? Happy to answer any questions.')
    expect(rows[2]!.sample).toBe('Dana, checking on the bill. Need the pay page sent again?')
    expect(rows[0]!.sample).toBe('Chris, did the invite come through?')
  })

  it('reads the team’s quick reply for a step as the line, as the run would', () => {
    const line: QuickReply = { id: 'q1', text: 'Any questions on the estimate? Call me any time.', for: 'customer', stepId: 'approved', scope: 'team', addedBy: 'u1' } as QuickReply
    const rows = reminderRows({ residential: SEED_FLOWS.residential }, {}, [line])
    expect(rows.find((r) => r.step.id === 'approved')!.sample).toBe('Any questions on the estimate? Call me any time.')
    expect(rows.find((r) => r.step.id === 'paid')!.sample).toBe('Dana, checking on the bill. Need the pay page sent again?')
  })

  it('leaves out a flow that did not read, and reads none when no step texts from the app', () => {
    expect(reminderRows({ residential: SEED_FLOWS.residential }, {}).map((r) => r.step.id)).toEqual(['approved', 'paid'])
    expect(reminderRows({ sub: SEED_FLOWS.sub, customer: SEED_FLOWS.customer }, {})).toEqual([])
    expect(reminderRows({}, {})).toEqual([])
  })

  it('groups the rows under their flow’s name', () => {
    const groups = rowsByFlow(reminderRows(ALL_SEEDS, {}))
    expect(groups.map((g) => [g.flowName, g.rows.map((r) => r.step.name)])).toEqual([
      ['Trade partner', ['Portal opened']],
      ['Residential customer', ['Approved', 'Paid']],
    ])
    expect(rowsByFlow([])).toEqual([])
  })

  it('names each control with its flow, since a step name repeats across flows', () => {
    const [row] = reminderRows({ residential: SEED_FLOWS.residential }, {})
    expect(reminderControlLabel(row!)).toBe(`Residential customer, Approved: ${APP_SENDS_LABEL}`)
  })

  it('writes what the Flows control writes: the switch as stored now with the one step set', () => {
    expect(pressWrites({}, 'residential', 'approved', 'offer')).toBe('{"residential":{"approved":"offer"}}')
    const offered = appSendsFrom(pressWrites({}, 'residential', 'approved', 'offer'))
    expect(pressWrites(offered, 'residential', 'paid', 'send')).toBe('{"residential":{"approved":"offer","paid":true}}')
    expect(pressWrites(offered, 'residential', 'approved', 'off')).toBe('{}')
    // A step someone set since the card was read is kept.
    const trade = appSendsFrom('{"trade":{"portal":true}}')
    expect(pressWrites(trade, 'residential', 'paid', 'offer')).toBe(appSendsText(withAppSend(trade, 'residential', 'paid', 'offer')))
  })

  it('reads as on to the switch card on Messages once the two residential reminders are offered', () => {
    const one = pressWrites({}, 'residential', 'approved', 'offer')
    expect(switchStates({ messages_nudge_app_sends_v1: { value_text: one, value_num: null } }).reminders).toBe('off')
    const both = pressWrites(appSendsFrom(one), 'residential', 'paid', 'offer')
    expect(switchStates({ messages_nudge_app_sends_v1: { value_text: both, value_num: null } }).reminders).toBe('on')
  })

  it('says what a press did in the Flows control’s words', () => {
    const [approved] = reminderRows({ residential: SEED_FLOWS.residential }, {})
    expect(pressWords(approved!, 'offer')).toBe('The app prepares the Approved reminder each morning for Today’s sends on the Dashboard.')
    expect(pressWords(approved!, 'send')).toBe('The app sends the Approved reminder from its next morning run at 9 AM.')
    expect(pressWords(approved!, 'off')).toBe('The app no longer sends the Approved reminder.')
  })

  it('draws the legend from the Flows control’s own hints, one line per way', () => {
    expect(REMINDER_LEGEND.map((l) => [l.mode, l.word])).toEqual([
      ['off', 'Off'],
      ['offer', 'Offers'],
      ['send', 'Sends'],
    ])
    expect(REMINDER_LEGEND.find((l) => l.mode === 'offer')!.hint).toBe(APP_SEND_MODE_HINT.offer)
  })

  it('keeps every sentence in plain words', () => {
    for (const w of Object.values(REMINDERS_CARD_WORDS)) expect(plainWordsFailures(w), w).toEqual([])
    for (const l of REMINDER_LEGEND) expect(plainWordsFailures(l.hint), l.hint).toEqual([])
    const [row] = reminderRows({ residential: SEED_FLOWS.residential }, {})
    for (const mode of ['off', 'offer', 'send'] as const) expect(plainWordsFailures(pressWords(row!, mode))).toEqual([])
  })
})
