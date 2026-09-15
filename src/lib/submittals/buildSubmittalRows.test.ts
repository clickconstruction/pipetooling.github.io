import { describe, expect, it } from 'vitest'
import { buildSubmittalRows, compareTags, rowsSentBack, summarizeChanges } from './buildSubmittalRows'
import type { PickInput, PreviousItem, SpecifiedInput, SubmittalRowDraft } from './buildSubmittalRows'

const spec = (tag: string, fixture: string | null, manufacturer: string | null, model: string | null, description = `${fixture ?? tag}`): SpecifiedInput => ({
  tag,
  fixture,
  manufacturer,
  model,
  description,
})

const pick = (fixture: string, label: string | null, extra: Partial<PickInput> = {}): PickInput => ({
  fixture,
  supplyHouseId: 'h-ferguson',
  houseName: 'Ferguson',
  quoteLineId: `ql-${fixture.toLowerCase().replace(/\s+/g, '-')}`,
  label,
  alternateReasonKind: null,
  alternateReasonNote: null,
  leadTimeDays: null,
  ...extra,
})

const prevItem = (tag: string, extra: Partial<PreviousItem> = {}): PreviousItem => ({
  id: `item-${tag || 'acc'}`,
  tag,
  submittedModel: null,
  submittedLabel: null,
  status: 'missing',
  reasonKind: null,
  reasonNote: null,
  leadTimeDays: null,
  sheetFile: null,
  sheetPages: [],
  reviewDecision: null,
  reviewNote: null,
  ...extra,
})

/** The SpaceX-like package: a wall-hung bowl, a superseded flush valve, an alternate water heater, a PRV nobody quoted, carriers on the quote with no tag. */
const specified: SpecifiedInput[] = [
  spec('WC-1', 'Water closet', 'TOTO', 'CT708UVG#01'),
  spec('WC-2', 'Water closet', 'TOTO', 'CT708UVG#01'),
  spec('FV-1', 'Flush valve', 'Sloan', 'Royal 111-1.28'),
  spec('DWH-1', 'Water heater', 'A.O. Smith', 'BTH-199'),
  spec('PRV-1', 'Pressure reducing valve', 'Watts', 'LF25AUB-Z3'),
  spec('LAV-1', 'Lavatory', 'Kohler', 'K-2210'),
]

const picks: PickInput[] = [
  pick('Water closet', 'TOTO CT708UVG#01 WALL HUNG BOWL 1.28GPF'),
  pick('Flush valve', 'SLOAN ROYAL 111-1.28 ESS SENSOR FLUSHOMETER'),
  pick('Water heater', 'RHEEM GHE100SS-200 TANKLESS', { alternateReasonKind: 'lead_time', alternateReasonNote: 'AO Smith 14 weeks out', leadTimeDays: 10 }),
  pick('Lavatory', 'KOHLER K-2210 CAXTON UNDERMOUNT'),
  pick('Carrier', 'ZURN Z1203 WALL CARRIER'),
]

const byTag = (rows: SubmittalRowDraft[], tag: string): SubmittalRowDraft => {
  const row = rows.find((r) => r.tag === tag)
  if (!row) throw new Error(`no row ${tag}`)
  return row
}

describe('buildSubmittalRows', () => {
  it('one row per tag, the pick matched by fixture, the accessory last', () => {
    const rows = buildSubmittalRows({ specified, picks })
    expect(rows.map((r) => r.tag)).toEqual(['DWH-1', 'FV-1', 'LAV-1', 'PRV-1', 'WC-1', 'WC-2', ''])
    expect(rows.map((r) => r.sequenceOrder)).toEqual([1, 2, 3, 4, 5, 6, 7])
    const wc1 = byTag(rows, 'WC-1')
    expect(wc1.status).toBe('as_specified')
    expect(wc1.near).toBe(false)
    expect(wc1.submittedModel).toBe('CT708UVG#01')
    expect(wc1.submittedLabel).toBe('TOTO CT708UVG#01 WALL HUNG BOWL 1.28GPF')
    expect(wc1.submittedManufacturer).toBeNull()
    expect(wc1.sourceQuoteLineId).toBe('ql-water-closet')
    expect(wc1.houseName).toBe('Ferguson')
  })

  it('two tags that share a count row both get the same pick', () => {
    const rows = buildSubmittalRows({ specified, picks })
    const wc1 = byTag(rows, 'WC-1')
    const wc2 = byTag(rows, 'WC-2')
    expect(wc2.sourceQuoteLineId).toBe(wc1.sourceQuoteLineId)
    expect(wc2.status).toBe('as_specified')
  })

  it('fixture matching ignores case and whitespace', () => {
    const rows = buildSubmittalRows({ specified: [spec('LAV-1', 'Lavatory  Faucet', 'Moen', 'M8"')], picks: [pick(' lavatory faucet ', 'MOEN M8" WIDESPREAD')] })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.status).toBe('as_specified')
    expect(rows[0]?.tag).toBe('LAV-1')
  })

  it('a quoted product that is not the specified one is an alternate carrying the pick reason and lead time', () => {
    const dwh = byTag(buildSubmittalRows({ specified, picks }), 'DWH-1')
    expect(dwh.status).toBe('alternate')
    expect(dwh.submittedModel).toBe('RHEEM GHE100SS-200 TANKLESS')
    expect(dwh.reasonKind).toBe('lead_time')
    expect(dwh.reasonNote).toBe('AO Smith 14 weeks out')
    expect(dwh.leadTimeDays).toBe(10)
  })

  it('a tag nobody quoted is missing with null submitted fields', () => {
    const prv = byTag(buildSubmittalRows({ specified, picks }), 'PRV-1')
    expect(prv.status).toBe('missing')
    expect(prv.submittedModel).toBeNull()
    expect(prv.submittedLabel).toBeNull()
    expect(prv.sourceQuoteLineId).toBeNull()
    expect(prv.supplyHouseId).toBeNull()
  })

  it('a pick with no specified tag is an accessory row with an empty tag, in pick order', () => {
    const rows = buildSubmittalRows({ specified, picks: [...picks, pick('Trap primer', 'PPP P1-500 TRAP PRIMER')] })
    const acc = rows.filter((r) => r.tag === '')
    expect(acc.map((r) => r.submittedLabel)).toEqual(['ZURN Z1203 WALL CARRIER', 'PPP P1-500 TRAP PRIMER'])
    expect(acc.every((r) => r.status === 'accessory')).toBe(true)
    expect(acc.map((r) => r.sequenceOrder)).toEqual([7, 8])
    expect(acc[0]?.specifiedModel).toBeNull()
  })

  it('an override wins over the derived status', () => {
    const rows = buildSubmittalRows({ specified, picks, overrides: { 'FV-1': 'superseded', 'WC-1': 'equal' } })
    expect(byTag(rows, 'FV-1').status).toBe('superseded')
    expect(byTag(rows, 'WC-1').status).toBe('equal')
    expect(byTag(rows, 'WC-2').status).toBe('as_specified')
  })

  it('an override on a missing row does not invent a product', () => {
    const rows = buildSubmittalRows({ specified, picks, overrides: { 'PRV-1': 'equal' } })
    expect(byTag(rows, 'PRV-1').status).toBe('missing')
  })

  it('the first revision marks every row new', () => {
    const rows = buildSubmittalRows({ specified, picks })
    expect(rows.every((r) => r.changed && r.changeNote === 'new row' && r.carriedFromItemId === null)).toBe(true)
    expect(summarizeChanges(rows)).toBe('7 new rows')
  })

  it('carry-forward keeps the sheet when the product is unchanged and drops it when it changed', () => {
    const previous: PreviousItem[] = [
      prevItem('WC-1', { submittedModel: 'CT708UVG#01', submittedLabel: 'TOTO CT708UVG#01 WALL HUNG BOWL 1.28GPF', status: 'as_specified', sheetFile: 0, sheetPages: [3, 4] }),
      prevItem('DWH-1', { submittedModel: 'AO SMITH BTH-199 (backordered)', submittedLabel: 'AO SMITH BTH-199', status: 'as_specified', sheetFile: 1, sheetPages: [1] }),
    ]
    const rows = buildSubmittalRows({ specified, picks, previous })
    const wc1 = byTag(rows, 'WC-1')
    expect(wc1.sheetFile).toBe(0)
    expect(wc1.sheetPages).toEqual([3, 4])
    expect(wc1.carriedFromItemId).toBe('item-WC-1')
    expect(wc1.changed).toBe(false)
    expect(wc1.changeNote).toBeNull()
    const dwh = byTag(rows, 'DWH-1')
    expect(dwh.sheetFile).toBeNull()
    expect(dwh.sheetPages).toEqual([])
    expect(dwh.carriedFromItemId).toBe('item-DWH-1')
    expect(dwh.changeNote).toBe('product changed')
  })

  it('the previous reason and lead time carry when the new pick has none; the pick wins when it has one', () => {
    const previous: PreviousItem[] = [
      prevItem('LAV-1', { submittedModel: 'K-2210', status: 'as_specified', reasonKind: 'in_stock', reasonNote: 'had it on the shelf', leadTimeDays: 3 }),
      prevItem('DWH-1', { submittedModel: 'RHEEM GHE100SS-200 TANKLESS', status: 'alternate', reasonKind: 'cost', reasonNote: 'cheaper', leadTimeDays: 30 }),
    ]
    const rows = buildSubmittalRows({ specified, picks, previous })
    const lav = byTag(rows, 'LAV-1')
    expect(lav.reasonKind).toBe('in_stock')
    expect(lav.reasonNote).toBe('had it on the shelf')
    expect(lav.leadTimeDays).toBe(3)
    const dwh = byTag(rows, 'DWH-1')
    expect(dwh.reasonKind).toBe('lead_time')
    expect(dwh.reasonNote).toBe('AO Smith 14 weeks out')
    expect(dwh.leadTimeDays).toBe(10)
  })

  it('change notes: status changed, reason added, now missing', () => {
    const previous: PreviousItem[] = [
      prevItem('FV-1', { submittedModel: 'Royal 111-1.28', status: 'as_specified' }),
      prevItem('DWH-1', { submittedModel: 'RHEEM GHE100SS-200 TANKLESS', status: 'alternate', reasonKind: null }),
      prevItem('PRV-1', { submittedModel: 'LF25AUB-Z3', submittedLabel: 'WATTS LF25AUB-Z3', status: 'as_specified' }),
      prevItem('WC-1', { submittedModel: 'CT708UVG#01', status: 'as_specified' }),
    ]
    const rows = buildSubmittalRows({ specified, picks, previous, overrides: { 'FV-1': 'superseded' } })
    expect(byTag(rows, 'FV-1').changeNote).toBe('status changed')
    expect(byTag(rows, 'DWH-1').changeNote).toBe('reason added')
    expect(byTag(rows, 'PRV-1').changeNote).toBe('now missing')
    expect(byTag(rows, 'WC-1').changeNote).toBeNull()
    expect(byTag(rows, 'WC-2').changeNote).toBe('new row')
    expect(summarizeChanges(rows)).toBe('6 rows changed · 1 carried')
  })

  it('an accessory carries its sheet from the previous accessory with the same label', () => {
    const previous: PreviousItem[] = [prevItem('', { id: 'item-carrier', submittedLabel: 'ZURN Z1203 WALL CARRIER', status: 'accessory', sheetFile: 2, sheetPages: [7] })]
    const rows = buildSubmittalRows({ specified, picks, previous })
    const acc = byTag(rows, '')
    expect(acc.carriedFromItemId).toBe('item-carrier')
    expect(acc.sheetFile).toBe(2)
    expect(acc.sheetPages).toEqual([7])
    expect(acc.changed).toBe(false)
  })

  it('a near match (one-letter suffix) is as specified but flagged', () => {
    const rows = buildSubmittalRows({ specified: [spec('LAV-1', 'Lav faucet', 'Chicago', 'B74-C')], picks: [pick('Lav faucet', 'CHICAGO B74-CH FAUCET')] })
    expect(rows[0]?.status).toBe('as_specified')
    expect(rows[0]?.near).toBe(true)
    expect(rows[0]?.submittedModel).toBe('CHICAGO B74-CH FAUCET')
  })
})

describe('compareTags', () => {
  it('sorts by prefix, then number numerically, accessories last', () => {
    const tags = ['WC-10', '', 'WC-2', 'LAV-1', 'WC-1', 'DWH-1', 'LAV-2A', 'LAV-2']
    expect([...tags].sort(compareTags)).toEqual(['DWH-1', 'LAV-1', 'LAV-2', 'LAV-2A', 'WC-1', 'WC-2', 'WC-10', ''])
  })

  it('is case-insensitive on the prefix and stable for equal tags', () => {
    expect(compareTags('wc-1', 'WC-1')).toBeLessThan(0)
    expect(compareTags('WC-1', 'WC-1')).toBe(0)
    expect(compareTags('WC', 'WC-1')).toBeLessThan(0)
  })
})

describe('rowsSentBack', () => {
  it('keeps revise and rejected, not approved or unreviewed', () => {
    const items = [
      prevItem('A-1', { reviewDecision: 'approved' }),
      prevItem('B-1', { reviewDecision: 'revise' }),
      prevItem('C-1', { reviewDecision: 'rejected' }),
      prevItem('D-1', { reviewDecision: null }),
    ]
    expect(rowsSentBack(items).map((i) => i.tag)).toEqual(['B-1', 'C-1'])
  })
})

describe('summarizeChanges', () => {
  const row = (changeNote: SubmittalRowDraft['changeNote']): SubmittalRowDraft => ({
    tag: 'X-1',
    sequenceOrder: 1,
    specifiedManufacturer: null,
    specifiedModel: null,
    specifiedDescription: null,
    submittedManufacturer: null,
    submittedModel: null,
    submittedLabel: null,
    supplyHouseId: null,
    houseName: null,
    sourceQuoteLineId: null,
    status: 'missing',
    near: false,
    reasonKind: null,
    reasonNote: null,
    leadTimeDays: null,
    sheetFile: null,
    sheetPages: [],
    carriedFromItemId: null,
    changed: changeNote !== null,
    changeNote,
  })

  it('wording: singular and plural, all new, nothing changed, empty', () => {
    expect(summarizeChanges([])).toBe('No rows')
    expect(summarizeChanges([row('new row')])).toBe('1 new row')
    expect(summarizeChanges([row('new row'), row('new row')])).toBe('2 new rows')
    expect(summarizeChanges([row('product changed'), row(null), row(null)])).toBe('1 row changed · 2 carried')
    expect(summarizeChanges([row('new row'), row('status changed'), row('reason added'), row(null)])).toBe('3 rows changed · 1 carried')
    expect(summarizeChanges([row(null), row(null)])).toBe('Nothing changed · 2 carried')
  })
})
