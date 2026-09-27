import { describe, expect, it } from 'vitest'
import { catalogEventSummary, filterCatalogItems } from './estimateCatalogView'
import type { EstimateCatalogItemEventRow } from '../estimateCatalogApi'

const ev = (over: Partial<EstimateCatalogItemEventRow>): EstimateCatalogItemEventRow =>
  ({
    id: 'ev-1',
    item_id: 'c1',
    action: 'update',
    editor_user_id: 'u1',
    created_at: '2026-09-26T12:00:00Z',
    prev_line_item: 'Pretest',
    prev_description: 'hydrostatic',
    prev_quantity: 1,
    prev_unit_price_cents: 45_000,
    prev_amount_cents: 45_000,
    new_line_item: 'Pretest',
    new_description: 'hydrostatic, 2 hr',
    new_quantity: 2,
    new_unit_price_cents: 40_000,
    new_amount_cents: 80_000,
    ...over,
  }) as unknown as EstimateCatalogItemEventRow

describe('catalogEventSummary', () => {
  it('reads each action as one sentence with its numbers', () => {
    expect(catalogEventSummary(ev({ action: 'create' }))).toMatch(/^Added: "Pretest" \(hydrostatic, 2 hr\) · qty 2 × .*400\.00 = .*800\.00$/)
    expect(catalogEventSummary(ev({ action: 'update' }))).toMatch(/^Updated: "Pretest" \(hydrostatic\) qty 1 × .*450\.00 → "Pretest" \(hydrostatic, 2 hr\)/)
    expect(catalogEventSummary(ev({ action: 'delete' }))).toMatch(/^Removed: "Pretest" \(hydrostatic\) · qty 1 × .*450\.00$/)
    expect(catalogEventSummary(ev({ action: 'restore' }))).toMatch(/^Restored: "Pretest" \(hydrostatic, 2 hr\) · qty 2/)
    expect(catalogEventSummary(ev({ action: 'whatever' as never }))).toBe('whatever')
  })
  it('names a line by its item, its description, or a dash; a missing number is a dash', () => {
    expect(catalogEventSummary(ev({ action: 'create', new_line_item: '', new_description: 'only a note' }))).toMatch(/^Added: "only a note"/)
    expect(catalogEventSummary(ev({ action: 'create', new_line_item: ' ', new_description: '', new_quantity: null, new_unit_price_cents: null, new_amount_cents: null }))).toBe('Added: — · qty — × — = —')
  })
})

describe('filterCatalogItems', () => {
  const items = [
    { id: 'a', line_item: 'Water heater', description: '50 gal gas', quantity: 1, unit_price_cents: 185_000, amount_cents: 185_000 },
    { id: 'b', line_item: 'Pretest', description: 'hydrostatic', quantity: 2, unit_price_cents: 45_000, amount_cents: 90_000 },
    { id: 'c', line_item: 'Hose bibb', description: '', quantity: 3, unit_price_cents: 9_000, amount_cents: 27_000 },
  ]
  const ids = (out: { id: string }[]) => out.map((x) => x.id)
  it('a blank filter is the whole catalog, as a new list', () => {
    const out = filterCatalogItems(items, '  ')
    expect(ids(out)).toEqual(['a', 'b', 'c'])
    expect(out).not.toBe(items)
  })
  it('matches the item, the description, and the numbers as typed or as money', () => {
    expect(ids(filterCatalogItems(items, 'HEATER'))).toEqual(['a'])
    expect(ids(filterCatalogItems(items, 'hydro'))).toEqual(['b'])
    expect(ids(filterCatalogItems(items, '3'))).toEqual(['c'])
    expect(ids(filterCatalogItems(items, '45000'))).toEqual(['b'])
    expect(ids(filterCatalogItems(items, '1,850.00'))).toEqual(['a'])
    expect(ids(filterCatalogItems(items, 'copper'))).toEqual([])
  })
})
