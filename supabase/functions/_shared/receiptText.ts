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
 * The host a receipt link rides. Null until the short host's Worker (`portal-link-shell`, the Cloudflare dashboard)
 * answers `my.clickplumbing.com/r/<code>` with a 301 to the app's `/r/:code`, as it does for `/e/` and `/pay/`; until
 * then the link is the app's own address.
 */
export const RECEIPT_SHORT_ORIGIN: string | null = null

/** `https://clicktooling.com/r/<code>`, or the short host's once it forwards. */
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
// One text for the charges of one hour.

/** Charges one text names; a link opens the same number (`RECEIPT_LINK_CAPS.charges`). */
export const RECEIPT_FOLD_MAX = 10
export const RECEIPT_FOLD_MS = 60 * 60 * 1000

export interface ReceiptWaiting {
  requestId: string
  holderUserId: string
  postedAtMs: number
}

/**
 * The texts a sweep sends: each holder's waiting charges, oldest first, cut into runs that post inside one hour of the
 * run's first charge, at most ten a run. A charge that posts after a text has gone gets its own text; the fold is for
 * charges that wait together, which is most nights, since the bank posts in batches before dawn.
 */
export function foldReceiptCharges<T extends ReceiptWaiting>(waiting: readonly T[]): T[][] {
  const byHolder = new Map<string, T[]>()
  for (const w of waiting) byHolder.set(w.holderUserId, [...(byHolder.get(w.holderUserId) ?? []), w])
  const out: T[][] = []
  for (const list of byHolder.values()) {
    const sorted = [...list].sort((a, b) => a.postedAtMs - b.postedAtMs || a.requestId.localeCompare(b.requestId))
    let run: T[] = []
    for (const w of sorted) {
      if (run.length > 0 && (w.postedAtMs - run[0]!.postedAtMs > RECEIPT_FOLD_MS || run.length >= RECEIPT_FOLD_MAX)) {
        out.push(run)
        run = []
      }
      run.push(w)
    }
    if (run.length > 0) out.push(run)
  }
  return out.sort((a, b) => a[0]!.postedAtMs - b[0]!.postedAtMs || a[0]!.requestId.localeCompare(b[0]!.requestId))
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
