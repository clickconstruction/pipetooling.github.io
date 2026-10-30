/**
 * The outbox (punch list #163, PR 1, v2.6074): the queue a phone keeps when a press cannot reach
 * the server. Four presses may queue, each with the moment it was pressed: clock in, clock out, a
 * job note and a field report. Money, a text or an email to a customer and a signature never do
 * (`NEVER_QUEUES`). The presses go out in the order they were pressed when the signal returns; a
 * press the server refuses keeps the server's reason and a door and the rest still go; a press
 * that waits past the next morning needs a person and says so.
 *
 * Pure rules here, every one taking `now`. The IndexedDB adapter, the replay hook and the bar on
 * the app-health strip are PR 2's; the server side of each press (the `land_field_press` RPC,
 * which takes the per-press id and the pressed time) is PR 2's for the clock and PR 3's for notes
 * and reports.
 *
 * The per-press id is minted on the phone when the press is made and travels with every send, so
 * a send that lands twice (a timeout whose request landed, a resend after a lost answer) counts
 * once: the server answers the first landing's result again. That is what makes a resend safe,
 * and why a resend is quiet on the bar (the owner, 2026-10-26: red means *this needs you*, and a
 * resend is the app's job).
 *
 * The clock-time rule is B (decided 2026-10-29): a clock press that lands late files a typed entry
 * through the late-entry path that already exists (`clock_typed_entries`), with the pressed time
 * filling the entry's times, so it waits for approval like any typed hours. The kernel's part is
 * the pressed-at stamp; the server's is the entry.
 */
import { appTzWallTimeMs, denverCalendarDayKey, formatDenverTimeOnly, ymdAddDays } from '../../utils/dateUtils'
import type { DatabaseErrorKind } from '../../utils/errorHandling'

// ---------------------------------------------------------------------------
// What may queue

export type OutboxKind = 'clock-in' | 'clock-out' | 'job-note' | 'field-report'

export const OUTBOX_KINDS: readonly OutboxKind[] = ['clock-in', 'clock-out', 'job-note', 'field-report']

export function isOutboxKind(value: unknown): value is OutboxKind {
  return typeof value === 'string' && (OUTBOX_KINDS as readonly string[]).includes(value)
}

/** The words a press goes by on the bar and in the list. */
export const OUTBOX_KIND_WORDS: Record<OutboxKind, string> = {
  'clock-in': 'Clock in',
  'clock-out': 'Clock out',
  'job-note': 'Job note',
  'field-report': 'Field report',
}

/**
 * What never queues, in the guide's words. A payment, a bill or a card split moves money; a text
 * or an email to a customer leaves the company; a signature needs the server's own stamp. Each
 * fails as it does today and the person sends it again when the signal is back.
 */
export const NEVER_QUEUES: readonly string[] = [
  'a payment',
  'a bill',
  'a card split',
  'a text or an email to a customer',
  'a signature',
]

// ---------------------------------------------------------------------------
// The press

/** Bump when the shape a press keeps changes: a press kept under an older number is dropped. */
export const OUTBOX_SCHEMA = 1

export type OutboxState =
  /** Kept on the phone, not yet landed. */
  | 'waiting'
  /** In flight right now. */
  | 'sending'
  /** Landed; the bar is green until Got it, the list says *Sent today*. */
  | 'sent'
  /** The server said no, with its reason; stays until the door is opened or the press is dropped. */
  | 'refused'

export interface OutboxRefusal {
  /** The server's reason, already a sentence. */
  message: string
  code: string | null
}

export interface ClockInPayload {
  jobLedgerId: string | null
  bidId: string | null
  notes: string
  /** Job Mode's leg stamp on the new session (v2.5573). */
  travel: 'on-the-way' | 'on-site' | null
}

export interface ClockOutPayload {
  /** The open session on the server, when the clock-in had landed. */
  sessionId: string | null
  /** The clock-in press still in the queue, when it had not: the server finds the session by it. */
  sessionPressId: string | null
  jobLedgerId: string | null
  bidId: string | null
  notes: string
}

export interface JobNotePayload {
  jobId: string
  body: string
}

export interface FieldReportPayload {
  templateId: string
  fieldValues: unknown
  jobLedgerId: string | null
  projectId: string | null
  bidId: string | null
  lat: number | null
  lng: number | null
}

export type OutboxPayloadOf<K extends OutboxKind> = K extends 'clock-in'
  ? ClockInPayload
  : K extends 'clock-out'
    ? ClockOutPayload
    : K extends 'job-note'
      ? JobNotePayload
      : FieldReportPayload

export interface OutboxPress<K extends OutboxKind = OutboxKind> {
  /** Minted on the phone when pressed; the server counts a send that lands twice once by it. */
  id: string
  /** The order: a press goes out after every press with a lower number. */
  seq: number
  schema: number
  kind: K
  userId: string
  /** The phone's clock at the press, epoch ms. */
  pressedAt: number
  payload: OutboxPayloadOf<K>
  /** What the press was about, for the list: the job's name, the bid's number; empty when there is none. */
  about: string
  /** Where a person fixes it: a path in the app, opened by Fix. */
  door: string | null
  /** A clock-out's clock-in press while that press is still in the queue; the clock-out never goes before it. */
  dependsOn: string | null
  state: OutboxState
  /** Sends so far. */
  attempts: number
  lastTriedAt: number | null
  sentAt: number | null
  /** What the server answered when it landed (the session id, the note id). */
  result: unknown
  refusal: OutboxRefusal | null
  /** Got it pressed, or the door opened: the bar no longer speaks for it; the list still lists it. */
  seen: boolean
}

export interface NewPressArgs<K extends OutboxKind> {
  id: string
  seq: number
  kind: K
  userId: string
  pressedAt: number
  payload: OutboxPayloadOf<K>
  about?: string
  door?: string | null
  dependsOn?: string | null
}

export function newPress<K extends OutboxKind>(args: NewPressArgs<K>): OutboxPress<K> {
  return {
    id: args.id,
    seq: args.seq,
    schema: OUTBOX_SCHEMA,
    kind: args.kind,
    userId: args.userId,
    pressedAt: args.pressedAt,
    payload: args.payload,
    about: args.about ?? '',
    door: args.door ?? null,
    dependsOn: args.dependsOn ?? null,
    state: 'waiting',
    attempts: 0,
    lastTriedAt: null,
    sentAt: null,
    result: null,
    refusal: null,
    seen: false,
  }
}

/** The next number for a new press: one past the highest kept, so the order survives a prune. */
export function nextSeq(presses: readonly OutboxPress[]): number {
  let max = 0
  for (const p of presses) if (p.seq > max) max = p.seq
  return max + 1
}

/** Shape-check a stored press: anything off is `null` and the entry is dropped. */
export function parseOutboxPress(raw: unknown): OutboxPress | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.schema !== OUTBOX_SCHEMA) return null
  if (typeof o.id !== 'string' || o.id.length === 0) return null
  if (typeof o.seq !== 'number' || !Number.isFinite(o.seq)) return null
  if (!isOutboxKind(o.kind)) return null
  if (typeof o.userId !== 'string' || o.userId.length === 0) return null
  if (typeof o.pressedAt !== 'number' || !Number.isFinite(o.pressedAt)) return null
  if (o.payload == null || typeof o.payload !== 'object') return null
  if (o.state !== 'waiting' && o.state !== 'sending' && o.state !== 'sent' && o.state !== 'refused') return null
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const refusal =
    o.refusal && typeof o.refusal === 'object' && typeof (o.refusal as { message?: unknown }).message === 'string'
      ? { message: (o.refusal as { message: string }).message, code: typeof (o.refusal as { code?: unknown }).code === 'string' ? (o.refusal as { code: string }).code : null }
      : null
  return {
    id: o.id,
    seq: o.seq,
    schema: OUTBOX_SCHEMA,
    kind: o.kind,
    userId: o.userId,
    pressedAt: o.pressedAt,
    payload: o.payload as OutboxPayloadOf<OutboxKind>,
    about: typeof o.about === 'string' ? o.about : '',
    door: typeof o.door === 'string' ? o.door : null,
    dependsOn: typeof o.dependsOn === 'string' ? o.dependsOn : null,
    // A press that was in flight when the page closed never got its answer: it waits again, and the id makes the resend safe.
    state: o.state === 'sending' ? 'waiting' : o.state,
    attempts: num(o.attempts) ?? 0,
    lastTriedAt: num(o.lastTriedAt),
    sentAt: num(o.sentAt),
    result: o.result ?? null,
    refusal,
    seen: o.seen === true,
  }
}

// ---------------------------------------------------------------------------
// When a failed write goes into the queue

/**
 * A write that failed at the fetch layer never reached the server, and a write that timed out
 * may or may not have: both go into the queue, since the per-press id makes the resend safe. A
 * refusal (the server answered no) never does; it shows its reason as it does today. With the
 * browser saying offline the write is not even tried.
 */
export function failureQueues(args: { kind: DatabaseErrorKind; timedOut?: boolean; online: boolean }): boolean {
  if (!args.online) return true
  if (args.timedOut) return true
  return args.kind === 'network'
}

// ---------------------------------------------------------------------------
// The retry rule and the wait limit

/** Between tries, by how many tries have been made: 5, 10, 20 and 30 s, then every 30 s. */
export const RETRY_DELAYS_MS: readonly number[] = [5_000, 10_000, 20_000, 30_000]

export function retryDelayMs(attempts: number): number {
  if (attempts <= 0) return 0
  return RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length) - 1] ?? 30_000
}

/** The instant a waiting press is next due: at once before its first try, then by the delay rule. */
export function nextTryAt(press: OutboxPress): number {
  if (press.lastTriedAt == null || press.attempts === 0) return press.pressedAt
  return press.lastTriedAt + retryDelayMs(press.attempts)
}

/** A press still waiting the next morning needs a person: red, with its reason and a door. */
export const NEXT_MORNING_HOUR = 6

/** The instant a press pressed at `pressedAt` has waited too long: the next morning in the company's calendar. */
export function waitLimitAt(pressedAt: number): number {
  const nextDay = ymdAddDays(denverCalendarDayKey(pressedAt), 1)
  return appTzWallTimeMs(nextDay, NEXT_MORNING_HOUR, 0)
}

export function waitedTooLong(press: OutboxPress, now: number): boolean {
  return press.state === 'waiting' && now >= waitLimitAt(press.pressedAt)
}

/** Refused by the server, or waited past the next morning: the bar is red and the list says *Needs you*. */
export function needsAPerson(press: OutboxPress, now: number): boolean {
  return press.state === 'refused' || waitedTooLong(press, now)
}

// ---------------------------------------------------------------------------
// The order, and what goes next

function bySeq(a: OutboxPress, b: OutboxPress): number {
  return a.seq - b.seq
}

/** The presses in the order they go out. */
export function inOrder(presses: readonly OutboxPress[]): OutboxPress[] {
  return [...presses].sort(bySeq)
}

/**
 * A press whose clock-in was refused cannot go: it is refused with that reason, never sent. The
 * rest are returned as they were.
 */
export const DEPENDENCY_REFUSED_MESSAGE = 'Its clock in could not be sent.'

export function settleDependents(presses: readonly OutboxPress[]): OutboxPress[] {
  const byId = new Map(presses.map((p) => [p.id, p]))
  return presses.map((p) => {
    if (p.state !== 'waiting' || !p.dependsOn) return p
    const dep = byId.get(p.dependsOn)
    if (!dep || dep.state !== 'refused') return p
    return { ...p, state: 'refused', refusal: { message: DEPENDENCY_REFUSED_MESSAGE, code: null } }
  })
}

/** The oldest waiting press, which is the one whose turn it is; null while one is in flight or nothing waits. */
export function oldestWaiting(presses: readonly OutboxPress[]): OutboxPress | null {
  if (presses.some((p) => p.state === 'sending')) return null
  const byId = new Map(presses.map((p) => [p.id, p]))
  for (const p of inOrder(presses)) {
    if (p.state !== 'waiting') continue
    const dep = p.dependsOn ? byId.get(p.dependsOn) : null
    // Its clock-in is still ahead of it in the queue: it goes after, never before.
    if (dep && (dep.state === 'waiting' || dep.state === 'sending')) continue
    return p
  }
  return null
}

/**
 * The press to send now, or null: the oldest waiting press once its try is due. The queue goes
 * out in order, so a press behind one that is not due yet waits with it; and a failed try stops
 * the run, so one lost signal costs one request, not one per press.
 */
export function nextToSend(presses: readonly OutboxPress[], now: number): OutboxPress | null {
  const next = oldestWaiting(presses)
  if (!next) return null
  return nextTryAt(next) <= now ? next : null
}

/** The instant the queue could next do something with no new event: the oldest waiting press's due time, or null. */
export function nextDueAt(presses: readonly OutboxPress[], now: number): number | null {
  const next = oldestWaiting(presses)
  if (!next) return null
  const at = nextTryAt(next)
  return at > now ? at : null
}

// ---------------------------------------------------------------------------
// The transitions

export function markSending(press: OutboxPress, now: number): OutboxPress {
  return { ...press, state: 'sending', attempts: press.attempts + 1, lastTriedAt: now }
}

/** Landed: the first time, or again (the server answered the first landing's result, which counts once). */
export function markSent(press: OutboxPress, result: unknown, now: number): OutboxPress {
  return { ...press, state: 'sent', sentAt: press.sentAt ?? now, result, refusal: null, seen: false }
}

export function markRefused(press: OutboxPress, refusal: OutboxRefusal): OutboxPress {
  return { ...press, state: 'refused', refusal, seen: false }
}

/** The try failed at the fetch layer: back to waiting, the next try by the delay rule. */
export function markTryFailed(press: OutboxPress, now: number): OutboxPress {
  return { ...press, state: 'waiting', lastTriedAt: now }
}

/** Try now: the next try is due at once, whatever the delay rule said. */
export function markDueNow(press: OutboxPress): OutboxPress {
  if (press.state !== 'waiting') return press
  return { ...press, attempts: 0, lastTriedAt: null }
}

/** Got it, or the door opened: the bar stops speaking for these. */
export function markSeen(presses: readonly OutboxPress[], ids: readonly string[]): OutboxPress[] {
  const set = new Set(ids)
  return presses.map((p) => (set.has(p.id) && !p.seen ? { ...p, seen: true } : p))
}

/** Dropped by a person from the list: gone for good. A sent press is never dropped by hand. */
export function dropPress(presses: readonly OutboxPress[], id: string): OutboxPress[] {
  return presses.filter((p) => p.id !== id || p.state === 'sent' || p.state === 'sending')
}

/**
 * What the store keeps: everything waiting, sending or refused; a sent press for the rest of the
 * day it landed on (the list's *Sent today*), and a day longer when nobody pressed Got it; a
 * press kept by another person is never this person's.
 */
export function prune(presses: readonly OutboxPress[], now: number, userId: string): OutboxPress[] {
  const today = denverCalendarDayKey(now)
  return presses.filter((p) => {
    if (p.userId !== userId) return false
    if (p.state !== 'sent') return true
    const sentDay = denverCalendarDayKey(p.sentAt ?? p.pressedAt)
    if (sentDay === today) return true
    return !p.seen && ymdAddDays(sentDay, 1) === today
  })
}

// ---------------------------------------------------------------------------
// The words. Plain words (`plainWords.ts`): one idea a sentence, no glue inside one. The bar's
// pieces are drawn as separate spans, never joined with a dash.

export type FormatTime = (ms: number) => string

/** "Clock in from 7:58 AM". */
export function pressLead(press: OutboxPress, formatTime: FormatTime = formatDenverTimeOnly): string {
  return `${OUTBOX_KIND_WORDS[press.kind]} from ${formatTime(press.pressedAt)}`
}

export const WAITING_WORDS = 'waiting to send'
export const SENT_MARK = 'sent ✓'
export const TRY_NOW_LABEL = 'Try now'
export const GOT_IT_LABEL = 'Got it'
export const FIX_LABEL = 'Fix'
export const SEE_THEM_WORDS = 'see them'
export const COULD_NOT_BE_SENT_WORDS = 'could not be sent.'
export const WAITED_TOO_LONG_WORDS = 'has waited since yesterday.'
export const WAITED_TOO_LONG_HELP = 'Open the list to send it now or drop it.'
/** The strip's line while the queue holds every press made since the trouble began. */
export const NOTHING_LOST_WORDS = 'Nothing you pressed is lost.'

export function countdownWords(ms: number): string {
  return `trying again in ${Math.max(1, Math.ceil(ms / 1000))} s`
}

export function lastTriedWords(lastTriedAt: number, formatTime: FormatTime = formatDenverTimeOnly): string {
  return `last tried ${formatTime(lastTriedAt)}`
}

export type OutboxBarTone = 'amber' | 'green' | 'red'

export interface OutboxBarButton {
  kind: 'try-now' | 'got-it' | 'fix'
  label: string
  /** The door a Fix opens; null for the other two. */
  door: string | null
  /** The press a Fix is for; the presses a Got it clears. */
  pressIds: string[]
}

export interface OutboxBarWords {
  tone: OutboxBarTone
  /** The first words, bold. */
  lead: string
  /** Pieces after the lead, each its own span. */
  lines: string[]
  /** "trying again in 12 s", drawn again each second; null when no try is counted down. */
  countdown: string | null
  button: OutboxBarButton | null
  /** A tap on the words opens the list. */
  opensList: boolean
  /** A send is in flight. */
  pulsing: boolean
}

export interface OutboxBarOptions {
  formatTime?: FormatTime
  /** The browser says offline: no countdown, since the resend fires on the online event. */
  offline?: boolean
}

/**
 * What the bar reads, or null when it is gone. Red first (a press needs a person), then the send
 * in flight, then what waits with its countdown, then what landed until Got it. The owner's words
 * of 2026-10-24 and 2026-10-26 (`to-dos/honest-and-fast/README.md`, part 3).
 */
export function outboxBarWords(presses: readonly OutboxPress[], now: number, opts: OutboxBarOptions = {}): OutboxBarWords | null {
  const fmt = opts.formatTime ?? formatDenverTimeOnly
  const ordered = inOrder(presses)
  const needing = ordered.filter((p) => needsAPerson(p, now) && !p.seen)
  const sending = ordered.find((p) => p.state === 'sending') ?? null
  const waiting = ordered.filter((p) => p.state === 'waiting' && !waitedTooLong(p, now))
  const sent = ordered.filter((p) => p.state === 'sent' && !p.seen)
  const sentLine = sent.length > 0 ? [`${sent.length} ${SENT_MARK}`] : []

  if (needing.length > 0) {
    if (needing.length === 1) {
      const p = needing[0]!
      const refused = p.state === 'refused'
      return {
        tone: 'red',
        lead: `${pressLead(p, fmt)} ${refused ? COULD_NOT_BE_SENT_WORDS : WAITED_TOO_LONG_WORDS}`,
        lines: [refused ? p.refusal?.message ?? '' : WAITED_TOO_LONG_HELP, ...sentLine].filter(Boolean),
        countdown: null,
        button: { kind: 'fix', label: FIX_LABEL, door: p.door, pressIds: [p.id] },
        opensList: true,
        pulsing: false,
      }
    }
    return {
      tone: 'red',
      lead: `${needing.length} presses need you`,
      lines: sentLine,
      countdown: null,
      button: null,
      opensList: true,
      pulsing: false,
    }
  }

  if (sending) {
    return {
      tone: 'amber',
      lead: `Sending ${pressLead(sending, fmt).replace(/^./, (c) => c.toLowerCase())}…`,
      lines: sentLine,
      countdown: null,
      button: null,
      opensList: true,
      pulsing: true,
    }
  }

  if (waiting.length > 0) {
    const oldest = oldestWaiting(presses) ?? waiting[0]!
    const due = nextTryAt(oldest)
    const countdown = opts.offline || due <= now ? null : countdownWords(due - now)
    const tried = oldest.lastTriedAt != null ? [lastTriedWords(oldest.lastTriedAt, fmt)] : []
    const button: OutboxBarButton = { kind: 'try-now', label: TRY_NOW_LABEL, door: null, pressIds: waiting.map((p) => p.id) }
    if (waiting.length === 1) {
      return {
        tone: 'amber',
        lead: pressLead(oldest, fmt),
        lines: [WAITING_WORDS, ...tried, ...sentLine],
        countdown,
        button,
        opensList: true,
        pulsing: false,
      }
    }
    return {
      tone: 'amber',
      lead: `${waiting.length} waiting to send`,
      lines: [...tried, ...sentLine],
      countdown,
      button,
      opensList: true,
      pulsing: false,
    }
  }

  if (sent.length > 0) {
    const button: OutboxBarButton = { kind: 'got-it', label: GOT_IT_LABEL, door: null, pressIds: sent.map((p) => p.id) }
    if (sent.length === 1) {
      return { tone: 'green', lead: `${pressLead(sent[0]!, fmt)} ${SENT_MARK}`, lines: [], countdown: null, button, opensList: true, pulsing: false }
    }
    return { tone: 'green', lead: `${sent.length} ${SENT_MARK}`, lines: [SEE_THEM_WORDS], countdown: null, button, opensList: true, pulsing: false }
  }

  return null
}

/**
 * *Nothing you pressed is lost.* is true while the queue holds something and no press needs a
 * person: the strip says it beside the slow line only then (#183's table).
 */
export function outboxHoldsEverything(presses: readonly OutboxPress[], now: number): boolean {
  const holding = presses.some((p) => p.state === 'waiting' || p.state === 'sending')
  return holding && !presses.some((p) => needsAPerson(p, now))
}

/** The waiting count the slow line and the No signal line name: "2 waiting to send". */
export function waitingCountWords(presses: readonly OutboxPress[]): string | null {
  const n = presses.filter((p) => p.state === 'waiting' || p.state === 'sending').length
  if (n === 0) return null
  return `${n} waiting to send`
}

// ---------------------------------------------------------------------------
// The list behind the bar

export type OutboxDoorState = 'needs-you' | 'waiting' | 'sending' | 'sent'

export interface OutboxDoorRow {
  id: string
  state: OutboxDoorState
  /** "Clock in", "Job note". */
  kind: string
  /** "Ridgeway Builders"; empty when the press is about nothing in particular. */
  about: string
  /** "pressed 7:58 AM". */
  pressed: string
  /** "sent 9:42 AM", "could not be sent", "waiting since yesterday", "sending…". */
  status: string
  /** The server's reason, or the wait's. */
  reason: string | null
  door: string | null
  canSendNow: boolean
  canDrop: boolean
}

export interface OutboxDoorSections {
  needsYou: OutboxDoorRow[]
  waiting: OutboxDoorRow[]
  sentToday: OutboxDoorRow[]
}

export const SEND_NOW_LABEL = 'Send now'
export const DROP_LABEL = 'Drop it'

export function outboxDoorSections(presses: readonly OutboxPress[], now: number, formatTime: FormatTime = formatDenverTimeOnly): OutboxDoorSections {
  const out: OutboxDoorSections = { needsYou: [], waiting: [], sentToday: [] }
  for (const p of inOrder(presses)) {
    const base = { id: p.id, kind: OUTBOX_KIND_WORDS[p.kind], about: p.about, pressed: `pressed ${formatTime(p.pressedAt)}`, door: p.door }
    if (p.state === 'refused') {
      out.needsYou.push({ ...base, state: 'needs-you', status: 'could not be sent', reason: p.refusal?.message ?? null, canSendNow: false, canDrop: true })
    } else if (waitedTooLong(p, now)) {
      out.needsYou.push({ ...base, state: 'needs-you', status: 'waiting since yesterday', reason: WAITED_TOO_LONG_HELP, canSendNow: true, canDrop: true })
    } else if (p.state === 'waiting') {
      const tried = p.lastTriedAt != null ? `, ${lastTriedWords(p.lastTriedAt, formatTime)}` : ''
      out.waiting.push({ ...base, state: 'waiting', status: `${WAITING_WORDS}${tried}`, reason: null, canSendNow: true, canDrop: true })
    } else if (p.state === 'sending') {
      out.waiting.push({ ...base, state: 'sending', status: 'sending…', reason: null, canSendNow: false, canDrop: false })
    } else {
      out.sentToday.push({ ...base, state: 'sent', status: `sent ${formatTime(p.sentAt ?? now)}`, reason: null, canSendNow: false, canDrop: false })
    }
  }
  // Sent today reads newest first: the one that just landed on top.
  out.sentToday.reverse()
  return out
}
