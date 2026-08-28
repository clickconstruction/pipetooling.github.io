import { describe, it, expect } from 'vitest'
import {
  MAX_ESTIMATE_OPTIONS,
  estimateOptionTotalCents,
  estimateOptionsDraftPersistFields,
  freezeAcceptedEstimateOption,
  normalizeEstimateOptionsFromJson,
  recommendedEstimateOption,
  setRecommendedEstimateOption,
  type EstimateOption,
} from './estimateOptions'

const line = (description: string, amount_cents: number) => ({
  line_item: '',
  description,
  quantity: 1,
  unit_price_cents: amount_cents,
  amount_cents,
})

const opt = (key: string, name: string, cents: number, recommended = false): EstimateOption => ({
  key,
  name,
  description: '',
  recommended,
  line_items: [line(name, cents)],
})

describe('normalizeEstimateOptionsFromJson', () => {
  it('null / absent / junk mean a single-option estimate', () => {
    expect(normalizeEstimateOptionsFromJson(null)).toEqual([])
    expect(normalizeEstimateOptionsFromJson(undefined)).toEqual([])
    expect(normalizeEstimateOptionsFromJson('nope')).toEqual([])
    expect(normalizeEstimateOptionsFromJson({})).toEqual([])
  })

  it('drops unkeyed and duplicate-keyed entries — the key is what acceptance records', () => {
    const out = normalizeEstimateOptionsFromJson([
      { name: 'no key', line_items: [] },
      { key: 'a', name: 'Repair', line_items: [] },
      { key: 'a', name: 'dupe of a', line_items: [] },
      { key: '  ', name: 'blank key', line_items: [] },
    ])
    expect(out.map((o) => o.name)).toEqual(['Repair'])
  })

  it('normalizes option line items through the shared line normalizer (legacy shapes included)', () => {
    const out = normalizeEstimateOptionsFromJson([
      { key: 'a', name: 'Repair', line_items: [{ description: 'valve', amount_cents: 78000 }] },
    ])
    expect(out[0]?.line_items).toEqual([
      { line_item: '', description: 'valve', quantity: 1, unit_price_cents: 78000, amount_cents: 78000 },
    ])
  })

  it('exactly one recommended: first marked wins; none marked falls to the first', () => {
    const marked = normalizeEstimateOptionsFromJson([
      { key: 'a', recommended: false, line_items: [] },
      { key: 'b', recommended: true, line_items: [] },
      { key: 'c', recommended: true, line_items: [] },
    ])
    expect(marked.map((o) => o.recommended)).toEqual([false, true, false])
    const none = normalizeEstimateOptionsFromJson([
      { key: 'a', line_items: [] },
      { key: 'b', line_items: [] },
    ])
    expect(none.map((o) => o.recommended)).toEqual([true, false])
  })

  it('caps at MAX_ESTIMATE_OPTIONS', () => {
    const out = normalizeEstimateOptionsFromJson(
      Array.from({ length: 9 }, (_, i) => ({ key: `k${i}`, line_items: [] })),
    )
    expect(out).toHaveLength(MAX_ESTIMATE_OPTIONS)
  })
})

describe('totals and the recommended pick', () => {
  it('sums amount_cents', () => {
    expect(estimateOptionTotalCents(opt('a', 'Replace', 340000))).toBe(340000)
    expect(estimateOptionTotalCents({ line_items: [] })).toBe(0)
  })

  it('recommendedEstimateOption honors the flag, falls back to first, null when empty', () => {
    const options = [opt('a', 'Repair', 185000), opt('b', 'Replace', 340000, true)]
    expect(recommendedEstimateOption(options)?.key).toBe('b')
    expect(recommendedEstimateOption([opt('a', 'Repair', 1)])?.key).toBe('a')
    expect(recommendedEstimateOption([])).toBeNull()
  })
})

describe('freezeAcceptedEstimateOption', () => {
  const options = [opt('a', 'Repair', 185000), opt('b', 'Replace', 340000, true)]

  it('freezes the chosen option into the legacy fields', () => {
    expect(freezeAcceptedEstimateOption(options, 'a')).toEqual({
      line_items_snapshot: options[0]!.line_items,
      total_cents: 185000,
      accepted_option_key: 'a',
    })
  })

  it('an unknown key freezes nothing — the caller must refuse the acceptance', () => {
    expect(freezeAcceptedEstimateOption(options, 'zzz')).toBeNull()
    expect(freezeAcceptedEstimateOption([], 'a')).toBeNull()
  })
})

describe('estimateOptionsDraftPersistFields', () => {
  it('no options → all nulls, callers keep today\'s writes', () => {
    expect(estimateOptionsDraftPersistFields([], null, [])).toEqual({
      options_snapshot: null,
      line_items_snapshot: null,
      total_cents: null,
    })
  })

  it('folds the edited option\'s live lines in, mirrors the RECOMMENDED option to legacy fields', () => {
    const options = [opt('a', 'Repair', 185000), opt('b', 'Replace', 340000, true)]
    const edited = [line('bigger valve', 200000)]
    const out = estimateOptionsDraftPersistFields(options, 'a', edited)
    expect(out.options_snapshot?.find((o) => o.key === 'a')?.line_items).toEqual(edited)
    // Recommended (b) untouched by the edit — legacy mirror shows its number.
    expect(out.line_items_snapshot).toEqual(options[1]!.line_items)
    expect(out.total_cents).toBe(340000)
  })

  it('editing the recommended option moves the mirror with it', () => {
    const options = [opt('a', 'Repair', 185000, true)]
    const edited = [line('valve + labor', 190000)]
    const out = estimateOptionsDraftPersistFields(options, 'a', edited)
    expect(out.line_items_snapshot).toEqual(edited)
    expect(out.total_cents).toBe(190000)
  })
})

describe('setRecommendedEstimateOption', () => {
  it('moves the star; unknown key is a no-op', () => {
    const options = [opt('a', 'Repair', 1, true), opt('b', 'Replace', 2)]
    expect(setRecommendedEstimateOption(options, 'b').map((o) => o.recommended)).toEqual([false, true])
    expect(setRecommendedEstimateOption(options, 'nope')).toBe(options)
  })
})
