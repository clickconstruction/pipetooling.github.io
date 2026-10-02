/**
 * Close out books it (v2.4363) — how Banking books a deposit the close-out strip is about to
 * take off To match, and every word the strip says about it.
 *
 * Read Oct 1: the one vendor refund through Accounts Receivable in six months (Texas Mutual,
 * $119.56) was already booked right — the Banking rule "TEXAS MUTUAL - Insurance" labelled it
 * Insurance — but the strip only said "Banking's label still books the money". 190 of 193
 * vendors paid 3 or more times in the last year have a rule, and the org's auto-approve is off,
 * so the usual case is a rule match waiting for someone to approve it. So the strip reads the
 * label back, approves a waiting match, and asks for a label only when nothing labels it.
 *
 * The one guess it makes about the REASON is the payee's own last close-out. "We have paid
 * them before" is not a signal: the city pays bills too (City of Seguin, #908).
 *
 * Pure: no Supabase, no React. The read is `ar_deposit_booking`, the write
 * `close_out_ar_deposit`.
 */
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { isArCloseReason, type ArCloseReason } from './arCloseOut'

export type ArBookingLabel = {
  id: string
  name: string
  defaultKey: string | null
  /** expense | income | equity | transfer */
  accountType: string | null
}

/** Who put the label on: a rule (approved), a person, a close-out, or Apply's Income. */
export type ArLabelBy = 'rule' | 'person' | 'close_out' | 'ar_income'

export type ArDepositBooking = {
  label: ArBookingLabel | null
  labelBy: ArLabelBy | null
  labelAt: string | null
  /** The rule whose approved match is the label now. */
  ruleName: string | null
  /** A rule match nobody has approved yet. */
  pending: { suggestionId: string; ruleName: string; label: ArBookingLabel } | null
  /** The label most of the payee's own payments carry. */
  usual: { label: ArBookingLabel; count: number } | null
  /** The payee's last deposit that was closed out. */
  lastCloseOut: { reason: ArCloseReason; closedAt: string; postedAt: string | null } | null
  labels: ArBookingLabel[]
}

const INCOME_KEY = 'income_part_i'
/** Labels a parts refund lands on: the credit belongs in Supply houses too. */
const PARTS_KEYS = new Set(['job_materials_parts', 'cogs_part_iii'])

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null
}

function parseLabel(raw: unknown): ArBookingLabel | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = str(r.id)
  const name = str(r.name)
  if (!id || !name) return null
  return { id, name, defaultKey: str(r.default_key), accountType: str(r.account_type) }
}

/** The RPC's jsonb, checked. Null when the read gave nothing usable. */
export function parseArDepositBooking(raw: unknown): ArDepositBooking | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const labelBy = str(r.label_by)
  const pendingRaw = r.pending && typeof r.pending === 'object' ? (r.pending as Record<string, unknown>) : null
  const pendingLabel = pendingRaw ? parseLabel(pendingRaw.label) : null
  const usualRaw = r.usual && typeof r.usual === 'object' ? (r.usual as Record<string, unknown>) : null
  const usualLabel = usualRaw ? parseLabel(usualRaw.label) : null
  const lastRaw = r.last_close_out && typeof r.last_close_out === 'object' ? (r.last_close_out as Record<string, unknown>) : null
  const lastReason = lastRaw ? str(lastRaw.reason) : null
  const lastClosedAt = lastRaw ? str(lastRaw.closed_at) : null
  const label = parseLabel(r.label)
  return {
    label,
    labelBy: label && (labelBy === 'rule' || labelBy === 'person' || labelBy === 'close_out' || labelBy === 'ar_income') ? labelBy : label ? 'person' : null,
    labelAt: label ? str(r.label_at) : null,
    ruleName: label ? str(r.rule_name) : null,
    pending:
      pendingRaw && pendingLabel && str(pendingRaw.suggestion_id)
        ? { suggestionId: str(pendingRaw.suggestion_id) as string, ruleName: str(pendingRaw.rule_name) ?? 'a rule', label: pendingLabel }
        : null,
    usual: usualRaw && usualLabel ? { label: usualLabel, count: Math.max(0, Number(usualRaw.count) || 0) } : null,
    lastCloseOut:
      lastReason && isArCloseReason(lastReason) && lastClosedAt
        ? { reason: lastReason, closedAt: lastClosedAt, postedAt: str(lastRaw?.posted_at) }
        : null,
    labels: Array.isArray(r.labels) ? (r.labels.map(parseLabel).filter(Boolean) as ArBookingLabel[]) : [],
  }
}

/** "TEXAS MUTUAL - Insurance" reads "TEXAS MUTUAL": the rule names its payee, then its label. */
export function ruleShortName(ruleName: string, labelName: string | null | undefined): string {
  const name = ruleName.trim()
  const label = (labelName ?? '').trim()
  if (label) {
    for (const sep of [' - ', ' – ', ' — ']) {
      const tail = `${sep}${label}`
      if (name.toLowerCase().endsWith(tail.toLowerCase()) && name.length > tail.length) {
        return name.slice(0, name.length - tail.length).trim()
      }
    }
  }
  return name
}

/** The label a reason books to on its own: interest is Income, an owner's money is equity. */
export function reasonDefaultLabel(reason: ArCloseReason, labels: ReadonlyArray<ArBookingLabel>): ArBookingLabel | null {
  if (reason === 'bank_interest') return labels.find((l) => l.defaultKey === INCOME_KEY) ?? null
  if (reason === 'owner_deposit') return labels.find((l) => l.accountType === 'equity') ?? null
  return null
}

/** Whether a label is the kind the reason books to. A label with no type is never flagged. */
export function labelFitsReason(reason: ArCloseReason, label: ArBookingLabel): boolean {
  if (!label.accountType) return true
  if (reason === 'vendor_refund') return label.accountType === 'expense'
  if (reason === 'bank_interest') return label.accountType === 'income'
  if (reason === 'owner_deposit') return label.accountType === 'equity'
  return true
}

/** "a vendor refund" — the reason inside a sentence. */
export function closeReasonPhrase(reason: ArCloseReason): string {
  switch (reason) {
    case 'bank_interest':
      return 'bank interest'
    case 'vendor_refund':
      return 'a vendor refund'
    case 'owner_deposit':
      return 'an owner deposit'
    default:
      return 'something else'
  }
}

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** "Aug 16" in the app's calendar. */
export function bookingShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: APP_CALENDAR_TZ })
}

/** The picker's "leave it" choice: close out without a label. */
export const AR_BOOK_LEAVE = ''

export type ArCloseBookingState =
  /** The deposit keeps the label it has. */
  | 'kept'
  /** Close out approves the rule's waiting match. */
  | 'approve'
  /** Close out writes the label in the picker. */
  | 'set'
  /** Nothing labels it and nothing is picked. */
  | 'none'
  /** The read failed: the strip says nothing about Banking and sends no label. */
  | 'unread'

export type ArCloseBookingView = {
  state: ArCloseBookingState
  /** The label the books line names: kept, approved or set. */
  label: ArBookingLabel | null
  /** What Close out sends as `p_label_id`; null leaves Banking alone. */
  sendLabelId: string | null
  /** "Banking books it as" / "Your rule TEXAS MUTUAL says" / "Book it as" — the label follows. */
  lead: string | null
  /** The quieter line under it. */
  detail: string | null
  /** A second line when the label is not the kind the reason books to. */
  warning: string | null
  tone: 'green' | 'blue' | 'amber' | 'plain'
  /** The picker shows open (set or none); otherwise Change opens it. */
  pickerOpen: boolean
  /** The picker offers "Leave it for Banking": only while nothing labels the deposit. */
  pickerCanLeave: boolean
  /** A parts label: the credit belongs in Supply houses too. */
  partsDoor: boolean
  /** The line beside the button. */
  footer: string
  /** The second press's title and body. */
  confirmTitle: string
  confirmBody: string
}

export type ArCloseBookingInput = {
  reason: ArCloseReason
  booking: ArDepositBooking | null
  /** The label picked in the picker: an id, AR_BOOK_LEAVE, or null when nobody has picked. */
  chosenLabelId: string | null
  /** The picker was opened with Change. */
  changing: boolean
  amount: number
  counterpartyName: string | null | undefined
}

function whoLabelled(b: ArDepositBooking): string | null {
  const when = bookingShortDate(b.labelAt)
  const on = when ? ` on ${when}` : ''
  switch (b.labelBy) {
    case 'rule':
      return b.ruleName ? `Your rule ${ruleShortName(b.ruleName, b.label?.name)} labelled it${on}.` : `A rule labelled it${on}.`
    case 'close_out':
      return `Close out labelled it${on}.`
    case 'ar_income':
      return 'Apply labelled it when it paid a bill.'
    case 'person':
      return `Someone labelled it in Banking${on}.`
    default:
      return null
  }
}

function fitWarning(reason: ArCloseReason): string {
  if (reason === 'vendor_refund') return 'A vendor refund goes under the expense it pays back.'
  if (reason === 'bank_interest') return 'Bank interest goes under Income.'
  return 'An owner deposit goes under Owners Equity.'
}

/** The strip's books line, its picker and the button's words for one reason. */
export function arCloseBookingView(input: ArCloseBookingInput): ArCloseBookingView {
  const { reason, booking } = input
  const amount = money(input.amount)
  const phrase = closeReasonPhrase(reason)
  const payee = (input.counterpartyName ?? '').trim()
  const takes = `Takes ${amount} off To match as ${phrase}.`
  const finish = (
    v: Omit<ArCloseBookingView, 'footer' | 'confirmTitle' | 'confirmBody' | 'partsDoor'>,
    bookSentence: string,
  ): ArCloseBookingView => ({
    ...v,
    partsDoor: reason === 'vendor_refund' && v.label != null && v.label.defaultKey != null && PARTS_KEYS.has(v.label.defaultKey),
    footer: `${takes} ${bookSentence}`,
    confirmTitle: `Close out ${amount} as ${phrase}?`,
    confirmBody: `It leaves To match for everyone. ${bookSentence} You can reopen it from All.`,
  })

  if (!booking) {
    return finish(
      { state: 'unread', label: null, sendLabelId: null, lead: null, detail: null, warning: null, tone: 'plain', pickerOpen: false, pickerCanLeave: false },
      'Banking is not changed.',
    )
  }

  const current = booking.label
  const byId = (id: string) => booking.labels.find((l) => l.id === id) ?? null
  const picked = input.chosenLabelId != null && input.chosenLabelId !== AR_BOOK_LEAVE ? byId(input.chosenLabelId) : null
  const leave = input.chosenLabelId === AR_BOOK_LEAVE && current == null

  const kept = (label: ArBookingLabel, changing: boolean): ArCloseBookingView => {
    const fits = labelFitsReason(reason, label)
    return finish(
      {
        state: 'kept',
        label,
        sendLabelId: label.id,
        lead: 'Banking books it as',
        detail: whoLabelled(booking),
        warning: fits ? null : fitWarning(reason),
        tone: fits ? 'green' : 'amber',
        pickerOpen: changing,
        pickerCanLeave: false,
      },
      `Banking keeps it as ${label.name}.`,
    )
  }

  const set = (label: ArBookingLabel, detail: string | null): ArCloseBookingView =>
    finish(
      {
        state: 'set',
        label,
        sendLabelId: label.id,
        lead: 'Book it as',
        detail: current && current.id !== label.id ? `It replaces ${current.name}. Reopen puts that back.` : detail,
        warning: labelFitsReason(reason, label) ? null : fitWarning(reason),
        tone: 'plain',
        pickerOpen: true,
        pickerCanLeave: current == null,
      },
      `Banking books it as ${label.name}.`,
    )

  const approve = (p: NonNullable<ArDepositBooking['pending']>): ArCloseBookingView =>
    finish(
      {
        state: 'approve',
        label: p.label,
        sendLabelId: p.label.id,
        lead: `Your rule ${ruleShortName(p.ruleName, p.label.name)} says`,
        detail: 'Close out approves it, the same as Approve in Banking.',
        warning: labelFitsReason(reason, p.label) ? null : fitWarning(reason),
        tone: 'blue',
        pickerOpen: input.changing,
        pickerCanLeave: false,
      },
      `Banking books it as ${p.label.name}.`,
    )

  const none = (): ArCloseBookingView =>
    finish(
      {
        state: 'none',
        label: null,
        sendLabelId: null,
        lead: 'Book it as',
        detail: 'Nothing in Banking labels it yet.',
        warning: null,
        tone: 'plain',
        pickerOpen: true,
        pickerCanLeave: true,
      },
      'Banking has no label for it yet.',
    )

  // Someone used the picker: their pick wins.
  if (picked) {
    if (current && picked.id === current.id) return kept(current, true)
    if (!current && booking.pending && booking.pending.label.id === picked.id) return { ...approve(booking.pending), pickerOpen: true }
    return set(picked, null)
  }
  if (leave) return none()

  if (current) return kept(current, input.changing)

  // A waiting rule match is the rule's word, unless the reason has its own kind of label.
  if (booking.pending) {
    const own = reasonDefaultLabel(reason, booking.labels)
    if (own && !labelFitsReason(reason, booking.pending.label)) {
      return set(own, reason === 'bank_interest' ? 'Bank interest goes under Income.' : 'An owner deposit goes under Owners Equity.')
    }
    return approve(booking.pending)
  }

  if (reason === 'vendor_refund' && booking.usual) {
    const of = booking.usual.count === 1 ? 'payment is' : 'payments are'
    return set(booking.usual.label, payee ? `Filled in because ${payee}’s ${of} booked that way.` : 'Filled in from how their payments are booked.')
  }
  const own = reasonDefaultLabel(reason, booking.labels)
  if (own) return set(own, reason === 'bank_interest' ? 'Bank interest goes under Income.' : 'An owner deposit goes under Owners Equity.')
  return none()
}

/** The reason the payee's last close-out had: the one guess the strip makes. */
export function rememberedCloseReason(booking: ArDepositBooking | null | undefined): ArCloseReason | null {
  return booking?.lastCloseOut?.reason ?? null
}

/** "Texas Mutual’s Aug 13 deposit was a vendor refund." */
export function rememberedCloseLine(booking: ArDepositBooking | null | undefined, counterpartyName: string | null | undefined): string | null {
  const last = booking?.lastCloseOut
  if (!last) return null
  const payee = (counterpartyName ?? '').trim() || 'This payee'
  const when = bookingShortDate(last.postedAt ?? last.closedAt)
  const deposit = when ? `${payee}’s ${when} deposit` : `${payee}’s last deposit`
  return last.reason === 'other' ? `${deposit} was closed out too.` : `${deposit} was ${closeReasonPhrase(last.reason)}.`
}

/** The toast after Close out: "Closed out · booked as Insurance". */
export function arCloseOutToast(booked: string | null | undefined, labelName: string | null | undefined): string {
  const name = (labelName ?? '').trim()
  if ((booked === 'kept' || booked === 'approved' || booked === 'set') && name) return `Closed out · booked as ${name}`
  return 'Closed out. It has left To match.'
}

/** The toast after Reopen: says what happened to a label the close-out put on. */
export function arReopenToast(labelUndone: string | null | undefined): string {
  if (labelUndone === 'removed') return 'Reopened. The label Close out put on came off.'
  if (labelUndone === 'restored') return 'Reopened. Banking has its old label back.'
  return 'Reopened. It is back in To match.'
}

/** The quiet line on a To match row whose Banking label is an expense: "Banking books it as Insurance". */
export function arRowBookedLine(label: Pick<ArBookingLabel, 'name' | 'accountType'> | null | undefined): string | null {
  if (!label || label.accountType !== 'expense') return null
  return `Banking books it as ${label.name}`
}
