/**
 * Punch list #141 PR 4: **While you were off**, the Needs you line that lists what waited for a person's **Push me**
 * hours (the card's decision 5: a line when the app is opened, not a catch-up push). Since v2.6029 `messages-notify`
 * writes the push it would have sent to someone who is off as a `notification_history` row with `channel = 'held'`
 * and no push. This reads the person's own held rows since their hours last closed, one wait per customer's line
 * however many pushes it would have been, leaves out a line someone answered meanwhile, and says the rest in one
 * line with a door. Pure; the reads are `whatWaitedIo.ts`. Not mirrored: nothing on the edge reads it.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { lastClosing, type OfficeHours } from './hasRule'
import { dayLabel } from './owed'
import { clockTime } from './thread'

export const WHAT_WAITED_WORDS = {
  /** The line's eyebrow in Walk the list: the block whose hours held the pushes. */
  kicker: 'Push me',
  action: 'See them',
} as const

/** A `notification_history` row written as held (v2.6029), as the Dashboard reads the person's own. */
export interface HeldRow {
  /** The customer's line the push was for; null for a push about something else (the other senders, PR 5). */
  messageId: string | null
  templateType: string
  sentAt: string
}

/** The customer's line a held reply's push was for, with the person's name. */
export interface HeldLine {
  id: string
  contactId: string
  at: string
  name: string
}

/** Something that went out to a person after their line, as `answeredBefore` counts an answer (`notifyRule.ts`). */
export interface Answer {
  contactId: string
  at: string
  channel: string
  direction: string
  /** The app sent it on its own (v2.6012): not an answer. */
  auto?: boolean | null
  /** Who sent it, by name; null when unknown. */
  whoName: string | null
}

/** The line as the Needs you card draws it. */
export interface WhatWaited {
  /** How many waits still stand. */
  count: number
  title: string
  detail: string
  /** The first line still waiting, for the door; null when none of them is a customer's line the read found. */
  first: { contactId: string; messageId: string } | null
}

/** The reply push's templates (`PushTemplate` in `notifyRule.ts`): each is a customer's line. */
const REPLY_TEMPLATES: ReadonlySet<string> = new Set(['message_reply', 'message_reply_wait', 'message_reply_breach', 'message_reply_off'])

/**
 * What each of the other senders' pushes is, in the line's words (PR 5, v2.6217): the `template_type` its held row
 * carries, as `_shared/pushHoursSend.ts` writes it. A work order's template is the step's own (`work_order_offered`,
 * the stage templates), so it is read by its head.
 */
const HELD_KINDS: Readonly<Record<string, string>> = {
  dispatch_request: 'dispatch request',
  dispatch_request_closed: 'dispatch answer',
  dispatch_request_reopened: 'dispatch answer',
  estimator_request: 'estimator request',
  bid_mark: 'marked bid',
  help_feedback: 'help note',
  lien_approval_ask: 'lien notice',
  lien_pen_recorded: 'lien signature',
  lien_code_used: 'lien signature',
  lien_waiver_code_used: 'lien waiver',
  trial_helper_verdict: 'try-out question',
  bid_followup: 'call-again day',
  ready_to_bill: 'Ready to Bill',
  bank_return: 'returned check',
  checklist_completed: 'checklist item',
  checklist: 'checklist item',
  scheduled_reminder: 'task reminder',
  report_submitted: 'report',
  clause_proposal: 'clause change',
}

/** What a held push was for, in a word or two: a reply, one of the other senders' kinds, or a push for one not named. */
export function heldKind(templateType: string): string {
  if (REPLY_TEMPLATES.has(templateType)) return 'reply'
  const named = HELD_KINDS[templateType]
  if (named) return named
  if (templateType.startsWith('work_order') || templateType.startsWith('stage_')) return 'work order'
  if (templateType.startsWith('checklist')) return 'checklist item'
  return 'push'
}

/**
 * When the stretch the rows are read from began: the hours' last close before `now`, whether the person is back or
 * still off. Null for any time, which holds nothing.
 */
export function waitedSince(now: string, hours: OfficeHours | null): string | null {
  if (!hours) return null
  return lastClosing(now, hours)
}

/** "8 PM" within the last day, "Fri 8 PM" before that: the rule `backWords` keeps for when someone is back. */
export function sinceWords(since: string, now: string): string {
  const time = clockTime(since).replace(':00 ', ' ')
  if (Date.parse(now) - Date.parse(since) < 24 * 3_600_000) return time
  return `${dayLabel(calendarYmdInAppTzFromIso(since)).slice(0, 3)} ${time}`
}

/** "3 replies and a work order": each kind that waited, one for one with its article. */
export function waitedCountWords(kinds: ReadonlyMap<string, number>): string {
  const parts: string[] = []
  for (const [kind, n] of kinds) {
    if (n <= 0) continue
    parts.push(n === 1 ? `${article(kind)} ${kind}` : `${n} ${plural(kind)}`)
  }
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** "an estimator request", "a reply". */
function article(kind: string): string {
  return /^[aeiou]/i.test(kind) ? 'an' : 'a'
}

function plural(kind: string): string {
  if (/[^aeiou]y$/.test(kind)) return `${kind.slice(0, -1)}ies`
  if (/(s|sh|ch|x)$/.test(kind)) return `${kind}es`
  return `${kind}s`
}

/** The first thing we sent them after their line, by `answeredBefore`'s rule: a text, an email or a call, not the app's own. */
function answerAfter(line: HeldLine, answers: readonly Answer[]): Answer | null {
  const from = Date.parse(line.at)
  let first: Answer | null = null
  for (const a of answers) {
    if (a.contactId !== line.contactId || a.direction !== 'out' || a.auto) continue
    if (a.channel !== 'text' && a.channel !== 'email' && a.channel !== 'call') continue
    const t = Date.parse(a.at)
    if (t <= from) continue
    if (!first || t < Date.parse(first.at)) first = a
  }
  return first
}

const firstName = (name: string): string => name.trim().split(/\s+/)[0] || 'them'

/**
 * What waited for the person's hours, or null when nothing still does. `back` says whether the person's hours are open
 * now, for the tense. A held row before `since` is not read; a line with an answer after it is left out and named in
 * the detail; a line the read did not find is counted and not named.
 */
export function whatWaited(input: {
  held: readonly HeldRow[]
  lines: readonly HeldLine[]
  answers: readonly Answer[]
  since: string | null
  now: string
  back: boolean
}): WhatWaited | null {
  if (!input.since) return null
  const from = Date.parse(input.since)
  const seen = new Set<string>()
  const kinds = new Map<string, number>()
  const add = (kind: string) => kinds.set(kind, (kinds.get(kind) ?? 0) + 1)
  const lineOf = new Map(input.lines.map((l) => [l.id, l]))
  const waiting: HeldLine[] = []
  const answered: Array<{ line: HeldLine; answer: Answer }> = []
  for (const row of input.held) {
    if (Date.parse(row.sentAt) < from) continue
    if (!row.messageId) {
      add(heldKind(row.templateType))
      continue
    }
    // One line is one wait, however many pushes it would have been.
    if (seen.has(row.messageId)) continue
    seen.add(row.messageId)
    const line = lineOf.get(row.messageId)
    if (!line) {
      add(heldKind(row.templateType))
      continue
    }
    const answer = answerAfter(line, input.answers)
    if (answer) answered.push({ line, answer })
    else {
      waiting.push(line)
      add('reply')
    }
  }
  const count = [...kinds.values()].reduce((a, b) => a + b, 0)
  if (count === 0) return null
  const when = input.back ? 'While you were off' : 'While you are off'
  const verb = input.back ? 'waited' : count === 1 ? 'waits' : 'wait'
  const sentences = [`Since ${sinceWords(input.since, input.now)}.`]
  if (answered.length > 0) {
    answered.sort((a, b) => Date.parse(a.answer.at) - Date.parse(b.answer.at))
    const { line, answer } = answered[0]!
    const at = clockTime(answer.at).replace(':00 ', ' ')
    sentences.push(answer.whoName ? `${firstName(answer.whoName)} answered ${firstName(line.name)} at ${at}.` : `${firstName(line.name)} was answered at ${at}.`)
    const more = answered.length - 1
    if (more > 0) sentences.push(`${more} more ${more === 1 ? 'was' : 'were'} answered.`)
  }
  waiting.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  const first = waiting[0]
  return {
    count,
    title: `${when}: ${waitedCountWords(kinds)} ${verb}`,
    detail: sentences.join(' '),
    first: first ? { contactId: first.contactId, messageId: first.id } : null,
  }
}
