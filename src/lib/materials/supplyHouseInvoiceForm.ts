import { parsePoGeneratorCodeFromPurchaseOrderName } from '../parsePoGeneratorCodeFromPurchaseOrderName'
import { calendarYmdInAppTzFromIso, startOfYmdInAppTzMs } from '../../utils/dateUtils'

/**
 * Pure logic behind the Materials → Supply Houses Add / Edit Invoice form
 * (v2.3474): the PO Generator check that used to live only in the table, the
 * "Paid on" date ↔ `paid_at` conversion, the due-date hint, and the job
 * allocation arithmetic the chips used to do inline.
 */

export type InvoiceJobAllocation = { job_id: string; pct: number }

// ---------- Purchase order # ----------

export type PoCodeHint =
  | { kind: 'empty' }
  /** Text with no five-digit PO Generator code — a hand-written PO, nothing to check. */
  | { kind: 'hand' }
  /** A code, but the ledger for this house hasn't loaded (or failed) — say nothing. */
  | { kind: 'unknown'; code: number }
  | { kind: 'on_ledger'; code: number }
  | { kind: 'not_on_ledger'; code: number }

export function poCodeHint(poText: string, ledgerCodes: ReadonlySet<number> | null): PoCodeHint {
  if (!poText.trim()) return { kind: 'empty' }
  const code = parsePoGeneratorCodeFromPurchaseOrderName(poText)
  if (code == null) return { kind: 'hand' }
  if (ledgerCodes == null) return { kind: 'unknown', code }
  return ledgerCodes.has(code) ? { kind: 'on_ledger', code } : { kind: 'not_on_ledger', code }
}

/** The one-line hint under the PO field; null when there is nothing worth saying. */
export function poCodeHintText(hint: PoCodeHint, houseName: string): string | null {
  switch (hint.kind) {
    case 'empty':
    case 'unknown':
      return null
    case 'hand':
      return 'Hand PO — no PO Generator code. A five-digit code here is checked against the ledger.'
    case 'on_ledger':
      return `PO ${hint.code} is on the PO Generator ledger for ${houseName}.`
    case 'not_on_ledger':
      return `PO ${hint.code} is not on the PO Generator ledger for ${houseName} — check the number.`
  }
}

// ---------- Due date ----------

/** 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th", 11–13 → "th", 21 → "21st". */
export function ordinalDay(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

/** Where the prefilled due date came from — the house's monthly payment day. Null when the house has none. */
export function dueDateHint(houseName: string, monthlyPaymentDay: number | null | undefined): string | null {
  if (monthlyPaymentDay == null || !Number.isInteger(monthlyPaymentDay) || monthlyPaymentDay < 1 || monthlyPaymentDay > 31) return null
  return `${houseName}'s payment day is the ${ordinalDay(monthlyPaymentDay)}.`
}

// ---------- Paid on ----------

/**
 * A "Paid on" calendar day → the `paid_at` instant to store: noon in the company
 * time zone, so the day survives every locale's `toLocaleDateString()` and a DST
 * switch. Null when the day is blank or malformed (the DB trigger then stamps now()).
 */
export function paidAtIsoFromYmd(ymd: string): string | null {
  const start = startOfYmdInAppTzMs(ymd)
  if (Number.isNaN(start)) return null
  return new Date(start + 12 * 60 * 60_000).toISOString()
}

/** The stored `paid_at` instant as the calendar day it fell on (company time zone); '' when unpaid. */
export function paidOnYmdFromIso(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return calendarYmdInAppTzFromIso(iso)
  } catch {
    return ''
  }
}

/**
 * What the save payload carries for `paid_at`. The trigger stamps now() when an
 * invoice flips to paid with no explicit date and nulls it when it flips back, so
 * the client only speaks up when the office typed a day that differs from what's stored.
 */
export function paidAtPayload(
  isPaid: boolean,
  paidOnYmd: string,
  priorPaidAtIso: string | null | undefined,
): { paid_at: string } | Record<string, never> {
  if (!isPaid) return {}
  const ymd = paidOnYmd.trim()
  if (!ymd) return {}
  if (ymd === paidOnYmdFromIso(priorPaidAtIso)) return {}
  const iso = paidAtIsoFromYmd(ymd)
  return iso ? { paid_at: iso } : {}
}

// ---------- Job allocations ----------

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Even split across n jobs; the last one absorbs the rounding remainder so the total is exactly 100. */
function evenSplit(jobIds: string[]): InvoiceJobAllocation[] {
  const n = jobIds.length
  if (n === 0) return []
  const each = round1(100 / n)
  return jobIds.map((job_id, i) => ({ job_id, pct: i === n - 1 ? round1(100 - (n - 1) * each) : each }))
}

/** Add a job to the split (even re-split). A job already on the invoice is a no-op. */
export function addAllocation(list: InvoiceJobAllocation[], jobId: string): InvoiceJobAllocation[] {
  if (list.some((a) => a.job_id === jobId)) return list
  return evenSplit([...list.map((a) => a.job_id), jobId])
}

/** Remove one job and re-split the rest evenly. */
export function removeAllocation(list: InvoiceJobAllocation[], index: number): InvoiceJobAllocation[] {
  return evenSplit(list.filter((_, i) => i !== index).map((a) => a.job_id))
}

/**
 * Set one job's percent and scale the others so the total stays 100 (the last
 * job absorbs rounding). With nothing else to scale, the others split what's left.
 */
export function setAllocationPct(list: InvoiceJobAllocation[], index: number, pct: number): InvoiceJobAllocation[] {
  const v = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0
  const rest = list.filter((_, i) => i !== index)
  const restSum = rest.reduce((s, x) => s + x.pct, 0)
  const scale = restSum > 0 ? (100 - v) / restSum : 1
  let next = list.map((x, i) => (i === index ? { ...x, pct: v } : { ...x, pct: round1(x.pct * scale) }))
  if (restSum === 0 && rest.length > 0) {
    // Everyone else was at 0 — hand them the remainder evenly instead of leaving it stranded.
    const share = round1((100 - v) / rest.length)
    next = list.map((x, i) => (i === index ? { ...x, pct: v } : { ...x, pct: share }))
  }
  const sum = next.reduce((s, x) => s + x.pct, 0)
  if (Math.abs(sum - 100) > 0.01 && next.length > 0) {
    // Push the rounding drift onto the last job that isn't the one being edited.
    let target = next.length - 1
    if (target === index && next.length > 1) target -= 1
    next = next.map((x, i) => (i === target ? { ...x, pct: round1(x.pct + (100 - sum)) } : x))
  }
  return next
}

export function allocationTotal(list: InvoiceJobAllocation[]): number {
  return round1(list.reduce((s, a) => s + a.pct, 0))
}

// ---------- Labels ----------

export function invoiceSaveLabel(editing: boolean, saving: boolean): string {
  if (saving) return 'Saving…'
  return editing ? 'Save changes' : 'Save invoice'
}
