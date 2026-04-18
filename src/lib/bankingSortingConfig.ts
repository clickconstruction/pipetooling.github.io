import { denverCalendarDayKey, ymdAddDays } from '../utils/dateUtils'

export const BANKING_SORTING_CONFIG_VERSION = 1 as const

/** Max substrings per exclusions list (AR sorting). */
export const BANKING_SORTING_MAX_EXCLUSION_PATTERNS = 50
/** Max length per exclusion substring after trim. */
export const BANKING_SORTING_MAX_EXCLUSION_STRING_LEN = 120

export type BankingSortingConfigV1 = {
  v: typeof BANKING_SORTING_CONFIG_VERSION
  /** Empty = all kinds */
  kinds: string[]
  /** Empty = all accounts */
  accountIds: string[]
  /** Empty = any debit card (rows without debit card in raw still pass when empty) */
  debitCardIds: string[]
  /** YYYY-MM-DD (America/Chicago calendar); show transactions whose posted date is on or after this day */
  startDateYmd: string
  /**
   * Case-insensitive substring exclusions for Mercury counterparty_name (empty = none).
   * Used by Accounts Receivable sorting / RPC p_filter.
   */
  excludeCounterpartyContains: string[]
  /**
   * Case-insensitive substring exclusions for Mercury note (empty = none).
   */
  excludeNoteContains: string[]
}

const STORAGE_PREFIX = 'banking_sorting_config_v1_'

/** Jobs → Stages → Bank payments only; independent from {@link STORAGE_PREFIX}. */
const BANK_PAYMENTS_STORAGE_PREFIX = 'bank_payments_sorting_config_v1_'

export function defaultBankingSortingConfig(): BankingSortingConfigV1 {
  const todayChicago = denverCalendarDayKey(Date.now())
  return {
    v: BANKING_SORTING_CONFIG_VERSION,
    kinds: [],
    accountIds: [],
    debitCardIds: [],
    startDateYmd: ymdAddDays(todayChicago, -90),
    excludeCounterpartyContains: [],
    excludeNoteContains: [],
  }
}

function isValidYmd(s: string): boolean {
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(s.trim())
}

function normalizeExclusionPatterns(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw) || !raw.every((x) => typeof x === 'string')) return null
  const out: string[] = []
  for (const s of raw) {
    const t = s.trim().slice(0, BANKING_SORTING_MAX_EXCLUSION_STRING_LEN)
    if (t.length === 0) continue
    out.push(t)
    if (out.length >= BANKING_SORTING_MAX_EXCLUSION_PATTERNS) break
  }
  return out
}

/** One substring per line; trim, cap length/count; sorted for stable saves. */
export function normalizeExclusionLinesFromText(raw: string): string[] {
  const out: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim().slice(0, BANKING_SORTING_MAX_EXCLUSION_STRING_LEN)
    if (t.length === 0) continue
    out.push(t)
    if (out.length >= BANKING_SORTING_MAX_EXCLUSION_PATTERNS) break
  }
  return [...out].sort((a, b) => a.localeCompare(b))
}

function normalizeConfig(raw: unknown): BankingSortingConfigV1 | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.v !== BANKING_SORTING_CONFIG_VERSION) return null
  if (!Array.isArray(o.kinds) || !o.kinds.every((x) => typeof x === 'string')) return null
  if (!Array.isArray(o.accountIds) || !o.accountIds.every((x) => typeof x === 'string')) return null
  const rawDebit = o.debitCardIds
  const debitCardIds =
    rawDebit === undefined
      ? []
      : Array.isArray(rawDebit) && rawDebit.every((x) => typeof x === 'string')
        ? rawDebit.map((id) => id.trim().toLowerCase()).filter((id) => id.length > 0)
        : null
  if (debitCardIds === null) return null
  if (typeof o.startDateYmd !== 'string' || !isValidYmd(o.startDateYmd)) return null
  const excludeCounterpartyContains = normalizeExclusionPatterns(o.excludeCounterpartyContains)
  const excludeNoteContains = normalizeExclusionPatterns(o.excludeNoteContains)
  if (excludeCounterpartyContains === null || excludeNoteContains === null) return null
  return {
    v: BANKING_SORTING_CONFIG_VERSION,
    kinds: o.kinds,
    accountIds: o.accountIds,
    debitCardIds,
    startDateYmd: o.startDateYmd.trim(),
    excludeCounterpartyContains,
    excludeNoteContains,
  }
}

export function loadBankingSortingConfig(userId: string | undefined): BankingSortingConfigV1 {
  if (!userId || typeof window === 'undefined') return defaultBankingSortingConfig()
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + userId)
    if (!raw) return defaultBankingSortingConfig()
    const parsed: unknown = JSON.parse(raw)
    const n = normalizeConfig(parsed)
    return n ?? defaultBankingSortingConfig()
  } catch {
    return defaultBankingSortingConfig()
  }
}

export function saveBankingSortingConfig(userId: string | undefined, cfg: BankingSortingConfigV1): void {
  if (!userId || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(cfg))
  } catch {
    /* quota / private mode */
  }
}

/**
 * Sorting filter for Jobs → Stages → Bank payments only (separate localStorage key).
 * On first access, seeds from {@link loadBankingSortingConfig} and persists so Banking / Quickfill stay aligned until the user edits Bank payments filters.
 */
export function loadBankPaymentsSortingConfig(userId: string | undefined): BankingSortingConfigV1 {
  if (!userId || typeof window === 'undefined') return defaultBankingSortingConfig()
  const key = BANK_PAYMENTS_STORAGE_PREFIX + userId
  try {
    const raw = window.localStorage.getItem(key)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      const n = normalizeConfig(parsed)
      if (n) return n
    }
  } catch {
    /* invalid JSON or parse error — seed below */
  }
  const fromGlobal = loadBankingSortingConfig(userId)
  try {
    window.localStorage.setItem(key, JSON.stringify(fromGlobal))
  } catch {
    /* quota / private mode */
  }
  return fromGlobal
}

export function saveBankPaymentsSortingConfig(userId: string | undefined, cfg: BankingSortingConfigV1): void {
  if (!userId || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(BANK_PAYMENTS_STORAGE_PREFIX + userId, JSON.stringify(cfg))
  } catch {
    /* quota / private mode */
  }
}

/** posted_at must exist; compare Chicago calendar day >= startDateYmd */
export function mercuryRowPassesSortingStartDate(postedAt: string | null, startDateYmd: string): boolean {
  if (!postedAt || !isValidYmd(startDateYmd)) return false
  try {
    const ms = new Date(postedAt).getTime()
    if (Number.isNaN(ms)) return false
    const rowDay = denverCalendarDayKey(ms)
    return rowDay >= startDateYmd.trim()
  } catch {
    return false
  }
}
