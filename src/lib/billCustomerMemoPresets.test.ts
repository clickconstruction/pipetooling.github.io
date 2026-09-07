import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Bill Customer memo presets: two shipped built-ins (Standard / Alternate, empty
 * until customised), up to 20 dev-added presets and a default-on-open, stored once
 * per org in app_settings and mirrored to localStorage for the session. The tests
 * drive the public surface and pin the stored JSON shape, the caps, and the
 * migration of a device-only mirror up to app_settings.
 */
type Step = { method: string; args: unknown[] }
type Result = { data: unknown; error: { message: string } | null }
const calls: Array<{ table: string; steps: Step[] }> = []
const results: Result[] = []
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      calls.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: Result) => void) => resolve(results.shift() ?? { data: null, error: null })
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<Result>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))

// A Map-backed localStorage on a bare `window` — the module only touches these three calls.
const store = new Map<string, string>()
;(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  },
}
const LS_KEY = 'pipetooling-bill-customer-memo-presets'
const SETTINGS_KEY = 'bill_customer_memo_presets_v1'

import {
  BILL_CUSTOMER_MEMO_CUSTOM_PRESET_MAX,
  BILL_CUSTOMER_MEMO_MAX_CHARS,
  billCustomerMemoActivePresetId,
  billCustomerMemoSummaryLine,
  fetchBillCustomerMemoPresetsFromAppSettings,
  getBillCustomerMemoDefaultOnOpen,
  getBillCustomerMemoSettingsDraft,
  listBillCustomerMemoPresets,
  parseBillCustomerMemoStoredJson,
  resetBillCustomerMemoPresetsToBuiltins,
  saveBillCustomerMemoPresetsState,
} from './billCustomerMemoPresets'

const last = () => calls[calls.length - 1]!
const step = (m: string) => last().steps.find((s) => s.method === m)

beforeEach(() => {
  calls.length = 0
  results.length = 0
  store.clear()
})
afterEach(async () => {
  await resetBillCustomerMemoPresetsToBuiltins() // clears the module's session cache
})

describe('parseBillCustomerMemoStoredJson', () => {
  it('yields empty storage for anything that is not a v2 object', () => {
    const empty = { builtinOverrides: {}, builtinLabelOverrides: {}, customPresets: [], defaultPresetId: null }
    expect(parseBillCustomerMemoStoredJson(null)).toEqual(empty)
    expect(parseBillCustomerMemoStoredJson('{"v":2}')).toEqual(empty)
    expect(parseBillCustomerMemoStoredJson([])).toEqual(empty)
    expect(parseBillCustomerMemoStoredJson({ v: 1, builtinOverrides: { standard: 'old' } })).toEqual(empty)
    expect(parseBillCustomerMemoStoredJson({ v: 2 })).toEqual(empty)
  })
  it('normalises bodies like the invoice footer (HTML stripped, NFKC, trimmed) and caps them at the memo limit', () => {
    const n = parseBillCustomerMemoStoredJson({
      v: 2,
      builtinOverrides: { standard: '<p>Thank you</p><p>Pay by check</p>', alternate: `  ${'x'.repeat(BILL_CUSTOMER_MEMO_MAX_CHARS + 10)}  `, other: 'ignored' },
    })
    expect(n.builtinOverrides.standard).toBe('Thank you\nPay by check')
    expect(n.builtinOverrides.alternate).toHaveLength(BILL_CUSTOMER_MEMO_MAX_CHARS)
    expect(Object.keys(n.builtinOverrides)).toEqual(['standard', 'alternate'])
  })
  it('keeps label overrides trimmed and capped at 200, dropping blank ones', () => {
    const n = parseBillCustomerMemoStoredJson({ v: 2, builtinLabelOverrides: { standard: '  Net 15  ', alternate: '   ' } })
    expect(n.builtinLabelOverrides).toEqual({ standard: 'Net 15' })
    expect(parseBillCustomerMemoStoredJson({ v: 2, builtinLabelOverrides: { standard: 'L'.repeat(250) } }).builtinLabelOverrides.standard).toHaveLength(200)
    expect(parseBillCustomerMemoStoredJson({ v: 2, builtinLabelOverrides: ['x'] }).builtinLabelOverrides).toEqual({})
  })
  it('keeps only well-formed custom presets, at most twenty, and maps a "standard" default to null', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: `c${i}`, label: ` Preset ${i} `, body: `Body ${i}` }))
    const n = parseBillCustomerMemoStoredJson({
      v: 2,
      customPresets: [null, 'junk', { id: 'x', label: 'no body' }, { id: 1, label: 'a', body: 'b' }, ...many],
      defaultPresetId: ' c3 ',
    })
    expect(n.customPresets).toHaveLength(BILL_CUSTOMER_MEMO_CUSTOM_PRESET_MAX)
    expect(n.customPresets[0]).toEqual({ id: 'c0', label: 'Preset 0', body: 'Body 0' })
    expect(n.defaultPresetId).toBe('c3')
    expect(parseBillCustomerMemoStoredJson({ v: 2, defaultPresetId: 'standard' }).defaultPresetId).toBeNull()
    expect(parseBillCustomerMemoStoredJson({ v: 2, defaultPresetId: '   ' }).defaultPresetId).toBeNull()
    expect(parseBillCustomerMemoStoredJson({ v: 2, customPresets: 'nope' }).customPresets).toEqual([])
  })
})

describe('reading presets from the local mirror', () => {
  it('with nothing stored, offers the two shipped built-ins with empty bodies and Standard on open', () => {
    expect(listBillCustomerMemoPresets()).toEqual([
      { id: 'standard', label: 'Standard', body: '' },
      { id: 'alternate', label: 'Alternate', body: '' },
    ])
    expect(getBillCustomerMemoDefaultOnOpen()).toBe('')
    expect(getBillCustomerMemoSettingsDraft()).toEqual({
      standardBody: '',
      alternateBody: '',
      standardLabel: 'Standard',
      alternateLabel: 'Alternate',
      customPresets: [],
      defaultPresetId: 'standard',
    })
  })
  it('applies label and body overrides, appends custom presets ("Untitled" when unlabeled), and opens on the chosen default', () => {
    store.set(
      LS_KEY,
      JSON.stringify({
        v: 2,
        builtinOverrides: { standard: 'Thanks!' },
        builtinLabelOverrides: { alternate: 'Net 30' },
        customPresets: [
          { id: 'c1', label: '', body: 'Custom one' },
          { id: 'c2', label: 'Two', body: 'Custom two' },
        ],
        defaultPresetId: 'c2',
      }),
    )
    expect(listBillCustomerMemoPresets()).toEqual([
      { id: 'standard', label: 'Standard', body: 'Thanks!' },
      { id: 'alternate', label: 'Net 30', body: '' },
      { id: 'c1', label: 'Untitled', body: 'Custom one' },
      { id: 'c2', label: 'Two', body: 'Custom two' },
    ])
    expect(getBillCustomerMemoDefaultOnOpen()).toBe('Custom two')
    expect(getBillCustomerMemoSettingsDraft().defaultPresetId).toBe('c2')
  })
  it('a default pointing at a preset that no longer exists falls back to Standard', () => {
    store.set(LS_KEY, JSON.stringify({ v: 2, builtinOverrides: { standard: 'Std body' }, defaultPresetId: 'gone' }))
    expect(getBillCustomerMemoDefaultOnOpen()).toBe('Std body')
    expect(getBillCustomerMemoSettingsDraft().defaultPresetId).toBe('standard')
  })
  it('ignores a corrupt or pre-v2 mirror', () => {
    store.set(LS_KEY, '{not json')
    expect(listBillCustomerMemoPresets()).toHaveLength(2)
    store.set(LS_KEY, JSON.stringify({ v: 1, builtinOverrides: { standard: 'old' } }))
    expect(listBillCustomerMemoPresets()[0]!.body).toBe('')
  })
})

describe('which preset a memo is', () => {
  beforeEach(() => {
    store.set(LS_KEY, JSON.stringify({ v: 2, builtinOverrides: { standard: 'Thank you\nPay by check' }, customPresets: [{ id: 'c1', label: 'Rush', body: 'Due on receipt' }] }))
  })
  it('matches after the same normalisation the presets get, and names the label; anything else is Custom; blank is None', () => {
    expect(billCustomerMemoActivePresetId('Thank you\r\nPay by check  ')).toBe('standard')
    expect(billCustomerMemoActivePresetId('<p>Due on receipt</p>')).toBe('c1')
    expect(billCustomerMemoActivePresetId('Something else')).toBeNull()
    expect(billCustomerMemoSummaryLine('Thank you\nPay by check')).toBe('Standard')
    expect(billCustomerMemoSummaryLine('Due on receipt')).toBe('Rush')
    expect(billCustomerMemoSummaryLine('Something else')).toBe('Custom')
    expect(billCustomerMemoSummaryLine('   ')).toBe('None')
  })
})

describe('fetchBillCustomerMemoPresetsFromAppSettings', () => {
  it('reads the org row by key, caches it for the session, and mirrors the sparse shape locally', async () => {
    results.push({ data: { value_text: JSON.stringify({ v: 2, builtinOverrides: { standard: 'Org body' }, defaultPresetId: 'standard' }) }, error: null })
    expect(await fetchBillCustomerMemoPresetsFromAppSettings({ authRole: 'assistant' })).toEqual({ rowExists: true })
    expect(last().table).toBe('app_settings')
    expect(step('eq')?.args).toEqual(['key', SETTINGS_KEY])
    expect(step('maybeSingle')).toBeTruthy()
    expect(listBillCustomerMemoPresets()[0]!.body).toBe('Org body')
    expect(JSON.parse(store.get(LS_KEY)!)).toEqual({ v: 2, builtinOverrides: { standard: 'Org body' } }) // sparse: a standard default is not stored
    expect(calls).toHaveLength(1)
  })
  it('a row with blank or unparsable text, or a pre-v2 shape, resets to the built-ins and clears the mirror', async () => {
    store.set(LS_KEY, JSON.stringify({ v: 2, builtinOverrides: { standard: 'device only' } }))
    results.push({ data: { value_text: '   ' }, error: null })
    expect(await fetchBillCustomerMemoPresetsFromAppSettings()).toEqual({ rowExists: true })
    expect(listBillCustomerMemoPresets()[0]!.body).toBe('')
    expect(store.has(LS_KEY)).toBe(false)

    results.push({ data: { value_text: '{oops' }, error: null })
    await fetchBillCustomerMemoPresetsFromAppSettings()
    expect(listBillCustomerMemoPresets()[0]!.body).toBe('')

    results.push({ data: { value_text: JSON.stringify({ v: 1, builtinOverrides: { standard: 'old' } }) }, error: null })
    await fetchBillCustomerMemoPresetsFromAppSettings()
    expect(listBillCustomerMemoPresets()[0]!.body).toBe('')
  })
  it('with no org row, a dev signed in migrates a device-only mirror up to app_settings; other roles only read it', async () => {
    store.set(LS_KEY, JSON.stringify({ v: 2, customPresets: [{ id: 'c1', label: 'Rush', body: 'Due on receipt' }] }))
    results.push({ data: null, error: null })
    expect(await fetchBillCustomerMemoPresetsFromAppSettings({ authRole: 'controller' })).toEqual({ rowExists: false })
    expect(calls).toHaveLength(1)
    expect(listBillCustomerMemoPresets().map((p) => p.id)).toEqual(['standard', 'alternate', 'c1'])

    calls.length = 0
    results.push({ data: null, error: null })
    expect(await fetchBillCustomerMemoPresetsFromAppSettings({ authRole: 'dev' })).toEqual({ rowExists: false })
    expect(calls.map((c) => c.table)).toEqual(['app_settings', 'app_settings'])
    const upsert = step('upsert')!
    expect(upsert.args[1]).toEqual({ onConflict: 'key' })
    expect(upsert.args[0]).toEqual({ key: SETTINGS_KEY, value_text: JSON.stringify({ v: 2, customPresets: [{ id: 'c1', label: 'Rush', body: 'Due on receipt' }] }) })
  })
  it('with no org row and nothing on the device, a dev does not write an empty row', async () => {
    results.push({ data: null, error: null })
    await fetchBillCustomerMemoPresetsFromAppSettings({ authRole: 'dev' })
    expect(calls).toHaveLength(1)
  })
  it('a read failure leaves the session untouched and reports no row', async () => {
    store.set(LS_KEY, JSON.stringify({ v: 2, builtinOverrides: { standard: 'device only' } }))
    results.push({ data: null, error: { message: 'rls' } })
    expect(await fetchBillCustomerMemoPresetsFromAppSettings({ authRole: 'dev' })).toEqual({ rowExists: false })
    expect(calls).toHaveLength(1)
    expect(listBillCustomerMemoPresets()[0]!.body).toBe('device only') // still read from the mirror
  })
})

describe('saveBillCustomerMemoPresetsState', () => {
  const draft = {
    standardBody: '',
    alternateBody: '',
    standardLabel: 'Standard',
    alternateLabel: 'Alternate',
    customPresets: [] as Array<{ id: string; label: string; body: string }>,
    defaultPresetId: 'standard',
  }
  it('stores only what differs from the shipped defaults, and deletes the row when nothing does', async () => {
    await saveBillCustomerMemoPresetsState({ ...draft, standardLabel: '  Standard ', alternateLabel: '' })
    expect(step('delete')).toBeTruthy()
    expect(step('eq')?.args).toEqual(['key', SETTINGS_KEY])
    expect(store.has(LS_KEY)).toBe(false)
    expect(listBillCustomerMemoPresets()[1]!.label).toBe('Alternate') // a blank label falls back to the shipped one
  })
  it('upserts the sparse v2 JSON, drops custom presets with a blank label or body, caps at twenty, and repairs a dangling default', async () => {
    const many = Array.from({ length: 22 }, (_, i) => ({ id: `c${i}`, label: `P${i}`, body: `B${i}` }))
    await saveBillCustomerMemoPresetsState({
      ...draft,
      standardBody: '<p>Thanks</p>',
      alternateLabel: 'Net 30',
      customPresets: [{ id: 'blank', label: '', body: 'x' }, { id: 'empty', label: 'E', body: '  ' }, ...many],
      defaultPresetId: 'c21', // cut by the cap → back to standard
    })
    const upsert = step('upsert')!
    const stored = JSON.parse((upsert.args[0] as { value_text: string }).value_text)
    expect(stored.v).toBe(2)
    expect(stored.builtinOverrides).toEqual({ standard: 'Thanks' })
    expect(stored.builtinLabelOverrides).toEqual({ alternate: 'Net 30' })
    expect(stored.customPresets).toHaveLength(BILL_CUSTOMER_MEMO_CUSTOM_PRESET_MAX)
    expect(stored.customPresets[0]).toEqual({ id: 'c0', label: 'P0', body: 'B0' })
    expect(stored.defaultPresetId).toBeUndefined()
    expect(JSON.parse(store.get(LS_KEY)!)).toEqual(stored) // the mirror is the same sparse shape
    expect(getBillCustomerMemoDefaultOnOpen()).toBe('Thanks')
    expect(listBillCustomerMemoPresets()).toHaveLength(2 + BILL_CUSTOMER_MEMO_CUSTOM_PRESET_MAX)
  })
  it('a chosen custom default is stored and opens by default', async () => {
    await saveBillCustomerMemoPresetsState({ ...draft, customPresets: [{ id: 'c1', label: 'Rush', body: 'Due on receipt' }], defaultPresetId: 'c1' })
    const stored = JSON.parse((step('upsert')!.args[0] as { value_text: string }).value_text)
    expect(stored.defaultPresetId).toBe('c1')
    expect(getBillCustomerMemoDefaultOnOpen()).toBe('Due on receipt')
  })
  it('a failed write surfaces to the caller and leaves the session on the old presets', async () => {
    results.push({ data: null, error: { message: 'read only' } })
    await expect(saveBillCustomerMemoPresetsState({ ...draft, standardBody: 'New' })).rejects.toThrow('read only')
    expect(listBillCustomerMemoPresets()[0]!.body).toBe('')
    expect(store.has(LS_KEY)).toBe(false)
  })
})

describe('resetBillCustomerMemoPresetsToBuiltins', () => {
  it('forgets the session, clears the mirror, deletes the org row, and swallows a delete failure', async () => {
    await saveBillCustomerMemoPresetsState({ standardBody: 'X', alternateBody: '', standardLabel: 'Standard', alternateLabel: 'Alternate', customPresets: [], defaultPresetId: 'standard' })
    calls.length = 0
    results.push({ data: null, error: { message: 'rls' } })
    await expect(resetBillCustomerMemoPresetsToBuiltins()).resolves.toBeUndefined()
    expect(step('delete')).toBeTruthy()
    expect(store.has(LS_KEY)).toBe(false)
    expect(listBillCustomerMemoPresets()[0]!.body).toBe('')
  })
})
