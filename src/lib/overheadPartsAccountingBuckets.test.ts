import { describe, expect, it } from 'vitest'
import type { OverheadPartsDetailLine } from './fetchOverheadOfficePartsByDay'
import {
  bucketForOverheadPartsLine,
  bucketOverheadPartsLinesByAccountingLabel,
  isMaterialsBucketKey,
  OVERHEAD_PARTS_ACCOUNTING_BUCKET_ORDER,
  overheadPartsAccountingBucketFromDefaultKey,
  sumMaterialsTotalUsdExcludingInternalTransfer,
  type OverheadPartsAccountingBucketKey,
} from './overheadPartsAccountingBuckets'

function line(p: Partial<OverheadPartsDetailLine> & Pick<OverheadPartsDetailLine, 'source' | 'sortKey'>): OverheadPartsDetailLine {
  return {
    amountUsd: 10,
    label: 'Test',
    mercuryDebitCardId: null,
    mercuryTransactionId: null,
    ...p,
  }
}

describe('overheadPartsAccountingBucketFromDefaultKey', () => {
  it('maps fuel_gas to fuel_gas', () => {
    expect(overheadPartsAccountingBucketFromDefaultKey('fuel_gas')).toBe('fuel_gas')
  })

  it('maps cogs_part_iii to cogs_part_iii', () => {
    expect(overheadPartsAccountingBucketFromDefaultKey('cogs_part_iii')).toBe('cogs_part_iii')
  })

  it('maps internal_transfers to internal_transfer', () => {
    expect(overheadPartsAccountingBucketFromDefaultKey('internal_transfers')).toBe('internal_transfer')
  })

  it.each([null, undefined, '', 'supplies', 'utilities', 'consumables', 'job_materials_parts'])(
    'maps %s to other',
    (k) => {
      expect(overheadPartsAccountingBucketFromDefaultKey(k as string | null)).toBe('other')
    },
  )
})

describe('isMaterialsBucketKey', () => {
  it.each<[OverheadPartsAccountingBucketKey, boolean]>([
    ['fuel_gas', true],
    ['cogs_part_iii', true],
    ['other', true],
    ['internal_transfer', false],
  ])('returns %s for key %s', (key, expected) => {
    expect(isMaterialsBucketKey(key)).toBe(expected)
  })
})

describe('bucketForOverheadPartsLine', () => {
  const bucketMap = new Map<string, OverheadPartsAccountingBucketKey>([
    ['tx-fuel', 'fuel_gas'],
    ['tx-cogs', 'cogs_part_iii'],
    ['tx-other-labeled', 'other'],
    ['tx-it', 'internal_transfer'],
  ])

  it('places supply lines in other regardless of any tx id', () => {
    expect(
      bucketForOverheadPartsLine(
        line({ source: 'supply', sortKey: 's:1', mercuryTransactionId: 'tx-fuel' }),
        bucketMap,
      ),
    ).toBe('other')
  })

  it('places tally lines in other', () => {
    expect(
      bucketForOverheadPartsLine(line({ source: 'tally', sortKey: 't:1' }), bucketMap),
    ).toBe('other')
  })

  it('places Mercury lines without a tx id in other (defensive)', () => {
    expect(
      bucketForOverheadPartsLine(
        line({ source: 'mercury', sortKey: 'mercury:1', mercuryTransactionId: null }),
        bucketMap,
      ),
    ).toBe('other')
  })

  it('places Mercury lines whose tx is not in the map in other', () => {
    expect(
      bucketForOverheadPartsLine(
        line({ source: 'mercury', sortKey: 'mercury:1', mercuryTransactionId: 'tx-unknown' }),
        bucketMap,
      ),
    ).toBe('other')
  })

  it('routes Mercury fuel_gas tx to fuel_gas', () => {
    expect(
      bucketForOverheadPartsLine(
        line({ source: 'mercury', sortKey: 'mercury:1', mercuryTransactionId: 'tx-fuel' }),
        bucketMap,
      ),
    ).toBe('fuel_gas')
  })

  it('routes Mercury cogs_part_iii tx to cogs_part_iii', () => {
    expect(
      bucketForOverheadPartsLine(
        line({ source: 'mercury', sortKey: 'mercury:1', mercuryTransactionId: 'tx-cogs' }),
        bucketMap,
      ),
    ).toBe('cogs_part_iii')
  })

  it('routes Mercury internal_transfer tx to internal_transfer', () => {
    expect(
      bucketForOverheadPartsLine(
        line({ source: 'mercury', sortKey: 'mercury:1', mercuryTransactionId: 'tx-it' }),
        bucketMap,
      ),
    ).toBe('internal_transfer')
  })
})

describe('bucketOverheadPartsLinesByAccountingLabel', () => {
  it('returns four buckets in fixed display order, even when empty', () => {
    const sections = bucketOverheadPartsLinesByAccountingLabel([], new Map())
    expect(sections.map((s) => s.key)).toEqual(OVERHEAD_PARTS_ACCOUNTING_BUCKET_ORDER)
    expect(sections.map((s) => s.totalUsd)).toEqual([0, 0, 0, 0])
    expect(sections.map((s) => s.lines.length)).toEqual([0, 0, 0, 0])
  })

  it('totals dollars per bucket and preserves order of lines within each bucket', () => {
    const bucketMap = new Map<string, OverheadPartsAccountingBucketKey>([
      ['tx-1', 'fuel_gas'],
      ['tx-2', 'fuel_gas'],
      ['tx-3', 'cogs_part_iii'],
    ])
    const lines: OverheadPartsDetailLine[] = [
      line({ source: 'mercury', sortKey: 'mercury:1', mercuryTransactionId: 'tx-1', amountUsd: 38.79, label: 'Shell' }),
      line({ source: 'supply', sortKey: 'supply:1', amountUsd: 200, label: 'Ferguson' }),
      line({ source: 'mercury', sortKey: 'mercury:2', mercuryTransactionId: 'tx-3', amountUsd: 123.45, label: 'Lowes' }),
      line({ source: 'tally', sortKey: 'tally:1', amountUsd: 5.5, label: 'Bushing' }),
      line({ source: 'mercury', sortKey: 'mercury:3', mercuryTransactionId: 'tx-2', amountUsd: 42.1, label: 'Buc-ees' }),
    ]
    const sections = bucketOverheadPartsLinesByAccountingLabel(lines, bucketMap)
    expect(sections[0]).toMatchObject({ key: 'fuel_gas', totalUsd: 80.89 })
    expect(sections[0]?.lines.map((l) => l.label)).toEqual(['Shell', 'Buc-ees'])
    expect(sections[1]).toMatchObject({ key: 'cogs_part_iii', totalUsd: 123.45 })
    expect(sections[1]?.lines.map((l) => l.label)).toEqual(['Lowes'])
    expect(sections[2]).toMatchObject({ key: 'other', totalUsd: 205.5 })
    expect(sections[2]?.lines.map((l) => l.label)).toEqual(['Ferguson', 'Bushing'])
    expect(sections[3]).toMatchObject({ key: 'internal_transfer', totalUsd: 0 })
    expect(sections[3]?.lines).toEqual([])
  })

  it('bucket totals across all sections sum to the total dollars in the input lines', () => {
    const bucketMap = new Map<string, OverheadPartsAccountingBucketKey>([
      ['tx-a', 'fuel_gas'],
      ['tx-b', 'cogs_part_iii'],
      ['tx-it', 'internal_transfer'],
    ])
    const lines: OverheadPartsDetailLine[] = [
      line({ source: 'mercury', sortKey: 'mercury:1', mercuryTransactionId: 'tx-a', amountUsd: 10 }),
      line({ source: 'mercury', sortKey: 'mercury:2', mercuryTransactionId: 'tx-b', amountUsd: 20 }),
      line({ source: 'mercury', sortKey: 'mercury:3', mercuryTransactionId: 'tx-unmapped', amountUsd: 30 }),
      line({ source: 'supply', sortKey: 'supply:1', amountUsd: 40 }),
      line({ source: 'tally', sortKey: 'tally:1', amountUsd: 50 }),
      line({ source: 'mercury', sortKey: 'mercury:4', mercuryTransactionId: 'tx-it', amountUsd: 500 }),
    ]
    const sections = bucketOverheadPartsLinesByAccountingLabel(lines, bucketMap)
    const totalAcrossSections = sections.reduce((s, sec) => s + sec.totalUsd, 0)
    const totalAcrossInput = lines.reduce((s, l) => s + l.amountUsd, 0)
    expect(totalAcrossSections).toBeCloseTo(totalAcrossInput, 10)
  })

  it('isolates internal_transfer dollars in their own bucket', () => {
    const bucketMap = new Map<string, OverheadPartsAccountingBucketKey>([
      ['tx-a', 'fuel_gas'],
      ['tx-it', 'internal_transfer'],
    ])
    const lines: OverheadPartsDetailLine[] = [
      line({ source: 'mercury', sortKey: 'mercury:1', mercuryTransactionId: 'tx-a', amountUsd: 25, label: 'Shell' }),
      line({
        source: 'mercury',
        sortKey: 'mercury:2',
        mercuryTransactionId: 'tx-it',
        amountUsd: 1500,
        label: 'Mercury Checking 0123',
      }),
    ]
    const sections = bucketOverheadPartsLinesByAccountingLabel(lines, bucketMap)
    const itSection = sections.find((s) => s.key === 'internal_transfer')
    expect(itSection?.totalUsd).toBe(1500)
    expect(itSection?.lines.map((l) => l.label)).toEqual(['Mercury Checking 0123'])
  })
})

describe('sumMaterialsTotalUsdExcludingInternalTransfer', () => {
  it('returns 0 for empty sections', () => {
    expect(sumMaterialsTotalUsdExcludingInternalTransfer([])).toBe(0)
  })

  it('sums fuel_gas + cogs_part_iii + other and excludes internal_transfer', () => {
    const sections = bucketOverheadPartsLinesByAccountingLabel(
      [
        line({ source: 'mercury', sortKey: 'mercury:1', mercuryTransactionId: 'tx-a', amountUsd: 100 }),
        line({ source: 'mercury', sortKey: 'mercury:2', mercuryTransactionId: 'tx-b', amountUsd: 200 }),
        line({ source: 'supply', sortKey: 'supply:1', amountUsd: 50 }),
        line({ source: 'mercury', sortKey: 'mercury:3', mercuryTransactionId: 'tx-it', amountUsd: 9999 }),
      ],
      new Map<string, OverheadPartsAccountingBucketKey>([
        ['tx-a', 'fuel_gas'],
        ['tx-b', 'cogs_part_iii'],
        ['tx-it', 'internal_transfer'],
      ]),
    )
    expect(sumMaterialsTotalUsdExcludingInternalTransfer(sections)).toBe(350)
  })
})
