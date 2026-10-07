/**
 * BP375 SPACEX BA-02N as the procurement log redraw's working page holds it (`RAW` and `LATER` in
 * `before-after.html` on PR #4527's branch; the card was closed unmerged once the train shipped): 47 lines, 14 fixtures, one house. `today` is
 * the log read on 2026-10-05: five parts sent back, three carriers on site, 39 waiting, no lead
 * time and no stage dates. `later` is the page's made-up three weeks on, read on 2026-10-26:
 * approvals, three POs, lead times and stage dates. Test data only.
 */
import type { ProcurementRow, ProcurementStatus } from './procurementLog'

export const row = (key: string, status: ProcurementStatus, p: Partial<ProcurementRow> = {}): ProcurementRow => ({
  key, tag: key, isHand: false, recordId: null, product: key, supplyHouse: 'National Wholesale', stage: 'trim_set', submittal: 'open', submittalAt: null, releasedOn: null, orderedOn: null, poRef: '', leadTimeDays: null,
  expectedOn: null, expectedSource: null, requiredOn: null, floatDays: null, orderBy: null, deliveredOn: null, note: '', status, late: false, countedWith: [], itemId: `it-${key}`, ...p,
})

const FIXTURES: Array<[tag: string, fixture: string, count: number | null, ids: string, orderOnly?: string]> = [
  ['12" DEEP MOP SINK', 'MOP SINK', 1, 'm1 m2 m3 m4 m5 m6 m7'],
  ['DWH-1', 'DWH', 1, 'd1 d2'],
  ['EWC-1', 'EWC', 2, 'e1 e2 e3 e4 e5 e6 e7', 'e3 e4 e5 e6'],
  ['FCO', 'FCO', 2, 'fco'],
  ['FD', 'FD', 3, 'fd'],
  ['HB-3', 'HB', 2, 'hb'],
  ['LAV-1', 'LAV1', 2, 'a1 a2 a3 a4 a5 a6 a7 a8', 'a4 a5 a6 a7 a8'],
  ['LAV-2', 'LAV2', 6, 'b1 b2 b3 b4 b5 b6 b7 b8', 'b4 b5 b6 b7 b8'],
  ['UR-1, UR-2', 'UR 1&2', 2, 'u1 u2 u3'],
  ['UTILITY SINK', 'UTILITY SINK', null, 'ut'],
  ['WC-1, WC-2', 'WC 1&2', 10, 'w1 w2 w3 w4 w5'],
  ['WHA-200', 'WHA', 2, 'h2'],
  ['WHA-300', 'WHA', 1, 'h3'],
  ['WHA-500', 'WHA', 1, 'h5'],
]
const BACK: Record<string, string> = { m2: '830AA', a2: 'TEL145', b1: 'KOHLER 2215-0', b2: 'TEL145', w2: 'TET2UA31#SS' }
const CARRIERS: Record<string, string> = { e7: 'JOSAM 17560-WCBL floor mount bi-level water cooler carrier', u3: 'JOSAM 17560-UR floor mount urinal carrier', w5: 'JOSAM 12694 4" NH double adjustable horizontal closet carrier' }

export const spacexToday: ProcurementRow[] = FIXTURES.flatMap(([tag, fixture, count, ids, oo = '']) => {
  const list = ids.split(' ')
  const orderOnly = new Set(oo.split(' ').filter(Boolean))
  return list.map((id): ProcurementRow => {
    const part = list.length > 1 ? { partKey: id, key: `part:${id}` } : { key: tag }
    const common = { ...part, tag, fixture, fixtureCount: count, itemId: `it-${tag}`, quantity: count, orderOnly: orderOnly.has(id) }
    if (CARRIERS[id]) return row(id, 'delivered', { ...common, product: CARRIERS[id]!, addedByHand: true, stage: 'rough_in', orderedOn: '2026-09-23', deliveredOn: '2026-09-29', poRef: 'space x carriers.' })
    if (id in BACK) return row(id, 'sent_back', { ...common, product: `PRODUCT ${id}`, submittal: 'rejected', reviewNote: BACK[id]! })
    if (id === 'ut') return row(id, 'not_submitted', { ...common, product: '(no product)', noProduct: true, submittal: 'none', quantity: null })
    return row(id, 'awaiting', { ...common, product: `PRODUCT ${id}` })
  })
})

const ready = (orderBy: string, lead: number): Partial<ProcurementRow> => ({ submittal: 'approved', releasedOn: '2026-10-22', requiredOn: '2026-12-08', orderBy, leadTimeDays: lead })
const each = (ids: string, to: [ProcurementStatus, Partial<ProcurementRow>]) => Object.fromEntries(ids.split(' ').map((id) => [id, to]))
const LATER: Record<string, [ProcurementStatus, Partial<ProcurementRow>]> = {
  ...each('fco fd', ['delivered', { orderedOn: '2026-10-06', deliveredOn: '2026-10-15', poRef: '4471', leadTimeDays: 7, stage: 'rough_in' }]),
  w4: ['ordered', { orderedOn: '2026-10-08', expectedOn: '2026-10-29', requiredOn: '2026-10-20', floatDays: -9, late: true, poRef: '4480', leadTimeDays: 21, stage: 'rough_in' }],
  ...each('h2 h3 h5', ['ordered', { orderedOn: '2026-10-20', expectedOn: '2026-11-03', requiredOn: '2026-11-10', floatDays: 7, poRef: '4502', leadTimeDays: 14, stage: 'top_out' }]),
  ...each('d1 d2', ['released', ready('2026-11-10', 28)]),
  ...each('m1 m3 m4 m5 m6 m7', ['released', ready('2026-10-27', 42)]),
  hb: ['released', ready('2026-11-24', 14)],
  ...each('e1 e2', ['released', ready('2026-11-03', 35)]),
  ...each('e3 e4 e5 e6', ['released', { noGc: true, requiredOn: '2026-12-08', orderBy: '2026-12-01', leadTimeDays: 7 }]),
  ...each('a1 a3 b3', ['awaiting', { leadTimeDays: 28, requiredOn: '2026-12-08' }]),
  ...each('a2 b2', ['awaiting', { leadTimeDays: 28, requiredOn: '2026-12-08', submittal: 'open', reviewNote: null }]),
}
const idOf = (r: ProcurementRow) => r.partKey ?? Object.entries({ FCO: 'fco', FD: 'fd', 'HB-3': 'hb', 'UTILITY SINK': 'ut', 'WHA-200': 'h2', 'WHA-300': 'h3', 'WHA-500': 'h5' }).find(([tag]) => tag === r.tag)?.[1] ?? ''
export const spacexLater: ProcurementRow[] = spacexToday.map((r) => {
  const to = LATER[idOf(r)]
  return to ? { ...r, status: to[0], ...to[1] } : r
})
