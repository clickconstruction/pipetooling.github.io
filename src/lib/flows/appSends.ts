/**
 * Messages, cut 5's screens: Settings → Flows' switch on the reminders the app sends itself, one per step, and the line
 * that reads the newest morning run. The switch is `app_settings` `messages_nudge_app_sends_v1`,
 * `{"<kind>": {"<step id>": true}}`, read the way the run reads it (`appSendsFrom`); only the owner and a dev change it
 * (`is_master_or_dev()`). The run's summary is `messages_nudge_last_run_v1`, which `messages-nudge-dispatch` writes;
 * it is read here without trusting its shape, since the run that writes it lands after this screen. Pure.
 */
import type { UserRole } from '../../hooks/useAuth'
import { lineWhen } from '../messages/thread'
import type { QuickReply } from '../quickReplies/kernel'
import { FLOW_KINDS, type FlowKind } from './facts'
import { nudgeLine, type AppSends, type NudgeNotSent } from './nudgeDispatch'
import type { PersonFlow } from './nudges'
import { appSendsFrom } from './nudgeRunInputs'
import { flat, type FlowDef, type FlowStep } from './state'

export { appSendsFrom }

/** The switch's name on a step. */
export const APP_SENDS_LABEL = 'The app sends this reminder'
/** On a step whose reminder the app sends, but only in the unsaved draft. */
export const APP_SENDS_SAVE_FIRST = 'Save the flow first.'
/** On a step whose reminder the app sends as a call or an email. */
export const APP_SENDS_TEXTS_ONLY = 'The app sends texts only.'
/** For anyone but the owner and a dev. */
export const APP_SENDS_OWNER_ONLY = 'Only the owner or a dev turns this on.'
/** When the write matched no row: the policy said no. */
export const APP_SENDS_NOT_SAVED = 'The switch did not change. Only the owner or a dev turns the app’s reminders on or off.'
/** Before the newest run has a summary. */
export const LAST_RUN_NONE = 'The app has not run its morning reminders yet.'
/** The press that opens the run's own sentences. */
export const READ_THE_RUN = 'Read the run'

/** What a press on the switch did, for its toast. */
export function appSendSetWords(stepName: string, on: boolean): string {
  return on ? `The app sends the ${stepName} reminder from its next morning run at 9 AM.` : `The app no longer sends the ${stepName} reminder.`
}

/** Who may turn a step's reminder on or off: the owner and a dev, as the setting's UPDATE policy allows. */
export function canSetAppSends(role: UserRole | null | undefined): boolean {
  return role === 'master_technician' || role === 'dev'
}

/** Whether the app sends a step's reminder: only a `true` under its kind. */
export function appSendOn(sends: AppSends, kind: FlowKind, stepId: string): boolean {
  return sends[kind]?.[stepId] === true
}

/** Only the steps that are on, the kinds in the flows' order and the steps sorted, and no kind with none. */
function onlyOn(sends: AppSends): AppSends {
  const out: AppSends = {}
  for (const k of FLOW_KINDS) {
    const steps = sends[k] ?? {}
    const on = Object.keys(steps)
      .filter((id) => steps[id] === true)
      .sort()
    if (on.length) out[k] = Object.fromEntries(on.map((id) => [id, true]))
  }
  return out
}

/** The switch with one step turned on or off. */
export function withAppSend(sends: AppSends, kind: FlowKind, stepId: string, on: boolean): AppSends {
  return onlyOn({ ...sends, [kind]: { ...(sends[kind] ?? {}), [stepId]: on } })
}

/** The switch as `value_text` stores it, so the same switch always writes the same text. */
export function appSendsText(sends: AppSends): string {
  return JSON.stringify(onlyOn(sends))
}

/** Whether the run would send this step's reminder from the saved flow: the app sends it, and it is a text. */
export function runSendsStep(saved: FlowDef | null | undefined, stepId: string): boolean {
  const step = saved ? flat(saved).find((s) => s.id === stepId) : undefined
  return step?.nudge?.send === 'app' && step.nudge.how === 'text'
}

export interface AppSendSwitch {
  /** The step's reminder is the app's to send, so the switch shows. */
  show: boolean
  /** It can be pressed. */
  live: boolean
  /** Why it cannot be pressed, in words; null when it can. */
  note: string | null
}

/**
 * The switch on a step in the draft: shown where the app sends the reminder. Anyone but the owner and a dev reads it
 * only. A call or an email is not the app's to send. A step the saved flow does not send that way waits for Save.
 */
export function appSendSwitch(step: FlowStep, opts: { canSet: boolean; saved: FlowDef | null | undefined }): AppSendSwitch {
  if (step.nudge?.send !== 'app') return { show: false, live: false, note: null }
  if (!opts.canSet) return { show: true, live: false, note: APP_SENDS_OWNER_ONLY }
  if (step.nudge.how !== 'text') return { show: true, live: false, note: APP_SENDS_TEXTS_ONLY }
  if (!runSendsStep(opts.saved, step.id)) return { show: true, live: false, note: APP_SENDS_SAVE_FIRST }
  return { show: true, live: true, note: null }
}

/** The first name a step's reminder is shown with, by kind: the prototype's samples. */
export const SAMPLE_FIRST: Readonly<Record<FlowKind, string>> = { customer: 'Sam', trade: 'Chris', arch: 'Alex', unknown: 'Sam' }

/**
 * The text the run would send on a step, to the kind's sample person: the team's quick reply for the step, else the
 * step's own words. No link, since the link is each person's own.
 */
export function stepNudgeWords(kind: FlowKind, step: FlowStep, quickReplies: readonly QuickReply[] = []): string {
  const person = { first: SAMPLE_FIRST[kind], reading: { kind } as PersonFlow['reading'] }
  return nudgeLine(person, step, quickReplies, null)
}

// ---------- the newest morning run ----------

/** The run's summary as this screen reads it. The run's own type is `RunSummary` in `nudgeRunLog.ts`. */
export interface LastRun {
  /** When it ran, an ISO timestamp. */
  at: string
  /** A dry run planned and wrote nothing. */
  dry: boolean
  /** Texts that went, or on a dry run would go. */
  sent: number
  /** Reminders kept back, by why. */
  kept: Partial<Record<NudgeNotSent, number>>
  /** Texts kept back because Send texts is off. */
  textsOff: number
  /** Texts that did not go. */
  refusedCount: number
  /** People whose rows did not come back. */
  unread: number
  /** The run's own sentences. */
  words: string[]
}

/** The reasons in the order the line says them, as the run's summary orders them. */
export const KEPT_ORDER: readonly NudgeNotSent[] = ['off', 'not a text', 'snoozed', 'sent lately', 'no number', 'opted out', 'one a morning']

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)

const parsed = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** The stored summary, or null when there is none yet (`{}`), it does not read, or it has no day it ran. */
export function lastRunFrom(stored: unknown): LastRun | null {
  const value = typeof stored === 'string' ? parsed(stored) : stored
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  if (typeof v.at !== 'string' || Number.isNaN(Date.parse(v.at))) return null
  const keptIn = v.kept && typeof v.kept === 'object' && !Array.isArray(v.kept) ? (v.kept as Record<string, unknown>) : {}
  const kept: Partial<Record<NudgeNotSent, number>> = {}
  for (const why of KEPT_ORDER) {
    const n = count(keptIn[why])
    if (n) kept[why] = n
  }
  return {
    at: v.at,
    dry: v.dry === true,
    sent: count(v.sent),
    kept,
    textsOff: count(v.textsOff),
    refusedCount: count(v.refusedCount),
    unread: count(v.unread),
    words: Array.isArray(v.words) ? v.words.filter((w): w is string => typeof w === 'string' && w.trim() !== '') : [],
  }
}

const is = (n: number, one: string, more: string) => `${n} ${n === 1 ? one : more}`

/** A reason's few words in the line: "11 are off". */
function keptPart(why: NudgeNotSent, n: number): string {
  switch (why) {
    case 'off':
      return is(n, 'is off', 'are off')
    case 'not a text':
      return is(n, 'is not a text', 'are not a text')
    case 'snoozed':
      return is(n, 'is snoozed', 'are snoozed')
    case 'sent lately':
      return is(n, 'was reminded lately', 'were reminded lately')
    case 'no number':
      return is(n, 'has no number', 'have no number')
    case 'opted out':
      return `${n} sent STOP`
    case 'one a morning':
      return is(n, 'already has a text this morning', 'already have a text this morning')
  }
}

/** "a", "a and b", "a, b and c". */
function andList(parts: readonly string[]): string {
  if (parts.length < 2) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * The line at the top of Settings → Flows: "Last morning run Tue, Oct 13 at 9:00 AM: no text went, 12 kept back. 11 are
 * off and 1 has no number." A dry run says so first; a text that did not go is said after.
 */
export function lastRunLine(run: LastRun | null, nowIso: string): string {
  if (!run) return LAST_RUN_NONE
  const when = lineWhen(run.at, nowIso).replace(' · ', ' at ')
  const sent = run.dry
    ? run.sent === 0
      ? 'no text would go'
      : `${is(run.sent, 'text', 'texts')} would go`
    : run.sent === 0
      ? 'no text went'
      : `${is(run.sent, 'text', 'texts')} went`
  const parts = KEPT_ORDER.filter((why) => run.kept[why]).map((why) => keptPart(why, run.kept[why]!))
  if (run.textsOff) parts.push(is(run.textsOff, 'waits on Send texts', 'wait on Send texts'))
  const keptTotal = KEPT_ORDER.reduce((t, why) => t + (run.kept[why] ?? 0), 0) + run.textsOff
  const words = [
    ...(run.dry ? ['A dry run.'] : []),
    `Last morning run ${when}: ${sent}, ${keptTotal ? `${keptTotal} kept back` : 'none kept back'}.`,
    ...(parts.length ? [`${capital(andList(parts))}.`] : []),
    ...(run.refusedCount ? [`${is(run.refusedCount, 'text', 'texts')} did not go.`] : []),
  ]
  return words.join(' ')
}
