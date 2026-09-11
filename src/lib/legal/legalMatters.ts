/**
 * Legal matters kernel (Legal portal PR 2, v2.3313): the stored side of the
 * Legal desk — a matter per paying account, its stage, the firm, held-entry
 * overrides, the review request — and the derivations the desk, the Pipeline
 * row chip and the dev's Needs You card read. Pure: no React, no supabase.
 * Row shapes are typed by hand until the migration is applied and the
 * generated types catch up.
 */
import { LEGAL_DEFAULT_FEE, type LegalFeeModel } from './legalPacket'

export const LEGAL_STAGES = ['review', 'referred', 'demand', 'suit', 'judgment', 'settled', 'written_down', 'pulled'] as const
export type LegalStage = (typeof LEGAL_STAGES)[number]

export type LegalFirmRow = {
  id: string
  name: string
  handling_name: string
  email: string
  phone: string
  contingency_pct: number
  filing_cost: number
  active: boolean
}

export type LegalMatterRow = {
  id: string
  payer_key: string
  customer_id: string | null
  payer_name: string
  firm_id: string | null
  stage: string
  ready_marked_by: string | null
  ready_marked_at: string | null
  released_at: string | null
  handling_name: string
  note_to_firm: string
  review_requested_by: string | null
  review_requested_at: string | null
  review_request_note: string
  held_overrides: unknown
  fees_to_statement: boolean
  closed_at: string | null
  closed_reason: string
  updated_at: string
}

export type LegalMatterJobRow = { matter_id: string; job_id: string }

export type LegalEntryRow = {
  id: string
  matter_id: string
  kind: string
  amount: number | null
  body: string
  occurred_on: string
  meta: unknown
  via_portal: boolean
  created_by: string | null
  acknowledged_at: string | null
  created_at: string
}

export function isLegalStage(raw: string | null | undefined): raw is LegalStage {
  return (LEGAL_STAGES as readonly string[]).includes(raw ?? '')
}

export function legalStageLabel(stage: string | null | undefined): string {
  switch (stage) {
    case 'referred': return 'With the firm · new'
    case 'demand': return 'With the firm · demand sent'
    case 'suit': return 'With the firm · suit filed'
    case 'judgment': return 'With the firm · judgment'
    case 'settled': return 'Settled'
    case 'written_down': return 'Written down'
    case 'pulled': return 'Pulled back'
    default: return 'Under review'
  }
}

/** True while a firm can see the matter (PR 3 reads the same rule server-side). */
export function stageIsWithFirm(stage: string | null | undefined): boolean {
  return stage === 'referred' || stage === 'demand' || stage === 'suit' || stage === 'judgment'
}

export function stageIsClosed(stage: string | null | undefined): boolean {
  return stage === 'written_down' || stage === 'settled'
}

/** The row chip on the Pipeline: nothing while an account is simply under review; a chip once the office asked for a dev or the firm has it. */
export function legalRowChip(matter: LegalMatterRow | null | undefined): { label: string; tone: 'blue' | 'legal' | 'neutral' } | null {
  if (!matter) return null
  if (stageIsWithFirm(matter.stage)) return { label: `⚖ ${legalStageLabel(matter.stage).replace('With the firm · ', '')}`, tone: 'legal' }
  if (stageIsClosed(matter.stage)) return { label: `⚖ ${legalStageLabel(matter.stage)}`, tone: 'neutral' }
  if (matter.review_requested_at) return { label: '⚖ review requested', tone: 'blue' }
  return null
}

export function heldOverridesOf(matter: LegalMatterRow | null | undefined): Record<string, boolean> {
  const raw = matter?.held_overrides
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === 'boolean') out[k] = v
  return out
}

/** Toggle one timeline entry: the override only exists where it differs from the default. */
export function withHoldOverride(current: Readonly<Record<string, boolean>>, key: string, held: boolean, heldByDefault: boolean): Record<string, boolean> {
  const next = { ...current }
  if (held === heldByDefault) delete next[key]
  else next[key] = held
  return next
}

export function feeModelOf(firm: LegalFirmRow | null | undefined): LegalFeeModel {
  if (!firm) return LEGAL_DEFAULT_FEE
  const pct = Number(firm.contingency_pct)
  const cost = Number(firm.filing_cost)
  return { contingencyPct: Number.isFinite(pct) ? pct / 100 : LEGAL_DEFAULT_FEE.contingencyPct, filingCost: Number.isFinite(cost) ? cost : LEGAL_DEFAULT_FEE.filingCost }
}

export function indexMatters(matters: ReadonlyArray<LegalMatterRow>, links: ReadonlyArray<LegalMatterJobRow>): { byPayerKey: Map<string, LegalMatterRow>; byJobId: Map<string, LegalMatterRow>; jobIdsByMatter: Map<string, string[]> } {
  const byId = new Map(matters.map((m) => [m.id, m] as const))
  const byPayerKey = new Map(matters.map((m) => [m.payer_key, m] as const))
  const byJobId = new Map<string, LegalMatterRow>()
  const jobIdsByMatter = new Map<string, string[]>()
  for (const l of links) {
    const m = byId.get(l.matter_id)
    if (!m) continue
    byJobId.set(l.job_id, m)
    jobIdsByMatter.set(m.id, [...(jobIdsByMatter.get(m.id) ?? []), l.job_id])
  }
  return { byPayerKey, byJobId, jobIdsByMatter }
}

// ---------------------------------------------------------------------------
// The dev's Needs You card
// ---------------------------------------------------------------------------

export type LegalReviewAccount = { key: string; name: string; reviewDays: number | null; balance: number }

export type LegalReviewSummary = {
  underReview: number
  withFirm: number
  requested: Array<{ key: string; name: string; by: string | null; note: string; days: number | null }>
  oldestDays: number | null
  /** The account the card opens on: a requested one first, else the oldest. */
  firstKey: string | null
  balanceUnderReview: number
}

/** Collections accounts not yet with a firm or closed, requested-first, oldest next. */
export function buildLegalReview(
  accounts: ReadonlyArray<LegalReviewAccount>,
  matters: ReadonlyArray<LegalMatterRow>,
  todayYmd: string,
  userNameOf: (id: string | null) => string | null = () => null,
): LegalReviewSummary {
  const byKey = new Map(matters.map((m) => [m.payer_key, m] as const))
  const under = accounts.filter((a) => {
    const m = byKey.get(a.key)
    return !m || (!stageIsWithFirm(m.stage) && !stageIsClosed(m.stage))
  })
  const withFirm = accounts.filter((a) => stageIsWithFirm(byKey.get(a.key)?.stage)).length
  const requested = under
    .filter((a) => byKey.get(a.key)?.review_requested_at)
    .map((a) => {
      const m = byKey.get(a.key) as LegalMatterRow
      const at = (m.review_requested_at ?? '').slice(0, 10)
      return { key: a.key, name: a.name, by: userNameOf(m.review_requested_by), note: m.review_request_note, days: /^\d{4}-\d{2}-\d{2}$/.test(at) ? daysBetween(at, todayYmd) : null }
    })
    .sort((x, y) => (y.days ?? 0) - (x.days ?? 0))
  const oldest = under.reduce<number | null>((m, a) => (a.reviewDays == null ? m : m == null ? a.reviewDays : Math.max(m, a.reviewDays)), null)
  const oldestAccount = [...under].sort((x, y) => (y.reviewDays ?? -1) - (x.reviewDays ?? -1))[0] ?? null
  return {
    underReview: under.length,
    withFirm,
    requested,
    oldestDays: oldest,
    firstKey: requested[0]?.key ?? oldestAccount?.key ?? null,
    balanceUnderReview: under.reduce((s, a) => s + a.balance, 0),
  }
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.UTC(Number(fromYmd.slice(0, 4)), Number(fromYmd.slice(5, 7)) - 1, Number(fromYmd.slice(8, 10)))
  const b = Date.UTC(Number(toYmd.slice(0, 4)), Number(toYmd.slice(5, 7)) - 1, Number(toYmd.slice(8, 10)))
  return Math.round((b - a) / 86_400_000)
}

/** Who at the firm hears about a release today: the handling person, by email. PR 5 replaces this with the recipients' own rules. */
export function releaseRecipients(firm: LegalFirmRow | null | undefined, handlingName: string): Array<{ name: string; email: string; why: string }> {
  if (!firm) return []
  const name = handlingName.trim() || firm.handling_name.trim() || firm.name
  return firm.email.trim() ? [{ name, email: firm.email.trim(), why: 'handling — always hears' }] : []
}
