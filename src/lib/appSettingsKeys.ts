/** `app_settings.key` — org-wide Job Parts Tally floor on Mercury `posted_at` (YYYY-MM-DD, Chicago day). Empty = no filter. */
export const APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD = 'job_tally_min_posted_ymd' as const

/** JSON map in `value_text`: Mercury kind → `{ nickname, color }` for Jobs → Bank Payments. Dev writes; all authenticated read. */
export const APP_SETTINGS_KEY_BANK_PAYMENTS_KIND_BADGES = 'bank_payments_kind_badges_v1' as const

/**
 * JSON in `value_text`: `BankingSortingConfigV1` — Mercury filter for Jobs → Stages → Accounts Receivable
 * (kinds, accounts, debit cards, start date, exclusions). Dev writes; all authenticated read.
 */
export const APP_SETTINGS_KEY_BANK_PAYMENTS_SORTING_CONFIG = 'bank_payments_sorting_config_v1' as const

/** E.164 or free-form digits in `value_text` — dispatch phone for subcontractor Collect Payment step 2. Dev writes; all authenticated read. */
export const APP_SETTINGS_KEY_FIELD_DISPATCH_PHONE = 'field_dispatch_phone_v1' as const

export function isValidYmd(s: string): boolean {
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(s.trim())
}

/** Returns trimmed YYYY-MM-DD or null if empty/invalid/missing (caller treats null as no filter). */
export function normalizeJobTallyMinPostedYmd(value: string | null | undefined): string | null {
  if (value == null) return null
  const t = value.trim()
  if (t === '') return null
  if (!isValidYmd(t)) return null
  return t
}
