import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Recording chainable Supabase stand-in + retry passthrough (same shape as teamFeedback.test.ts).
type Step = { method: string; args: unknown[] }
type Call = { table: string; steps: Step[] }
type Result = { data: unknown; error: { message: string } | null }
const calls: Call[] = []
let handler: (c: Call) => Result = () => ({ data: null, error: null })
function builder(table: string): unknown {
  const steps: Step[] = []
  const p: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') {
          return (resolve: (v: Result) => void) => {
            const call = { table, steps }
            calls.push(call)
            resolve(handler(call))
          }
        }
        return (...args: unknown[]) => {
          steps.push({ method: String(prop), args })
          return p
        }
      },
    },
  )
  return p
}
vi.mock('./supabase', () => ({ supabase: { from: (table: string) => builder(table) } }))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => PromiseLike<Result>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))

import * as edge from '../../supabase/functions/_shared/stripeInvoiceFooter'
import {
  STRIPE_INVOICE_FOOTER_DEFAULT_ON_OPEN,
  STRIPE_INVOICE_FOOTER_MAX_CHARS,
  STRIPE_INVOICE_FOOTER_PRESET_ELECTRICAL,
  STRIPE_INVOICE_FOOTER_PRESET_PLUMBING,
  fetchStripeInvoiceFooterPresetsFromAppSettings,
  getStripeInvoiceFooterDefaultOnOpen,
  getStripeInvoiceFooterPresetElectrical,
  getStripeInvoiceFooterPresetPlumbing,
  parseStripeInvoiceFooterStoredJson,
  readStripeInvoiceFooterPresetsFromStorage,
  resetStripeInvoiceFooterPresetsToBuiltins,
  saveStripeInvoiceFooterPresetsFromForm,
  stripeInvoiceFooterActivePreset,
  upsertStripeInvoiceFooterPresetsToAppSettings,
} from './stripeInvoiceFooter'

const KEY = 'stripe_invoice_footer_presets_v1'
const LS = 'pipetooling-stripe-invoice-footer-presets'
const g = globalThis as unknown as { window?: unknown }
let store: Map<string, string>
const write = (c: Call) => `${c.table}:${c.steps[0]!.method}`
const argOf = (c: Call, m: string) => c.steps.find((s) => s.method === m)?.args

beforeEach(async () => {
  store = new Map()
  g.window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
    },
  }
  handler = () => ({ data: null, error: null })
  await resetStripeInvoiceFooterPresetsToBuiltins() // clears the module's session pin
  calls.length = 0
})
afterEach(() => {
  delete g.window
})

describe('client and edge copies stay in sync', () => {
  it('the footer cap is the same number on both sides', () => {
    expect(edge.STRIPE_INVOICE_FOOTER_MAX_CHARS).toBe(STRIPE_INVOICE_FOOTER_MAX_CHARS)
    expect(STRIPE_INVOICE_FOOTER_MAX_CHARS).toBe(5000)
  })
})

describe('shipped presets', () => {
  it('open on the plumbing preset; both fit the cap; the two differ', () => {
    expect(STRIPE_INVOICE_FOOTER_DEFAULT_ON_OPEN).toBe(STRIPE_INVOICE_FOOTER_PRESET_PLUMBING)
    expect(STRIPE_INVOICE_FOOTER_PRESET_PLUMBING.length).toBeLessThanOrEqual(STRIPE_INVOICE_FOOTER_MAX_CHARS)
    expect(STRIPE_INVOICE_FOOTER_PRESET_ELECTRICAL.length).toBeLessThanOrEqual(STRIPE_INVOICE_FOOTER_MAX_CHARS)
    expect(STRIPE_INVOICE_FOOTER_PRESET_PLUMBING).not.toBe(STRIPE_INVOICE_FOOTER_PRESET_ELECTRICAL)
  })
  it('with nothing stored the getters return the shipped text and the preset detector recognises it', () => {
    expect(readStripeInvoiceFooterPresetsFromStorage()).toEqual({})
    expect(getStripeInvoiceFooterPresetPlumbing()).toBe(STRIPE_INVOICE_FOOTER_PRESET_PLUMBING)
    expect(getStripeInvoiceFooterPresetElectrical()).toBe(STRIPE_INVOICE_FOOTER_PRESET_ELECTRICAL)
    expect(getStripeInvoiceFooterDefaultOnOpen()).toBe(STRIPE_INVOICE_FOOTER_PRESET_PLUMBING)
    expect(stripeInvoiceFooterActivePreset(STRIPE_INVOICE_FOOTER_PRESET_ELECTRICAL)).toBe('electrical')
    expect(stripeInvoiceFooterActivePreset('something custom')).toBeNull()
    expect(stripeInvoiceFooterActivePreset('')).toBeNull()
  })
})

describe('parseStripeInvoiceFooterStoredJson', () => {
  it('keeps only the two string fields, capped; anything else is empty', () => {
    expect(parseStripeInvoiceFooterStoredJson(null)).toEqual({})
    expect(parseStripeInvoiceFooterStoredJson([1])).toEqual({})
    expect(parseStripeInvoiceFooterStoredJson('x')).toEqual({})
    expect(parseStripeInvoiceFooterStoredJson({ plumbing: 'P', electrical: 42, other: 'z' })).toEqual({ plumbing: 'P' })
    expect(parseStripeInvoiceFooterStoredJson({ electrical: 'e'.repeat(6000) }).electrical).toHaveLength(5000)
  })
})

describe('the local mirror before any fetch', () => {
  it('overrides stored on the device apply, and a malformed mirror reads as shipped', () => {
    store.set(LS, JSON.stringify({ plumbing: 'Local plumbing footer' }))
    expect(getStripeInvoiceFooterPresetPlumbing()).toBe('Local plumbing footer')
    expect(getStripeInvoiceFooterPresetElectrical()).toBe(STRIPE_INVOICE_FOOTER_PRESET_ELECTRICAL)
    expect(stripeInvoiceFooterActivePreset('Local plumbing footer')).toBe('plumbing')
    store.set(LS, '{oops')
    expect(getStripeInvoiceFooterPresetPlumbing()).toBe(STRIPE_INVOICE_FOOTER_PRESET_PLUMBING)
  })
  it('with no window at all everything is shipped', () => {
    delete g.window
    expect(readStripeInvoiceFooterPresetsFromStorage()).toEqual({})
    expect(getStripeInvoiceFooterDefaultOnOpen()).toBe(STRIPE_INVOICE_FOOTER_PRESET_PLUMBING)
  })
})

describe('fetchStripeInvoiceFooterPresetsFromAppSettings', () => {
  it('an org row wins over the device: it is pinned for the session and mirrored locally', async () => {
    store.set(LS, JSON.stringify({ plumbing: 'stale local' }))
    handler = () => ({ data: { value_text: JSON.stringify({ electrical: 'Org electrical' }) }, error: null })
    expect(await fetchStripeInvoiceFooterPresetsFromAppSettings()).toEqual({ rowExists: true })
    expect(argOf(calls[0]!, 'eq')).toEqual(['key', KEY])
    expect(getStripeInvoiceFooterPresetPlumbing()).toBe(STRIPE_INVOICE_FOOTER_PRESET_PLUMBING) // the stale local plumbing is gone
    expect(getStripeInvoiceFooterPresetElectrical()).toBe('Org electrical')
    expect(JSON.parse(store.get(LS)!)).toEqual({ electrical: 'Org electrical' })
  })
  it('an org row with empty or unparseable text pins "shipped" and clears the mirror', async () => {
    store.set(LS, JSON.stringify({ plumbing: 'stale local' }))
    handler = () => ({ data: { value_text: '   ' }, error: null })
    expect(await fetchStripeInvoiceFooterPresetsFromAppSettings()).toEqual({ rowExists: true })
    expect(store.has(LS)).toBe(false)
    expect(getStripeInvoiceFooterPresetPlumbing()).toBe(STRIPE_INVOICE_FOOTER_PRESET_PLUMBING)
    handler = () => ({ data: { value_text: '{not json' }, error: null })
    await fetchStripeInvoiceFooterPresetsFromAppSettings()
    expect(readStripeInvoiceFooterPresetsFromStorage()).toEqual({})
  })
  it('no org row: the device mirror is pinned, and a dev uploads it while others do not', async () => {
    store.set(LS, JSON.stringify({ plumbing: 'Local plumbing' }))
    handler = () => ({ data: null, error: null })
    expect(await fetchStripeInvoiceFooterPresetsFromAppSettings({ authRole: 'assistant' })).toEqual({ rowExists: false })
    expect(calls.map(write)).toEqual(['app_settings:select'])
    expect(getStripeInvoiceFooterPresetPlumbing()).toBe('Local plumbing')

    calls.length = 0
    expect(await fetchStripeInvoiceFooterPresetsFromAppSettings({ authRole: 'dev' })).toEqual({ rowExists: false })
    expect(calls.map(write)).toEqual(['app_settings:select', 'app_settings:upsert'])
    expect(argOf(calls[1]!, 'upsert')).toEqual([{ key: KEY, value_text: JSON.stringify({ plumbing: 'Local plumbing' }) }, { onConflict: 'key' }])
  })
  it('a failed read reports no row and leaves the current values alone', async () => {
    handler = () => ({ data: null, error: { message: 'offline' } })
    expect(await fetchStripeInvoiceFooterPresetsFromAppSettings()).toEqual({ rowExists: false })
    expect(getStripeInvoiceFooterPresetPlumbing()).toBe(STRIPE_INVOICE_FOOTER_PRESET_PLUMBING)
  })
})

describe('saving from the dev form', () => {
  it('stores only the fields that differ from shipped, then pins and mirrors them', async () => {
    await saveStripeInvoiceFooterPresetsFromForm(STRIPE_INVOICE_FOOTER_PRESET_PLUMBING, 'New electrical text')
    expect(calls.map(write)).toEqual(['app_settings:upsert'])
    expect(argOf(calls[0]!, 'upsert')).toEqual([{ key: KEY, value_text: JSON.stringify({ electrical: 'New electrical text' }) }, { onConflict: 'key' }])
    expect(getStripeInvoiceFooterPresetPlumbing()).toBe(STRIPE_INVOICE_FOOTER_PRESET_PLUMBING)
    expect(getStripeInvoiceFooterPresetElectrical()).toBe('New electrical text')
    expect(stripeInvoiceFooterActivePreset('New electrical text')).toBe('electrical')
    expect(JSON.parse(store.get(LS)!)).toEqual({ electrical: 'New electrical text' })
  })
  it('saving both fields as shipped deletes the org row and the mirror', async () => {
    store.set(LS, JSON.stringify({ plumbing: 'old' }))
    await saveStripeInvoiceFooterPresetsFromForm(STRIPE_INVOICE_FOOTER_PRESET_PLUMBING, STRIPE_INVOICE_FOOTER_PRESET_ELECTRICAL)
    expect(calls.map(write)).toEqual(['app_settings:delete'])
    expect(argOf(calls[0]!, 'eq')).toEqual(['key', KEY])
    expect(store.has(LS)).toBe(false)
    expect(readStripeInvoiceFooterPresetsFromStorage()).toEqual({})
  })
  it('a draft over the cap is truncated before it is stored', async () => {
    await saveStripeInvoiceFooterPresetsFromForm('p'.repeat(6000), STRIPE_INVOICE_FOOTER_PRESET_ELECTRICAL)
    expect(getStripeInvoiceFooterPresetPlumbing()).toHaveLength(5000)
  })
  it('a failed upsert propagates and leaves the pin untouched', async () => {
    handler = () => ({ data: null, error: { message: 'rls' } })
    await expect(saveStripeInvoiceFooterPresetsFromForm('x', STRIPE_INVOICE_FOOTER_PRESET_ELECTRICAL)).rejects.toThrow('rls')
    expect(getStripeInvoiceFooterPresetPlumbing()).toBe(STRIPE_INVOICE_FOOTER_PRESET_PLUMBING)
  })
  it('upsertStripeInvoiceFooterPresetsToAppSettings with an empty layer deletes instead', async () => {
    await upsertStripeInvoiceFooterPresetsToAppSettings({})
    expect(calls.map(write)).toEqual(['app_settings:delete'])
  })
})

describe('resetStripeInvoiceFooterPresetsToBuiltins', () => {
  it('drops the session pin, the mirror and the org row, and swallows a delete failure', async () => {
    await saveStripeInvoiceFooterPresetsFromForm('custom', STRIPE_INVOICE_FOOTER_PRESET_ELECTRICAL)
    calls.length = 0
    handler = () => ({ data: null, error: { message: 'rls' } })
    await expect(resetStripeInvoiceFooterPresetsToBuiltins()).resolves.toBeUndefined()
    expect(calls.map(write)).toEqual(['app_settings:delete'])
    expect(store.has(LS)).toBe(false)
    expect(getStripeInvoiceFooterPresetPlumbing()).toBe(STRIPE_INVOICE_FOOTER_PRESET_PLUMBING)
  })
})
