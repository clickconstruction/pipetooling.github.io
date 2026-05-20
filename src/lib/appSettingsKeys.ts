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

/**
 * JSON in `value_text`: `MapDefaultViewV1` (center lat/lng, zoom, address label) — org default for `/map` when no fit-bounds. Dev writes; all authenticated read.
 * @see `src/lib/mapDefaultViewSettings.ts`
 */
export const APP_SETTINGS_KEY_MAP_DEFAULT_VIEW_V1 = 'map_default_view_v1' as const

/** UUID of `jobs_ledger.id` for People → Overhead “office job” (non–revenue work bucket). Dev writes; readers use Overhead tab. */
export const APP_SETTINGS_KEY_OVERHEAD_OFFICE_JOB_LEDGER_ID_V1 = 'overhead_office_job_ledger_id_v1' as const

/**
 * JSON in `value_text`: physical invoice footer presets (`v: 2` — builtins/alternate/custom/defaultPresetId).
 * Dev writes via Settings; all authenticated users read (Bill Customer Physical tab).
 */
export const APP_SETTINGS_KEY_PHYSICAL_INVOICE_FOOTER_PRESETS_V1 = 'physical_invoice_footer_presets_v1' as const

/**
 * JSON in `value_text`: `{ plumbing?, electrical? }` sparse overrides vs shipped Stripe footer presets.
 * Dev writes via Settings; all authenticated users read (Bill Customer Stripe tab).
 */
export const APP_SETTINGS_KEY_STRIPE_INVOICE_FOOTER_PRESETS_V1 = 'stripe_invoice_footer_presets_v1' as const

/**
 * JSON in `value_text`: Bill Customer memo presets (`v: 2` — builtins/alternate/custom/defaultPresetId).
 * Dev writes via Settings; all authenticated users read (Bill Customer modal memo fields).
 */
export const APP_SETTINGS_KEY_BILL_CUSTOMER_MEMO_PRESETS_V1 = 'bill_customer_memo_presets_v1' as const

/**
 * JSON in `value_text`: physical invoice issuer block (company, address, contact, tagline, license).
 * Dev writes via Settings; all authenticated users read (physical invoices, AIA, lien tooling).
 */
export const APP_SETTINGS_KEY_PHYSICAL_INVOICE_ISSUER_V1 = 'physical_invoice_issuer_v1' as const

/**
 * JSON in `value_text`: `DispatchNoteRequirementsConfigV1` — org-wide per-user schedule-block note
 * requirements (require-note vs skip-note assignee lists). Dispatch staff write via the
 * /schedule-dispatch "Dispatch Settings" modal; all authenticated read.
 * @see `src/lib/dispatchNoteRequirements.ts`
 */
export const APP_SETTINGS_KEY_DISPATCH_NOTE_REQUIREMENT_CONFIG =
  'dispatch_note_requirement_config_v1' as const

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
