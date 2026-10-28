/**
 * The walk's pure half (punch list #142 PR 8; `to-dos/walk-kit/BUILD_PLAN.md` § PR 8). `npm run walk`
 * (`scripts/walk/run.ts`) runs the Messages loop on prod end to end, on the company's own inbox and number, and
 * reads what landed where through the office's own kernels. What it can decide without a network lives here, tested
 * on its own: the flags, the steps and their limits, the wait that ends on its limit with what it saw and tries a poll
 * that threw again on the next (v2.6030), the kept kit's press window and its one seed (v2.6030), the estimate
 * text's words, what each wait looks for on the kit's thread, the strip's difference, the stray check, the report's
 * rows and lines, and the scrub that keeps a secret or a whole link out of anything printed.
 */
import { DEFAULT_LINES } from '../tellCustomer/tellCustomer'
import { fillLine } from '../quickReplies/blanks'
import { stoppedOn, type BoxSettings, type OptedOutByBox } from '../messages/boxes'
import type { Tile } from '../messages/weekStrip'
import { channelKey, type WalkKit } from './kit'
import { SEED_WHO } from './walkFunction'

// ---------------------------------------------------------------------------------------------------------------------
// The flags
// ---------------------------------------------------------------------------------------------------------------------

export interface WalkFlags {
  /** No cleanup at the end: the kit's rows stay for a look. */
  keep: boolean
  /** BUILD_PLAN § 4: the owner presses the two sends; the script waits for them, then does the rest as the dev identity. */
  ownerPresses: boolean
  /** BUILD_PLAN § 4: the kit's phone is the owner's own; the text legs are the owner's presses. */
  fallbackPhone: boolean
  /** README step 8: the tester answers from the thread by email, and the walk asserts one line out and no second. */
  answer: boolean
  /** Only `walk cleanup`. */
  cleanupOnly: boolean
}

export const WALK_FLAGS: ReadonlyArray<{ flag: string; key: keyof WalkFlags; words: string }> = [
  { flag: '--keep', key: 'keep', words: 'leave the kit’s rows for a look (no cleanup)' },
  { flag: '--owner-presses', key: 'ownerPresses', words: 'the owner presses the two sends; the walk waits for them' },
  { flag: '--fallback-phone', key: 'fallbackPhone', words: 'the kit’s phone is the owner’s own; the owner texts the replies' },
  { flag: '--answer', key: 'answer', words: 'the tester answers from the thread by email at the end' },
  { flag: '--cleanup-only', key: 'cleanupOnly', words: 'only clean up a kit left behind' },
]

/** The flags from argv; the unknown ones are named so a typo never runs a walk. */
export function parseWalkFlags(argv: readonly string[]): { flags: WalkFlags; unknown: string[] } {
  const flags: WalkFlags = { keep: false, ownerPresses: false, fallbackPhone: false, answer: false, cleanupOnly: false }
  const unknown: string[] = []
  for (const arg of argv) {
    const known = WALK_FLAGS.find((f) => f.flag === arg)
    if (known) flags[known.key] = true
    else unknown.push(arg)
  }
  return { flags, unknown }
}

// ---------------------------------------------------------------------------------------------------------------------
// The steps and their waits
// ---------------------------------------------------------------------------------------------------------------------

/** Every wait polls this often. */
export const POLL_MS = 15_000
/** A mail leg: the reader runs every minute, so three minutes is three chances. */
export const MAIL_WAIT_MS = 3 * 60_000
/** A text leg through Quo. */
export const TEXT_WAIT_MS = 3 * 60_000
/** A STOP or START's mark on the channel. */
export const STOP_WAIT_MS = 2 * 60_000
/** The owner's two presses (§ 4): long, since a person is pressing. */
export const OWNER_WAIT_MS = 15 * 60_000
/** The read of the kit's thread before seeding (found item 4): short, two more looks on a lost signal. */
export const SEED_READ_WAIT_MS = 30_000

export type StepKey =
  | 'setup'
  | 'signIn'
  | 'seedOld'
  | 'estimateEmail'
  | 'estimateText'
  | 'open'
  | 'replyEmail'
  | 'replyText'
  | 'stop'
  | 'start'
  | 'answer'
  | 'office'
  | 'stray'
  | 'cleanup'

export interface Step {
  key: StepKey
  name: string
  /** What the step waits for, or null when it is one press. */
  waitsFor: string | null
  limitMs: number | null
}

export const STEPS: readonly Step[] = [
  { key: 'setup', name: 'Set up the kit', waitsFor: null, limitMs: null },
  { key: 'signIn', name: 'Sign in as the tester', waitsFor: null, limitMs: null },
  { key: 'seedOld', name: 'Seed an older text of ours', waitsFor: null, limitMs: null },
  { key: 'estimateEmail', name: 'Send the estimate email', waitsFor: null, limitMs: null },
  { key: 'estimateText', name: 'Send the estimate text', waitsFor: null, limitMs: null },
  { key: 'open', name: 'Open the estimate from the bids inbox', waitsFor: 'the estimate email in bids@, then the 👀 line', limitMs: MAIL_WAIT_MS },
  { key: 'replyEmail', name: 'Reply by email from bids@', waitsFor: 'the email line in, box team', limitMs: MAIL_WAIT_MS },
  { key: 'replyText', name: 'Reply by text from the bids number', waitsFor: 'the text line in, and the estimate text delivered', limitMs: TEXT_WAIT_MS },
  { key: 'stop', name: 'Text STOP', waitsFor: 'the team box’s stop on the kit’s number', limitMs: STOP_WAIT_MS },
  { key: 'start', name: 'Text START', waitsFor: 'the stop cleared', limitMs: STOP_WAIT_MS },
  { key: 'answer', name: 'Answer from the thread by email', waitsFor: 'one line out and no second', limitMs: MAIL_WAIT_MS },
  { key: 'office', name: 'Read the office’s view', waitsFor: null, limitMs: null },
  { key: 'stray', name: 'Check for stray contacts', waitsFor: null, limitMs: null },
  { key: 'cleanup', name: 'Clean up', waitsFor: null, limitMs: null },
]

export const stepOf = (key: StepKey): Step => STEPS.find((s) => s.key === key)!

export interface WaitEnd<T> {
  found: T | null
  waitedMs: number
  polls: number
  /** The last poll that threw, in words (a lost signal, a refused read); null when every poll answered. */
  lastError: string | null
}

/**
 * Polls `check` every `pollMs` until it answers something, or `limitMs` has passed; then ends with what it saw. The
 * first look is at once, so a thing already there costs no wait. A poll that throws (`TypeError: fetch failed` on a
 * lost signal; `docs/WALK_KIT.md` § Found on the first walks, item 2) is tried again on the next poll, within the same
 * limit, and never ends the run: `onError` hears each one as it happens, and a wait that found nothing carries the
 * last one in words.
 */
export async function waitUntil<T>(
  check: () => Promise<T | null>,
  opts: { limitMs: number; pollMs?: number; sleep: (ms: number) => Promise<void>; now: () => number; onError?: (words: string, poll: number) => void },
): Promise<WaitEnd<T>> {
  const pollMs = opts.pollMs ?? POLL_MS
  const started = opts.now()
  let polls = 0
  let lastError: string | null = null
  for (;;) {
    polls += 1
    let found: T | null = null
    try {
      found = await check()
    } catch (e) {
      lastError = errorWords(e)
      opts.onError?.(lastError, polls)
    }
    const waitedMs = opts.now() - started
    if (found !== null && found !== undefined) return { found, waitedMs, polls, lastError }
    if (waitedMs >= opts.limitMs) return { found: null, waitedMs, polls, lastError }
    await opts.sleep(Math.min(pollMs, opts.limitMs - waitedMs))
  }
}

/**
 * An error in the walk's own words: its name, its message and its cause (`TypeError: fetch failed (ECONNRESET)`). The
 * one reading the walk's log is a dev who wants the cause, so the app's class copy (`formatErrorMessage`'s offline
 * sentence) is not used here.
 */
export function errorWords(e: unknown): string {
  if (!(e instanceof Error)) return String(e)
  const head = e.name && e.name !== 'Error' ? `${e.name}: ${e.message}` : e.message
  const cause = (e as { cause?: unknown }).cause
  if (cause instanceof Error) return `${head} (${cause.message})`
  if (cause !== undefined && cause !== null && cause !== '') return `${head} (${String(cause)})`
  return head
}

/** What a held wait saw: the step's own words, then the last poll that failed, when one did. */
export function waitSaw(end: Pick<WaitEnd<unknown>, 'lastError'>, words: string | null = null): string | null {
  const bits = [words, end.lastError ? `the last poll failed: ${end.lastError}` : null].filter((b): b is string => !!b)
  return bits.length ? bits.join('; ') : null
}

/** A wait's time in words: "2 m 30 s", "45 s". */
export function waitedWords(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const rest = s - m * 60
  return rest ? `${m} m ${rest} s` : `${m} m`
}

// ---------------------------------------------------------------------------------------------------------------------
// The estimate text's words
// ---------------------------------------------------------------------------------------------------------------------

/** The kit customer's first name: *ZZ Walk Messages Desk* reads as "ZZ". */
export const KIT_FIRST_NAME = 'ZZ'
export const TESTER_SAYS = 'ZZ Walk tester'

/** The estimate text as the Tell the customer sheet would make it, with the kit's blanks filled. */
export function estimateTextWords(input: { first?: string; me?: string; job: string; amount: string; link: string }): { text: string; left: string[] } {
  return fillLine(DEFAULT_LINES.estimate.text, {
    first: input.first ?? KIT_FIRST_NAME,
    me: input.me ?? TESTER_SAYS,
    job: input.job,
    amount: input.amount,
    link: input.link,
  })
}

// ---------------------------------------------------------------------------------------------------------------------
// What each wait looks for on the kit's thread
// ---------------------------------------------------------------------------------------------------------------------

/** A line of the kit's thread as the driver reads it (`MESSAGE_ROW_COLUMNS`, the ones the waits read). */
export interface ThreadLine {
  id: string
  quo_id: string | null
  channel_id: string | null
  channel: string
  direction: string
  who_text: string
  at: string
  body: string
  delivery: string | null
  mailbox: string | null
}

/** The 👀 line's key (`estimateEventLine.ts`): one per estimate. */
export const openedKey = (estimateId: string) => `estimate:${estimateId}:opened`

export function openedLine(lines: readonly ThreadLine[], estimateId: string): ThreadLine | null {
  return lines.find((l) => l.quo_id === openedKey(estimateId)) ?? null
}

/** Their newest line in on a channel, in a box when one is asked for, at or after `sinceIso`. */
export function inboundLine(lines: readonly ThreadLine[], channel: 'email' | 'text', box: 'team' | 'bids' | null, sinceIso: string): ThreadLine | null {
  const since = Date.parse(sinceIso) - 60_000
  const hits = lines.filter((l) => l.direction === 'in' && l.channel === channel && (box === null || l.mailbox === box) && Date.parse(l.at) >= since)
  hits.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  return hits[0] ?? null
}

/** Our newest line out on a channel at or after `sinceIso`, never the seed. */
export function outboundLine(lines: readonly ThreadLine[], channel: 'email' | 'text', sinceIso: string): ThreadLine | null {
  const since = Date.parse(sinceIso) - 60_000
  const hits = lines.filter((l) => l.direction === 'out' && l.channel === channel && !isSeedLine(l) && Date.parse(l.at) >= since)
  hits.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  return hits[0] ?? null
}

/** How many lines went out on a channel at or after `sinceIso`, the seed left out: README step 8 asserts one and no second. */
export function outboundCount(lines: readonly ThreadLine[], channel: 'email' | 'text', sinceIso: string): number {
  const since = Date.parse(sinceIso) - 60_000
  return lines.filter((l) => l.direction === 'out' && l.channel === channel && !isSeedLine(l) && Date.parse(l.at) >= since).length
}

/** Whether a text of ours has Quo's ✓ delivered. */
export function deliveredText(lines: readonly ThreadLine[], messageId: string | null): boolean {
  if (!messageId) return false
  return lines.some((l) => l.id === messageId && l.delivery === 'delivered')
}

/** The team box's stop on the kit's number, as `quo-webhook` writes it. */
export function stoppedForTeam(channel: { opted_out_at: string | null; opted_out_by_box: OptedOutByBox | null }): boolean {
  return stoppedOn({ channelId: 'kit', optedOutAt: channel.opted_out_at, optedOutByBox: channel.opted_out_by_box ?? {} }, 'team')
}

// ---------------------------------------------------------------------------------------------------------------------
// A kept kit: the press before the restart, and the one seed (v2.6030)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * When the owner's presses may have happened (found item 3): from the kit's own stamp, so a press made before a restart
 * on a kept kit is read, not waited for again; from the run's own moment when the kit carries no stamp.
 */
export function pressWindowStart(kit: Pick<WalkKit, 'madeAt'> | null, fallbackIso: string): string {
  const madeAt = kit?.madeAt ?? null
  return madeAt && Number.isFinite(Date.parse(madeAt)) ? madeAt : fallbackIso
}

/** The seed's `quo_id` prefix, as `seedOldColumns` writes it (`walkFunction.ts`). */
export const SEED_QUO_PREFIX = 'walk-seed-'

/** Whether a line is the seed: its who, or its quo_id's prefix. */
export function isSeedLine(line: Pick<ThreadLine, 'quo_id' | 'who_text'>): boolean {
  return line.who_text === SEED_WHO || (line.quo_id ?? '').startsWith(SEED_QUO_PREFIX)
}

/** The seed already on the kit's thread (found item 4): one per kit, so a restart on a kept kit makes no second. */
export function seedLine(lines: readonly ThreadLine[]): ThreadLine | null {
  return lines.find(isSeedLine) ?? null
}

// ---------------------------------------------------------------------------------------------------------------------
// The office's view: the strip's difference
// ---------------------------------------------------------------------------------------------------------------------

export interface TileDifference {
  key: string
  label: string
  withKit: string
  withoutKit: string
  /** The kit changed this tile. */
  differs: boolean
}

/** The strip read twice (README decision 7): each tile's value with the kit's lines and estimate, and without. */
export function stripDifference(withKit: readonly Tile[], withoutKit: readonly Tile[]): TileDifference[] {
  return withKit.map((t) => {
    const other = withoutKit.find((o) => o.key === t.key)
    const withoutValue = other ? `${other.value}${other.sub ? ` · ${other.sub}` : ''}` : 'none'
    const withValue = `${t.value}${t.sub ? ` · ${t.sub}` : ''}`
    return { key: t.key, label: t.label, withKit: withValue, withoutKit: withoutValue, differs: withValue !== withoutValue }
  })
}

// ---------------------------------------------------------------------------------------------------------------------
// The stray check
// ---------------------------------------------------------------------------------------------------------------------

/** The app's sender, as `EMAIL_FROM` names it on prod (`_shared/emailFrom.ts`); a secret the driver cannot read. */
export const APP_FROM_ADDRESS = 'team@noreply.clicktooling.com'

/** The keys of every address or number of our own (BUILD_PLAN § 5): both boxes', the app's sender's, the kit's. */
export function ownKeys(boxes: BoxSettings | null, kit: WalkKit | null, appFrom: string = APP_FROM_ADDRESS): Set<string> {
  const keys = new Set<string>()
  const add = (kind: 'email' | 'phone', value: string | null | undefined) => {
    const k = channelKey(kind, value)
    if (k) keys.add(`${kind}:${k}`)
  }
  for (const box of ['team', 'bids'] as const) {
    add('email', boxes?.[box].address)
    add('phone', boxes?.[box].phone)
  }
  add('email', appFrom)
  add('email', kit?.email)
  add('phone', kit?.phone)
  return keys
}

export interface StrayContact {
  id: string
  kind: string
  created_at: string
  channels: ReadonlyArray<{ kind: string; key: string }>
}

export interface StrayRow {
  contactId: string
  kind: string
  madeAt: string
  carries: string
}

/** Contacts made since the run began, other than the kit's, that carry an own address or number: there must be none. */
export function strayRows(contacts: readonly StrayContact[], own: ReadonlySet<string>, kitContactId: string | null, sinceIso: string): StrayRow[] {
  const since = Date.parse(sinceIso)
  const out: StrayRow[] = []
  for (const c of contacts) {
    if (c.id === kitContactId) continue
    if (Date.parse(c.created_at) < since) continue
    const hit = c.channels.find((ch) => own.has(`${ch.kind}:${ch.key}`))
    if (hit) out.push({ contactId: c.id, kind: c.kind, madeAt: c.created_at, carries: `${hit.kind} ${hit.key}` })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------------------------------------------------

export interface StepRow {
  key: StepKey
  name: string
  /** True went, false held, null not run (a flag left it out, or a step before it held). */
  ok: boolean | null
  sentAt: string | null
  landedAt: string | null
  /** Where it landed: the line, its box, the lane. */
  where: string | null
  /** Why it held. */
  held: string | null
  /** What it waited for, and for how long. */
  waitedFor: string | null
  /** What it saw when the wait ended. */
  saw: string | null
}

export function stepWent(key: StepKey, patch: Partial<Omit<StepRow, 'key' | 'name' | 'ok'>> = {}): StepRow {
  return { key, name: stepOf(key).name, ok: true, sentAt: null, landedAt: null, where: null, held: null, waitedFor: null, saw: null, ...patch }
}

export function stepHeld(key: StepKey, held: string, patch: Partial<Omit<StepRow, 'key' | 'name' | 'ok' | 'held'>> = {}): StepRow {
  return { key, name: stepOf(key).name, ok: false, sentAt: null, landedAt: null, where: null, held, waitedFor: null, saw: null, ...patch }
}

export function stepSkipped(key: StepKey, why: string): StepRow {
  return { key, name: stepOf(key).name, ok: null, sentAt: null, landedAt: null, where: null, held: why, waitedFor: null, saw: null }
}

export interface LaneReport {
  needsReply: string[]
  newLane: string[]
  waitingOnThem: string[]
  wentOut: string[]
  /** Where ZZ Walk is, and who has it. */
  kitIn: string
}

export interface WalkReport {
  startedAt: string
  finishedAt: string | null
  flags: WalkFlags
  kit: { customerId: string; contactId: string; estimateId: string | null; emailChannelId: string | null; phoneChannelId: string | null; sharedPhone: boolean } | null
  tester: { id: string; email: string } | null
  steps: StepRow[]
  lanes: LaneReport | null
  strip: TileDifference[] | null
  strays: StrayRow[] | null
  strayNote: string | null
  quo: Array<{ step: StepKey; status: number; quoId: string | null }>
  cleanup: Record<string, unknown> | null
  /** Every step that held, in words. */
  held: string[]
  ok: boolean
}

export function emptyReport(startedAt: string, flags: WalkFlags): WalkReport {
  return { startedAt, finishedAt: null, flags, kit: null, tester: null, steps: [], lanes: null, strip: null, strays: null, strayNote: null, quo: [], cleanup: null, held: [], ok: false }
}

/** The kit as the report names it: ids alone, never the address or number (they are the company's own, but the report is pasted around). */
export function reportKit(kit: WalkKit): WalkReport['kit'] {
  return { customerId: kit.customerId, contactId: kit.contactId, estimateId: kit.estimateId, emailChannelId: kit.emailChannelId, phoneChannelId: kit.phoneChannelId, sharedPhone: kit.sharedPhone }
}

/** A walk is green when every step that ran went, no stray contact was made, and cleanup answered counts or was kept off. */
export function finishReport(report: WalkReport, finishedAt: string): WalkReport {
  const held = report.steps.filter((s) => s.ok === false).map((s) => `${s.name}: ${s.held ?? 'held'}`)
  const strays = report.strays?.length ?? 0
  // Nothing to clean is clean too: a walk whose setup refused made no rows, and --cleanup-only after a clean walk finds none.
  const cleanupOk = report.flags.keep || (report.cleanup !== null && (report.cleanup.cleaned === true || report.cleanup.nothing === true))
  return { ...report, finishedAt, held, ok: held.length === 0 && strays === 0 && cleanupOk }
}

const t = (iso: string | null) => (iso ? iso.replace('T', ' ').slice(0, 19) : '—')

/** The report in plain lines, one row per step, then the lanes, the strip, the stray check and cleanup. */
export function reportLines(report: WalkReport): string[] {
  const out: string[] = []
  out.push(`Walk started ${t(report.startedAt)} UTC${report.finishedAt ? `, finished ${t(report.finishedAt)} UTC` : ''}.`)
  out.push(report.ok ? 'Green: every step went, no stray contact, cleaned up.' : 'Not green yet. See the held steps below.')
  out.push('')
  out.push('Steps')
  for (const s of report.steps) {
    const mark = s.ok === true ? '✓' : s.ok === false ? '✗' : '–'
    const bits = [`${mark} ${s.name}`]
    if (s.sentAt) bits.push(`sent ${t(s.sentAt)}`)
    if (s.landedAt) bits.push(`landed ${t(s.landedAt)}`)
    if (s.where) bits.push(s.where)
    if (s.waitedFor) bits.push(`waited ${s.waitedFor}`)
    if (s.saw) bits.push(`saw: ${s.saw}`)
    if (s.held) bits.push(s.ok === null ? `not run: ${s.held}` : `held: ${s.held}`)
    out.push(`  ${bits.join(' · ')}`)
  }
  if (report.lanes) {
    out.push('')
    out.push('The office’s view')
    out.push(`  ZZ Walk is ${report.lanes.kitIn}.`)
    out.push(`  Needs a reply: ${report.lanes.needsReply.length ? report.lanes.needsReply.join(', ') : 'nobody'}`)
    out.push(`  New: ${report.lanes.newLane.length ? report.lanes.newLane.join(', ') : 'nobody'}`)
    out.push(`  Waiting on them: ${report.lanes.waitingOnThem.length ? report.lanes.waitingOnThem.join(', ') : 'nobody'}`)
    out.push(`  Went out: ${report.lanes.wentOut.length ? report.lanes.wentOut.join('; ') : 'nothing'}`)
  }
  if (report.strip) {
    out.push('')
    out.push('The 7-day strip, with the kit and without')
    for (const d of report.strip) out.push(`  ${d.label}: ${d.withKit} | ${d.withoutKit}${d.differs ? ' (the kit’s difference)' : ''}`)
  }
  out.push('')
  if (report.strayNote) out.push(`Stray check: ${report.strayNote}`)
  else if (report.strays) out.push(report.strays.length === 0 ? 'Stray check: no contact made during the run carries an own address or number.' : `Stray check: ${report.strays.length} stray contact(s): ${report.strays.map((s) => `${s.kind} ${s.contactId} carries ${s.carries}`).join('; ')}`)
  if (report.quo.length) out.push(`Quo answered: ${report.quo.map((q) => `${q.step} ${q.status}${q.quoId ? ` (${q.quoId})` : ''}`).join(', ')}`)
  if (report.cleanup) {
    const counts = report.cleanup.counts as Record<string, number> | undefined
    out.push(counts ? `Cleaned up: ${Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(', ') || 'nothing to delete'}.` : `Cleanup: ${String(report.cleanup.words ?? JSON.stringify(report.cleanup))}`)
  } else if (report.flags.keep) out.push('Kept: the kit’s rows stay (--keep). Run `npm run walk -- --cleanup-only` to remove them.')
  if (report.held.length) {
    out.push('')
    out.push('Held')
    for (const h of report.held) out.push(`  ${h}`)
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------------
// Nothing printed carries a secret or a whole link
// ---------------------------------------------------------------------------------------------------------------------

const ACCEPT_LINK = /https?:\/\/[^\s"'<>]+\/estimate\/accept\?[^\s"'<>]*/gi

/** A link or a token as it may be printed: its last four characters. */
export const tail4 = (v: string) => `…${v.slice(-4)}`

/**
 * The text with every secret (8 characters or more) and every accept link replaced by its last four characters. The
 * anon key, the dev-login secret, the tester's JWT and the estimate's link all go through here before `console.log`.
 */
export function secretsOut(text: string, secrets: readonly (string | null | undefined)[]): string {
  let out = text.replace(ACCEPT_LINK, (m) => tail4(m))
  for (const s of secrets) {
    if (!s || s.length < 8) continue
    out = out.split(s).join(tail4(s))
  }
  return out
}
