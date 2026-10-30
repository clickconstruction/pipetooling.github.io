/**
 * The chase clock as a strip of days (punch list #217, bids-7, a prototype): one pending bid's
 * clock drawn instead of said. The Call queue and Waiting to hear read *quiet 5d*, *0 of 1
 * fresh*, *to chase* and *tab gettable* — verdicts from two silent defaults, seven days since
 * the last contact (`PENDING_CHASE_STALE_CONTACT_DAYS`) and twenty-one days since the send
 * (`TAB_GETTABLE_AFTER_DAYS`) — and a day someone promised reads the same as a day the rule
 * made. The strip puts each on a day: the send a blue dot, each contact a filled dot, the
 * call-again day a diamond (solid when a person promised it, dashed when the rule made it), the
 * tab-gettable day a green tick, today a line. A bid is *to chase* when today has reached its
 * diamond, and the reader can see it coming.
 *
 * Pure: it reads `resolveBidFollowup`'s answer and the bid's contact instants and returns
 * cells; `ChaseClockStrip.tsx` draws them. The window runs from the send to a little past the
 * farthest mark, never over `CHASE_CLOCK_MAX_DAYS`; a bid sent long ago keeps today in view and
 * says its send fell off the left edge.
 */

import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort, ymdAddDays, ymdDaysBetween } from '../../utils/dateUtils'
import { PENDING_CHASE_STALE_CONTACT_DAYS } from '../bidPendingChase'
import { followupNeedsCall, type BidFollowup, type BidFollowupSource } from './bidNextFollowup'
import { TAB_GETTABLE_AFTER_DAYS } from './callQueue'

export type ChaseClockMark = 'sent' | 'contact' | 'promised' | 'default' | 'gettable'

export type ChaseClockDay = {
  ymd: string
  /** 0 Sunday … 6 Saturday. */
  dow: number
  weekend: boolean
  today: boolean
  /** The marks on the day, the ones that matter first. */
  marks: ChaseClockMark[]
  /** The day's hover: "Oct 27 · a contact". */
  title: string
}

export type ChaseClockLabelTone = 'muted' | 'blue' | 'amber' | 'green'

export type ChaseClockLabel = {
  ymd: string
  text: string
  tone: ChaseClockLabelTone
  /** Which way the words lean off their day, so the first and the last never run off the strip. */
  align: 'left' | 'center' | 'right'
}

export type ChaseClockCallAgain = {
  ymd: string
  source: BidFollowupSource
  /** "call again · Nov 3 · the rule's 7 days after the last contact" */
  words: string
}

export type ChaseClockStrip = {
  startYmd: string
  endYmd: string
  days: ChaseClockDay[]
  sentYmd: string
  /** The send sits on the strip; false when the window had to drop it off the left edge. */
  sentOnStrip: boolean
  /** The contact days on or after the send, each once, oldest first. */
  contactYmds: string[]
  callAgain: ChaseClockCallAgain | null
  /** The day the bid's tab becomes worth asking for; null when a tab is already on record. */
  gettable: { ymd: string; past: boolean } | null
  /** Today has reached the call-again day: the bid belongs on today's list. */
  toChase: boolean
  /** Days from the last contact (or the send, with none) to today. */
  quietDays: number
  labels: ChaseClockLabel[]
  /** The whole strip in one sentence, for the hover and the screen reader. */
  words: string
}

export type ChaseClockInput = {
  /** `bids.bid_date_sent` ('YYYY-MM-DD') or an instant. */
  sentIso: string | null
  /** Every contact's instant (method entries and the bid's own stamp); order and duplicates do not matter. */
  contactIsos: ReadonlyArray<string>
  /** Where the bid stands today, from `resolveBidFollowup`. */
  followup: BidFollowup
  /** A bid tab is already on record: no gettable day to draw. */
  hasTab: boolean
  todayYmd: string
}

export const CHASE_CLOCK_MAX_DAYS = 42
/** Air past the farthest mark, and the least the strip reaches past today. */
export const CHASE_CLOCK_PAD_DAYS = 3
/** Two labels closer than this, in days, would overprint: the lesser gives way. */
export const CHASE_CLOCK_LABEL_GAP_DAYS = 4

const YMD = /^\d{4}-\d{2}-\d{2}$/
const MARK_ORDER: ReadonlyArray<ChaseClockMark> = ['promised', 'default', 'gettable', 'sent', 'contact']

/** A civil day from a bare date or an instant; '' for neither. */
function dayOf(iso: string | null | undefined): string {
  if (!iso) return ''
  const bare = iso.slice(0, 10)
  if (YMD.test(bare) && (iso.length === 10 || iso.charAt(10) !== 'T')) return bare
  return calendarYmdInAppTzFromIso(iso)
}

function dowOf(ymd: string): number {
  return new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))).getUTCDay()
}

function md(ymd: string): string {
  return formatWorkDateYmdMonthDayShort(ymd)
}

function later(a: string, b: string): string {
  return a >= b ? a : b
}

/** The call-again day with its words. Null only when the follow-up has no day and the bid no send. */
export function chaseClockCallAgain(followup: BidFollowup, sentYmd: string): ChaseClockCallAgain | null {
  if (followup.source === 'bid' && followup.dueYmd) return { ymd: followup.dueYmd, source: 'bid', words: `call again · ${md(followup.dueYmd)} · promised` }
  if (followup.source === 'builder' && followup.dueYmd) return { ymd: followup.dueYmd, source: 'builder', words: `call again · ${md(followup.dueYmd)} · the builder's day` }
  if (followup.dueYmd) {
    // The rule's day, never before the send: a contact older than the send does not start the clock.
    const ymd = later(followup.dueYmd, sentYmd)
    return { ymd, source: 'default', words: `call again · ${md(ymd)} · the rule's ${PENDING_CHASE_STALE_CONTACT_DAYS} days after the last contact` }
  }
  if (!sentYmd) return null
  return { ymd: sentYmd, source: 'default', words: `call again · ${md(sentYmd)} · the day it went out, nobody has called since` }
}

const LABEL_RANK: Record<ChaseClockLabelTone, number> = { amber: 0, blue: 1, muted: 2, green: 3 }

/**
 * The labels under the strip, the lesser of two close neighbours dropped: the call-again day
 * outranks today, today the send, the send the gettable day. Exported for its own test.
 */
export function chaseClockLabels(wanted: ReadonlyArray<Omit<ChaseClockLabel, 'align'>>, startYmd: string, endYmd: string): ChaseClockLabel[] {
  const inWindow = wanted.filter((l) => l.ymd >= startYmd && l.ymd <= endYmd)
  const byRank = [...inWindow].sort((a, b) => LABEL_RANK[a.tone] - LABEL_RANK[b.tone])
  const kept: Array<Omit<ChaseClockLabel, 'align'>> = []
  for (const l of byRank) {
    const crowded = kept.some((k) => Math.abs(ymdDaysBetween(k.ymd, l.ymd) ?? 0) < CHASE_CLOCK_LABEL_GAP_DAYS)
    if (!crowded) kept.push(l)
  }
  kept.sort((a, b) => a.ymd.localeCompare(b.ymd))
  const span = Math.max(1, ymdDaysBetween(startYmd, endYmd) ?? 1)
  return kept.map((l) => {
    const at = (ymdDaysBetween(startYmd, l.ymd) ?? 0) / span
    return { ...l, align: at < 0.2 ? 'left' : at > 0.8 ? 'right' : 'center' }
  })
}

/** One pending bid's clock as cells. Null when the bid has no send day to count from. */
export function chaseClockStrip(input: ChaseClockInput): ChaseClockStrip | null {
  const sentYmd = dayOf(input.sentIso)
  if (!sentYmd) return null
  const { todayYmd } = input
  const contactYmds = [...new Set(input.contactIsos.map(dayOf).filter((d) => d && d >= sentYmd))].sort()
  const callAgain = chaseClockCallAgain(input.followup, sentYmd)
  const gettableYmd = input.hasTab ? null : ymdAddDays(sentYmd, TAB_GETTABLE_AFTER_DAYS)
  const gettable = gettableYmd ? { ymd: gettableYmd, past: gettableYmd <= todayYmd } : null

  let startYmd = sentYmd
  let endYmd = ymdAddDays([ymdAddDays(todayYmd, CHASE_CLOCK_PAD_DAYS), callAgain?.ymd ?? '', gettableYmd ?? ''].sort().slice(-1)[0]!, 1)
  if ((ymdDaysBetween(startYmd, endYmd) ?? 0) + 1 > CHASE_CLOCK_MAX_DAYS) {
    // Too long to read as columns: keep today in view, the far past trimmed first.
    const ahead = Math.min(ymdDaysBetween(todayYmd, endYmd) ?? 0, 14)
    endYmd = ymdAddDays(todayYmd, Math.max(CHASE_CLOCK_PAD_DAYS, ahead))
    startYmd = ymdAddDays(endYmd, -(CHASE_CLOCK_MAX_DAYS - 1))
  }
  const sentOnStrip = sentYmd >= startYmd

  const days: ChaseClockDay[] = []
  for (let ymd = startYmd; ymd <= endYmd; ymd = ymdAddDays(ymd, 1)) {
    const marks: ChaseClockMark[] = []
    const words: string[] = []
    if (ymd === sentYmd) {
      marks.push('sent')
      words.push('sent')
    }
    if (contactYmds.includes(ymd)) {
      marks.push('contact')
      words.push('a contact')
    }
    if (callAgain && ymd === callAgain.ymd) {
      marks.push(callAgain.source === 'default' ? 'default' : 'promised')
      words.push(callAgain.words)
    }
    if (gettable && ymd === gettable.ymd) {
      marks.push('gettable')
      words.push('tab gettable from here')
    }
    marks.sort((a, b) => MARK_ORDER.indexOf(a) - MARK_ORDER.indexOf(b))
    const dow = dowOf(ymd)
    days.push({ ymd, dow, weekend: dow === 0 || dow === 6, today: ymd === todayYmd, marks, title: [md(ymd), ymd === todayYmd ? 'today' : '', ...words].filter(Boolean).join(' · ') })
  }

  const lastContact = contactYmds[contactYmds.length - 1] ?? null
  const quietDays = Math.max(0, ymdDaysBetween(lastContact ?? sentYmd, todayYmd) ?? 0)
  const toChase = followupNeedsCall(input.followup)

  const wanted: Array<Omit<ChaseClockLabel, 'align'>> = []
  if (sentOnStrip) wanted.push({ ymd: sentYmd, text: `sent ${md(sentYmd)}`, tone: 'muted' })
  if (todayYmd >= startYmd && todayYmd <= endYmd) wanted.push({ ymd: todayYmd, text: 'today', tone: 'blue' })
  if (callAgain) wanted.push({ ymd: callAgain.ymd, text: callAgain.source === 'default' ? 'call again · default' : 'call again · promised', tone: 'amber' })
  if (gettable) wanted.push({ ymd: gettable.ymd, text: gettable.past ? `tab gettable since ${md(gettable.ymd)}` : `tab gettable ${md(gettable.ymd)}`, tone: 'green' })
  const labels = chaseClockLabels(wanted, startYmd, endYmd)

  const parts: string[] = []
  parts.push(sentOnStrip ? `Sent ${md(sentYmd)}.` : `Sent ${md(sentYmd)}, before the strip starts.`)
  parts.push(
    contactYmds.length === 0
      ? 'No contact since it went out.'
      : `${contactYmds.length} contact${contactYmds.length === 1 ? '' : 's'}, the last ${md(lastContact!)}.`,
  )
  if (callAgain) {
    const rel = callAgain.ymd < todayYmd ? 'passed' : callAgain.ymd === todayYmd ? 'is today' : 'is ahead'
    parts.push(`${callAgain.words.replace(/^call again/, 'Call again')}, ${rel}.`)
  }
  if (gettable) parts.push(gettable.past ? `Tab gettable since ${md(gettable.ymd)}.` : `Tab gettable from ${md(gettable.ymd)}.`)
  parts.push(`Today ${md(todayYmd)}: ${quietDays} day${quietDays === 1 ? '' : 's'} quiet${toChase ? ', to chase' : ''}.`)

  return { startYmd, endYmd, days, sentYmd, sentOnStrip, contactYmds, callAgain, gettable, toChase, quietDays, labels, words: parts.join(' ') }
}

export type ChaseClockLegendItem = { mark: ChaseClockMark | 'today'; words: string }

/** The legend drawn once over a list of strips. */
export function chaseClockLegend(): ChaseClockLegendItem[] {
  return [
    { mark: 'sent', words: 'the send' },
    { mark: 'contact', words: 'a contact' },
    { mark: 'promised', words: 'call again, a day someone promised' },
    { mark: 'default', words: `call again by the rule, ${PENDING_CHASE_STALE_CONTACT_DAYS} days after the last contact` },
    { mark: 'gettable', words: `tab gettable, ${TAB_GETTABLE_AFTER_DAYS} days after the send` },
    { mark: 'today', words: 'today' },
  ]
}
