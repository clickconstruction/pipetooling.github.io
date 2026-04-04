import { denverCalendarDayKey, ymdAddDays } from '../utils/dateUtils'

export const BANKING_SORTING_CONFIG_VERSION = 1 as const

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
}

const STORAGE_PREFIX = 'banking_sorting_config_v1_'

export function defaultBankingSortingConfig(): BankingSortingConfigV1 {
  const todayChicago = denverCalendarDayKey(Date.now())
  return {
    v: BANKING_SORTING_CONFIG_VERSION,
    kinds: [],
    accountIds: [],
    debitCardIds: [],
    startDateYmd: ymdAddDays(todayChicago, -90),
  }
}

function isValidYmd(s: string): boolean {
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(s.trim())
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
  return {
    v: BANKING_SORTING_CONFIG_VERSION,
    kinds: o.kinds,
    accountIds: o.accountIds,
    debitCardIds,
    startDateYmd: o.startDateYmd.trim(),
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
