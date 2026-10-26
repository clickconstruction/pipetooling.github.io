/**
 * The last 7 days (punch list #140 PR 5): five tiles under the pills on `/messages`, each a door to the rows behind
 * its number — *Answered within an hour* (the share, last week's beside it) opens Needs a reply; *Longest wait right
 * now* (who, and who has it) opens their thread; *Texts not delivered* opens Went out on its texts; *Estimates* (sent,
 * opened, accepted, and how many opened and went quiet) opens Waiting on them; *Ratings* (asked, answered and the
 * score, v2.5878) opens the newest answer's thread. The office read six true sections top to bottom with no number
 * that said how the week went. Pure; the read is `weekStripIo.ts` (its own 14-day read, not the page's view), the
 * strip `components/messages/WeekStrip.tsx`; the longest wait comes from the queue the panel already reads
 * (`waitsFromQueue`, over the page's `onQueue`), never a second read.
 */
import type { ContactKind } from '../contacts/kernel'
import type { NeedsReplyRow } from '../followUp/queue'
import type { FollowUpContact } from '../followUp/followUpRows'
import { startOfYmdInAppTzMs, todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import { APP_WHO } from './appLines'
import { inPill, type KindPill } from './kindPills'
import { deliveryMark, type MessageChannel, type QuoDeliveryWord } from './thread'

/** The window, today included. */
export const STRIP_DAYS = 7
const HOUR_MS = 3_600_000

/** One line either way, as the io reads it. */
export interface StripLine {
  id: string
  contactId: string
  kind: ContactKind | null
  direction: 'in' | 'out'
  channel: MessageChannel
  atMs: number
  /** Who sent it: a name, or the app's own who (`APP_WHO`) on a send nobody pressed. */
  who: string
  /** Quo's answer on a text of ours; null before it answers. */
  delivery?: QuoDeliveryWord | null
}

/** An estimate as the io reads it: when it went, and what the customer did with it. */
export interface StripEstimate {
  id: string
  number: number
  sentAtMs: number | null
  opened: boolean
  accepted: boolean
}

/** A person waiting on a reply, as the queue has them: the page builds these from the panel's queue (`waitsFromQueue`). */
export interface StripWait {
  contactId: string
  name: string
  /** Who has it, by name; null when nobody does. */
  has: string | null
  waitingSinceMs: number
  /** The line the thread opens at. */
  landOnId: string | null
}

/** A rating ask as the io reads it (v2.5878): when it went, and the customer's answer when one came. */
export interface StripRating {
  contactId: string | null
  askedAtMs: number
  answeredAtMs: number | null
  score: number | null
}

/** A span of time, `[fromMs, toMs)`. */
export interface StripWindow {
  fromMs: number
  toMs: number
}

/** This week (the last `STRIP_DAYS` days, today included, in the company calendar) and the seven before it. */
export function stripWindows(now: Date): { thisWeek: StripWindow; lastWeek: StripWindow } {
  const today = todayYmdInAppTz(now)
  const start = startOfYmdInAppTzMs(ymdAddDays(today, -(STRIP_DAYS - 1)))
  const end = startOfYmdInAppTzMs(ymdAddDays(today, 1))
  const lastStart = startOfYmdInAppTzMs(ymdAddDays(today, -(2 * STRIP_DAYS - 1)))
  return { thisWeek: { fromMs: start, toMs: end }, lastWeek: { fromMs: lastStart, toMs: start } }
}

const inWindow = (ms: number, w: StripWindow) => ms >= w.fromMs && ms < w.toMs

/** The lines under a pill. A number nobody has named shows under All alone, as the lanes do. */
export function linesForPill(lines: readonly StripLine[], pill: KindPill): StripLine[] {
  return pill === 'all' ? [...lines] : lines.filter((l) => l.kind !== null && inPill(l.kind, pill))
}

// ---------- turns: one wait per run of theirs, answered by the first real reply ----------

/** One run of their lines, from the first after our last word, and when one of ours first answered it. */
export interface Turn {
  contactId: string
  inAtMs: number
  outAtMs: number | null
}

const ANSWER_CHANNELS: ReadonlySet<MessageChannel> = new Set<MessageChannel>(['text', 'email', 'call'])

/**
 * A line of ours that answers them: a text, an email or a call one of ours made. Never the app's own send (a reminder
 * is not an answer), never a text Quo could not deliver (they never read it), and never a note, which the customer never
 * sees — the thread's court (`courtOf`) ignores notes for the same reason.
 */
export function answers(l: Pick<StripLine, 'direction' | 'channel' | 'who' | 'delivery'>): boolean {
  if (l.direction !== 'out' || !ANSWER_CHANNELS.has(l.channel)) return false
  if (l.who.trim().toLowerCase() === APP_WHO) return false
  if (l.channel === 'text' && deliveryMark({ direction: 'out', channel: 'text', delivery: l.delivery ?? null })?.bad) return false
  return true
}

/**
 * The turns, oldest first: a person who writes at 9 and again at 9:05 before we reply made one turn, not two; the
 * answer is the first line of ours that answers after it; the next line of theirs after that answer opens a new turn.
 */
export function turns(lines: readonly StripLine[]): Turn[] {
  const byContact = new Map<string, StripLine[]>()
  for (const l of lines) {
    const ls = byContact.get(l.contactId)
    if (ls) ls.push(l)
    else byContact.set(l.contactId, [l])
  }
  const out: Turn[] = []
  for (const [contactId, ls] of byContact) {
    ls.sort((a, b) => a.atMs - b.atMs)
    let open: Turn | null = null
    for (const l of ls) {
      if (l.direction === 'in') {
        if (!open) {
          open = { contactId, inAtMs: l.atMs, outAtMs: null }
          out.push(open)
        }
      } else if (open && answers(l)) {
        open.outAtMs = l.atMs
        open = null
      }
    }
  }
  return out.sort((a, b) => a.inAtMs - b.inAtMs)
}

export interface AnsweredShare {
  count: number
  of: number
  /** `count / of`, or null for a window with no turn. */
  share: number | null
}

/** Of the turns that started inside the window, how many one of ours answered within an hour. */
export function answeredWithinHour(ts: readonly Turn[], w: StripWindow): AnsweredShare {
  const inW = ts.filter((t) => inWindow(t.inAtMs, w))
  const count = inW.filter((t) => t.outAtMs !== null && t.outAtMs - t.inAtMs <= HOUR_MS).length
  return { count, of: inW.length, share: inW.length ? count / inW.length : null }
}

export const pct = (share: number): string => `${Math.round(share * 100)}%`

/** "↑ from 71% last week", "↓ from 90% last week", "same as last week"; null when either week had no turn. */
export function fromLastWeek(now: number | null, last: number | null): string | null {
  if (now === null || last === null) return null
  const a = Math.round(now * 100)
  const b = Math.round(last * 100)
  return a > b ? `↑ from ${b}% last week` : a < b ? `↓ from ${b}% last week` : 'same as last week'
}

// ---------- the longest wait ----------

/** "35 min", "6 h", "2 d 4 h". */
export function waitWords(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h`
  const d = Math.floor(h / 24)
  return `${d} d ${h - d * 24} h`
}

export interface LongestWait {
  contactId: string
  name: string
  has: string | null
  words: string
  landOnId: string | null
}

/** The person waiting longest right now, or null when nobody waits. */
export function longestWaitNow(waits: readonly StripWait[], now: Date): LongestWait | null {
  const first = [...waits].sort((a, b) => a.waitingSinceMs - b.waitingSinceMs)[0]
  if (!first) return null
  return { contactId: first.contactId, name: first.name, has: first.has, words: waitWords(now.getTime() - first.waitingSinceMs), landOnId: first.landOnId }
}

const NOBODY_NAMED = 'A number nobody has named'

/** The queue's Needs a reply rows as the strip wants them: the name, who has it by name, and since when. */
export function waitsFromQueue(rows: readonly NeedsReplyRow[], contacts: readonly FollowUpContact[], nameOf: (userId: string) => string | null): StripWait[] {
  const out: StripWait[] = []
  for (const r of rows) {
    if (!r.waitingSince) continue
    const since = Date.parse(r.waitingSince)
    if (Number.isNaN(since)) continue
    const c = contacts.find((x) => x.id === r.contactId)
    out.push({
      contactId: r.contactId,
      name: c?.name?.trim() || c?.company?.trim() || NOBODY_NAMED,
      has: c?.hasUserId ? (nameOf(c.hasUserId) ?? 'Someone') : null,
      waitingSinceMs: since,
      landOnId: r.landOnId,
    })
  }
  return out
}

// ---------- texts not delivered, and the estimates ----------

/** The texts of ours inside the window that Quo could not deliver, newest first. */
export function textsNotDelivered(lines: readonly StripLine[], w: StripWindow): { count: number; first: { contactId: string } | null } {
  const bad = lines
    .filter((l) => l.direction === 'out' && l.channel === 'text' && inWindow(l.atMs, w) && deliveryMark({ direction: 'out', channel: 'text', delivery: l.delivery ?? null })?.bad)
    .sort((a, b) => b.atMs - a.atMs)
  return { count: bad.length, first: bad[0] ? { contactId: bad[0].contactId } : null }
}

export interface Funnel {
  sent: number
  opened: number
  accepted: number
  /** Opened and not accepted: the ones to nudge. */
  openedQuiet: number
}

/** Of the estimates sent inside the window: how many the customer opened, accepted, or opened and went quiet on. */
export function estimateFunnel(estimates: readonly StripEstimate[], w: StripWindow): Funnel {
  const sent = estimates.filter((e) => e.sentAtMs !== null && inWindow(e.sentAtMs, w))
  return {
    sent: sent.length,
    opened: sent.filter((e) => e.opened).length,
    accepted: sent.filter((e) => e.accepted).length,
    openedQuiet: sent.filter((e) => e.opened && !e.accepted).length,
  }
}

// ---------- the ratings ----------

export interface RatingRead {
  asked: number
  answered: number
  /** The answered scores' mean, one decimal's worth; null with no answer. */
  avg: number | null
  /** Answers of 2 or less: the ones to call. */
  low: number
  /** The newest answer's thread, for the tile's door. */
  newest: { contactId: string } | null
}

/** Of the asks minted inside the window: how many the customer answered, and the score they gave. */
export function ratingRead(ratings: readonly StripRating[], w: StripWindow): RatingRead {
  const asked = ratings.filter((r) => inWindow(r.askedAtMs, w))
  const answered = asked.filter((r) => r.answeredAtMs !== null && r.score !== null)
  const newest = [...answered].sort((a, b) => (b.answeredAtMs ?? 0) - (a.answeredAtMs ?? 0)).find((r) => r.contactId)
  return {
    asked: asked.length,
    answered: answered.length,
    avg: answered.length ? Math.round((answered.reduce((s, r) => s + (r.score ?? 0), 0) / answered.length) * 10) / 10 : null,
    low: answered.filter((r) => (r.score ?? 5) <= 2).length,
    newest: newest?.contactId ? { contactId: newest.contactId } : null,
  }
}

// ---------- the tiles ----------

export type TileKey = 'answered' | 'longest' | 'notDelivered' | 'estimates' | 'ratings'
export type TileDoor = { kind: 'needs-reply' } | { kind: 'thread'; contactId: string; at: string | null } | { kind: 'went-out' } | { kind: 'waiting' }

export interface Tile {
  key: TileKey
  label: string
  value: string
  sub: string | null
  /** Where the number's rows are; null for a tile with nothing behind it, which reads *none* and is no press. */
  door: TileDoor | null
  tip: string
}

export const STRIP_WORDS = {
  title: 'The last 7 days',
  note: 'Each number opens its rows.',
  problem: 'The last 7 days could not be read.',
  answered: 'Answered within an hour',
  longest: 'Longest wait right now',
  notDelivered: 'Texts not delivered',
  estimates: 'Estimates',
  none: 'none',
  of: (count: number, of: number) => `${count} of ${of}`,
  hasIt: (name: string) => `${name} has it`,
  nobodyHasIt: 'nobody has it',
  /** Under Mine: the strip is the office's read, not the lens's. */
  officeWait: 'The office’s numbers, not only yours.',
  funnel: (f: Funnel) => `${f.sent} sent · ${f.opened} opened · ${f.accepted} accepted`,
  openedQuiet: (n: number) => (n === 1 ? '1 opened and quiet' : `${n} opened and quiet`),
  ratings: 'Ratings',
  ratingLine: (r: RatingRead) => `${r.asked} asked · ${r.answered} answered${r.avg !== null ? ` · ${r.avg} of 5` : ''}`,
  ratingLow: (n: number) => (n === 1 ? '1 answer of 2 or less' : `${n} answers of 2 or less`),
  tips: {
    answered: 'Opens Needs a reply.',
    longest: 'Opens their thread.',
    notDelivered: 'Opens Went out on its texts.',
    estimates: 'Opens Waiting on them.',
    ratings: 'Opens the newest answer’s thread.',
  } as const,
}

/** The five tiles for the week under a pill. The estimates and the ratings are customers', so they read none under any other pill. */
export function stripTiles(input: { lines: readonly StripLine[]; estimates: readonly StripEstimate[]; ratings?: readonly StripRating[]; waits: readonly StripWait[]; now: Date; pill: KindPill }): Tile[] {
  const w = stripWindows(input.now)
  const lines = linesForPill(input.lines, input.pill)
  const ts = turns(lines)
  const a = answeredWithinHour(ts, w.thisWeek)
  const last = answeredWithinHour(ts, w.lastWeek)
  const longest = longestWaitNow(input.waits, input.now)
  const bad = textsNotDelivered(lines, w.thisWeek)
  const f = input.pill === 'all' || input.pill === 'customer' ? estimateFunnel(input.estimates, w.thisWeek) : null
  const r = input.pill === 'all' || input.pill === 'customer' ? ratingRead(input.ratings ?? [], w.thisWeek) : null
  return [
    {
      key: 'answered',
      label: STRIP_WORDS.answered,
      value: a.share !== null ? pct(a.share) : STRIP_WORDS.none,
      sub: a.of ? [STRIP_WORDS.of(a.count, a.of), fromLastWeek(a.share, last.share)].filter(Boolean).join(' · ') : null,
      door: a.of ? { kind: 'needs-reply' } : null,
      tip: STRIP_WORDS.tips.answered,
    },
    {
      key: 'longest',
      label: STRIP_WORDS.longest,
      value: longest ? longest.words : STRIP_WORDS.none,
      sub: longest ? `${longest.name} · ${longest.has ? STRIP_WORDS.hasIt(longest.has) : STRIP_WORDS.nobodyHasIt}` : null,
      door: longest ? { kind: 'thread', contactId: longest.contactId, at: longest.landOnId } : null,
      tip: STRIP_WORDS.tips.longest,
    },
    {
      key: 'notDelivered',
      label: STRIP_WORDS.notDelivered,
      value: bad.count ? String(bad.count) : STRIP_WORDS.none,
      sub: null,
      door: bad.count ? { kind: 'went-out' } : null,
      tip: STRIP_WORDS.tips.notDelivered,
    },
    {
      key: 'estimates',
      label: STRIP_WORDS.estimates,
      value: f && f.sent ? STRIP_WORDS.funnel(f) : STRIP_WORDS.none,
      sub: f && f.openedQuiet ? STRIP_WORDS.openedQuiet(f.openedQuiet) : null,
      door: f && f.sent ? { kind: 'waiting' } : null,
      tip: STRIP_WORDS.tips.estimates,
    },
    {
      key: 'ratings',
      label: STRIP_WORDS.ratings,
      value: r && r.asked ? STRIP_WORDS.ratingLine(r) : STRIP_WORDS.none,
      sub: r && r.low ? STRIP_WORDS.ratingLow(r.low) : null,
      door: r?.newest ? { kind: 'thread', contactId: r.newest.contactId, at: null } : null,
      tip: STRIP_WORDS.tips.ratings,
    },
  ]
}
