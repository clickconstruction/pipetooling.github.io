/** Keep in sync with `supabase/functions/_shared/stripeInvoiceFooter.ts` (Edge). */
export const STRIPE_INVOICE_FOOTER_MAX_CHARS = 5000

const LS_KEY_STRIPE_INVOICE_FOOTER_PRESETS = 'pipetooling-stripe-invoice-footer-presets'

/** Shipped defaults (repo). Dev overrides in localStorage layer on top per field. */
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

/** Raw overrides from localStorage (capped); missing fields mean “use shipped default”. */
export function readStripeInvoiceFooterPresetsFromStorage(): StripeInvoiceFooterPresetStored {
  try {
    const raw = localStorage.getItem(LS_KEY_STRIPE_INVOICE_FOOTER_PRESETS)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const o = parsed as Record<string, unknown>
    const out: StripeInvoiceFooterPresetStored = {}
    if (typeof o.plumbing === 'string') out.plumbing = capFooter(o.plumbing)
    if (typeof o.electrical === 'string') out.electrical = capFooter(o.electrical)
    return out
  } catch {
    return {}
  }
}

/** Persist dev edits: only stores values that differ from shipped presets; removes key when empty. */
export function saveStripeInvoiceFooterPresetsFromForm(plumbingDraft: string, electricalDraft: string): void {
  try {
    const p = capFooter(plumbingDraft)
    const e = capFooter(electricalDraft)
    const toStore: StripeInvoiceFooterPresetStored = {}
    if (p !== STRIPE_INVOICE_FOOTER_PRESET_PLUMBING) toStore.plumbing = p
    if (e !== STRIPE_INVOICE_FOOTER_PRESET_ELECTRICAL) toStore.electrical = e
    if (Object.keys(toStore).length === 0) {
      localStorage.removeItem(LS_KEY_STRIPE_INVOICE_FOOTER_PRESETS)
    } else {
      localStorage.setItem(LS_KEY_STRIPE_INVOICE_FOOTER_PRESETS, JSON.stringify(toStore))
    }
  } catch {
    /* private mode / quota */
  }
}

export function resetStripeInvoiceFooterPresetsToBuiltins(): void {
  try {
    localStorage.removeItem(LS_KEY_STRIPE_INVOICE_FOOTER_PRESETS)
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
