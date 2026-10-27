import { describe, expect, it, vi } from 'vitest'
import {
  assemblyListEmptyWords,
  jobAccountsEmptyWords,
  materialsTabPath,
  partsBookEmptyWords,
  purchaseOrdersEmptyWords,
  SUPPLY_HOUSE_AGING_EMPTY,
  supplyHouseDirectoryEmptyWords,
  supplyHouseInvoicesEmptyWords,
  supplyHousePosEmptyWords,
} from './materialsEmptyWords'
import type { EmptyStateWords } from '../emptyWords'
import { plainWordsFailures } from '../plainWords'

/** The sentence a person reads: main, the press's label, the tail. */
const read = (w: EmptyStateWords) => [w.main, w.next?.label, w.tail].filter(Boolean).join(' ')

describe('materialsEmptyWords', () => {
  it('a Materials tab is a plain path the page reads', () => {
    expect(materialsTabPath('assembly-book')).toBe('/materials?tab=assembly-book')
  })

  it('the assembly list: + Add Assembly on the Assembly Book, a link from the PO Builder, one press for the filters', () => {
    const add = vi.fn()
    const clear = vi.fn()
    expect(assemblyListEmptyWords({ total: 0, query: '', typeFiltered: false, clearFilters: clear, addAssembly: add })).toEqual({ main: 'No assemblies yet.', next: { label: '+ Add Assembly', onPress: add }, tail: 'adds the first.' })
    expect(assemblyListEmptyWords({ total: 0, query: '', typeFiltered: false, clearFilters: clear, addAssembly: null })).toEqual({ main: 'No assemblies yet.', next: { label: 'Assembly Book', to: '/materials?tab=assembly-book' }, tail: 'makes the first.' })
    expect(assemblyListEmptyWords({ total: 5, query: ' tub ', typeFiltered: false, clearFilters: clear, addAssembly: add })).toEqual({ main: 'No assemblies match ‘tub’.', next: { label: 'Clear the search', onPress: clear }, tail: undefined })
    expect(assemblyListEmptyWords({ total: 5, query: 'tub', typeFiltered: true, clearFilters: clear, addAssembly: add })).toEqual({ main: 'No assemblies match the filters.', next: { label: 'Clear the filters', onPress: clear }, tail: undefined })
  })

  it('the Parts Book: a search or a select hides them, else Add Part', () => {
    const add = vi.fn()
    const clear = vi.fn()
    expect(partsBookEmptyWords({ query: 'wax ring', typeOrMakerFiltered: false, clearFilters: clear, addPart: add }).main).toBe('No parts match ‘wax ring’.')
    expect(partsBookEmptyWords({ query: '', typeOrMakerFiltered: true, clearFilters: clear, addPart: add })).toEqual({ main: 'No parts match the filters.', next: { label: 'Clear the filters', onPress: clear }, tail: undefined })
    expect(partsBookEmptyWords({ query: ' ', typeOrMakerFiltered: false, clearFilters: clear, addPart: add })).toEqual({ main: 'No parts yet.', next: { label: 'Add Part', onPress: add }, tail: 'adds the first.' })
  })

  it('Purchase Orders: the filters clear, else the PO Builder makes the first', () => {
    const clear = vi.fn()
    expect(purchaseOrdersEmptyWords({ query: 'PO-12', statusFiltered: false, clearFilters: clear }).main).toBe('No purchase orders match ‘PO-12’.')
    expect(purchaseOrdersEmptyWords({ query: 'PO-12', statusFiltered: true, clearFilters: clear }).next).toEqual({ label: 'Clear the filters', onPress: clear })
    expect(purchaseOrdersEmptyWords({ query: '', statusFiltered: false, clearFilters: clear })).toEqual({ main: 'No purchase orders yet.', next: { label: 'PO Builder', to: '/materials?tab=assemblies-po' }, tail: 'makes the first.' })
  })

  it('Held for suppliers: the Supply houses tab fills it, the All chip undoes a filter', () => {
    const all = vi.fn()
    expect(jobAccountsEmptyWords({ total: 0, showAll: all }).next).toEqual({ label: 'Supply houses', to: '/materials?tab=supply-houses' })
    expect(jobAccountsEmptyWords({ total: 3, showAll: all })).toEqual({ main: 'No jobs match this filter.', next: { label: 'All', onPress: all }, tail: 'shows every job.' })
  })

  it('the directory: the search first, then the chips, then the add button by audience', () => {
    const s = { clearSearch: vi.fn(), clearFilters: vi.fn(), addHouse: vi.fn() }
    expect(supplyHouseDirectoryEmptyWords({ ...s, audience: 'office', query: 'Ferguson', narrowed: true })).toEqual({ main: 'No houses or reps match ‘Ferguson’.', next: { label: 'Clear the search', onPress: s.clearSearch }, tail: undefined })
    expect(supplyHouseDirectoryEmptyWords({ ...s, audience: 'estimator', query: '', narrowed: true })).toEqual({ main: 'No supply houses match the filters.', next: { label: 'Clear the filters', onPress: s.clearFilters }, tail: undefined })
    expect(supplyHouseDirectoryEmptyWords({ ...s, audience: 'office', query: '', narrowed: false })).toEqual({ main: 'No vendors yet.', next: { label: 'Add vendor', onPress: s.addHouse }, tail: 'adds the first.' })
    expect(supplyHouseDirectoryEmptyWords({ ...s, audience: 'estimator', query: '', narrowed: false }).next?.label).toBe('Add supply house')
  })

  it('one house: its invoices and its POs name the house and the section’s own button', () => {
    const add = vi.fn()
    const showPaid = vi.fn()
    expect(supplyHouseInvoicesEmptyWords({ house: 'Hartline', total: 0, addInvoice: add, showPaid })).toEqual({ main: 'No invoices from Hartline yet.', next: { label: 'Add Invoice', onPress: add }, tail: 'adds the first.' })
    expect(supplyHouseInvoicesEmptyWords({ house: 'Hartline', total: 4, addInvoice: add, showPaid })).toEqual({ main: 'Nothing unpaid with Hartline.', next: { label: 'Show paid invoices', onPress: showPaid }, tail: 'lists the paid ones too.' })
    const create = vi.fn()
    expect(supplyHousePosEmptyWords({ house: 'Hartline', createPo: create })).toEqual({ main: 'No purchase orders for Hartline yet.', next: { label: 'Create PO', onPress: create }, tail: 'starts the first.' })
    expect(supplyHousePosEmptyWords({ house: 'Hartline', createPo: null })).toEqual({ main: 'No purchase orders for Hartline yet.' })
  })

  it('every sentence reads in plain words', () => {
    const f = vi.fn()
    const all: EmptyStateWords[] = [
      assemblyListEmptyWords({ total: 0, query: '', typeFiltered: false, clearFilters: f, addAssembly: f }),
      assemblyListEmptyWords({ total: 0, query: '', typeFiltered: false, clearFilters: f, addAssembly: null }),
      assemblyListEmptyWords({ total: 2, query: 'tub', typeFiltered: false, clearFilters: f, addAssembly: f }),
      partsBookEmptyWords({ query: '', typeOrMakerFiltered: false, clearFilters: f, addPart: f }),
      purchaseOrdersEmptyWords({ query: '', statusFiltered: false, clearFilters: f }),
      jobAccountsEmptyWords({ total: 0, showAll: f }),
      jobAccountsEmptyWords({ total: 1, showAll: f }),
      supplyHouseDirectoryEmptyWords({ audience: 'office', query: '', narrowed: false, clearSearch: f, clearFilters: f, addHouse: f }),
      SUPPLY_HOUSE_AGING_EMPTY,
      supplyHouseInvoicesEmptyWords({ house: 'Hartline', total: 0, addInvoice: f, showPaid: f }),
      supplyHouseInvoicesEmptyWords({ house: 'Hartline', total: 2, addInvoice: f, showPaid: f }),
      supplyHousePosEmptyWords({ house: 'Hartline', createPo: f }),
    ]
    for (const w of all) expect(plainWordsFailures(read(w)), read(w)).toEqual([])
  })
})
