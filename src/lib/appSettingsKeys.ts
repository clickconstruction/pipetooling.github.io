/** `app_settings.key` — org-wide Job Parts Tally floor on Mercury `posted_at` (YYYY-MM-DD, Chicago day). Empty = no filter. */
export const APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD = 'job_tally_min_posted_ymd' as const

/** `app_settings.key` — 'true' in `value_text` hides dev-role staff transactions in the Stale tally follow-up (list + banner count) for everyone. Dev writes; all authenticated read. */
export const APP_SETTINGS_KEY_HIDE_DEV_TALLY_TRANSACTIONS = 'hide_dev_tally_transactions' as const

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

/** `value_text` — org default for the bid cover letter Terms & warranty paragraph (used when a bid's Terms box is empty). Blank/missing = built-in DEFAULT_TERMS_AND_WARRANTY. Dev writes; all authenticated read. */
export const APP_SETTINGS_KEY_BID_COVER_LETTER_TERMS_DEFAULT = 'bid_cover_letter_terms_default_v1' as const

/** `value_text` — org default for the bid cover letter Exclusions list (one per line; used when a bid's Exclusions box is empty). Blank/missing = built-in DEFAULT_EXCLUSIONS. Dev writes; all authenticated read. */
export const APP_SETTINGS_KEY_BID_COVER_LETTER_EXCLUSIONS_DEFAULT = 'bid_cover_letter_exclusions_default_v1' as const

/** `value_text` — the cover letter closing paragraph lines (before "Respectfully submitted…"). Blank/missing = built-in DEFAULT_COVER_LETTER_CLOSING. Dev writes; all authenticated read. */
export const APP_SETTINGS_KEY_BID_COVER_LETTER_CLOSING = 'bid_cover_letter_closing_v1' as const

/** Dollars in `value_num` — default Turnaway trip charge when the client isn't home. NULL/≤0 = not configured. Dev writes; all authenticated read. */
export const APP_SETTINGS_KEY_TRIP_CHARGE_CLIENT_NOT_HOME = 'trip_charge_client_not_home' as const

/** Dollars in `value_num` — default Turnaway trip charge when the site isn't ready. NULL/≤0 = not configured. Dev writes; all authenticated read. */
export const APP_SETTINGS_KEY_TRIP_CHARGE_SITE_NOT_READY = 'trip_charge_site_not_ready' as const

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

/** Parse the hide-dev-tally `app_settings.value_text`: only the literal 'true' (trimmed) enables hiding. */
export function parseHideDevTallyFlag(valueText: string | null | undefined): boolean {
  return (valueText ?? '').trim() === 'true'
}

/* ── Bulk-deletion alert (dev dashboard notice). Thresholds are ALSO read server-side by the
 * list_bulk_deletion_alerts() RPC, so these key names are load-bearing in SQL — see
 * 20260717120000_bulk_deletion_alerts.sql. Defaults below must match the RPC's COALESCE fallbacks. */

/** `value_text` — 'true'/'false'. Missing = enabled. Dev writes; all authenticated read. */
export const APP_SETTINGS_KEY_BULK_DELETE_ALERT_ENABLED = 'bulk_delete_alert_enabled_v1' as const

/** `value_num` — alert when one person deletes at least this many BUNDLES (distinct group_key) in a window. Missing = 5. Dev writes; all authenticated read. */
export const APP_SETTINGS_KEY_BULK_DELETE_ALERT_BUNDLES = 'bulk_delete_alert_bundles_v1' as const

/** `value_num` — second trigger: alert at this many archived ROWS in a window (catches one huge bundle, e.g. a customer cascading into many projects). Missing = 200. Dev writes; all authenticated read. */
export const APP_SETTINGS_KEY_BULK_DELETE_ALERT_ROWS = 'bulk_delete_alert_rows_v1' as const

/** `value_num` — width of the detection window, in minutes. Missing = 60. Dev writes; all authenticated read. */
export const APP_SETTINGS_KEY_BULK_DELETE_ALERT_WINDOW_MINUTES = 'bulk_delete_alert_window_minutes_v1' as const

/** `value_num` — how far back the dashboard notice looks, in hours. Missing = 168 (7 days). Dev writes; all authenticated read. */
export const APP_SETTINGS_KEY_BULK_DELETE_ALERT_LOOKBACK_HOURS = 'bulk_delete_alert_lookback_hours_v1' as const

/** Defaults — must stay in sync with the COALESCE fallbacks in list_bulk_deletion_alerts(). */
export const BULK_DELETE_ALERT_DEFAULTS = {
  bundles: 5,
  rows: 200,
  windowMinutes: 60,
  lookbackHours: 168,
} as const

/**
 * Parse a bulk-delete-alert `value_num` threshold. Blank/garbage/≤0 falls back to `fallback` rather
 * than to zero — a mistyped setting must never silence the alarm or fire it on every delete.
 * Clamps to app_settings.value_num's numeric(10,2) ceiling.
 */
export function parseBulkDeleteAlertThreshold(
  value: number | string | null | undefined,
  fallback: number,
): number {
  if (value === null || value === undefined || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(Math.floor(n), 99_999_999)
}

/** Parse the bulk-delete-alert enabled flag: only the literal 'false' (trimmed) disables it; missing = on. */
export function parseBulkDeleteAlertEnabled(valueText: string | null | undefined): boolean {
  return (valueText ?? '').trim() !== 'false'
}

/**
 * JSON in `value_text`: `{ability,drive,integrity}` dimension weights for the Team → Review composite
 * (normalized by `parseCompositeWeights`; missing = equal thirds). Dev writes; all authenticated read.
 * @see `src/lib/prospects/teamComposite.ts`
 */
export const APP_SETTINGS_KEY_TEAM_REVIEW_COMPOSITE_WEIGHTS = 'team_review_composite_weights_v1' as const

/**
 * `value_num`: days between team-member reviews before the Dashboard/Dispatch Inbox reminder fires
 * (default 30 via `parseTeamReviewCadenceDays`). Dev writes (Settings → Dashboard & alerts); all authenticated read.
 * @see `src/lib/prospects/teamReviewDue.ts`
 */
export const APP_SETTINGS_KEY_TEAM_REVIEW_CADENCE_DAYS = 'team_review_cadence_days_v1' as const
