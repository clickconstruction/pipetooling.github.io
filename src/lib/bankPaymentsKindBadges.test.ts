import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Kind badges for Jobs → Bank payments (nickname + colour per Mercury kind):
 * the colour normaliser, the stored-JSON parser, the localStorage cache, the
 * app_settings read and write, pruning to the kinds Mercury actually has, and
 * the text-on-background contrast pick.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: () => { data: unknown; error: { message: string } | null } = () => ({ data: null, error: null })
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(route())
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
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))
const store = new Map<string, string>()
;(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  },
}
const LS_KEY = 'bank_payments_kind_badges_v1'

import { formatMercuryKind } from './mercuryKindLabels'
import {
  defaultKindBadgeColor,
  fetchBankPaymentsKindBadgesFromAppSettings,
  loadBankPaymentsKindBadges,
  mercuryKindPaymentTypeLabel,
  normalizeHexColor,
  parseBankPaymentsKindBadgesObject,
  pickTextOnBackground,
  pruneKindBadgesToChoices,
  saveBankPaymentsKindBadges,
  upsertBankPaymentsKindBadgesToAppSettings,
} from './bankPaymentsKindBadges'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)

beforeEach(() => {
  queries.length = 0
  store.clear()
  route = () => ({ data: null, error: null })
})

describe('colours', () => {
  it('normalizeHexColor accepts #rrggbb and #rgb (expanded), lowercases, trims, and rejects the rest', () => {
    expect(normalizeHexColor(' #AABBCC ')).toBe('#aabbcc')
    expect(normalizeHexColor('#Abc')).toBe('#aabbcc')
    expect(normalizeHexColor('aabbcc')).toBeNull()
    expect(normalizeHexColor('#aabbc')).toBeNull()
    expect(normalizeHexColor('#gggggg')).toBeNull()
    expect(normalizeHexColor('')).toBeNull()
  })
  it('pickTextOnBackground goes dark on light backgrounds, white on dark ones, and dark on junk', () => {
    expect(pickTextOnBackground('#ffffff')).toBe('#111827')
    expect(pickTextOnBackground(defaultKindBadgeColor())).toBe('#111827')
    expect(pickTextOnBackground('#000000')).toBe('#ffffff')
    expect(pickTextOnBackground('#1d4ed8')).toBe('#ffffff')
    expect(pickTextOnBackground('#fde047')).toBe('#111827')
    expect(pickTextOnBackground('not a colour')).toBe('#111827')
  })
})

describe('parseBankPaymentsKindBadgesObject', () => {
  it('keeps entries with a valid kind key and colour, trims nicknames, defaults a blank colour, drops invalid colours and keys', () => {
    expect(
      parseBankPaymentsKindBadgesObject({
        debitCardTransaction: { nickname: '  Card ', color: '#ABC' },
        ach: { nickname: 'ACH', color: '' },
        wire: { color: 'blue' }, // invalid colour: dropped
        check: 'not an object',
        '': { nickname: 'blank key', color: '#000000' },
        ['k'.repeat(121)]: { nickname: 'too long', color: '#000000' },
      }),
    ).toEqual({
      debitCardTransaction: { nickname: 'Card', color: '#aabbcc' },
      ach: { nickname: 'ACH', color: defaultKindBadgeColor() },
    })
    expect(parseBankPaymentsKindBadgesObject(null)).toEqual({})
    expect(parseBankPaymentsKindBadgesObject('x')).toEqual({})
  })
})

describe('labels and pruning', () => {
  it('the payment-type label is the nickname when set, else the formatted kind', () => {
    const badges = { ach: { nickname: ' Bank transfer ', color: '#aabbcc' }, wire: { nickname: '', color: '#aabbcc' } }
    expect(mercuryKindPaymentTypeLabel('ach', badges)).toBe('Bank transfer')
    expect(mercuryKindPaymentTypeLabel('wire', badges)).toBe(formatMercuryKind('wire'))
    expect(mercuryKindPaymentTypeLabel('debitCardTransaction', badges)).toBe(formatMercuryKind('debitCardTransaction'))
  })
  it('pruning keeps only the kinds Mercury actually offers', () => {
    const badges = { ach: { nickname: 'A', color: '#aabbcc' }, wire: { nickname: 'W', color: '#aabbcc' } }
    expect(pruneKindBadgesToChoices(badges, ['wire', 'check'])).toEqual({ wire: { nickname: 'W', color: '#aabbcc' } })
    expect(pruneKindBadgesToChoices(badges, [])).toEqual({})
  })
})

describe('local cache', () => {
  it('round-trips through localStorage, validating on the way back in, and ignores junk', () => {
    expect(loadBankPaymentsKindBadges()).toEqual({})
    saveBankPaymentsKindBadges({ ach: { nickname: 'ACH', color: '#aabbcc' } })
    expect(JSON.parse(store.get(LS_KEY)!)).toEqual({ ach: { nickname: 'ACH', color: '#aabbcc' } })
    expect(loadBankPaymentsKindBadges()).toEqual({ ach: { nickname: 'ACH', color: '#aabbcc' } })
    store.set(LS_KEY, JSON.stringify({ ach: { nickname: 'ACH', color: 'nope' } }))
    expect(loadBankPaymentsKindBadges()).toEqual({})
    store.set(LS_KEY, '{oops')
    expect(loadBankPaymentsKindBadges()).toEqual({})
  })
})

describe('app_settings', () => {
  it('reads the org row by key and says whether it exists, parsing or blanking its text', async () => {
    route = () => ({ data: { value_text: JSON.stringify({ ach: { nickname: 'ACH', color: '#abc' } }) }, error: null })
    expect(await fetchBankPaymentsKindBadgesFromAppSettings()).toEqual({ badges: { ach: { nickname: 'ACH', color: '#aabbcc' } }, rowExists: true })
    expect(queries[0]!.table).toBe('app_settings')
    expect(argsOf(queries[0]!.steps, 'eq')).toEqual([['key', 'bank_payments_kind_badges_v1']])
    expect(queries[0]!.steps.some((s) => s.method === 'maybeSingle')).toBe(true)

    route = () => ({ data: { value_text: '   ' }, error: null })
    expect(await fetchBankPaymentsKindBadgesFromAppSettings()).toEqual({ badges: {}, rowExists: true })
    route = () => ({ data: { value_text: '{oops' }, error: null })
    expect(await fetchBankPaymentsKindBadgesFromAppSettings()).toEqual({ badges: {}, rowExists: true })
    route = () => ({ data: null, error: null })
    expect(await fetchBankPaymentsKindBadgesFromAppSettings()).toEqual({ badges: {}, rowExists: false })
    route = () => ({ data: null, error: { message: 'rls' } })
    expect(await fetchBankPaymentsKindBadgesFromAppSettings()).toEqual({ badges: {}, rowExists: false })
  })
  it('upserts the whole map as JSON under the key; a failure throws', async () => {
    await upsertBankPaymentsKindBadgesToAppSettings({ ach: { nickname: 'ACH', color: '#aabbcc' } })
    expect(argsOf(queries[0]!.steps, 'upsert')).toEqual([[{ key: 'bank_payments_kind_badges_v1', value_text: '{"ach":{"nickname":"ACH","color":"#aabbcc"}}' }, { onConflict: 'key' }]])
    route = () => ({ data: null, error: { message: 'read only' } })
    await expect(upsertBankPaymentsKindBadgesToAppSettings({})).rejects.toThrow('read only')
  })
})
