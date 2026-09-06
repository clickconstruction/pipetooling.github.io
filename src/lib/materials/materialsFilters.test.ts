import { describe, expect, it } from 'vitest'
import {
  computeLoadAllDisplayParts,
  filterPartsByQuery,
  filterTemplatesByQuery,
  manufacturerFacetOptions,
  manufacturerIlikePattern,
  manufacturerMatches,
} from './materialsFilters'

const parts = [
  { name: 'Copper Elbow', manufacturer: 'Mueller', notes: null, part_type: { name: 'Fittings' } },
  { name: 'PVC Tee', manufacturer: 'Charlotte', notes: 'schedule 40', part_type: { name: 'Fittings' } },
  { name: 'Ball Valve', manufacturer: null, notes: null, part_type: null },
]

describe('filterPartsByQuery', () => {
  it('matches on name, manufacturer, part type, and notes (case-insensitive)', () => {
    expect(filterPartsByQuery(parts, 'copper').map(p => p.name)).toEqual(['Copper Elbow'])
    expect(filterPartsByQuery(parts, 'CHARLOTTE').map(p => p.name)).toEqual(['PVC Tee'])
    expect(filterPartsByQuery(parts, 'fitting').map(p => p.name)).toEqual(['Copper Elbow', 'PVC Tee'])
    expect(filterPartsByQuery(parts, 'schedule').map(p => p.name)).toEqual(['PVC Tee'])
  })

  it('returns the first `limit` parts for an empty/whitespace query', () => {
    expect(filterPartsByQuery(parts, '   ')).toHaveLength(3)
    expect(filterPartsByQuery(parts, '', 2)).toHaveLength(2)
  })

  it('applies the limit after filtering', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ name: `Widget ${i}` }))
    expect(filterPartsByQuery(many, 'widget')).toHaveLength(50)
    expect(filterPartsByQuery(many, 'widget', 5)).toHaveLength(5)
  })
})

const assemblyTypes = [
  { id: 'at-1', name: 'Rough-in' },
  { id: 'at-2', name: 'Trim' },
]

const templates = [
  { name: 'Bath rough kit', description: null, assembly_type_id: 'at-1' },
  { name: 'Kitchen trim', description: 'sink + faucet', assembly_type_id: 'at-2' },
  { name: 'Misc', description: null, assembly_type_id: null },
]

describe('filterTemplatesByQuery', () => {
  it('matches on name, description, and resolved assembly-type name', () => {
    expect(filterTemplatesByQuery(templates, 'rough', assemblyTypes).map(t => t.name))
      .toEqual(['Bath rough kit'])
    expect(filterTemplatesByQuery(templates, 'faucet', assemblyTypes).map(t => t.name))
      .toEqual(['Kitchen trim'])
    expect(filterTemplatesByQuery(templates, 'trim', assemblyTypes).map(t => t.name))
      .toEqual(['Kitchen trim'])
  })

  it('returns everything (up to limit) for an empty query', () => {
    expect(filterTemplatesByQuery(templates, '', assemblyTypes)).toHaveLength(3)
    expect(filterTemplatesByQuery(templates, '', assemblyTypes, 2)).toHaveLength(2)
  })
})

const loadAllParts = [
  { name: 'B part', manufacturer: 'Acme', notes: null, part_type: { name: 'Valves' }, part_type_id: 'pt-1', prices: [1, 2] },
  { name: 'A part', manufacturer: 'Acme', notes: null, part_type: { name: 'Valves' }, part_type_id: 'pt-1', prices: [1, 2] },
  { name: 'C part', manufacturer: 'Zen', notes: 'copper', part_type: { name: 'Fittings' }, part_type_id: 'pt-2', prices: [] },
]

describe('computeLoadAllDisplayParts', () => {
  const base = { filterPartTypeId: '', filterManufacturer: '', clientSearchQuery: '', sortByPriceCountAsc: false }

  it('returns input order untouched with no filters or sort', () => {
    expect(computeLoadAllDisplayParts(loadAllParts, base).map(p => p.name)).toEqual(['B part', 'A part', 'C part'])
  })

  it('filters by exact part type and manufacturer', () => {
    expect(computeLoadAllDisplayParts(loadAllParts, { ...base, filterPartTypeId: 'pt-2' }).map(p => p.name)).toEqual(['C part'])
    expect(computeLoadAllDisplayParts(loadAllParts, { ...base, filterManufacturer: 'Acme' })).toHaveLength(2)
  })

  it('searches name/manufacturer/part-type/notes', () => {
    expect(computeLoadAllDisplayParts(loadAllParts, { ...base, clientSearchQuery: 'copper' }).map(p => p.name)).toEqual(['C part'])
    expect(computeLoadAllDisplayParts(loadAllParts, { ...base, clientSearchQuery: 'zen' }).map(p => p.name)).toEqual(['C part'])
  })

  it('sorts by price count ascending with name tiebreak when the flag is on', () => {
    expect(computeLoadAllDisplayParts(loadAllParts, { ...base, sortByPriceCountAsc: true }).map(p => p.name))
      .toEqual(['C part', 'A part', 'B part'])
  })
})

describe('manufacturer facet case-fold (v2.2903)', () => {
  const rows = [
    { manufacturer: 'WATTS' },
    { manufacturer: 'watts' },
    { manufacturer: 'Watts ' },
    { manufacturer: 'watts' },
    { manufacturer: 'Zurn' },
    { manufacturer: null },
    { manufacturer: '' },
  ]

  it('manufacturerFacetOptions collapses spellings to one option, labelled by the most common spelling', () => {
    expect(manufacturerFacetOptions(rows)).toEqual(['watts', 'Zurn'])
    expect(manufacturerFacetOptions([{ manufacturer: 'Oatey' }, { manufacturer: 'OATEY' }])).toEqual(['Oatey'])
  })

  it('manufacturerMatches ignores case and surrounding whitespace; blank filter matches everything', () => {
    expect(manufacturerMatches('WATTS', 'watts')).toBe(true)
    expect(manufacturerMatches(' Watts ', 'WATTS')).toBe(true)
    expect(manufacturerMatches('Zurn', 'watts')).toBe(false)
    expect(manufacturerMatches(null, 'watts')).toBe(false)
    expect(manufacturerMatches(null, '')).toBe(true)
  })

  it('computeLoadAllDisplayParts applies the manufacturer filter case-insensitively', () => {
    const parts = [
      { name: 'A', manufacturer: 'WATTS', notes: null, part_type: null, part_type_id: null, prices: [] },
      { name: 'B', manufacturer: 'watts', notes: null, part_type: null, part_type_id: null, prices: [] },
      { name: 'C', manufacturer: 'Zurn', notes: null, part_type: null, part_type_id: null, prices: [] },
    ]
    const out = computeLoadAllDisplayParts(parts, {
      filterPartTypeId: '',
      filterManufacturer: 'watts',
      clientSearchQuery: '',
      sortByPriceCountAsc: false,
    })
    expect(out.map(p => p.name)).toEqual(['A', 'B'])
  })

  it('manufacturerIlikePattern escapes PostgREST LIKE metacharacters', () => {
    expect(manufacturerIlikePattern('Watts')).toBe('Watts')
    expect(manufacturerIlikePattern(' A_B 100% ')).toBe('A\\_B 100\\%')
    expect(manufacturerIlikePattern('back\\slash')).toBe('back\\\\slash')
  })
})
