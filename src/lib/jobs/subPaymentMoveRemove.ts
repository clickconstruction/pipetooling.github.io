/**
 * Sub sheet payments: move or remove one, with a trace (v2.3562). The pure half of the two
 * dialogs on Jobs → Subs → Pay — which sheets a payment may go to and in what order, what both
 * sheets' money reads before and after, the reasons a removal may carry, how long an undo
 * lasts, and the words of the grey trace line each sheet draws from
 * `people_labor_job_payment_events`. The writes are three RPCs (migration 20260917140000).
 */
import { laborItemsSubtotal } from '../peopleLaborJobItemLineCost'
import type { LaborJob, LaborJobPayment, LaborJobPaymentEvent } from '../../types/laborJob'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

export const SUB_PAYMENT_UNDO_DAYS = 30

export type SubPaymentRemoveReasonKey = 'duplicate' | 'wrong_amount' | 'other'

/** The chips on the Remove dialog. "Wrong job" is not a reason — it is the door to Move. */
export const SUB_PAYMENT_REMOVE_REASONS: ReadonlyArray<{ key: SubPaymentRemoveReasonKey; label: string }> = [
  { key: 'duplicate', label: 'Duplicate entry' },
  { key: 'wrong_amount', label: 'Wrong amount' },
  { key: 'other', label: 'Something else' },
]

/** The reason text the RPC stores: the chip's label, plus the note when there is one. */
export function subPaymentRemoveReasonText(key: SubPaymentRemoveReasonKey | null, note: string): string | null {
  const label = SUB_PAYMENT_REMOVE_REASONS.find((r) => r.key === key)?.label ?? null
  const n = note.trim()
  if (label && n) return `${label} — ${n}`
  return label ?? (n || null)
}

export type SheetMoney = { totalCost: number; paid: number; backcharges: number; balance: number }

/**
 * The same arithmetic the sheet modal shows under Payments: labor from the items at the sheet's
 * rate, paid = non-negative payments, backcharges = the magnitude of negatives; a sheet with no
 * priced items but money moved reads its cost as what moved.
 */
export function sheetMoney(sheet: Pick<LaborJob, 'items' | 'payments' | 'labor_rate'>): SheetMoney {
  const rate = sheet.labor_rate ?? sheet.items?.find((r) => r.labor_rate != null && r.labor_rate !== 0)?.labor_rate ?? 20
  let totalCost = laborItemsSubtotal(sheet.items, rate)
  const payments = sheet.payments ?? []
  const paid = payments.filter((p) => Number(p.amount) >= 0).reduce((s, p) => s + Number(p.amount), 0)
  const backcharges = payments.filter((p) => Number(p.amount) < 0).reduce((s, p) => s + Math.abs(Number(p.amount)), 0)
  if (totalCost === 0 && (paid > 0 || backcharges > 0)) totalCost = paid + backcharges
  return { totalCost, paid, backcharges, balance: totalCost - paid - backcharges }
}

/** `880 Reliant Health-HVAC` · `880` · `Reliant Health-HVAC` · the address — whatever the sheet has. */
export function sheetLabel(sheet: Pick<LaborJob, 'job_number' | 'job_ledger_id' | 'address'>, jobNamesById: Record<string, string>): string {
  const num = (sheet.job_number ?? '').trim()
  const name = sheet.job_ledger_id ? (jobNamesById[sheet.job_ledger_id] ?? '').trim() : ''
  const addr = (sheet.address ?? '').trim()
  return [num, name || addr].filter(Boolean).join(' ') || addr || 'this sheet'
}

export type SubPaymentMoveSide = { label: string; paidBefore: number; paidAfter: number; owedBefore: number; owedAfter: number }
export type SubPaymentMovePlan = { from: SubPaymentMoveSide; to: SubPaymentMoveSide; toPaidInFull: boolean; isBackcharge: boolean }

/** What both sheets read before and after the move — the dialog's "What changes" panel. */
export function planSubPaymentMove(
  payment: Pick<LaborJobPayment, 'id' | 'amount'>,
  fromSheet: LaborJob,
  toSheet: LaborJob,
  jobNamesById: Record<string, string>,
): SubPaymentMovePlan {
  const amt = Number(payment.amount) || 0
  const isBackcharge = amt < 0
  const fromNow = sheetMoney(fromSheet)
  const toNow = sheetMoney(toSheet)
  const fromAfter = sheetMoney({ ...fromSheet, payments: (fromSheet.payments ?? []).filter((p) => p.id !== payment.id) })
  const toAfter = sheetMoney({ ...toSheet, payments: [...(toSheet.payments ?? []), { id: 'moving', amount: amt, memo: null, created_at: '' }] })
  const side = (label: string, before: SheetMoney, after: SheetMoney): SubPaymentMoveSide => ({
    label,
    paidBefore: before.paid,
    paidAfter: after.paid,
    owedBefore: Math.max(0, before.balance),
    owedAfter: Math.max(0, after.balance),
  })
  return {
    from: side(sheetLabel(fromSheet, jobNamesById), fromNow, fromAfter),
    to: side(sheetLabel(toSheet, jobNamesById), toNow, toAfter),
    toPaidInFull: toNow.balance > 0 && toAfter.balance <= 0 && toAfter.totalCost > 0,
    isBackcharge,
  }
}

export type SubPaymentMoveDestination = { sheet: LaborJob; sameSub: boolean }

/**
 * Where a payment may go: the same sub's other sheets first (by shared assignee, else by the
 * sheet's name), then every other sheet that matches the search. With no search only the same
 * sub's sheets show — the common wrong-job case is the neighbouring sheet, not another sub.
 */
export function rankSubPaymentMoveDestinations(
  sheets: readonly LaborJob[],
  currentSheetId: string,
  assigneesBySheetId: ReadonlyMap<string, ReadonlyArray<{ personId: string }>>,
  jobNamesById: Record<string, string>,
  query: string,
): SubPaymentMoveDestination[] {
  const current = sheets.find((s) => s.id === currentSheetId)
  if (!current) return []
  const myPeople = new Set((assigneesBySheetId.get(currentSheetId) ?? []).map((a) => a.personId))
  const myName = current.assigned_to_name.trim().toLowerCase()
  const q = query.trim().toLowerCase()
  const isSameSub = (s: LaborJob) => {
    const theirs = assigneesBySheetId.get(s.id) ?? []
    if (myPeople.size > 0 && theirs.some((a) => myPeople.has(a.personId))) return true
    return myName.length > 0 && s.assigned_to_name.trim().toLowerCase() === myName
  }
  const matches = (s: LaborJob) => {
    if (!q) return false
    const hay = `${s.job_number ?? ''} ${s.job_ledger_id ? jobNamesById[s.job_ledger_id] ?? '' : ''} ${s.address ?? ''} ${s.assigned_to_name}`.toLowerCase()
    return hay.includes(q)
  }
  const out: SubPaymentMoveDestination[] = []
  for (const s of sheets) {
    if (s.id === currentSheetId) continue
    const same = isSameSub(s)
    if (same ? q.length === 0 || matches(s) : matches(s)) out.push({ sheet: s, sameSub: same })
  }
  const recency = (s: LaborJob) => s.job_date ?? s.created_at ?? ''
  out.sort((a, b) => (a.sameSub === b.sameSub ? recency(b.sheet).localeCompare(recency(a.sheet)) : a.sameSub ? -1 : 1))
  return out
}

/** A removal can be undone for 30 days, once. */
export function canUndoSubPaymentRemoval(event: Pick<LaborJobPaymentEvent, 'kind' | 'restored_event_id' | 'created_at'>, nowIso: string): boolean {
  if (event.kind !== 'removed' || event.restored_event_id) return false
  const at = Date.parse(event.created_at)
  if (!Number.isFinite(at)) return false
  return Date.parse(nowIso) - at < SUB_PAYMENT_UNDO_DAYS * 86_400_000
}

export type SubPaymentTraceLine = {
  eventId: string
  kind: 'moved_out' | 'moved_in' | 'removed'
  /** YYYY-MM-DD of the event. */
  date: string
  amount: number
  /** `Moved → 922 Michael Palmer · Taunya · wrong job` */
  text: string
  /** The sheet on the other end of a move, when there is one. */
  otherSheetId: string | null
  undoable: boolean
}

/**
 * The grey lines a sheet draws under its payments: money that left it, money that arrived,
 * money that was removed. A restored removal is history and draws nothing; the restored row
 * itself is a live payment again.
 */
export function subPaymentTraceLines(
  events: readonly LaborJobPaymentEvent[],
  sheetId: string,
  sheetsById: ReadonlyMap<string, LaborJob>,
  jobNamesById: Record<string, string>,
  nowIso: string,
): SubPaymentTraceLine[] {
  const who = (e: LaborJobPaymentEvent) => (e.actor_name ?? '').trim()
  const tail = (e: LaborJobPaymentEvent) => [who(e), (e.reason ?? '').trim()].filter(Boolean).join(' · ')
  const label = (id: string | null) => {
    const s = id ? sheetsById.get(id) : undefined
    return s ? sheetLabel(s, jobNamesById) : 'another sheet'
  }
  const out: SubPaymentTraceLine[] = []
  // Newest first by the instant, so two events on one day keep their order.
  for (const e of [...events].sort((x, y) => y.created_at.localeCompare(x.created_at))) {
    // The company's calendar day — the UTC day is tomorrow every evening after 7 PM Central.
    const date = calendarYmdInAppTzFromIso(e.created_at) || e.created_at.slice(0, 10)
    if (e.kind === 'moved' && e.from_job_id === sheetId) {
      out.push({ eventId: e.id, kind: 'moved_out', date, amount: e.amount, text: ['Moved → ' + label(e.to_job_id), tail(e)].filter(Boolean).join(' · '), otherSheetId: e.to_job_id, undoable: false })
    } else if (e.kind === 'moved' && e.to_job_id === sheetId) {
      out.push({ eventId: e.id, kind: 'moved_in', date, amount: e.amount, text: ['Moved here from ' + label(e.from_job_id), tail(e)].filter(Boolean).join(' · '), otherSheetId: e.from_job_id, undoable: false })
    } else if (e.kind === 'removed' && e.from_job_id === sheetId && !e.restored_event_id) {
      out.push({ eventId: e.id, kind: 'removed', date, amount: e.amount, text: ['Removed', tail(e)].filter(Boolean).join(' · '), otherSheetId: null, undoable: canUndoSubPaymentRemoval(e, nowIso) })
    }
  }
  return out
}
