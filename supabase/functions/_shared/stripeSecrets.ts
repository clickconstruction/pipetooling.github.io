/** Billing mode for dual Stripe test/live keys (Supabase Edge secrets). */

export type StripeBillingMode = 'test' | 'live'

export function parseStripeBillingMode(raw: unknown): StripeBillingMode | null {
  if (raw === 'test' || raw === 'live') return raw
  return null
}

function legacyStripeSecret(): string {
  return Deno.env.get('STRIPE_SECRET_KEY')?.trim() ?? ''
}

/** sk_test / sk_live from STRIPE_SECRET_KEY_TEST / STRIPE_SECRET_KEY_LIVE, with legacy STRIPE_SECRET_KEY fallback when prefix matches. */
export function stripeApiKeyForMode(mode: StripeBillingMode): string | null {
  if (mode === 'test') {
    const t = Deno.env.get('STRIPE_SECRET_KEY_TEST')?.trim()
    if (t) return t
    const g = legacyStripeSecret()
    return g.startsWith('sk_test_') ? g : null
  }
  const l = Deno.env.get('STRIPE_SECRET_KEY_LIVE')?.trim()
  if (l) return l
  const g = legacyStripeSecret()
  return g.startsWith('sk_live_') ? g : null
}

export function hasStripeTestConfigured(): boolean {
  return stripeApiKeyForMode('test') != null
}

export function hasStripeLiveConfigured(): boolean {
  return stripeApiKeyForMode('live') != null
}

/**
 * When the caller omits `stripe_mode` (legacy / non-UI callers). A5
 * (FRAGILITY_REMEDIATION_PLAN.md): when BOTH keys are configured the default
 * is **live** — pre-A5 it was test, which meant any script/curl caller that
 * forgot the param silently operated in test mode against prod data. Every
 * app call site passes an explicit mode (dev-gated pref, others pinned live),
 * and row-bound functions resolve from the invoice row (A3), so this default
 * only reaches `create`/`preview` from non-app callers — fail safe to live.
 */
export function defaultStripeBillingMode(): StripeBillingMode {
  const hasTest = hasStripeTestConfigured()
  const hasLive = hasStripeLiveConfigured()
  if (hasLive) return 'live'
  if (hasTest) return 'test'
  return 'live'
}

export function anyStripeApiKeyConfigured(): boolean {
  return hasStripeTestConfigured() || hasStripeLiveConfigured()
}

export function resolveStripeBillingMode(requested: unknown): StripeBillingMode {
  const parsed = parseStripeBillingMode(requested)
  if (parsed) return parsed
  return defaultStripeBillingMode()
}

export type EffectiveRowStripeMode =
  | { mode: StripeBillingMode; conflict?: undefined }
  | { mode?: undefined; conflict: { row_mode: StripeBillingMode; requested_mode: StripeBillingMode } }

/**
 * A3 (FRAGILITY_REMEDIATION_PLAN.md): for operations bound to an existing
 * jobs_ledger_invoices row, the row's recorded stripe_mode (v2.1114) is
 * authoritative. An explicitly requested mode that disagrees is a conflict —
 * the caller must not act cross-mode (the pre-A3 failure: a test-mode void of
 * a live invoice read "No such invoice" and deleted the ledger row). A NULL
 * row mode (pre-A1 legacy) falls back to the requested/default mode.
 */
export function effectiveRowStripeMode(rowMode: unknown, requestedRaw: unknown): EffectiveRowStripeMode {
  const row = parseStripeBillingMode(rowMode)
  const requested = parseStripeBillingMode(requestedRaw)
  if (row) {
    if (requested && requested !== row) {
      return { conflict: { row_mode: row, requested_mode: requested } }
    }
    return { mode: row }
  }
  return { mode: requested ?? defaultStripeBillingMode() }
}

function normalizeWebhookSecret(raw: string | undefined): string {
  let t = raw?.trim() ?? ''
  if (t.startsWith('\uFEFF')) t = t.slice(1).trim()
  if (
    t.length >= 2 &&
    ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
  ) {
    t = t.slice(1, -1).trim()
  }
  return t
}

/**
 * Webhook signing secrets to try. Order: **live, test, legacy** — most prod traffic is livemode, so we verify
 * in one `constructEvent` when only `STRIPE_WEBHOOK_SECRET_LIVE` is set. (Test events still succeed: live secret
 * fails first, then test matches.)
 */
export function stripeWebhookSecretsOrdered(): string[] {
  return stripeWebhookSecretsWithModes().map((s) => s.secret)
}

export type StripeWebhookSecretWithMode = {
  secret: string
  /** Mode the env var claims (LIVE/TEST vars); null for the legacy mode-less STRIPE_WEBHOOK_SECRET. */
  mode: StripeBillingMode | null
}

/**
 * Same ordering as stripeWebhookSecretsOrdered, but each secret carries the
 * mode its env var claims — the secret that verifies a signature is
 * cryptographic evidence of the sending endpoint's mode (A2: cross-checked
 * against `event.livemode`; disagreement = endpoint misconfiguration).
 */
export function stripeWebhookSecretsWithModes(): StripeWebhookSecretWithMode[] {
  const out: StripeWebhookSecretWithMode[] = []
  const push = (s: string | undefined, mode: StripeBillingMode | null) => {
    const t = normalizeWebhookSecret(s)
    if (t && !out.some((x) => x.secret === t)) out.push({ secret: t, mode })
  }
  push(Deno.env.get('STRIPE_WEBHOOK_SECRET_LIVE'), 'live')
  push(Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST'), 'test')
  push(Deno.env.get('STRIPE_WEBHOOK_SECRET'), null)
  return out
}

/** Safe preview for logs / Stripe retry UI — never log or return the full `whsec_` value. */
export type StripeWebhookEnvFingerprint = {
  envVar: string
  rawEnvNonEmpty: boolean
  normalizedLen: number
  whsecPrefix: boolean
  tail4: string | null
}

export function stripeWebhookEnvFingerprints(): StripeWebhookEnvFingerprint[] {
  const names = [
    'STRIPE_WEBHOOK_SECRET_LIVE',
    'STRIPE_WEBHOOK_SECRET_TEST',
    'STRIPE_WEBHOOK_SECRET',
  ] as const
  return names.map((envVar) => {
    const raw = Deno.env.get(envVar)
    const t = normalizeWebhookSecret(raw)
    return {
      envVar,
      rawEnvNonEmpty: Boolean(raw?.trim()),
      normalizedLen: t.length,
      whsecPrefix: t.startsWith('whsec_'),
      tail4: t.length >= 4 ? t.slice(-4) : null,
    }
  })
}

export function stripeWebhookDebugFingerprintsEnabled(): boolean {
  const v = Deno.env.get('STRIPE_WEBHOOK_DEBUG_FINGERPRINT')?.trim().toLowerCase() ?? ''
  return v === '1' || v === 'true' || v === 'yes'
}
