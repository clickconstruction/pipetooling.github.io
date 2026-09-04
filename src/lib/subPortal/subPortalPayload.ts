/**
 * Sub portal payload types + defensive parse (sub-portal train). Mirrors
 * src/lib/portal/portalPayload.ts: the page trusts nothing — a malformed
 * response renders the friendly error, never a crash.
 */

export type SubPortalCompany = {
  name: string
  cityLine: string
  licenseLine: string
  phone: string
  email: string
}

export type SubPortalSheetStage = 'working' | 'walkthrough' | 'customer_pay'

export type SubPortalSheet = {
  id: string
  jobNumber: string | null
  address: string | null
  /** v2.2767: working → walkthrough → customer_pay; paid sheets leave the list. */
  stage: SubPortalSheetStage
  stageChangedOn: string | null
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

export type SubPortalOffer = {
  id: string
  title: string
  lines: Array<{ label: string; amount: number | null }>
  total: number
  startsLabel: string | null
  expiresOn: string | null
  /** v2.2789 — sheet work orders: exclusions, referenced documents, the boxes to tick before signing. */
  anchor: 'sheet' | 'step'
  exclusions: string[]
  references: SubPortalReference[]
  acknowledgements: string[]
  bond: 'none' | 'furnished'
  specialProvisions: string | null
}

export type SubPortalDocDetail =
  | { kind: 'signed'; signedOn: string }
  | { kind: 'on_file' }
  | { kind: 'expires'; on: string }
  | { kind: 'expired'; on: string }
  | { kind: 'needs_signature' }

export type SubPortalDoc = {
  id: string
  name: string
  state: 'on_file' | 'expiring' | 'action_needed'
  detail: SubPortalDocDetail
  signable: boolean
}

export type SubPortalPayload = {
  company: SubPortalCompany
  subName: string
  preparedOn: string
  sheets: SubPortalSheet[]
  payments: SubPortalPaymentLine[]
  totals: { earned: number; paid: number; open: number }
  offers: SubPortalOffer[]
  documents: SubPortalDoc[]
  payRun: { day: string | null; nextRun: string | null; explainer: string | null }
  requestToken: string | null
  slug: string | null
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strOrNull = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s || null
}
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean) : [])

function parseLines(raw: unknown): Array<{ label: string; amount: number | null }> {
  return Array.isArray(raw)
    ? raw
        .map((l) => {
          if (l == null || typeof l !== 'object') return null
          const label = str((l as Record<string, unknown>).label).trim()
          if (!label) return null
          return { label, amount: numOrNull((l as Record<string, unknown>).amount) }
        })
        .filter((l): l is { label: string; amount: number | null } => l != null)
    : []
}

function parseReferences(raw: unknown): SubPortalReference[] {
  if (!Array.isArray(raw)) return []
  const out: SubPortalReference[] = []
  for (const r of raw) {
    if (r == null || typeof r !== 'object') continue
    const rr = r as Record<string, unknown>
    const name = str(rr.name).trim()
    if (!name) continue
    out.push({ kind: rr.kind === 'setting' || rr.kind === 'compliance' ? rr.kind : 'book', name, versionDate: strOrNull(rr.versionDate) })
  }
  return out
}

function parseAgreement(raw: unknown): SubPortalAgreement | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  return {
    signedOn: strOrNull(r.signedOn),
    signerName: strOrNull(r.signerName),
    amount: num(r.amount),
    lines: parseLines(r.lines),
    exclusions: strList(r.exclusions),
    references: parseReferences(r.references),
    acknowledgements: strList(r.acknowledgements),
  }
}

function parseSheet(raw: unknown): SubPortalSheet | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = str(r.id)
  if (!id) return null
  const stageRaw = str(r.stage)
  const sourceRaw = str(r.stageSource)
  const items = Array.isArray(r.items)
    ? r.items
        .map((it) => {
          if (it == null || typeof it !== 'object') return null
          const label = str((it as Record<string, unknown>).label).trim()
          if (!label) return null
          return { label, amount: num((it as Record<string, unknown>).amount) }
        })
        .filter((it): it is { label: string; amount: number } => it != null)
    : []
  return {
    id,
    jobNumber: strOrNull(r.jobNumber),
    address: strOrNull(r.address),
    stage: stageRaw === 'walkthrough' || stageRaw === 'customer_pay' ? stageRaw : 'working',
    stageChangedOn: strOrNull(r.stageChangedOn),
    stageSource: sourceRaw === 'office' || sourceRaw === 'portal' || sourceRaw === 'auto' ? sourceRaw : null,
    items,
    agreed: num(r.agreed),
    paid: num(r.paid),
    backcharges: num(r.backcharges),
    open: num(r.open),
    payableAfter: strOrNull(r.payableAfter),
    payHoldReason: strOrNull(r.payHoldReason),
    agreement: parseAgreement(r.agreement),
  }
}

function parsePaymentLine(raw: unknown): SubPortalPaymentLine | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const amount = numOrNull(r.amount)
  if (amount == null) return null
  return { date: strOrNull(r.date), jobNumber: strOrNull(r.jobNumber), memo: strOrNull(r.memo), amount }
}

function parseOffer(raw: unknown): SubPortalOffer | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = str(r.id)
  if (!id) return null
  const lines = parseLines(r.lines)
  return {
    id,
    title: str(r.title).trim() || 'Work order',
    lines,
    total: num(r.total),
    startsLabel: strOrNull(r.startsLabel),
    expiresOn: strOrNull(r.expiresOn),
    anchor: r.anchor === 'sheet' ? 'sheet' : 'step',
    exclusions: strList(r.exclusions),
    references: parseReferences(r.references),
    acknowledgements: strList(r.acknowledgements),
    bond: r.bond === 'furnished' ? 'furnished' : 'none',
    specialProvisions: strOrNull(r.specialProvisions),
  }
}

function parseDoc(raw: unknown): SubPortalDoc | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = str(r.id)
  const name = str(r.name).trim()
  if (!id || !name) return null
  const stateRaw = str(r.state)
  const state = stateRaw === 'on_file' || stateRaw === 'expiring' || stateRaw === 'action_needed' ? stateRaw : null
  if (!state) return null
  const d = (r.detail ?? null) as Record<string, unknown> | null
  const kind = d ? str(d.kind) : ''
  let detail: SubPortalDocDetail
  if (kind === 'signed' && strOrNull(d?.signedOn)) detail = { kind: 'signed', signedOn: str(d?.signedOn) }
  else if (kind === 'expires' && strOrNull(d?.on)) detail = { kind: 'expires', on: str(d?.on) }
  else if (kind === 'expired' && strOrNull(d?.on)) detail = { kind: 'expired', on: str(d?.on) }
  else if (kind === 'needs_signature') detail = { kind: 'needs_signature' }
  else detail = { kind: 'on_file' }
  return { id, name, state, detail, signable: r.signable === true }
}

export function parseSubPortalPayload(raw: unknown): SubPortalPayload | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.subName !== 'string' || r.totals == null || typeof r.totals !== 'object') return null
  const company = (r.company ?? {}) as Record<string, unknown>
  const totals = r.totals as Record<string, unknown>
  const payRun = (r.payRun ?? {}) as Record<string, unknown>
  return {
    company: {
      name: str(company.name),
      cityLine: str(company.cityLine),
      licenseLine: str(company.licenseLine),
      phone: str(company.phone),
      email: str(company.email),
    },
    subName: r.subName.trim() || 'Subcontractor',
    preparedOn: str(r.preparedOn),
    sheets: Array.isArray(r.sheets) ? r.sheets.map(parseSheet).filter((s): s is SubPortalSheet => s != null) : [],
    payments: Array.isArray(r.payments)
      ? r.payments.map(parsePaymentLine).filter((p): p is SubPortalPaymentLine => p != null)
      : [],
    totals: { earned: num(totals.earned), paid: num(totals.paid), open: num(totals.open) },
    offers: Array.isArray(r.offers) ? r.offers.map(parseOffer).filter((o): o is SubPortalOffer => o != null) : [],
    documents: Array.isArray(r.documents) ? r.documents.map(parseDoc).filter((d): d is SubPortalDoc => d != null) : [],
    payRun: {
      day: strOrNull(payRun.day),
      nextRun: strOrNull(payRun.nextRun),
      explainer: strOrNull(payRun.explainer),
    },
    requestToken: strOrNull(r.requestToken),
    slug: strOrNull(r.slug),
  }
}
