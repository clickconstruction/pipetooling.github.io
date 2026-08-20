/**
 * Partnership config kernel (PARTNERSHIPS_PLAN.md PR 1).
 *
 * Pure helpers behind the /partnerships Deal tab: module-toggle normalization
 * (the DB stores modules as jsonb so later mechanisms are additive without
 * DDL), config validation, and the changed-keys patch written to the
 * partnership_events log on every save. No Supabase imports — I/O stays in the
 * page component.
 */

export type PartnershipModules = {
  /** §3 — post profit splits on close of checked-off jobs */
  profit_shares: boolean
  /** §4h — move bid-tagged estimating hours onto awarded jobs */
  est_transfer: boolean
  /** §4 — generate Sun–Sat statements with mutual acknowledgment */
  weekly_statement: boolean
  /** §5 — partner job-costing drill-in (checked-off jobs only) */
  costing: boolean
  /** sign prompts + banner until an agreement is signed */
  require_sign: boolean
  /** §8a — auto-serve lapse notice. Stays false pending attorney sign-off. */
  auto_notice: boolean
  /** §4a — weekly estimating cap. Modeled only; nothing built behind it. */
  cap: boolean
  /** §2b — W2 transition watch. Modeled only; nothing built behind it. */
  w2: boolean
}

export const DEFAULT_PARTNERSHIP_MODULES: PartnershipModules = {
  profit_shares: true,
  est_transfer: true,
  weekly_statement: true,
  costing: true,
  require_sign: true,
  auto_notice: false,
  cap: false,
  w2: false,
}

/** Module keys that flip in the UI but have no machinery behind them yet. */
export const UNBUILT_MODULE_KEYS: readonly (keyof PartnershipModules)[] = ['cap', 'w2']

export type PartnershipConfig = {
  status: string
  started_on: string | null
  field_rate: number
  estimating_rate: number
  farm_rate: number
  company_first_pct: number
  partner_remainder_pct: number
  utilities_allowance: number
  modules: PartnershipModules
}

export const PARTNERSHIP_STATUSES = ['draft', 'active', 'paused', 'ended'] as const

/**
 * Fill defaults for any missing/invalid module keys. The jsonb column may
 * predate a later key (additive evolution) or hold junk — unknown keys are
 * dropped, non-boolean values fall back to the default.
 */
export function normalizeModules(raw: unknown): PartnershipModules {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const out = { ...DEFAULT_PARTNERSHIP_MODULES }
  for (const key of Object.keys(DEFAULT_PARTNERSHIP_MODULES) as (keyof PartnershipModules)[]) {
    const v = src[key]
    if (typeof v === 'boolean') out[key] = v
  }
  return out
}

/** Human-readable validation errors for the Deal tab; empty array = savable. */
export function validatePartnershipConfig(cfg: PartnershipConfig): string[] {
  const errors: string[] = []
  const money: [string, number][] = [
    ['Field rate', cfg.field_rate],
    ['Estimating rate', cfg.estimating_rate],
    ['Farm rate', cfg.farm_rate],
    ['Utilities allowance', cfg.utilities_allowance],
  ]
  for (const [label, v] of money) {
    if (!Number.isFinite(v) || v < 0) errors.push(`${label} must be a non-negative number`)
  }
  const pcts: [string, number][] = [
    ['Company first cut %', cfg.company_first_pct],
    ['Partner share of remainder %', cfg.partner_remainder_pct],
  ]
  for (const [label, v] of pcts) {
    if (!Number.isFinite(v) || v < 0 || v > 100) errors.push(`${label} must be between 0 and 100`)
  }
  if (!(PARTNERSHIP_STATUSES as readonly string[]).includes(cfg.status)) {
    errors.push(`Status must be one of: ${PARTNERSHIP_STATUSES.join(', ')}`)
  }
  return errors
}

/**
 * Changed-keys patch for the partnership_events log: `{ key: { from, to } }`.
 * Modules diff key-by-key under a `modules.` prefix so the log reads
 * "modules.costing: true → false", not an opaque object swap.
 */
export function buildConfigPatch(
  before: PartnershipConfig,
  after: PartnershipConfig,
): Record<string, { from: unknown; to: unknown }> {
  const patch: Record<string, { from: unknown; to: unknown }> = {}
  const scalarKeys: (keyof Omit<PartnershipConfig, 'modules'>)[] = [
    'status',
    'started_on',
    'field_rate',
    'estimating_rate',
    'farm_rate',
    'company_first_pct',
    'partner_remainder_pct',
    'utilities_allowance',
  ]
  for (const key of scalarKeys) {
    if (before[key] !== after[key]) patch[key] = { from: before[key], to: after[key] }
  }
  for (const key of Object.keys(DEFAULT_PARTNERSHIP_MODULES) as (keyof PartnershipModules)[]) {
    if (before.modules[key] !== after.modules[key]) {
      patch[`modules.${key}`] = { from: before.modules[key], to: after.modules[key] }
    }
  }
  return patch
}
