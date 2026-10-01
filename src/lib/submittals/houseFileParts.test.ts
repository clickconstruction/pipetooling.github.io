import { describe, expect, it } from 'vitest'
import { defaultFileChoice, fileMatchCounts, matchFileToRows, pairParts, partRole, planFileApply, rawCommonHeader, readHouseFile, tagSet, type HouseFilePart } from './houseFileParts'
import { BP375_NWS_PAGES } from './houseFileParts.bp375.fixture'
import type { SubmittalPartRow } from './itemParts'

const read = readHouseFile(BP375_NWS_PAGES)!

describe('reading a house’s submittal file (BP375, National Wholesale, 2026-09-28)', () => {
  it('finds the job line, the tags in file order, and 32 parts', () => {
    expect(rawCommonHeader(BP375_NWS_PAGES)).toBe('SPACEX BA-2 CORE & SHELL ')
    expect(read.header).toBe('SPACEX BA-2 CORE & SHELL')
    expect(read.tags).toEqual(['DWH-1', 'ET-1', 'HWCP-1', 'PRV-1', 'WC-1 & WC-2', 'UR-1', 'LAV-1', 'LAV-2', 'MB-1', 'EWC-1'])
    expect(read.parts).toHaveLength(32)
  })

  it('each part has its maker, its model as the divider prints it, its description and its pages', () => {
    const of = (tag: string) => read.parts.filter((p) => p.tag === tag).map((p) => [p.maker, p.model, p.pages])
    expect(of('DWH-1')).toEqual([['Rheem', 'PROPH40 T2 RH400', [6, 7, 8, 9]], ['Watts', 'LFN36-M1', [10, 11]]])
    expect(of('WC-1 & WC-2')).toEqual([['Toto', 'CT728CUVG#01', [20, 21]], ['Toto', 'TET2LBi31#SS', [22, 23]], ['Toto', 'SC534#01', [24]]])
    expect(of('LAV-1').map((x) => x[1])).toEqual(['TSL.MON.B.38.2', 'TLE25006U1#CP', 'B-8236', 'Z8802XL-LR-PC', 'Z8700-8B-PC', '170D-LF'])
    expect(of('LAV-1')[0]![2]).toEqual([31, 32, 33, 34, 35, 36, 37, 38, 39, 40])
    expect(of('MB-1').map((x) => [x[0], x[1]])).toEqual([['Fiat', 'MSB2424'], ['T&S Brass', 'B-0665-CR-BSTR'], ['Fiat', '832-AA'], ['Fiat', '889-CC'], ['Fiat', 'E88AA24000'], ['Fiat', 'MSG-2424']])
    const valve = read.parts.find((p) => p.model === 'TET2LBi31#SS')!
    expect(valve.description).toBe('Ecopower Touchless 1.28 Gpf High Efficiency Concealed Toilet Flushometer Valve For Back Spud With 14 X 12 Cover Plate, Iot Ready - Stainless Steel')
    expect(valve.label.startsWith('TOTO TET2LBI31#SS ECOPOWER TOUCHLESS 1.28 GPF')).toBe(true)
    expect(read.parts.find((p) => p.model === '60A0B6001')!.description).toBe('Lead Free Brass Autocirc 1/2" Fixed Thermostat With Timer')
  })

  it('a file with no stamped job line, or no part to read, is not a house file', () => {
    expect(readHouseFile(['one page of cut sheet text, nothing else on it', 'another page entirely, different words'])).toBeNull()
    expect(readHouseFile([])).toBeNull()
  })
})

describe('the file beside the rows', () => {
  const part = (id: string, item: string, label: string, seq: number, extra: Partial<SubmittalPartRow> = {}): SubmittalPartRow => ({ id, item_id: item, bid_id: 'b', sequence_order: seq, label, manufacturer: null, model: null, description: null, quantity: 1, on_submittal: true, source: 'takeoff', part_id: null, source_line_id: null, source_template_item_id: null, assembly: null, priced_label: null, reason_note: null, supply_house_id: null, lead_time_days: null, stage: null, sheet_file: null, sheet_pages: [], review_decision: null, review_note: null, reviewed_at: null, reviewed_by_name: null, reviewed_by_email: null, reviewed_by_person_id: null, decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, procure_key: `k-${id}`, carried_from_part_id: null, created_at: '', updated_at: '', ...extra })
  // BP375's rows and the parts the takeoff priced (2026-10-01).
  const rows = [
    { id: 'wc', tag: 'WC-1, WC-2' },
    { id: 'lav2', tag: 'LAV-2' },
    { id: 'mop', tag: '12" DEEP MOP SINK' },
    { id: 'dwh', tag: 'DWH-1' },
  ]
  const parts = new Map<string, SubmittalPartRow[]>([
    ['wc', [part('bowl', 'wc', 'TOTO CT728CUVG#01 TORNADO FLUSH COMMERCIAL FLUSHOMETER WALL- MOUNTED TOILET', 1), part('fv', 'wc', 'TOTO TET2UB31#SS', 2), part('seat', 'wc', 'MAINLINE ML1055SSC000 WHT ELONG', 3), part('car', 'wc', 'ZURN Z1201-NR4-CL12-RYK17 NH DURA-COAT CI ADJ HORIZONTAL SIPHON JET EZCARRY W/RT HAND INLET', 4)]],
    ['lav2', [part('kohler', 'lav2', 'KOHLER 2215-0 LADENA WHITE', 1), part('t25', 'lav2', 'TOTO T25S51E#CP', 2), part('sup', 'lav2', 'BRASSCRAFT/PLUMBSHOP PLS1-16AF 3/8 COMP X 1/2 FIP X 16 IN SS SUPPLY', 3, { on_submittal: false, quantity: 2 }), part('grid', 'lav2', 'HYDRAPRO |HYDRAPRO H20008 CP BRASS COMMERCIAL LAVATORY GRID DRAIN WITH OVERFLOW', 4, { on_submittal: false }), part('trap', 'lav2', 'MAINLINE MLZ8700 11/4 CHROME PLATED 17 GUAGE SEMI CAST BRASS P-TRAP', 5, { on_submittal: false }), part('flange', 'lav2', 'MAINLINE ML90105 POLISHED CHROME 5/8 OD LOW PATTERN SURE GRIP FLANGE', 6, { on_submittal: false }), part('soap', 'lav2', 'BOBRICK B-8236', 7)]],
    ['mop', [part('basin', 'mop', 'FIAT MSB2424100 MOLDED STONE MOP SERVICE BASIN 24X24X10', 1), part('hose', 'mop', 'FIAT MOP BSN HOSE & BRKT COMBO PN: 832AA', 2)]],
    ['dwh', [part('rheem', 'dwh', 'RHEEM PROPH40-T2-RH400-SO', 1), part('watts', 'dwh', 'WATTS LFN36M1 0556031 3/4 M BRASS WATER SERVICE VACUUM RELIEF VALVE LEAD FREE', 2)]],
  ])
  const matches = matchFileToRows(read, rows, parts)
  const at = (tag: string) => matches.find((m) => m.tag === tag)!

  it('reads tags the same however they are written', () => {
    expect(tagSet('WC-1 & WC-2')).toEqual(['WC 1', 'WC 2'])
    expect(tagSet('WC-1, WC-2')).toEqual(['WC 1', 'WC 2'])
    expect(tagSet('WC 1&2')).toEqual(['WC 1', 'WC 2'])
    expect(tagSet('FD')).toEqual([])
    expect(partRole('Vitreous China Undermount Lavatory')).toBe('lavatory')
    expect(partRole('Ecopower Touchless 1.28 Gpf High Efficiency Concealed Toilet Flushometer Valve')).toBe('flush valve')
    expect(partRole('Tornado Flush Commercial Flushometer Wall Mounted Toilet')).toBe('toilet')
  })

  it('WC-1 & WC-2: the bowl is the same; the 1.28 gpf valve takes the TET2UB31’s place; the TOTO seat is left for the estimator — the Mainline seat’s name never says seat', () => {
    const wc = at('WC-1 & WC-2')
    expect(wc.itemIds).toEqual(['wc'])
    expect(wc.how).toBe('tag')
    expect(wc.parts.map((p) => [p.file.model, p.kind, p.rowPart?.id ?? null])).toEqual([['CT728CUVG#01', 'same', 'bowl'], ['TET2LBi31#SS', 'different', 'fv'], ['SC534#01', 'not_priced', null]])
    expect(wc.notInFile.map((p) => p.id)).toEqual(['seat', 'car'])
  })

  it('LAV-2: the soap dispenser is the same; drain, supply and trap pair by what they are; the Sloan, the TOTO spout and the mixing valve stand beside nothing yet', () => {
    const lav = at('LAV-2')
    expect(lav.parts.map((p) => [p.file.model, p.kind, p.rowPart?.id ?? null])).toEqual([
      ['3873021', 'not_priced', null],
      ['TLE25006U1#CP', 'not_priced', null],
      ['B-8236', 'same', 'soap'],
      ['Z8743-PC', 'different', 'grid'],
      ['Z8802XL-LR-PC', 'different', 'sup'],
      ['Z8700-8B-PC', 'different', 'trap'],
      ['170D-LF', 'not_priced', null],
    ])
    expect(lav.notInFile.map((p) => p.id)).toEqual(['kohler', 't25', 'flange'])
  })

  it('MB-1 is no row’s tag: the row whose parts it carries is the one to rename; ET-1 stands alone', () => {
    expect(at('MB-1')).toMatchObject({ itemIds: ['mop'], how: 'parts' })
    expect(at('MB-1').parts[0]).toMatchObject({ kind: 'same' })
    expect(at('ET-1')).toMatchObject({ itemIds: [], how: null })
    expect(at('ET-1').parts.map((p) => p.kind)).toEqual(['not_priced'])
    expect(at('DWH-1').parts.map((p) => p.kind)).toEqual(['same', 'same'])
  })

  it('counts every part', () => {
    const c = fileMatchCounts(matches)
    expect(c.same + c.different + c.not_priced).toBe(32)
  })

  it('one left on each side pairs, trim aside', () => {
    const file: HouseFilePart = { tag: 'X-1', maker: 'Sloan', model: '3873021', description: 'Vitreous china undermount', label: 'SLOAN 3873021', pages: [1], firstPageText: '' }
    const r = pairParts([file], [part('k', 'x', 'KOHLER 2215-0 LADENA WHITE', 1), part('s', 'x', 'BRASSCRA PLB113XP ANG', 2, { on_submittal: false })])
    expect(r.parts[0]).toMatchObject({ kind: 'different', rowPart: { id: 'k' } })
    expect(r.notInFile.map((p) => p.id)).toEqual(['s'])
  })
})

describe('what Use the file’s parts writes', () => {
  const part = (id: string, label: string, seq: number, extra: Partial<SubmittalPartRow> = {}): SubmittalPartRow => ({ id, item_id: 'lav2', bid_id: 'b', sequence_order: seq, label, manufacturer: null, model: null, description: null, quantity: 1, on_submittal: true, source: 'takeoff', part_id: `cat-${id}`, source_line_id: null, source_template_item_id: null, assembly: null, priced_label: null, reason_note: null, supply_house_id: null, lead_time_days: null, stage: null, sheet_file: null, sheet_pages: [], review_decision: null, review_note: null, reviewed_at: null, reviewed_by_name: null, reviewed_by_email: null, reviewed_by_person_id: null, decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, procure_key: `k-${id}`, carried_from_part_id: null, created_at: '', updated_at: '', ...extra })
  const rowParts = [
    part('kohler', 'KOHLER 2215-0 LADENA WHITE', 1),
    part('soap', 'BOBRICK B-8236', 2),
    part('grid', 'HYDRAPRO H20008 GRID DRAIN', 3, { on_submittal: false }),
    part('flange', 'MAINLINE ML90105 FLANGE', 4, { on_submittal: false }),
    part('t25', 'TOTO T25S51E#CP', 5),
  ]
  const lav2 = matchFileToRows(read, [{ id: 'lav2', tag: 'LAV-2' }], new Map([['lav2', rowParts]])).find((m) => m.tag === 'LAV-2')!

  it('starts from the reader’s pairing; trim and order-only kept, another part the file drops taken off', () => {
    const c = defaultFileChoice(lav2)
    expect(c).toMatchObject({ use: true, addRow: false, rename: false })
    expect(c.keep).toEqual({ kohler: false, flange: true, t25: false })
  })

  it('the Sloan in the Kohler’s place, the spout in the T25S51E’s: rewritten with the takeoff’s name kept as priced; the rest new; the flange kept order only after them; the row’s sheet is every page', () => {
    const c = { ...defaultFileChoice(lav2), inPlaceOf: { ...defaultFileChoice(lav2).inPlaceOf, 0: 'kohler', 1: 't25' } }
    const plan = planFileApply(lav2, c, 'lav2', rowParts, { fileIndex: 0, houseId: 'h-nws' })
    expect(plan.updates.map((u) => [u.partId, u.patch.model, u.patch.priced_label ?? '(kept)', u.patch.sequence_order])).toEqual([
      ['kohler', '3873021', 'KOHLER 2215-0 LADENA WHITE', 1],
      ['t25', 'TLE25006U1#CP', 'TOTO T25S51E#CP', 2],
      ['soap', 'B-8236', '(kept)', 3],
      ['grid', 'Z8743-PC', 'HYDRAPRO H20008 GRID DRAIN', 4],
    ])
    expect(plan.updates[0]!.patch).toMatchObject({ source: 'file', on_submittal: true, supply_house_id: 'h-nws', sheet_file: 0, sheet_pages: [49, 50], part_id: null, label: 'SLOAN 3873021 VITREOUS CHINA UNDERMOUNT LAVATORY' })
    expect('part_id' in plan.updates[2]!.patch).toBe(false)
    expect(plan.inserts.map((p) => [p.model, p.sequence_order])).toEqual([['Z8802XL-LR-PC', 5], ['Z8700-8B-PC', 6], ['170D-LF', 7]])
    expect(plan.keptOrderOnly).toEqual([{ partId: 'flange', sequence_order: 8 }])
    expect(plan.deletes).toEqual([])
    expect(plan.rowPatch).toEqual({ sheet_file: 0, sheet_pages: [49, 50, 51, 52, 53, 54, 55, 56, 57, 58], sheet_source: 'house' })
  })

  it('a row found by its parts takes the file’s tag; a part the estimator takes off is deleted', () => {
    const mop = matchFileToRows(read, [{ id: 'mop', tag: '12" DEEP MOP SINK' }], new Map([['mop', [part('basin', 'FIAT MSB2424100 MOLDED STONE MOP SERVICE BASIN', 1, { item_id: 'mop' }), part('e77', 'FIAT E77AA24000 BUMPER GUARDS', 2, { item_id: 'mop' })]]])).find((m) => m.tag === 'MB-1')!
    const plan = planFileApply(mop, defaultFileChoice(mop), 'mop', [part('basin', 'FIAT MSB2424100 MOLDED STONE MOP SERVICE BASIN', 1, { item_id: 'mop' }), part('e77', 'FIAT E77AA24000 BUMPER GUARDS', 2, { item_id: 'mop' })], { fileIndex: 0, houseId: null })
    expect(plan.rowPatch.tag).toBe('MB-1')
    expect(plan.deletes).toEqual(['e77'])
  })
})
