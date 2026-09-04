/**
 * Sub portal statement builders (sub-portal train): pure functions shaping the
 * Work & Pay payload from raw rows. Deno- and Node-safe — unit-tested from
 * src/lib/subPortal/subPortalStatement.test.ts (the portalMergedBills
 * precedent).
 *
 * Money math mirrors src/lib/peopleLaborJobItemLineCost.ts +
 * src/lib/subLaborOutstanding.ts (the Sub Labor tab's source of truth):
 * line $ = direct amount when set, else hours x effective rate; paid sums
 * non-negative payments; backcharges sum the magnitude of negatives;
 * cost-less sheets with money moved reconstruct cost so they net to zero.
 */

export type SubSheetRow = {
  id: string
  address: string | null
  job_number: string | null
  job_date: string | null
  labor_rate: number | null
  stage: string | null
  stage_changed_at: string | null
  stage_source: string | null
  payable_after: string | null
  pay_hold_reason: string | null
}

export type SubItemRow = {
  job_id: string
  fixture: string | null
  count: number | null
  hrs_per_unit: number | null
  is_fixed: boolean | null
  labor_rate: number | null
  direct_labor_amount: number | null
  sequence_order: number | null
}

export type SubPaymentRow = {
  job_id: string
  amount: number | null
  memo: string | null
  payment_date: string | null
  created_at: string | null
  hidden_from_sub: boolean | null
  sequence_order: number | null
}

export type SubOfferRow = {
  id: string
  amount: number | null
  notes: string | null
  offer_scope_snapshot: unknown
  offer_expires_at: string | null
  proposed_start: string | null
  proposed_end: string | null
  step_name: string | null
}

export type SubDocRow = {
  id: string
  document_name: string
  doc_type: string | null
  status: string
  signed_at: string | null
  expires_at: string | null
}

/** v2.2767: working → walkthrough → customer_pay; paid is derived (the card leaves "Your jobs"). */
export type SubPortalSheetStage = 'working' | 'walkthrough' | 'customer_pay'

export type SubPortalSheet = {
  id: string
  jobNumber: string | null
  address: string | null
  stage: SubPortalSheetStage
  /** YMD of the last stage move (the sentence's date), null when never moved. */
  stageChangedOn: string | null
  /** Who moved it last — 'portal' means the sub said the work was done. */
  stageSource: 'office' | 'portal' | 'auto' | null
  items: Array<{ label: string; amount: number }>
  agreed: number
  paid: number
  backcharges: number
  open: number
  payableAfter: string | null
  payHoldReason: string | null
}

export type SubPortalPaymentLine = {
  date: string | null
  jobNumber: string | null
  memo: string | null
  amount: number
}

export type SubPortalOffer = {
  id: string
  title: string
  lines: Array<{ label: string; amount: number | null }>
  total: number
  startsLabel: string | null
  expiresOn: string | null
}

export type SubPortalDocState = 'on_file' | 'expiring' | 'action_needed'

export type SubPortalDoc = {
  id: string
  name: string
  state: SubPortalDocState
  /** Machine hints the page turns into copy (never raw internal statuses). */
  detail:
    | { kind: 'signed'; signedOn: string }
    | { kind: 'on_file' }
    | { kind: 'expires'; on: string }
    | { kind: 'expired'; on: string }
    | { kind: 'needs_signature' }
  signable: boolean
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/** Mirrors src/lib/peopleLaborJobItemLineCost.ts */
export function subLineLaborCost(
  item: Pick<SubItemRow, 'count' | 'hrs_per_unit' | 'is_fixed' | 'labor_rate' | 'direct_labor_amount'>,
  jobLaborRate: number,
): number {
  const direct = item.direct_labor_amount
  if (direct != null && Number.isFinite(Number(direct))) {
    return Number(direct)
  }
  const hrs = Number(item.hrs_per_unit) || 0
  const laborHrs = (item.is_fixed ?? false) ? hrs : (Number(item.count) || 0) * hrs
  const rate = item.labor_rate != null ? Number(item.labor_rate) : jobLaborRate
  return laborHrs * rate
}

function itemLabel(item: SubItemRow, jobLaborRate: number): string {
  const fixture = (item.fixture ?? '').trim() || 'Work'
  if (item.is_fixed ?? false) return `${fixture} (fixed price)`
  const count = Number(item.count) || 0
  const hrs = Number(item.hrs_per_unit) || 0
  const rate = item.labor_rate != null ? Number(item.labor_rate) : jobLaborRate
  const parts: string[] = []
  if (count > 0) parts.push(`${count} ×`)
  parts.push(fixture)
  if (hrs > 0) parts.push(`— ${hrs} hr each @ $${rate}/hr`)
  return parts.join(' ')
}

function normalizeStage(raw: string | null): SubPortalSheetStage {
  return raw === 'walkthrough' || raw === 'customer_pay' ? raw : 'working'
}

function normalizeStageSource(raw: string | null): 'office' | 'portal' | 'auto' | null {
  return raw === 'office' || raw === 'portal' || raw === 'auto' ? raw : null
}

export function buildSubSheets(
  sheets: SubSheetRow[],
  items: SubItemRow[],
  payments: SubPaymentRow[],
): SubPortalSheet[] {
  const itemsByJob = new Map<string, SubItemRow[]>()
  for (const it of items) {
    const list = itemsByJob.get(it.job_id)
    if (list) list.push(it)
    else itemsByJob.set(it.job_id, [it])
  }
  const paymentsByJob = new Map<string, SubPaymentRow[]>()
  for (const p of payments) {
    const list = paymentsByJob.get(p.job_id)
    if (list) list.push(p)
    else paymentsByJob.set(p.job_id, [p])
  }

  return sheets.map((sheet) => {
    const rate = Number(sheet.labor_rate) || 0
    const sheetItems = (itemsByJob.get(sheet.id) ?? []).slice().sort(
      (a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0),
    )
    let agreed = sheetItems.reduce((s, it) => s + subLineLaborCost(it, rate), 0)
    const sheetPayments = paymentsByJob.get(sheet.id) ?? []
    const paid = sheetPayments
      .filter((p) => Number(p.amount) >= 0)
      .reduce((s, p) => s + Number(p.amount), 0)
    const backcharges = sheetPayments
      .filter((p) => Number(p.amount) < 0)
      .reduce((s, p) => s + Math.abs(Number(p.amount)), 0)
    if (agreed === 0 && (paid > 0 || backcharges > 0)) {
      agreed = paid + backcharges
    }
    return {
      id: sheet.id,
      jobNumber: (sheet.job_number ?? '').trim() || null,
      address: (sheet.address ?? '').trim() || null,
      stage: normalizeStage(sheet.stage),
      stageChangedOn: (sheet.stage_changed_at ?? '').slice(0, 10) || null,
      stageSource: normalizeStageSource(sheet.stage_source),
      items: sheetItems.map((it) => ({
        label: itemLabel(it, rate),
        amount: round2(subLineLaborCost(it, rate)),
      })),
      agreed: round2(agreed),
      paid: round2(paid),
      backcharges: round2(backcharges),
      open: round2(agreed - paid - backcharges),
      payableAfter: sheet.payable_after,
      payHoldReason: (sheet.pay_hold_reason ?? '').trim() || null,
    }
  })
}

/**
 * Ledger lines, newest first. Hidden memos drop the TEXT only — the amount
 * always shows (the recap must sum to what actually moved).
 */
export function buildSubPaymentLines(
  payments: SubPaymentRow[],
  sheetsById: ReadonlyMap<string, SubSheetRow>,
  sinceYmd: string,
): SubPortalPaymentLine[] {
  return payments
    .map((p) => ({
      date: (p.payment_date ?? '').trim() || (p.created_at ?? '').slice(0, 10) || null,
      jobNumber: (sheetsById.get(p.job_id)?.job_number ?? '').trim() || null,
      memo: (p.hidden_from_sub ?? false) ? null : (p.memo ?? '').trim() || null,
      amount: round2(Number(p.amount) || 0),
    }))
    .filter((line) => line.amount !== 0 && line.date != null && line.date >= sinceYmd)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

export type SubPortalTotals = { earned: number; paid: number; open: number }

/**
 * All-time recap. `open` floors per sheet (a credit on one sheet never nets
 * against money owed on another — the Sub Labor tab's grand-total semantics),
 * so Earned - Paid may exceed `open` when a sheet is overpaid.
 */
export function buildSubTotals(sheets: SubPortalSheet[]): SubPortalTotals {
  const earned = sheets.reduce((s, sh) => s + sh.agreed, 0)
  const paid = sheets.reduce((s, sh) => s + sh.paid + sh.backcharges, 0)
  const open = sheets.reduce((s, sh) => s + Math.max(0, sh.open), 0)
  return { earned: round2(earned), paid: round2(paid), open: round2(open) }
}

function parseScopeLines(snapshot: unknown): Array<{ label: string; amount: number | null }> {
  if (snapshot == null || typeof snapshot !== 'object') return []
  const lines = (snapshot as { lines?: unknown }).lines
  if (!Array.isArray(lines)) return []
  const out: Array<{ label: string; amount: number | null }> = []
  for (const raw of lines) {
    if (raw == null || typeof raw !== 'object') continue
    const label = String((raw as { label?: unknown }).label ?? '').trim()
    if (!label) continue
    const amountRaw = (raw as { amount?: unknown }).amount
    const amount = typeof amountRaw === 'number' && Number.isFinite(amountRaw) ? round2(amountRaw) : null
    out.push({ label, amount })
  }
  return out
}

function scopeStartsLabel(snapshot: unknown): string | null {
  if (snapshot == null || typeof snapshot !== 'object') return null
  const raw = (snapshot as { startsLabel?: unknown }).startsLabel
  const label = typeof raw === 'string' ? raw.trim() : ''
  return label || null
}

/** Open offers only: status filtering happens in the query; expiry here. */
export function buildSubOffers(offers: SubOfferRow[], todayYmd: string): SubPortalOffer[] {
  return offers
    .filter((o) => {
      const exp = (o.offer_expires_at ?? '').trim()
      return !exp || exp >= todayYmd
    })
    .map((o) => {
      const lines = parseScopeLines(o.offer_scope_snapshot)
      const fallbackLabel = (o.notes ?? '').trim() || (o.step_name ?? '').trim() || 'Work order'
      return {
        id: o.id,
        title: (o.step_name ?? '').trim() || 'Work order',
        lines: lines.length > 0 ? lines : [{ label: fallbackLabel, amount: null }],
        total: round2(Number(o.amount) || 0),
        startsLabel:
          scopeStartsLabel(o.offer_scope_snapshot) ??
          ((o.proposed_start ?? '').trim() ? `Starts ${o.proposed_start}` : null),
        expiresOn: (o.offer_expires_at ?? '').trim() || null,
      }
    })
}

export const DOC_EXPIRY_WARN_DAYS = 60

export function buildSubDocuments(docs: SubDocRow[], todayYmd: string): SubPortalDoc[] {
  const warnCutoff = addDaysYmd(todayYmd, DOC_EXPIRY_WARN_DAYS)
  return docs.map((doc) => {
    const expires = (doc.expires_at ?? '').trim() || null
    if (doc.status === 'signed') {
      if (expires && expires < todayYmd) {
        return {
          id: doc.id,
          name: doc.document_name,
          state: 'action_needed',
          detail: { kind: 'expired', on: expires },
          signable: false,
        }
      }
      if (expires && expires <= warnCutoff) {
        return {
          id: doc.id,
          name: doc.document_name,
          state: 'expiring',
          detail: { kind: 'expires', on: expires },
          signable: false,
        }
      }
      const signedOn = (doc.signed_at ?? '').trim()
      return {
        id: doc.id,
        name: doc.document_name,
        state: 'on_file',
        detail: signedOn ? { kind: 'signed', signedOn } : { kind: 'on_file' },
        signable: false,
      }
    }
    // unsent / sent — either way the sub can sign from the portal.
    return {
      id: doc.id,
      name: doc.document_name,
      state: 'action_needed',
      detail: { kind: 'needs_signature' },
      signable: true,
    }
  })
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map((n) => Number(n))
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

/**
 * The next pay-run date on or after today. Unknown day names return null (the
 * page then shows no run-date promise).
 */
export function nextPayRunYmd(todayYmd: string, payRunDay: string | null): string | null {
  const target = DAY_NAMES.indexOf((payRunDay ?? '').trim().toLowerCase() as (typeof DAY_NAMES)[number])
  if (target < 0) return null
  const [y, m, d] = todayYmd.split('-').map((n) => Number(n))
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1))
  const delta = (target - dt.getUTCDay() + 7) % 7
  return addDaysYmd(todayYmd, delta)
}
