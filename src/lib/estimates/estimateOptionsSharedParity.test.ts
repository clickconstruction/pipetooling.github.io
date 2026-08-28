/**
 * The edge functions freeze acceptances with the _shared kernel; the app builds options with
 * the client kernel. This parity suite is what keeps the two saying the same thing.
 */
import { describe, it, expect } from 'vitest'
import {
  freezeSharedAcceptedOption,
  normalizeSharedEstimateOptions,
  MAX_ESTIMATE_OPTIONS as SHARED_MAX,
} from '../../../supabase/functions/_shared/estimateOptions'
import {
  MAX_ESTIMATE_OPTIONS,
  freezeAcceptedEstimateOption,
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
