/**
 * The text about a card charge (punch list #299, PR 2): the pure rules the `receipt-request` sweep, the Settings switch
 * and the Team queue's line share. When a charge posts to a card tied to a person, the company number texts that
 * person a receipt link (`receiptLink.ts`, PR 1). This file holds the switch's shape, which charges are asked, why a
 * text cannot go, which charges share one text, when the one reminder is due, and every word of the two texts.
 *
 * Its one import is the company's time zone, which is pure too, so the app's tests import this file as the function
 * does (`src/lib/tickets/receiptText.ts` re-exports it).
 */
import { APP_CALENDAR_TZ, todayYmdInAppTz } from './appTimeZone.ts'

// ---------------------------------------------------------------------------------------------------------------------
// Where a link points.

/**
 * The host a receipt link rides: the short host, since its Worker (`portal-link-shell`, the Cloudflare dashboard,
 * mirrored in `scripts/cloudflare/portal-link-shell.worker.js`) answers `my.clickplumbing.com/r/<code>` with a 301
 * to the app's `/r/:code`, as it does for `/e/` and `/pay/` (v2.7286, punch list #299). Null would make the link the
 * app's own address again.
 */
export const RECEIPT_SHORT_ORIGIN: string | null = 'https://my.clickplumbing.com'

/** `https://my.clickplumbing.com/r/<code>`, the short host's; the app's own address when the origin is null. */
export function receiptLinkUrl(code: string, origin: string = RECEIPT_SHORT_ORIGIN ?? 'https://clicktooling.com'): string {
  return `${origin.replace(/\/$/, '')}/r/${encodeURIComponent(code.trim().toLowerCase())}`
}

// ---------------------------------------------------------------------------------------------------------------------
// The switch: `app_settings` `receipt_texts_v1`, JSON in `value_text`. Off as it ships.

export const RECEIPT_TEXTS_KEY = 'receipt_texts_v1'

export interface ReceiptTextsSetting {
  on: boolean
  /** When it was last switched on. A charge that posted before it is never texted: switching on asks about no backlog. */
  since: string | null
  /** A trial: only these people's charges text. Empty means everyone with a card. */
  only: string[]
}

export const RECEIPT_TEXTS_OFF: ReceiptTextsSetting = { on: false, since: null, only: [] }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The switch as stored. Anything that does not read is off: a doubt never sends a text. */
export function parseReceiptTextsSetting(valueText: string | null | undefined): ReceiptTextsSetting {
  if (!valueText) return RECEIPT_TEXTS_OFF
  let raw: unknown
  try {
    raw = JSON.parse(valueText)
  } catch {
    return RECEIPT_TEXTS_OFF
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return RECEIPT_TEXTS_OFF
  const o = raw as Record<string, unknown>
  const since = typeof o.since === 'string' && Number.isFinite(Date.parse(o.since)) ? o.since : null
  // On with no day to start from is off: there would be no floor under the backlog.
  if (o.on !== true || !since) return { on: false, since, only: [] }
  // Nobody named is everyone, so a list that does not read must never be taken for nobody named: it is off.
  if (o.only === undefined || o.only === null) return { on: true, since, only: [] }
  if (!Array.isArray(o.only) || !o.only.every((v): v is string => typeof v === 'string' && UUID_RE.test(v))) return { on: false, since, only: [] }
  return { on: true, since, only: [...new Set(o.only.map((v) => v.toLowerCase()))] }
}

/**
 * The words to store for a press of the switch. Switching on stamps now, so nothing older is asked about. The database
 * stamps it again with its own clock (`receipt_texts_stamp`, the migration), so a phone whose clock is wrong cannot
 * reach back; what the row then holds is what the app reads.
 */
export function receiptTextsValue(next: { on: boolean; only?: readonly string[] }, nowIso: string): string {
  if (!next.on) return JSON.stringify({ on: false })
  return JSON.stringify({ on: true, since: nowIso, only: [...new Set(next.only ?? [])] })
}

/** How far back the sweep looks behind now, whatever the switch says: a charge older than this is never texted. */
export const RECEIPT_SWEEP_HOURS = 48

/** The oldest posting the sweep asks about: the later of the switch's day and the look-back. Null when the switch is off. */
export function receiptSweepFloor(setting: ReceiptTextsSetting, nowMs: number): string | null {
  if (!setting.on || !setting.since) return null
  const since = Date.parse(setting.since)
  return new Date(Math.max(since, nowMs - RECEIPT_SWEEP_HOURS * 60 * 60 * 1000)).toISOString()
}

/** Whether a holder's charges text under the switch: everyone, or the people a trial names. */
export function receiptHolderInTrial(setting: ReceiptTextsSetting, holderUserId: string | null): boolean {
  if (!setting.on) return false
  if (setting.only.length === 0) return true
  return holderUserId !== null && setting.only.includes(holderUserId.toLowerCase())
}

// ---------------------------------------------------------------------------------------------------------------------
// Which charges are asked, and why a text cannot go.

const DEAD_STATUSES: ReadonlySet<string> = new Set(['failed', 'cancelled', 'canceled', 'reversed'])
const CARD_KINDS: ReadonlySet<string> = new Set(['debitCardTransaction', 'creditCardTransaction'])

export interface ReceiptChargeRow {
  id: string
  kind: string | null
  /** Signed dollars as the bank feed has them: a purchase is below zero. */
  amount: number
  status: string | null
  posted_at: string | null
  duplicate_of_transaction_id?: string | null
}

/**
 * A charge the sweep asks about: a card purchase that has posted and stands. Never a pending one (her call: *not
 * pending but lands*), never money back (nothing to photograph), never a failed or reversed charge, never a duplicate.
 */
export function receiptChargeAsks(c: ReceiptChargeRow): boolean {
  if (!c.kind || !CARD_KINDS.has(c.kind)) return false
  if (!c.posted_at || !Number.isFinite(Date.parse(c.posted_at))) return false
  if (!(Number(c.amount) < 0)) return false
  if (DEAD_STATUSES.has(String(c.status ?? '').toLowerCase())) return false
  return !c.duplicate_of_transaction_id
}

export type ReceiptNoTextWhy = 'no_person' | 'archived' | 'no_cell' | 'opted_out'

/** Why no text can go for a charge, the first that holds; null when one can. */
export function receiptNoTextWhy(h: { holderUserId: string | null; archived: boolean; cell: string | null; optedOut: boolean }): ReceiptNoTextWhy | null {
  if (!h.holderUserId) return 'no_person'
  if (h.archived) return 'archived'
  if (!h.cell) return 'no_cell'
  return h.optedOut ? 'opted_out' : null
}

/** A text that failed is tried again on a later sweep, this many times in all; after that the line says it did not go. */
export const RECEIPT_TEXT_TRIES = 3

// ---------------------------------------------------------------------------------------------------------------------
// One text a charge.

/**
 * Charges one text names. One, since v2.7299: the owner's call 3 of 2026-11-14 (punch list #299), "One text per charge",
 * over the hour's fold the card drew. A link still opens up to `RECEIPT_LINK_CAPS.charges`, for a link the office makes.
 */
export const RECEIPT_FOLD_MAX = 1

export interface ReceiptWaiting {
  requestId: string
  holderUserId: string
  postedAtMs: number
}

/**
 * The texts a sweep sends: one a charge, oldest first across every holder, each run `RECEIPT_FOLD_MAX` charges long.
 * Until v2.7299 a holder's charges that posted inside one hour shared one text; the owner chose one text a charge, so a
 * second charge minutes after the first gets its own text and its own link, the one line without the hello.
 */
export function foldReceiptCharges<T extends ReceiptWaiting>(waiting: readonly T[]): T[][] {
  const sorted = [...waiting].sort((a, b) => a.postedAtMs - b.postedAtMs || a.requestId.localeCompare(b.requestId))
  const out: T[][] = []
  for (const w of sorted) {
    const run = out[out.length - 1]
    if (run && run[0]!.holderUserId === w.holderUserId && run.length < RECEIPT_FOLD_MAX) run.push(w)
    else out.push([w])
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------------
// The one reminder: the first six in the evening at least twelve hours after the text.

export const RECEIPT_COMPANY_TZ = APP_CALENDAR_TZ
const REMINDER_AFTER_MS = 12 * 60 * 60 * 1000
const REMINDER_FROM_HOUR = 18
const REMINDER_TO_HOUR = 21

/** The hour of the company's clock at an instant, 0 to 23. */
export function receiptCompanyHour(ms: number): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: RECEIPT_COMPANY_TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date(ms))
  return Number(h) % 24
}

/**
 * Whether the reminder goes on this sweep. It goes once, between six and nine in the evening on the company's clock, at
 * least twelve hours after the first text: a text at 6:14 PM is reminded the next evening, and one that went before dawn
 * is reminded that same evening. A sweep that was down at six does not text at midnight; it waits for the next evening.
 * Never past the day the link closes.
 */
export function receiptReminderDue(r: { texted_at: string | null; reminded_at: string | null; answered_at: string | null; closed_at: string | null; closes_at: string }, nowMs: number): boolean {
  if (!r.texted_at || r.reminded_at || r.answered_at || r.closed_at) return false
  const texted = Date.parse(r.texted_at)
  if (!Number.isFinite(texted) || nowMs - texted < REMINDER_AFTER_MS) return false
  if (!(Date.parse(r.closes_at) > nowMs)) return false
  const hour = receiptCompanyHour(nowMs)
  return hour >= REMINDER_FROM_HOUR && hour < REMINDER_TO_HOUR
}

// ---------------------------------------------------------------------------------------------------------------------
// The words of the two texts.

export interface ReceiptTextCharge {
  /** Signed or not: the words use the size. */
  amount: number
  store: string | null
  posted_at: string | null
}

function money(amount: number): string {
  return `$${Math.abs(Number(amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function chargeWords(c: ReceiptTextCharge): string {
  const store = (c.store ?? '').trim()
  return store ? `${money(c.amount)} at ${store}` : money(c.amount)
}

function companyDay(ms: number): string {
  return todayYmdInAppTz(new Date(ms))
}

/** *today*, or *on Tuesday* for a charge that posted on an earlier company day. */
function postedWhen(charges: readonly ReceiptTextCharge[], nowMs: number): string {
  const days = charges.map((c) => (c.posted_at ? Date.parse(c.posted_at) : NaN)).filter((ms) => Number.isFinite(ms))
  if (days.length === 0 || days.every((ms) => companyDay(ms) === companyDay(nowMs))) return 'today'
  const oldest = Math.min(...days)
  if (!days.every((ms) => companyDay(ms) === companyDay(oldest))) return 'this week'
  return `on ${new Intl.DateTimeFormat('en-US', { timeZone: RECEIPT_COMPANY_TZ, weekday: 'long' }).format(new Date(oldest))}`
}

function total(charges: readonly ReceiptTextCharge[]): string {
  return money(charges.reduce((sum, c) => sum + Math.abs(Number(c.amount) || 0), 0))
}

/**
 * The text when a charge posts. A person's first text from the company number opens with their name and the company's;
 * every later one is the one line. The carriers' opt-out line is not written here: `planSend` adds it once, on a first
 * text, as it does for a customer.
 *
 *   Hi Jordan, this is Click Plumbing. $228.58 at Ridgeway Supply posted to your card today. Snap the receipt here: <link>
 *   $228.58 at Ridgeway Supply and $41.17 at Cedar Bend Hardware posted to your card today. Snap the receipts here: <link>
 *   3 charges posted to your card today, $311.92 in all. Snap the receipts here: <link>
 */
export function receiptTextBody(a: { first: boolean; firstName: string; company: string; charges: readonly ReceiptTextCharge[]; url: string; nowMs: number }): string {
  const name = a.firstName.trim()
  const company = a.company.trim()
  const hello = a.first && company ? `${name ? `Hi ${name}, this is` : 'This is'} ${company}. ` : ''
  const when = postedWhen(a.charges, a.nowMs)
  const n = a.charges.length
  if (n === 1) return `${hello}${chargeWords(a.charges[0]!)} posted to your card ${when}. Snap the receipt here: ${a.url}`
  if (n === 2) return `${hello}${chargeWords(a.charges[0]!)} and ${chargeWords(a.charges[1]!)} posted to your card ${when}. Snap the receipts here: ${a.url}`
  return `${hello}${n} charges posted to your card ${when}, ${total(a.charges)} in all. Snap the receipts here: ${a.url}`
}

/**
 * The one reminder, the next evening.
 *
 *   Still no receipt for $228.58 at Ridgeway Supply. Snap it here: <link>
 *   Still no receipt for $228.58 at Ridgeway Supply and $41.17 at Cedar Bend Hardware. Snap them here: <link>
 *   Still no receipt for 3 charges on your card, $311.92 in all. Snap them here: <link>
 */
export function receiptReminderBody(a: { charges: readonly ReceiptTextCharge[]; url: string }): string {
  const n = a.charges.length
  if (n === 1) return `Still no receipt for ${chargeWords(a.charges[0]!)}. Snap it here: ${a.url}`
  if (n === 2) return `Still no receipt for ${chargeWords(a.charges[0]!)} and ${chargeWords(a.charges[1]!)}. Snap them here: ${a.url}`
  return `Still no receipt for ${n} charges on your card, ${total(a.charges)} in all. Snap them here: ${a.url}`
}

// ---------------------------------------------------------------------------------------------------------------------
// Text again: the office's press for one more text on a charge texted twice with no receipt (v2.8697).

/** The most texts the office sends by Text again on one charge, beside the first text and the reminder. */
export const RECEIPT_AGAIN_MAX = 2
/** A charge rests this long after the reminder, and after each Text again, before the office can press. */
export const RECEIPT_AGAIN_REST_HOURS = 12

export interface ReceiptAgainRequest {
  no_text_why: string | null
  texted_at: string | null
  reminded_at: string | null
  answered_at: string | null
  closed_at: string | null
  closes_at: string
  again_at?: string | null
  again_count?: number | null
}

/** Why the rule holds a Text again back. */
export type ReceiptAgainHold = 'answered' | 'closed' | 'held' | 'not_twice' | 'cap' | 'resting'

/**
 * Whether the office may text a charge again, by the request alone: null when it may, else the first reason that
 * holds. The charge was texted and reminded, twelve hours have passed since the reminder and since the last Text
 * again, the receipt has not come, the link is open, and the office has pressed fewer than `RECEIPT_AGAIN_MAX` times.
 * The function asks this before it sends; the office's list shows a row only when the first five are so.
 */
export function receiptAgainHold(r: ReceiptAgainRequest, nowMs: number): ReceiptAgainHold | null {
  if (r.answered_at) return 'answered'
  if (r.closed_at || !(Date.parse(r.closes_at) > nowMs)) return 'closed'
  if (r.no_text_why) return 'held'
  const rest = RECEIPT_AGAIN_REST_HOURS * 60 * 60 * 1000
  const reminded = r.reminded_at ? Date.parse(r.reminded_at) : NaN
  if (!r.texted_at || !Number.isFinite(reminded) || nowMs - reminded < rest) return 'not_twice'
  if ((r.again_count ?? 0) >= RECEIPT_AGAIN_MAX) return 'cap'
  const again = r.again_at ? Date.parse(r.again_at) : NaN
  if (Number.isFinite(again) && nowMs - again < rest) return 'resting'
  return null
}

/**
 * The text a Text again sends. It says who is asking, so it does not read as the reminder a second time.
 *
 *   The office still needs the receipt for $228.58 at Ridgeway Supply. Snap it here: <link>
 */
export function receiptAgainBody(a: { charge: ReceiptTextCharge; url: string }): string {
  return `The office still needs the receipt for ${chargeWords(a.charge)}. Snap it here: ${a.url}`
}

/** Every reason a Text again sends nothing: the rule's, the two switches', the charge's, the holder's and the caller's. */
export type ReceiptAgainRefusal = ReceiptAgainHold | 'off' | 'texts_off' | 'not_in_trial' | 'gone' | 'dead' | 'has_ticket' | 'no_holder' | 'no_cell' | 'opted_out' | 'taken' | 'not_office' | 'training'

/** What the office reads when a Text again sent nothing. `who` is the holder's first name, or empty. */
export function receiptAgainRefusalWords(why: ReceiptAgainRefusal, who: string): string {
  const name = who.trim() || 'The holder'
  switch (why) {
    case 'answered':
    case 'has_ticket':
      return 'That charge has its receipt now, so no text went.'
    case 'closed':
      return 'The link for that charge has closed, so no text went.'
    case 'held':
      return 'No text can go for that charge. Its row says why.'
    case 'not_twice':
      return 'Text again comes twelve hours after the reminder. No text went.'
    case 'cap':
      return `The office has texted ${who.trim() || 'the holder'} again ${RECEIPT_AGAIN_MAX === 2 ? 'twice' : `${RECEIPT_AGAIN_MAX} times`} about this charge. Ask for the receipt another way.`
    case 'resting':
      return `${name} was texted again less than twelve hours ago. No text went.`
    case 'off':
      return 'Receipt texts are off in Settings, so no text went.'
    case 'texts_off':
      return 'Send texts is off in Settings, so no text went.'
    case 'not_in_trial':
      return `Receipt texts are on for a trial, and ${who.trim() || 'the holder'} is not in it. No text went.`
    case 'gone':
      return 'That request is gone, so no text went.'
    case 'dead':
      return 'The bank took that charge back, so there is no receipt to ask for.'
    case 'no_holder':
      return 'The person who held that card has left, so no text went.'
    case 'no_cell':
      return `${name} has no cell on file now, so no text went. Add the cell on People.`
    case 'opted_out':
      return `${name} replied STOP, so no text went. Ask for the receipt another way.`
    case 'taken':
      return 'Someone else pressed Text again on this charge a moment ago. One text went.'
    case 'not_office':
      return 'Only the office can text a card holder again.'
    case 'training':
      return 'This is a training account, so no text went.'
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The charge's line in the office's Team queue.

export interface ReceiptRequestState {
  holder_name: string
  no_text_why: string | null
  texted_at: string | null
  reminded_at: string | null
  answered_at: string | null
  closed_at: string | null
  text_tries: number
}

function clock(iso: string, nowMs: number): string {
  const ms = Date.parse(iso)
  const time = new Intl.DateTimeFormat('en-US', { timeZone: RECEIPT_COMPANY_TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(ms))
  if (companyDay(ms) === companyDay(nowMs)) return time
  return `${new Intl.DateTimeFormat('en-US', { timeZone: RECEIPT_COMPANY_TZ, weekday: 'short' }).format(new Date(ms))} ${time}`
}

export type ReceiptLineTone = 'waiting' | 'held'

export interface ReceiptLine {
  /** The chip beside the store: *Texted 6:14 PM*, or *No text*. */
  chip: string
  /** The sentence under the charge. */
  words: string
  tone: ReceiptLineTone
  /** The press that mends a text that could not go, or null. */
  next: string | null
}

/**
 * What the Team queue says on a charge with no ticket yet: when it was texted and reminded, or why no text could go
 * with the press that mends it. Null when there is nothing to say: no request, a request the office made by hand, or a
 * charge whose receipt came (the ticket's own chip says that).
 */
export function receiptLineWords(r: ReceiptRequestState, nowMs: number): ReceiptLine | null {
  if (r.answered_at || r.closed_at) return null
  const who = (r.holder_name ?? '').trim().split(/\s+/)[0] ?? ''
  const held = (words: string, next: string): ReceiptLine => ({ chip: 'No text', words, tone: 'held', next })
  switch (r.no_text_why) {
    case 'no_person':
      return held('The card is tied to no one.', 'Tie the card on Banking, and its next charge texts the holder.')
    case 'no_cell':
      return held(`${who || 'The holder'} has no cell on file.`, 'Add the cell on People, and the next charge texts them.')
    case 'archived':
      return held(`${who || 'The holder'} has left.`, 'Tie the card to who holds it now on Banking.')
    case 'opted_out':
      return held(`${who || 'The holder'} replied STOP.`, 'Ask for the receipt another way. A START from their phone brings the texts back.')
  }
  if (r.texted_at) {
    const reminded = r.reminded_at ? `Reminded ${clock(r.reminded_at, nowMs)}. ` : ''
    return { chip: `Texted ${clock(r.texted_at, nowMs)}`, words: `${reminded}No receipt yet.`, tone: 'waiting', next: null }
  }
  if ((r.text_tries ?? 0) >= RECEIPT_TEXT_TRIES) return held('The text did not go.', 'Copy the receipt link and send it yourself.')
  return null
}

// ---------------------------------------------------------------------------------------------------------------------
// The Settings card's words.

export const RECEIPT_TEXTS_WORDS = {
  title: 'Text a receipt link when a card charge posts',
  what: 'When a charge posts to a card tied to a person, the company number texts them a link. The link opens a page where they photograph the receipt.',
  rules: 'One text for the charges that post together. One reminder the next evening. A charge with its ticket already gets no text.',
  needs: 'Send texts must be on too. A person with no cell on file gets no text, and the charge says so on the Team queue.',
  everyone: 'Everyone with a card',
  onlyMe: 'Only me, to try it first',
  whoLabel: 'Who gets these texts',
  confirm: {
    title: 'Turn on receipt texts?',
    message: 'Each card charge that posts from now on texts its holder. Each one is a real text to their phone.',
    confirmLabel: 'Turn it on',
  },
  confirmTrial: {
    title: 'Try receipt texts on your own card?',
    message: 'Each charge that posts to your card from now on texts you. No one else gets a text.',
    confirmLabel: 'Turn it on for me',
  },
  onToast: 'Receipt texts are on. Charges that post from now on text their holders.',
  trialToast: 'Receipt texts are on for you alone.',
  offToast: 'Receipt texts are off.',
  notSaved: 'The switch did not change. Only the owner or a dev can turn receipt texts on or off.',
  sendTextsOff: 'Send texts is off, so no receipt text goes. Turn Send texts on above first.',
  changeWho: 'Turn it off to change who gets these texts.',
} as const

/**
 * What the Settings card says while the switch is on: who it texts and since when, on the company's clock.
 *
 *   On for everyone with a card since Nov 13, 2:04 PM. A charge that posted before then gets no text.
 */
export function receiptTextsOnWords(setting: ReceiptTextsSetting, myUserId: string | null): string | null {
  if (!setting.on || !setting.since) return null
  const when = new Intl.DateTimeFormat('en-US', { timeZone: RECEIPT_COMPANY_TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(Date.parse(setting.since)))
  const n = setting.only.length
  const who = n === 0 ? 'for everyone with a card' : n === 1 && myUserId !== null && setting.only[0] === myUserId.toLowerCase() ? 'for you alone' : `for ${n} ${n === 1 ? 'person' : 'people'}`
  return `On ${who} since ${when}. A charge that posted before then gets no text.`
}
