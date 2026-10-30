/**
 * Messages R4 · 4: the stages the customer feels (`to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md` → R4, integration
 * 15 in `customer-messages-integrations-mockups.html` on branch spike/gc-mode). Pure: the caller reads the move, the
 * customer's residential flow, the team's quick replies, the steps switched on, `nudge_sent` and their text number, and
 * sends what this returns through `quo/send.ts`'s `planSend`, then writes the `nudge_sent` row and the thread's event.
 *
 * A move on a Pipeline job the customer feels sends that step's line, so the board's move and the customer's text are
 * the same moment: dispatch's block (scheduled), Working (started), Ready to Bill (done), Billed and Paid. Waiting and
 * every other move stay the office's. Each step is off until the owner turns it on, as the morning run's are, and a
 * step sends once a day at most, by the morning run's own rule (`sentLately`).
 *
 * The Jobs board's dot reads Follow up's queue by job: a customer line waiting that nobody has answered.
 */
import { stepLine, type QuickReply } from '../quickReplies/kernel'
import { channelWord, clockTime, daysAgo, snippetOf, whenWords, type ThreadMessage } from '../messages/thread'
import type { NeedsReplyRow } from '../followUp/queue'
import { flowContactKind } from './facts'
import { appSendMode, blanksLeftWords, sentLately, type AppSends, type NudgeSent, type NudgeText, type TextNumber } from './nudgeDispatch'
import { stepById, stepReading, type FlowDef, type FlowReading } from './state'

// ---------- the moves the customer feels ----------

/** A move on a Pipeline job: dispatch's block for it (`job_schedule_blocks`), or a move on the Jobs board (`job_status_events`). */
export type StageEvent = { kind: 'block'; jobId: string } | { kind: 'move'; jobId: string; toStatus: string }

/** The Jobs board's moves the customer feels, by `job_status_events.to_status`, with the residential step each turns true. */
export const FELT_MOVES: Readonly<Partial<Record<string, string>>> = {
  working: 'working',
  ready_to_bill: 'done',
  billed: 'billed',
  paid: 'paid',
}

/** The residential step a move turns true, when the customer feels it: dispatch's block is Booked. */
export function feltStep(event: StageEvent): string | null {
  return event.kind === 'block' ? 'booked' : FELT_MOVES[event.toStatus] ?? null
}

// ---------- the line ----------

/**
 * The blanks a stage line fills itself: their first name and the job's name. Helper 4's `fillLine`
 * (`quickReplies/blanks.ts`, #5558) replaces this on the rebase after it lands, with the day and the window from the
 * schedule; it fills the same way and names the blanks left.
 */
function fillBlanks(text: string, fills: { first: string; job: string | null }): { text: string; left: string[] } {
  const left: string[] = []
  const out = text.replace(/\{([a-z ]+)\}/g, (whole, key: string) => {
    const value = (key === 'first' ? fills.first : key === 'job' ? fills.job : null)?.trim()
    if (value) return value
    if (!left.includes(key)) left.push(key)
    return whole
  })
  return { text: out, left }
}

// ---------- the send ----------

export interface StageSendSettings {
  contactId: string
  /** Their first name, for `{first}`. */
  first: string
  /** The job's name, for `{job}`. */
  jobName: string | null
  /** The residential flow as the office keeps it (`flow_steps`): the step's name for the thread's event. */
  flow: FlowDef
  /** The steps switched on, by kind: the same switch as the morning run's. */
  appSends: AppSends
  /** What `nudge_sent` holds for them. */
  sent: readonly NudgeSent[]
  /** Their text number, and whether it sent STOP. */
  number: TextNumber | null
  now: Date
}

/**
 * Why a move sent nothing: the customer does not feel it, they are off the flow, the step is not switched on, the flow
 * does not read the step done, it went today already, there is no number or it sent STOP, the team keeps no line for
 * the step, or the line has a blank the app cannot fill.
 */
export type StageNotSent = 'not felt' | 'off the flow' | 'off' | 'not done' | 'sent today' | 'no number' | 'opted out' | 'no line' | 'blanks left'

/** A move that sent nothing, with why in words for the log. */
export interface StageKept {
  stepId: string | null
  jobId: string
  why: StageNotSent
  words: string
}

export type StageSend =
  | {
      text: NudgeText
      kept: null
      /** Sent at once, or prepared for the office to press on Today's sends (an *offers* step, v2.5595). */
      mode: 'send' | 'offer'
    }
  | { text: null; kept: StageKept }

/** The log's words for a move that sent nothing. */
export function stageNotSentWords(why: StageNotSent, left: readonly string[] = []): string {
  switch (why) {
    case 'not felt':
      return 'the customer does not feel this move'
    case 'off the flow':
      return 'they are off the flow'
    case 'off':
      return 'the app does not send this step yet'
    case 'not done':
      return 'the flow does not read this step done'
    case 'sent today':
      return 'this step went today already'
    case 'no number':
      return 'no number on file'
    case 'opted out':
      return 'the number sent STOP'
    case 'no line':
      return 'the team keeps no line for this step'
    case 'blanks left':
      return blanksLeftWords(left)
  }
}

/**
 * The text a move sends the customer: the step's own quick reply, filled, when the customer feels the move, the step is
 * switched on, and the flow reads it done on that job (a loop, a round done). Nothing goes for a step that is off, a
 * number that sent STOP or a step that went today, by a stage text or a reminder.
 */
export function stageSendFor(event: StageEvent, reading: FlowReading, lines: readonly QuickReply[], settings: StageSendSettings): StageSend {
  const stepId = feltStep(event)
  const jobId = event.jobId
  const kept = (why: StageNotSent, left: readonly string[] = []): StageSend => ({
    text: null,
    kept: { stepId, jobId, why, words: stageNotSentWords(why, left) },
  })
  if (!stepId || reading.kind !== 'residential') return kept('not felt')
  if (reading.off) return kept('off the flow')
  const mode = appSendMode(settings.appSends, 'residential', stepId)
  if (mode === 'off') return kept('off')
  const step = stepReading(reading, stepId, jobId)
  if (!step || !(step.isTrue || step.rounds.some((r) => r.state === 'done'))) return kept('not done')
  if (sentLately(settings.sent, settings.contactId, { stepId, jobId }, 1, settings.now)) return kept('sent today')
  if (!settings.number?.number) return kept('no number')
  if (settings.number.optedOut) return kept('opted out')
  const line = stepLine(lines, flowContactKind(reading.kind), stepId, '')
  if (!line) return kept('no line')
  const filled = fillBlanks(line.text, { first: settings.first, job: settings.jobName })
  if (filled.left.length) return kept('blanks left', filled.left)
  const name = stepById(settings.flow, stepId)?.name ?? stepId
  return {
    text: {
      contactId: settings.contactId,
      stepId,
      jobId,
      body: filled.text,
      record: { contactId: settings.contactId, stepId, jobId, at: settings.now.toISOString(), by: 'app', how: 'text' },
      event: mode === 'offer' ? `The app prepared the ${name} line for Today’s sends.` : `The app sent the ${name} line by text.`,
    },
    kept: null,
    mode,
  }
}

// ---------- the Jobs board's dot ----------

/** The dot's hover, in parts the board draws side by side, each in plain words. */
export interface BoardDotHover {
  /** Their first name: "Dana". */
  who: string
  /** How it came: "text", "missed call". */
  channel: string
  /** When: "4:05 PM" today, else "yesterday", "on Wednesday". */
  when: string
  /** The first line of what they wrote. */
  line: string
  status: 'Nobody has answered.'
}

/** A message as the dot reads it: Follow up's, with the job it is tied to. */
export type BoardDotMessage = Pick<ThreadMessage, 'id' | 'contactId' | 'jobId' | 'channel' | 'direction' | 'at' | 'subject' | 'body'>

/**
 * Whether a job's row on the Jobs board shows the dot: a customer waits in Follow up's Needs a reply, their newest line
 * is on this job, and nothing of ours went to them after it. A reply of ours on any channel, or the row done, takes the
 * dot away. Of two people waiting on one job, the one waiting longest is the hover's, as Needs a reply orders them.
 */
export function boardDot(
  rows: readonly NeedsReplyRow[],
  messages: readonly BoardDotMessage[],
  names: Readonly<Partial<Record<string, string>>>,
  jobId: string,
  now: Date,
): BoardDotHover | null {
  const byId = new Map(messages.map((m) => [m.id, m]))
  for (const row of rows) {
    const m = row.landOnId ? byId.get(row.landOnId) : undefined
    if (!m || m.direction !== 'in' || m.jobId !== jobId) continue
    if (messages.some((x) => x.contactId === m.contactId && x.direction === 'out' && Date.parse(x.at) > Date.parse(m.at))) continue
    const nowIso = now.toISOString()
    return {
      who: names[row.contactId] ?? '',
      channel: channelWord(m).toLowerCase(),
      when: daysAgo(m.at, nowIso) <= 0 ? clockTime(m.at) : whenWords(m.at, nowIso),
      line: (snippetOf(m).split('\n')[0] ?? '').trim(),
      status: 'Nobody has answered.',
    }
  }
  return null
}
