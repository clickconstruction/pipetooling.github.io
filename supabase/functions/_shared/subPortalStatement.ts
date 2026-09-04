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
  /** v2.2789: sheet-anchored work orders (step_id NULL) carry the sheet they belong to. */
  labor_job_id?: string | null
}

/** A signed sheet work order, joined onto its sheet card as "what you agreed to" (v2.2789). */
export type SubAgreementRow = {
  labor_job_id: string | null
  amount: number | null
  signed_at: string | null
  accepted_at: string | null
  signer_printed_name: string | null
  offer_scope_snapshot: unknown
  signer_acknowledgements: unknown
}

export type SubPortalReference = { kind: 'book' | 'setting' | 'compliance'; name: string; versionDate: string | null }

export type SubPortalAgreement = {
  signedOn: string | null
  signerName: string | null
  amount: number
  lines: Array<{ label: string; amount: number | null }>
  exclusions: string[]
  references: SubPortalReference[]
  acknowledgements: string[]
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
  /** v2.2789: the signed work order behind this sheet, when one exists. */
  agreement: SubPortalAgreement | null
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
  /** v2.2789 — sheet work orders: exclusions, referenced documents, and the boxes to tick at signing. */
  anchor: 'sheet' | 'step'
  exclusions: string[]
  references: SubPortalReference[]
  acknowledgements: string[]
  bond: 'none' | 'furnished'
  specialProvisions: string | null
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
      agreement: null,
    }
  })
}

/** Join signed sheet work orders onto their sheets (one per sheet; the newest signature wins). */
export function attachSheetAgreements(sheets: SubPortalSheet[], agreements: SubAgreementRow[]): SubPortalSheet[] {
  const bySheet = new Map<string, SubAgreementRow>()
  for (const a of agreements) {
    if (!a.labor_job_id) continue
    const prev = bySheet.get(a.labor_job_id)
    const when = (a.signed_at ?? a.accepted_at ?? '')
    const prevWhen = prev ? (prev.signed_at ?? prev.accepted_at ?? '') : ''
    if (!prev || when > prevWhen) bySheet.set(a.labor_job_id, a)
  }
  return sheets.map((sheet) => {
    const a = bySheet.get(sheet.id)
    if (!a) return sheet
    const extras = parseScopeExtras(a.offer_scope_snapshot)
    return {
      ...sheet,
      agreement: {
        signedOn: (a.signed_at ?? a.accepted_at ?? '').slice(0, 10) || null,
        signerName: (a.signer_printed_name ?? '').trim() || null,
        amount: round2(Number(a.amount) || 0),
        lines: parseScopeLines(a.offer_scope_snapshot),
        exclusions: extras.exclusions,
        references: extras.references,
        acknowledgements: parseAcknowledged(a.signer_acknowledgements, extras.acknowledgements),
      },
    }
  })
}

function parseStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean)
}

/** The sheet-work-order extras on a snapshot (v2.2789); a legacy step snapshot yields empty lists. */
export function parseScopeExtras(snapshot: unknown): {
  anchor: 'sheet' | 'step'
  sheetLabel: string | null
  exclusions: string[]
  references: SubPortalReference[]
  acknowledgements: string[]
  bond: 'none' | 'furnished'
  specialProvisions: string | null
} {
  const o = snapshot != null && typeof snapshot === 'object' ? (snapshot as Record<string, unknown>) : {}
  const references: SubPortalReference[] = []
  if (Array.isArray(o.references)) {
    for (const r of o.references) {
      if (r == null || typeof r !== 'object') continue
      const rr = r as Record<string, unknown>
      const name = typeof rr.name === 'string' ? rr.name.trim() : ''
      if (!name) continue
      const kind = rr.kind === 'setting' || rr.kind === 'compliance' ? rr.kind : 'book'
      const versionDate = typeof rr.versionDate === 'string' && rr.versionDate.trim() ? rr.versionDate.trim() : null
      references.push({ kind, name, versionDate })
    }
  }
  const sheetLabel = typeof o.sheetLabel === 'string' ? o.sheetLabel.trim() : ''
  const special = typeof o.specialProvisions === 'string' ? o.specialProvisions.trim() : ''
  return {
    anchor: o.anchor === 'sheet' ? 'sheet' : 'step',
    sheetLabel: sheetLabel || null,
    exclusions: parseStringList(o.exclusions),
    references,
    acknowledgements: parseStringList(o.acknowledgements),
    bond: o.bond === 'furnished' ? 'furnished' : 'none',
    specialProvisions: special || null,
  }
}

/** What the sub actually ticked ([{text}] rows); falls back to the snapshot's list for pre-v2.2789 rows. */
function parseAcknowledged(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return fallback
  const out = raw
    .map((r) => (r != null && typeof r === 'object' && typeof (r as { text?: unknown }).text === 'string' ? ((r as { text: string }).text).trim() : ''))
    .filter(Boolean)
  return out.length > 0 ? out : fallback
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
      const extras = parseScopeExtras(o.offer_scope_snapshot)
      const fallbackLabel = (o.notes ?? '').trim() || (o.step_name ?? '').trim() || extras.sheetLabel || 'Work order'
      return {
        id: o.id,
        title: (o.step_name ?? '').trim() || extras.sheetLabel || 'Work order',
        lines: lines.length > 0 ? lines : [{ label: fallbackLabel, amount: null }],
        total: round2(Number(o.amount) || 0),
        startsLabel:
          scopeStartsLabel(o.offer_scope_snapshot) ??
          ((o.proposed_start ?? '').trim() ? `Starts ${o.proposed_start}` : null),
        expiresOn: (o.offer_expires_at ?? '').trim() || null,
        anchor: extras.anchor === 'sheet' || (o.labor_job_id != null && !(o.step_name ?? '').trim()) ? 'sheet' : 'step',
        exclusions: extras.exclusions,
        references: extras.references,
        acknowledgements: extras.acknowledgements,
        bond: extras.bond,
        specialProvisions: extras.specialProvisions,
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
