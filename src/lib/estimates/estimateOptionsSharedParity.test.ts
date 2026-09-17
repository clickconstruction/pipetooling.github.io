/**
 * The edge functions freeze acceptances with the _shared kernel; the app builds options with
 * the client kernel. This parity suite is what keeps the two saying the same thing.
 */
import { describe, it, expect } from 'vitest'
import {
  describeSharedEstimateSelection,
  freezeSharedAcceptedOption,
  freezeSharedAcceptedOptions,
  isValidSharedEstimateSelection,
  normalizeSharedEstimateOptions,
  sharedEstimateSelectionProblemMessage,
  MAX_ESTIMATE_OPTIONS as SHARED_MAX,
} from '../../../supabase/functions/_shared/estimateOptions'
import {
  MAX_ESTIMATE_OPTIONS,
  describeEstimateSelection,
  estimateSelectionProblemMessage,
  freezeAcceptedEstimateOption,
  freezeAcceptedEstimateOptions,
  isValidEstimateSelection,
  normalizeEstimateOptionsFromJson,
} from './estimateOptions'

const rawOptions = [
  { name: 'no key — dropped', line_items: [] },
  {
    key: 'repair',
    name: 'Repair',
    description: 'valve + anode',
    line_items: [{ line_item: '', description: 'Gas valve & anode', quantity: 1, unit_price_cents: 185000, amount_cents: 185000 }],
  },
  {
    key: 'replace',
    name: 'Replace 50-gal',
    description: '',
    recommended: true,
    line_items: [
      { line_item: '', description: 'Heater', quantity: 1, unit_price_cents: 165000, amount_cents: 165000 },
      { line_item: '', description: 'Labor', quantity: 1, unit_price_cents: 175000, amount_cents: 175000 },
    ],
  },
  { key: 'repair', name: 'dupe — dropped', line_items: [] },
]

// v2.3554: a mixed estimate (two choices, two add-ons) and an all-add-on one, with the star
// written where the builder would never put it, so the star rule is exercised on both sides.
const rawMixed = [
  ...rawOptions,
  {
    key: 'soft',
    name: 'Water softener',
    description: '',
    kind: 'add_on',
    recommended: true,
    line_items: [{ line_item: '', description: 'Softener', quantity: 1, unit_price_cents: 195000, amount_cents: 195000 }],
  },
  {
    key: 'bibs',
    name: 'Hose bibs (2)',
    description: '',
    kind: 'add_on',
    line_items: [{ line_item: '', description: 'Sillcocks', quantity: 2, unit_price_cents: 19500, amount_cents: 39000 }],
  },
]
const rawAllAddOns = [
  { key: 'kitchen', name: 'Kitchen rough-in', kind: 'add_on', line_items: [{ line_item: '', description: 'Kitchen', quantity: 1, unit_price_cents: 420000, amount_cents: 420000 }] },
  { key: 'bath', name: 'Hall bath', kind: 'add_on', recommended: true, line_items: [{ line_item: '', description: 'Bath', quantity: 1, unit_price_cents: 365000, amount_cents: 365000 }] },
]

describe('shared/client kernel parity', () => {
  it('same cap', () => {
    expect(SHARED_MAX).toBe(MAX_ESTIMATE_OPTIONS)
  })

  it('normalize agrees on well-formed builder output (keys, order, recommended, lines)', () => {
    const client = normalizeEstimateOptionsFromJson(rawOptions)
    const shared = normalizeSharedEstimateOptions(rawOptions)
    expect(shared).toEqual(client)
  })

  it('freeze agrees on the accepted write', () => {
    const client = freezeAcceptedEstimateOption(normalizeEstimateOptionsFromJson(rawOptions), 'replace')
    const shared = freezeSharedAcceptedOption(normalizeSharedEstimateOptions(rawOptions), 'replace')
    expect(shared).toEqual(client)
    expect(shared?.total_cents).toBe(340000)
  })

  it('both refuse an unknown key', () => {
    expect(freezeSharedAcceptedOption(normalizeSharedEstimateOptions(rawOptions), 'zzz')).toBeNull()
    expect(freezeAcceptedEstimateOption(normalizeEstimateOptionsFromJson(rawOptions), 'zzz')).toBeNull()
  })
})

describe('shared/client kernel parity — add-ons (v2.3554)', () => {
  it('normalize agrees on kind and on where the star lands', () => {
    for (const raw of [rawMixed, rawAllAddOns]) {
      const client = normalizeEstimateOptionsFromJson(raw)
      const shared = normalizeSharedEstimateOptions(raw)
      expect(shared).toEqual(client)
    }
    const mixed = normalizeSharedEstimateOptions(rawMixed)
    expect(mixed.map((o) => o.kind)).toEqual(['choice', 'choice', 'add_on', 'add_on'])
    // two stars written (replace, then the softener): the first marked wins, and it is a choice
    expect(mixed.find((o) => o.recommended)?.key).toBe('replace')
    // a star only on an add-on moves to the first choice
    expect(normalizeSharedEstimateOptions([rawOptions[1], { ...rawMixed[4], recommended: true }]).find((o) => o.recommended)?.key).toBe('repair')
    expect(normalizeSharedEstimateOptions(rawAllAddOns).find((o) => o.recommended)?.key).toBe('bath')
  })

  it('validity and the refusal words agree', () => {
    const cases: Array<[unknown, string[]]> = [
      [rawMixed, ['replace', 'soft', 'bibs']],
      [rawMixed, ['soft']],
      [rawMixed, ['repair', 'replace']],
      [rawMixed, []],
      [rawMixed, ['replace', 'zzz']],
      [rawAllAddOns, ['bath']],
      [rawAllAddOns, ['kitchen', 'bath']],
      [rawAllAddOns, []],
    ]
    for (const [raw, keys] of cases) {
      const client = isValidEstimateSelection(normalizeEstimateOptionsFromJson(raw), keys)
      const shared = isValidSharedEstimateSelection(normalizeSharedEstimateOptions(raw), keys)
      expect(shared).toEqual(client)
      if (!client.ok && !shared.ok) {
        expect(sharedEstimateSelectionProblemMessage(normalizeSharedEstimateOptions(raw), shared.reason)).toBe(
          estimateSelectionProblemMessage(normalizeEstimateOptionsFromJson(raw), client.reason),
        )
      }
    }
  })

  it('the multi-option freeze agrees byte for byte, and the lone-choice case equals the single-key freeze', () => {
    const client = freezeAcceptedEstimateOptions(normalizeEstimateOptionsFromJson(rawMixed), ['bibs', 'replace', 'soft'])
    const shared = freezeSharedAcceptedOptions(normalizeSharedEstimateOptions(rawMixed), ['bibs', 'replace', 'soft'])
    expect(shared).toEqual(client)
    expect(shared?.accepted_option_keys).toEqual(['replace', 'soft', 'bibs'])
    expect(shared?.accepted_option_key).toBe('replace')
    expect(shared?.total_cents).toBe(340000 + 195000 + 39000)

    const lone = freezeSharedAcceptedOptions(normalizeSharedEstimateOptions(rawMixed), ['replace'])
    const single = freezeSharedAcceptedOption(normalizeSharedEstimateOptions(rawMixed), 'replace')
    expect(lone?.line_items_snapshot).toEqual(single?.line_items_snapshot)
    expect(lone?.total_cents).toBe(single?.total_cents)
    expect(lone?.accepted_option_key).toBe(single?.accepted_option_key)

    const all = freezeSharedAcceptedOptions(normalizeSharedEstimateOptions(rawAllAddOns), ['bath', 'kitchen'])
    expect(all).toEqual(freezeAcceptedEstimateOptions(normalizeEstimateOptionsFromJson(rawAllAddOns), ['bath', 'kitchen']))
    expect(all?.accepted_option_key).toBeNull()
    expect(all?.accepted_option_keys).toEqual(['kitchen', 'bath'])
  })

  it('the selection words agree (the Approve button and the staff email say the same thing)', () => {
    for (const [raw, keys] of [
      [rawMixed, ['replace']],
      [rawMixed, ['replace', 'soft', 'bibs']],
      [rawAllAddOns, ['bath']],
      [rawAllAddOns, ['kitchen', 'bath']],
    ] as Array<[unknown, string[]]>) {
      const client = describeEstimateSelection(normalizeEstimateOptionsFromJson(raw), keys)
      const shared = describeSharedEstimateSelection(normalizeSharedEstimateOptions(raw), keys)
      expect(shared).toEqual(client)
    }
    expect(describeSharedEstimateSelection(normalizeSharedEstimateOptions(rawMixed), ['replace', 'soft', 'bibs']).label).toBe('"Replace 50-gal" + 2 add-ons')
  })
})
