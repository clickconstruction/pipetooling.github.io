import { describe, it, expect } from 'vitest'
import {
  MAX_ESTIMATE_OPTIONS,
  defaultEstimateSelection,
  describeEstimateSelection,
  estimateOptionTotalCents,
  estimateOptionsDraftPersistFields,
  estimateSelectionProblemMessage,
  freezeAcceptedEstimateOption,
  freezeAcceptedEstimateOptions,
  isValidEstimateSelection,
  normalizeEstimateOptionsFromJson,
  recommendedEstimateOption,
  setEstimateOptionKind,
  setRecommendedEstimateOption,
  toggleEstimateOptionSelection,
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
  kind: 'choice',
  line_items: [line(name, cents)],
})

const addOn = (key: string, name: string, cents: number): EstimateOption => ({ ...opt(key, name, cents), kind: 'add_on' })

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

// ── Add-ons (v2.3554) ────────────────────────────────────────────────────────────────────

const mixed = () => [opt('repair', 'Repair', 185000), opt('replace', 'Replace 50-gal', 340000, true), addOn('soft', 'Water softener', 195000), addOn('bibs', 'Hose bibs (2)', 39000)]
const allAddOns = () => [addOn('kitchen', 'Kitchen rough-in', 420000), addOn('bath', 'Hall bath', 365000), addOn('laundry', 'Laundry relocation', 210000)]

describe('kind', () => {
  it('a snapshot from before add-ons reads as all choices; only the literal add_on is an add-on', () => {
    const parsed = normalizeEstimateOptionsFromJson([
      { key: 'a', name: 'A', line_items: [] },
      { key: 'b', name: 'B', kind: 'add_on', line_items: [] },
      { key: 'c', name: 'C', kind: 'bonus', line_items: [] },
    ])
    expect(parsed.map((o) => o.kind)).toEqual(['choice', 'add_on', 'choice'])
  })

  it('the star sits on a choice whenever the estimate has one; an all-add-on estimate keeps its star', () => {
    const starredAddOn = normalizeEstimateOptionsFromJson([
      { key: 'a', name: 'A', line_items: [] },
      { key: 'b', name: 'B', kind: 'add_on', recommended: true, line_items: [] },
    ])
    expect(starredAddOn.map((o) => o.recommended)).toEqual([true, false])
    const all = normalizeEstimateOptionsFromJson([
      { key: 'a', name: 'A', kind: 'add_on', line_items: [] },
      { key: 'b', name: 'B', kind: 'add_on', recommended: true, line_items: [] },
    ])
    expect(all.map((o) => o.recommended)).toEqual([false, true])
  })

  it('setEstimateOptionKind re-seats the star; setRecommended refuses an add-on while choices exist', () => {
    const moved = setEstimateOptionKind(mixed(), 'replace', 'add_on')
    expect(moved.find((o) => o.key === 'replace')?.kind).toBe('add_on')
    expect(moved.find((o) => o.recommended)?.key).toBe('repair')
    expect(setRecommendedEstimateOption(mixed(), 'soft').find((o) => o.recommended)?.key).toBe('replace')
    const all = setEstimateOptionKind(setEstimateOptionKind(mixed(), 'repair', 'add_on'), 'replace', 'add_on')
    expect(all.every((o) => o.kind === 'add_on')).toBe(true)
    expect(all.filter((o) => o.recommended)).toHaveLength(1)
    expect(setRecommendedEstimateOption(all, 'bibs').find((o) => o.recommended)?.key).toBe('bibs')
  })
})

describe('the selection', () => {
  it('starts on the ★ choice with no add-ons; an all-add-on estimate starts empty', () => {
    expect(defaultEstimateSelection(mixed())).toEqual(['replace'])
    expect(defaultEstimateSelection(allAddOns())).toEqual([])
    expect(defaultEstimateSelection([])).toEqual([])
  })

  it('a choice replaces the other choice, an add-on toggles, the result is in offered order', () => {
    let sel = defaultEstimateSelection(mixed())
    sel = toggleEstimateOptionSelection(mixed(), sel, 'bibs')
    sel = toggleEstimateOptionSelection(mixed(), sel, 'soft')
    expect(sel).toEqual(['replace', 'soft', 'bibs'])
    sel = toggleEstimateOptionSelection(mixed(), sel, 'repair')
    expect(sel).toEqual(['repair', 'soft', 'bibs'])
    sel = toggleEstimateOptionSelection(mixed(), sel, 'soft')
    expect(sel).toEqual(['repair', 'bibs'])
    expect(toggleEstimateOptionSelection(mixed(), sel, 'zzz')).toEqual(sel)
    // tapping the selected choice again keeps it (radio semantics)
    expect(toggleEstimateOptionSelection(mixed(), sel, 'repair')).toEqual(['repair', 'bibs'])
  })

  it('validity: one choice required when choices exist; at least one tick when none; unknown keys refused', () => {
    expect(isValidEstimateSelection(mixed(), ['replace'])).toEqual({ ok: true })
    expect(isValidEstimateSelection(mixed(), ['replace', 'soft', 'bibs'])).toEqual({ ok: true })
    expect(isValidEstimateSelection(mixed(), ['soft'])).toEqual({ ok: false, reason: 'option_required' })
    expect(isValidEstimateSelection(mixed(), ['repair', 'replace'])).toEqual({ ok: false, reason: 'option_required' })
    expect(isValidEstimateSelection(mixed(), [])).toEqual({ ok: false, reason: 'option_required' })
    expect(isValidEstimateSelection(mixed(), ['replace', 'zzz'])).toEqual({ ok: false, reason: 'option_unknown' })
    expect(isValidEstimateSelection(allAddOns(), ['bath'])).toEqual({ ok: true })
    expect(isValidEstimateSelection(allAddOns(), ['bath', 'kitchen'])).toEqual({ ok: true })
    expect(isValidEstimateSelection(allAddOns(), [])).toEqual({ ok: false, reason: 'option_required' })
    // a single-option estimate has no selection to validate
    expect(isValidEstimateSelection([opt('only', 'Only', 1)], [])).toEqual({ ok: true })
    expect(isValidEstimateSelection([], ['anything'])).toEqual({ ok: true })
  })

  it('the refusal words depend on whether there is anything to choose between', () => {
    expect(estimateSelectionProblemMessage(mixed(), 'option_required')).toBe('Please choose an option first.')
    expect(estimateSelectionProblemMessage(allAddOns(), 'option_required')).toBe('Please tick at least one option first.')
    expect(estimateSelectionProblemMessage(mixed(), 'option_unknown')).toBe('That option is no longer offered on this estimate.')
  })
})

describe('freezeAcceptedEstimateOptions', () => {
  it('freezes every accepted option in offered order, sums them, keeps the choice in the old key', () => {
    const f = freezeAcceptedEstimateOptions(mixed(), ['bibs', 'replace', 'soft'])
    expect(f).not.toBeNull()
    expect(f!.accepted_option_keys).toEqual(['replace', 'soft', 'bibs'])
    expect(f!.accepted_option_key).toBe('replace')
    expect(f!.total_cents).toBe(340000 + 195000 + 39000)
    expect(f!.line_items_snapshot.map((l) => l.description)).toEqual(['Replace 50-gal', 'Water softener', 'Hose bibs (2)'])
  })

  it('a lone choice freezes exactly what the single-key form freezes (a client from before add-ons)', () => {
    const many = freezeAcceptedEstimateOptions(mixed(), ['replace'])
    const one = freezeAcceptedEstimateOption(mixed(), 'replace')
    expect(many!.line_items_snapshot).toEqual(one!.line_items_snapshot)
    expect(many!.total_cents).toBe(one!.total_cents)
    expect(many!.accepted_option_key).toBe(one!.accepted_option_key)
    expect(many!.accepted_option_keys).toEqual(['replace'])
  })

  it('an all-add-on acceptance has no choice key', () => {
    const f = freezeAcceptedEstimateOptions(allAddOns(), ['laundry', 'kitchen'])
    expect(f!.accepted_option_keys).toEqual(['kitchen', 'laundry'])
    expect(f!.accepted_option_key).toBeNull()
    expect(f!.total_cents).toBe(630000)
  })

  it('an invalid selection freezes nothing — the caller must refuse the acceptance', () => {
    expect(freezeAcceptedEstimateOptions(mixed(), ['soft'])).toBeNull()
    expect(freezeAcceptedEstimateOptions(mixed(), [])).toBeNull()
    expect(freezeAcceptedEstimateOptions(allAddOns(), [])).toBeNull()
    expect(freezeAcceptedEstimateOptions(mixed(), ['replace', 'zzz'])).toBeNull()
  })
})

describe('describeEstimateSelection', () => {
  it('names the choice, counts the add-ons, sums the money', () => {
    expect(describeEstimateSelection(mixed(), ['replace']).label).toBe('"Replace 50-gal"')
    expect(describeEstimateSelection(mixed(), ['replace', 'soft']).label).toBe('"Replace 50-gal" + 1 add-on')
    const both = describeEstimateSelection(mixed(), ['replace', 'soft', 'bibs'])
    expect(both.label).toBe('"Replace 50-gal" + 2 add-ons')
    expect(both.totalCents).toBe(574000)
    expect(both.count).toBe(3)
    expect(both.choice?.key).toBe('replace')
    expect(both.addOns.map((o) => o.key)).toEqual(['soft', 'bibs'])
  })

  it('all add-ons: one is named, several are counted, none is empty', () => {
    expect(describeEstimateSelection(allAddOns(), ['bath']).label).toBe('"Hall bath"')
    expect(describeEstimateSelection(allAddOns(), ['kitchen', 'laundry', 'bath']).label).toBe('3 options')
    expect(describeEstimateSelection(allAddOns(), []).label).toBe('')
    expect(describeEstimateSelection(mixed(), []).count).toBe(0)
  })

  it('an unnamed option reads as Option', () => {
    expect(describeEstimateSelection([opt('a', '  ', 1), opt('b', 'B', 2)], ['a']).label).toBe('"Option"')
  })
})
