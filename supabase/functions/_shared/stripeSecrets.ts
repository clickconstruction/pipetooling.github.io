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

/** When the client omits `stripe_mode` (legacy callers). If both *_TEST and *_LIVE secrets exist, default test; else pick the only configured mode; else infer legacy key prefix. */
export function defaultStripeBillingMode(): StripeBillingMode {
  const testEnv = Boolean(Deno.env.get('STRIPE_SECRET_KEY_TEST')?.trim())
  const liveEnv = Boolean(Deno.env.get('STRIPE_SECRET_KEY_LIVE')?.trim())
  if (testEnv && liveEnv) return 'test'

  const hasTest = hasStripeTestConfigured()
  const hasLive = hasStripeLiveConfigured()
  if (hasLive && !hasTest) return 'live'
  if (hasTest && !hasLive) return 'test'

  const g = legacyStripeSecret()
  if (g.startsWith('sk_test_')) return 'test'
  if (g.startsWith('sk_live_')) return 'live'
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
  const out: string[] = []
  const push = (s: string | undefined) => {
    const t = normalizeWebhookSecret(s)
    if (t && !out.includes(t)) out.push(t)
  }
  push(Deno.env.get('STRIPE_WEBHOOK_SECRET_LIVE'))
  push(Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST'))
  push(Deno.env.get('STRIPE_WEBHOOK_SECRET'))
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
