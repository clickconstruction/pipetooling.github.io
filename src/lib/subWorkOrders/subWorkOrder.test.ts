import { describe, expect, it } from 'vitest'
import {
  buildSheetWorkOrderSnapshot,
  buildWorkOrderReferences,
  frozenAmountFromSheetTotal,
  generalConditionsStanding,
  parseSubWorkOrderSnapshot,
  scopeItemsForTrade,
  sheetWorkOrderLabel,
  sheetWorkOrderRail,
  signedAmountDrift,
  workOrderWindowLabel,
  type SubScopeItem,
} from './subWorkOrder'

const item = (over: Partial<SubScopeItem>): SubScopeItem => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  service_type_id: null,
  kind: 'scope',
  label: 'x',
  is_default: true,
  sequence_order: 0,
  archived_at: null,
  ...over,
})

describe('parseSubWorkOrderSnapshot', () => {
  it('reads a legacy step snapshot as step-anchored with empty extras', () => {
    const s = parseSubWorkOrderSnapshot({ lines: [{ label: 'Rough-in', amount: 4350 }], startsLabel: 'Starts Sep 15' })
    expect(s.anchor).toBe('step')
    expect(s.lines).toEqual([{ label: 'Rough-in', amount: 4350 }])
    expect(s.startsLabel).toBe('Starts Sep 15')
    expect(s.exclusions).toEqual([])
    expect(s.references).toEqual([])
    expect(s.acknowledgements).toEqual([])
    expect(s.bond).toBe('none')
  })

  it('never throws on garbage and drops malformed entries', () => {
    expect(parseSubWorkOrderSnapshot(null).lines).toEqual([])
    expect(parseSubWorkOrderSnapshot('nope').anchor).toBe('step')
    const s = parseSubWorkOrderSnapshot({
      anchor: 'sheet',
      lines: [{ label: '' }, 'junk', { label: ' ok ', amount: 'NaN' }],
      references: [{ name: '' }, { kind: 'weird', name: 'General Conditions', versionDate: '2026-06-19' }],
      acknowledgements: ['a', '', 7],
      bond: 'maybe',
    })
    expect(s.anchor).toBe('sheet')
    expect(s.lines).toEqual([{ label: 'ok', amount: null }])
    expect(s.references).toEqual([{ kind: 'book', documentId: null, name: 'General Conditions', versionDate: '2026-06-19' }])
    expect(s.acknowledgements).toEqual(['a'])
    expect(s.bond).toBe('none')
  })
})

describe('buildSheetWorkOrderSnapshot', () => {
  it('freezes the sheet label, dedupes lines, and labels the window', () => {
    const s = buildSheetWorkOrderSnapshot({
      sheet: { job_number: 'J977', address: '415 Springtown Way' },
      scopeLines: ['Fixtures per plans', ' fixtures per plans ', '', 'Med-gas rough-in'],
      exclusions: ['Sales tax'],
      references: [{ kind: 'book', documentId: 'd1', name: 'General Conditions', versionDate: '2026-06-19' }, { kind: 'setting', documentId: null, name: '', versionDate: null }],
      acknowledgements: ['I will bill through the portal.'],
      bond: 'none',
      specialProvisions: '  ',
      proposedStart: '2026-09-15',
      proposedEnd: '2026-09-26',
    })
    expect(s.anchor).toBe('sheet')
    expect(s.sheetLabel).toBe('J977 · 415 Springtown Way')
    expect(s.lines.map((l) => l.label)).toEqual(['Fixtures per plans', 'Med-gas rough-in'])
    expect(s.startsLabel).toBe('Starts Sep 15 → Sep 26')
    expect(s.references).toHaveLength(1)
    expect(s.specialProvisions).toBeNull()
  })

  it('round-trips through the parser', () => {
    const built = buildSheetWorkOrderSnapshot({
      sheet: { job_number: null, address: '2210 Rollingwood Dr' },
      scopeLines: ['A'],
      exclusions: [],
      references: [],
      acknowledgements: ['B'],
      bond: 'furnished',
      specialProvisions: 'Owner supplies fixtures.',
      proposedStart: null,
      proposedEnd: '2026-09-26',
    })
    const parsed = parseSubWorkOrderSnapshot(JSON.parse(JSON.stringify(built)))
    expect(parsed).toEqual(built)
    expect(parsed.startsLabel).toBe('by Sep 26')
    expect(parsed.sheetLabel).toBe('2210 Rollingwood Dr')
  })
})

describe('sheetWorkOrderLabel / workOrderWindowLabel', () => {
  it('falls back sensibly', () => {
    expect(sheetWorkOrderLabel({ job_number: ' ', address: '' })).toBe('Sub sheet')
    expect(sheetWorkOrderLabel({ job_number: 'J1', address: null })).toBe('J1')
    expect(workOrderWindowLabel(null, null)).toBeNull()
    expect(workOrderWindowLabel('2026-09-15', null)).toBe('starting Sep 15')
  })
})

describe('scopeItemsForTrade', () => {
  it('keeps all-trades + the sheet trade, live only, defaults ticked, all-trades first', () => {
    const plumbing = 'st-plumb'
    const items = [
      item({ id: 'p2', service_type_id: plumbing, label: 'Plumb 2', sequence_order: 20 }),
      item({ id: 'gas', service_type_id: 'st-gas', label: 'Gas only' }),
      item({ id: 'all', service_type_id: null, label: 'All trades', sequence_order: 5 }),
      item({ id: 'p1', service_type_id: plumbing, label: 'Plumb 1', sequence_order: 10, is_default: false }),
      item({ id: 'dead', service_type_id: plumbing, label: 'Archived', archived_at: '2026-01-01' }),
      item({ id: 'excl', service_type_id: null, kind: 'exclusion', label: 'Not this' }),
    ]
    const out = scopeItemsForTrade(items, plumbing, 'scope')
    expect(out.map((o) => o.item.id)).toEqual(['all', 'p1', 'p2'])
    expect(out.map((o) => o.ticked)).toEqual([true, false, true])
    expect(scopeItemsForTrade(items, null, 'scope').map((o) => o.item.id)).toEqual(['all'])
    expect(scopeItemsForTrade(items, plumbing, 'exclusion').map((o) => o.item.id)).toEqual(['excl'])
  })
})

describe('sheetWorkOrderRail', () => {
  it('walks draft → awaiting signature → signed → the sheet stages → paid', () => {
    const keys = (r: ReturnType<typeof sheetWorkOrderRail>, state: string) => r.filter((s) => s.state === state).map((s) => s.key)
    const draft = sheetWorkOrderRail('draft', 'working', 100)
    expect(keys(draft, 'now')).toEqual(['draft'])
    const offered = sheetWorkOrderRail('offered', 'working', 100)
    expect(offered.find((s) => s.key === 'sent')?.label).toBe('Awaiting signature')
    expect(keys(offered, 'now')).toEqual(['sent'])
    const signedWorking = sheetWorkOrderRail('accepted', 'working', 100)
    expect(keys(signedWorking, 'done')).toEqual(['draft', 'sent', 'signed'])
    expect(keys(signedWorking, 'now')).toEqual(['working'])
    const walk = sheetWorkOrderRail('accepted', 'walkthrough', 100)
    expect(keys(walk, 'now')).toEqual(['walkthrough'])
    const paid = sheetWorkOrderRail('settled', 'customer_pay', 0)
    expect(keys(paid, 'todo')).toEqual([])
    expect(keys(paid, 'done')).toContain('paid')
    expect(sheetWorkOrderRail('declined', 'working', 100)).toEqual([])
  })
})

describe('generalConditionsStanding', () => {
  it('compares the signed version to the book version', () => {
    expect(generalConditionsStanding({ bookVersionDate: null, signedVersionDate: null, signed: false })).toBe('none')
    expect(generalConditionsStanding({ bookVersionDate: '2026-06-19', signedVersionDate: null, signed: false })).toBe('unsigned')
    expect(generalConditionsStanding({ bookVersionDate: '2026-06-19', signedVersionDate: '2026-03-02', signed: true })).toBe('behind')
    expect(generalConditionsStanding({ bookVersionDate: '2026-06-19', signedVersionDate: '2026-06-19', signed: true })).toBe('current')
    expect(generalConditionsStanding({ bookVersionDate: '2026-06-19', signedVersionDate: null, signed: true })).toBe('behind')
  })
})

describe('frozen amount + drift', () => {
  it('freezes the sheet total and flags real drift only', () => {
    expect(frozenAmountFromSheetTotal(6400.004)).toBe(6400)
    expect(frozenAmountFromSheetTotal(-5)).toBe(0)
    expect(frozenAmountFromSheetTotal(Number.NaN)).toBe(0)
    expect(signedAmountDrift(6400, 6400.004)).toEqual({ differs: false, delta: 0 })
    expect(signedAmountDrift(6400, 6850)).toEqual({ differs: true, delta: 450 })
    expect(signedAmountDrift(6400, 6000)).toEqual({ differs: true, delta: -400 })
  })
})

describe('buildWorkOrderReferences', () => {
  it('lists book docs, then pay, then insurance with the COI expiry', () => {
    const refs = buildWorkOrderReferences({
      bookDocs: [{ id: 'gc', document_name: 'General Conditions', book_version_date: '2026-06-19' }, { id: 'x', document_name: '  ', book_version_date: null }],
      payRunDay: 'Friday',
      includePay: true,
      coiExpiresOn: '2027-03-01',
      includeInsurance: true,
    })
    expect(refs).toEqual([
      { kind: 'book', documentId: 'gc', name: 'General Conditions', versionDate: '2026-06-19' },
      { kind: 'setting', documentId: null, name: 'How pay works here · pay-run Friday', versionDate: null },
      { kind: 'compliance', documentId: null, name: 'Insurance requirements (certificate on file)', versionDate: '2027-03-01' },
    ])
    expect(buildWorkOrderReferences({ bookDocs: [], payRunDay: null, includePay: false, coiExpiresOn: null, includeInsurance: false })).toEqual([])
  })
})
