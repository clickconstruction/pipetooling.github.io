/**
 * Settings → Phone and texts → **Reminders the app offers** (v2.5720, the owner's ask after punch list #140's switch-on:
 * the two residential reminders were set to Offers on Flows and could not be found with the other Messages switches).
 * The card lists every step whose reminder the app can text, across the flows as saved, each with Settings → Flows'
 * own control **The app and this reminder** (`flows/appSends.ts`: Off, Offers, Sends) and the text the morning run
 * would send under it. It is the one setting `messages_nudge_app_sends_v1`, written through the one io the Flows tab
 * writes it with (`flows/appSendsIo.ts`), so a press on either shows on both. Pure: the rows, their order, the words,
 * and what a press writes.
 */
import { APP_SEND_MODE_HINT, APP_SEND_MODE_WORDS, APP_SEND_MODES, APP_SENDS_LABEL, APP_SENDS_OWNER_ONLY, appSendMode, appSendSetWords, appSendsText, stepNudgeWords, withAppSend, type AppSendMode } from '../flows/appSends'
import { EDITOR_KINDS, type EditorKind } from '../flows/editorKinds'
import type { FlowKind } from '../flows/facts'
import type { AppSends } from '../flows/nudgeDispatch'
import { flat, type FlowDef, type FlowStep } from '../flows/state'
import type { QuickReply } from '../quickReplies/kernel'

/** The flows the card reads: the ones Settings → Flows edits, in its tab row's order. */
export const REMINDER_FLOW_KINDS: readonly EditorKind[] = EDITOR_KINDS.map(([kind]) => kind)

/** Each flow's name as its tab reads it. */
const FLOW_NAMES: Readonly<Partial<Record<FlowKind, string>>> = Object.fromEntries(EDITOR_KINDS)

/** The flows as read, by kind; a kind that did not read is left out. */
export type ReminderFlows = Partial<Record<FlowKind, FlowDef>>

export const REMINDERS_CARD_WORDS = {
  title: 'Reminders the app offers',
  note: 'The reminders the app can text for you. Each one has three ways. The same control is on the step in Flows.',
  loading: 'Reading the reminders…',
  none: 'No step texts its reminder from the app yet. Set one up in Flows.',
  ownerOnly: APP_SENDS_OWNER_ONLY,
  legend: 'What each way means',
  flowsDoor: 'Open Flows',
  saving: 'Saving…',
} as const

/** One line per way, for the legend under the note: the word, and the sentence the Flows control shows for it. */
export const REMINDER_LEGEND: readonly { mode: AppSendMode; word: string; hint: string }[] = APP_SEND_MODES.map((mode) => ({ mode, word: APP_SEND_MODE_WORDS[mode], hint: APP_SEND_MODE_HINT[mode] }))

/** Whether the app can text a step's reminder: the step's reminder is the app's to send, and it is a text. */
export function appCanText(step: Pick<FlowStep, 'nudge'>): boolean {
  return step.nudge?.send === 'app' && step.nudge.how === 'text'
}

export interface ReminderRow {
  kind: FlowKind
  /** The flow's name as its tab reads: "Residential customer". */
  flowName: string
  step: FlowStep
  mode: AppSendMode
  /** The text the morning run would send, to the kind's sample person. */
  sample: string
}

/**
 * The card's rows: every step the app can text, flow by flow in the tab row's order and each flow's steps in their
 * order, with the step's mode under its own kind and the text the run would send.
 */
export function reminderRows(flows: ReminderFlows, sends: AppSends, quickReplies: readonly QuickReply[] = []): ReminderRow[] {
  const rows: ReminderRow[] = []
  for (const kind of REMINDER_FLOW_KINDS) {
    const flow = flows[kind]
    if (!flow) continue
    for (const step of flat(flow)) {
      if (!appCanText(step)) continue
      rows.push({ kind, flowName: FLOW_NAMES[kind] ?? kind, step, mode: appSendMode(sends, kind, step.id), sample: stepNudgeWords(kind, step, quickReplies) })
    }
  }
  return rows
}

export interface ReminderFlowGroup {
  kind: FlowKind
  flowName: string
  rows: ReminderRow[]
}

/** The rows under their flow's name, in the rows' order. */
export function rowsByFlow(rows: readonly ReminderRow[]): ReminderFlowGroup[] {
  const groups: ReminderFlowGroup[] = []
  for (const row of rows) {
    const last = groups[groups.length - 1]
    if (last && last.kind === row.kind) last.rows.push(row)
    else groups.push({ kind: row.kind, flowName: row.flowName, rows: [row] })
  }
  return groups
}

/** The control's name on a row, with the flow, since a step name can repeat across flows: "Residential customer, Approved: The app and this reminder". */
export function reminderControlLabel(row: Pick<ReminderRow, 'flowName' | 'step'>): string {
  return `${row.flowName}, ${row.step.name}: ${APP_SENDS_LABEL}`
}

/** The `value_text` a press writes: the switch as stored now with this step set, as the Flows control writes it. */
export function pressWrites(sends: AppSends, kind: FlowKind, stepId: string, mode: AppSendMode): string {
  return appSendsText(withAppSend(sends, kind, stepId, mode))
}

/** What a press did, for its toast: the Flows control's own words. */
export function pressWords(row: Pick<ReminderRow, 'step'>, mode: AppSendMode): string {
  return appSendSetWords(row.step.name, mode)
}
