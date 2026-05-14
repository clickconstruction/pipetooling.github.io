import { APP_SETTINGS_KEY_STRIPE_INVOICE_FOOTER_PRESETS_V1 } from './appSettingsKeys'
import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

/** Keep in sync with `supabase/functions/_shared/stripeInvoiceFooter.ts` (Edge). */
export const STRIPE_INVOICE_FOOTER_MAX_CHARS = 5000

const LS_KEY_STRIPE_INVOICE_FOOTER_PRESETS = 'pipetooling-stripe-invoice-footer-presets'

/** Shipped defaults (repo). Org/local sparse overrides layer on top per field. */
export const STRIPE_INVOICE_FOOTER_PRESET_PLUMBING = `Click Plumbing and Electrical
Reliable service today, innovative solutions for tomorrow.
Ph: 801-252-5155
12925 FM 20 Kingsbury TX 78638
Malachi Whites RMP M-41130 
Regulated by the Texas State Board of Plumbing Examiners`

export const STRIPE_INVOICE_FOOTER_PRESET_ELECTRICAL = `Click Plumbing and Electrical
Ph: 801-252-5155 | office@clickplumbing.com
12925 FM 20 Kingsbury TX 78638
Ph: 801-252-5155 TECL#: 40694
Regulated by the Texas Department of Licensing & Regulation.
920 Colorado St, Austin, TX 78701
tdlr.texas.gov 512-463-6599`

/** Same as shipped plumbing preset; Bill Customer modal should use {@link getStripeInvoiceFooterDefaultOnOpen}. */
export const STRIPE_INVOICE_FOOTER_DEFAULT_ON_OPEN = STRIPE_INVOICE_FOOTER_PRESET_PLUMBING

export type StripeInvoiceFooterPresetId = 'plumbing' | 'electrical'

export type StripeInvoiceFooterPresetStored = {
  plumbing?: string
  electrical?: string
}

function capFooter(s: string): string {
  return s.slice(0, STRIPE_INVOICE_FOOTER_MAX_CHARS)
}

/** Pinned overrides for this tab session after fetch/save (`undefined` = use local mirror until first fetch). */
let sessionOverrides: StripeInvoiceFooterPresetStored | undefined

export function parseStripeInvoiceFooterStoredJson(parsed: unknown): StripeInvoiceFooterPresetStored {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {}
  }
  const o = parsed as Record<string, unknown>
  const out: StripeInvoiceFooterPresetStored = {}
  if (typeof o.plumbing === 'string') out.plumbing = capFooter(o.plumbing)
  if (typeof o.electrical === 'string') out.electrical = capFooter(o.electrical)
  return out
}

function persistLocalMirror(overrides: StripeInvoiceFooterPresetStored): void {
  if (typeof window === 'undefined') return
  try {
    if (Object.keys(overrides).length === 0) {
      window.localStorage.removeItem(LS_KEY_STRIPE_INVOICE_FOOTER_PRESETS)
      return
    }
    window.localStorage.setItem(LS_KEY_STRIPE_INVOICE_FOOTER_PRESETS, JSON.stringify(overrides))
  } catch {
    /* quota / private mode */
  }
}

function readOverridesFromLocalMirrorOnly(): StripeInvoiceFooterPresetStored {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LS_KEY_STRIPE_INVOICE_FOOTER_PRESETS)
    if (!raw) return {}
    return parseStripeInvoiceFooterStoredJson(JSON.parse(raw) as unknown)
  } catch {
    return {}
  }
}

function applySessionPin(overrides: StripeInvoiceFooterPresetStored): void {
  sessionOverrides = { ...overrides }
  persistLocalMirror(sessionOverrides)
}

function sparseOverridesFromDraft(
  plumbingDraft: string,
  electricalDraft: string,
): StripeInvoiceFooterPresetStored {
  const p = capFooter(plumbingDraft)
  const e = capFooter(electricalDraft)
  const toStore: StripeInvoiceFooterPresetStored = {}
  if (p !== STRIPE_INVOICE_FOOTER_PRESET_PLUMBING) toStore.plumbing = p
  if (e !== STRIPE_INVOICE_FOOTER_PRESET_ELECTRICAL) toStore.electrical = e
  return toStore
}

function normalizedHasPersistablePayload(s: StripeInvoiceFooterPresetStored): boolean {
  return Object.keys(s).length > 0
}

async function deleteStripeInvoiceFooterPresetsFromAppSettings(): Promise<void> {
  await withSupabaseRetry(
    async () =>
      supabase.from('app_settings').delete().eq('key', APP_SETTINGS_KEY_STRIPE_INVOICE_FOOTER_PRESETS_V1),
    'delete_stripe_invoice_footer_presets_app_settings',
  )
}

export async function upsertStripeInvoiceFooterPresetsToAppSettings(
  sparse: StripeInvoiceFooterPresetStored,
): Promise<void> {
  if (!normalizedHasPersistablePayload(sparse)) {
    await deleteStripeInvoiceFooterPresetsFromAppSettings()
    return
  }
  await withSupabaseRetry(
    async () =>
      supabase.from('app_settings').upsert(
        {
          key: APP_SETTINGS_KEY_STRIPE_INVOICE_FOOTER_PRESETS_V1,
          value_text: JSON.stringify(sparse),
        },
        { onConflict: 'key' },
      ),
    'upsert_stripe_invoice_footer_presets_app_settings',
  )
}

/**
 * Loads org presets into session pin + local mirror.
 * Remote wins when a row exists; when no row, uses local mirror and optionally dev-uploads.
 */
export async function fetchStripeInvoiceFooterPresetsFromAppSettings(opts?: {
  authRole?: string | null
}): Promise<{ rowExists: boolean }> {
  try {
    const data = (await withSupabaseRetry(
      async () =>
        supabase
          .from('app_settings')
          .select('value_text')
          .eq('key', APP_SETTINGS_KEY_STRIPE_INVOICE_FOOTER_PRESETS_V1)
          .maybeSingle(),
      'fetch_stripe_invoice_footer_presets_app_settings',
    )) as { value_text: string | null } | null

    if (data != null) {
      const text = data.value_text
      if (text != null && text.trim() !== '') {
        try {
          const parsed: unknown = JSON.parse(text)
          applySessionPin(parseStripeInvoiceFooterStoredJson(parsed))
        } catch {
          applySessionPin({})
        }
      } else {
        applySessionPin({})
      }
      return { rowExists: true }
    }

    const localOnly = readOverridesFromLocalMirrorOnly()
    applySessionPin(localOnly)
    if (opts?.authRole === 'dev' && normalizedHasPersistablePayload(localOnly)) {
      try {
        await upsertStripeInvoiceFooterPresetsToAppSettings(localOnly)
      } catch {
        /* RLS or network; keep local mirror only */
      }
    }
    return { rowExists: false }
  } catch {
    return { rowExists: false }
  }
}

/**
 * Sparse override layer (capped); missing fields mean “use shipped default”.
 * Uses session pin after fetch/save; otherwise local mirror.
 */
export function readStripeInvoiceFooterPresetsFromStorage(): StripeInvoiceFooterPresetStored {
  if (sessionOverrides !== undefined) {
    return { ...sessionOverrides }
  }
  return readOverridesFromLocalMirrorOnly()
}

/** Persist dev/org edits: sparse layer; updates DB then session + mirror. */
export async function saveStripeInvoiceFooterPresetsFromForm(
  plumbingDraft: string,
  electricalDraft: string,
): Promise<void> {
  const sparse = sparseOverridesFromDraft(plumbingDraft, electricalDraft)
  await upsertStripeInvoiceFooterPresetsToAppSettings(sparse)
  applySessionPin(sparse)
}

export async function resetStripeInvoiceFooterPresetsToBuiltins(): Promise<void> {
  sessionOverrides = undefined
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LS_KEY_STRIPE_INVOICE_FOOTER_PRESETS)
    }
  } catch {
    /* ignore */
  }
  try {
    await deleteStripeInvoiceFooterPresetsFromAppSettings()
  } catch {
    /* ignore */
  }
}

export function getStripeInvoiceFooterPresetPlumbing(): string {
  const o = readStripeInvoiceFooterPresetsFromStorage()
  return o.plumbing !== undefined ? o.plumbing : STRIPE_INVOICE_FOOTER_PRESET_PLUMBING
}

export function getStripeInvoiceFooterPresetElectrical(): string {
  const o = readStripeInvoiceFooterPresetsFromStorage()
  return o.electrical !== undefined ? o.electrical : STRIPE_INVOICE_FOOTER_PRESET_ELECTRICAL
}

export function getStripeInvoiceFooterDefaultOnOpen(): string {
  return getStripeInvoiceFooterPresetPlumbing()
}

/** Which preset the footer text matches exactly, or null if custom / empty. */
export function stripeInvoiceFooterActivePreset(footer: string): StripeInvoiceFooterPresetId | null {
  if (footer === getStripeInvoiceFooterPresetPlumbing()) return 'plumbing'
  if (footer === getStripeInvoiceFooterPresetElectrical()) return 'electrical'
  return null
}
