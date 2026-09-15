import { describe, expect, it } from 'vitest'

import { KNOWN_MANUFACTURERS, SCHEDULE_TAG_SYNONYMS, normalizeTag, parseFixtureSchedule } from './parseFixtureSchedule'

const FIXTURES = [
  { id: 'f1', fixture: 'Toilet' },
  { id: 'f2', fixture: 'Lavatory' },
  { id: 'f3', fixture: 'Kitchen sink' },
  { id: 'f4', fixture: 'Water heater' },
  { id: 'f5', fixture: 'Floor drain' },
  { id: 'f6', fixture: 'Hose bibb' },
  { id: 'f7', fixture: 'Backflow preventer' },
  { id: 'f8', fixture: 'Expansion tank' },
  { id: 'f9', fixture: 'Mop sink' },
  { id: 'f10', fixture: 'Shower/tub combos' },
]

const SPACEX_SCHEDULE = [
  'PLUMBING FIXTURE SCHEDULE',
  'MARK DESCRIPTION MANUFACTURER MODEL CW HW W V',
  '',
  'WC-1 WATER CLOSET, WALL HUNG, 1.28 GPF TOTO CT708UVG#01 3" 2" 1" 1/2"',
  '     FLUSH VALVE: TOTO TET1GN32#CP, ELONGATED BOWL',
  'LAV-1 LAVATORY, WALL HUNG, ADA TOTO LT307 / TEL145 1/2" 1/2" 1-1/2" 1-1/2"',
  'DWH-1 WATER HEATER, GAS, 40 GAL RHEEM PROPH40 T2 RH375 40 GAL 3/4" 3/4"',
  'RPZ-1 REDUCED PRESSURE BACKFLOW PREVENTER ZURN-WILKINS 375 4"',
  'HB-3 WALL HYDRANT, FREEZELESS WOODFORD B74-CH 3/4"',
  'FD-1 FLOOR DRAIN, NICKEL BRONZE STRAINER JR SMITH 2005 3"',
  'ET-1 EXPANSION TANK AMTROL ST-12 3/4"',
].join('\n')

function line(text: string, tag: string) {
  const found = parseFixtureSchedule(text, FIXTURES).lines.find((l) => l.tag === tag)
  if (!found) throw new Error(`no line for ${tag}`)
  return found
}

describe('normalizeTag', () => {
  it('upper-cases and hyphenates', () => {
    expect(normalizeTag('WC 1')).toBe('WC-1')
    expect(normalizeTag('wc-1')).toBe('WC-1')
    expect(normalizeTag('LAV2')).toBe('LAV-2')
    expect(normalizeTag(' DWH-1 ')).toBe('DWH-1')
    expect(normalizeTag('RD-4A')).toBe('RD-4A')
  })
  it('rejects non-tags', () => {
    expect(normalizeTag('WATER CLOSET')).toBeNull()
    expect(normalizeTag('Page 3')).toBeNull()
    expect(normalizeTag('')).toBeNull()
    expect(normalizeTag('1234')).toBeNull()
  })
})

describe('parseFixtureSchedule — a plan schedule', () => {
  const parsed = parseFixtureSchedule(SPACEX_SCHEDULE, FIXTURES)

  it('yields one line per tag and skips the header and blank lines', () => {
    expect(parsed.lines.map((l) => l.tag)).toEqual(['WC-1', 'LAV-1', 'DWH-1', 'RPZ-1', 'HB-3', 'FD-1', 'ET-1'])
    expect(parsed.skipped).toEqual(['PLUMBING FIXTURE SCHEDULE', 'MARK DESCRIPTION MANUFACTURER MODEL CW HW W V', ''])
  })

  it('WC-1: TOTO CT708UVG#01, the wrapped flush-valve line folded into the row', () => {
    const wc = line(SPACEX_SCHEDULE, 'WC-1')
    expect(wc.manufacturer).toBe('TOTO')
    expect(wc.model).toBe('CT708UVG#01')
    expect(wc.description).toBe('WATER CLOSET, WALL HUNG, 1.28 GPF')
    expect(wc.raw).toContain('FLUSH VALVE: TOTO TET1GN32#CP')
    expect(wc.confidence).toBe('exact')
    expect(wc.fixtureMatches[0]).toMatchObject({ fixture: 'Toilet', id: 'f1' })
    expect(wc.fixtureMatches[0]?.score).toBeGreaterThanOrEqual(0.9)
  })

  it('LAV-1: the model stops at the "/" that starts the faucet', () => {
    const lav = line(SPACEX_SCHEDULE, 'LAV-1')
    expect(lav.manufacturer).toBe('TOTO')
    expect(lav.model).toBe('LT307')
    expect(lav.description).toBe('LAVATORY, WALL HUNG, ADA')
    expect(lav.fixtureMatches[0]?.fixture).toBe('Lavatory')
    expect(lav.confidence).toBe('exact')
  })

  it('DWH-1: a multi-token model that stops before the "40 GAL" rating', () => {
    const dwh = line(SPACEX_SCHEDULE, 'DWH-1')
    expect(dwh.manufacturer).toBe('Rheem')
    expect(dwh.model).toBe('PROPH40 T2 RH375')
    expect(dwh.description).toBe('WATER HEATER, GAS, 40 GAL')
    expect(dwh.fixtureMatches[0]?.fixture).toBe('Water heater')
    expect(dwh.confidence).toBe('exact')
  })

  it('RPZ-1: Zurn-Wilkins wins over Zurn, the model is the bare 375, the 4" size is not part of it', () => {
    const rpz = line(SPACEX_SCHEDULE, 'RPZ-1')
    expect(rpz.manufacturer).toBe('Zurn-Wilkins')
    expect(rpz.model).toBe('375')
    expect(rpz.description).toBe('REDUCED PRESSURE BACKFLOW PREVENTER')
    expect(rpz.fixtureMatches[0]?.fixture).toBe('Backflow preventer')
  })

  it('HB-3: Woodford B74-CH, the wall hydrant lands on the hose bibb row', () => {
    const hb = line(SPACEX_SCHEDULE, 'HB-3')
    expect(hb.manufacturer).toBe('Woodford')
    expect(hb.model).toBe('B74-CH')
    expect(hb.description).toBe('WALL HYDRANT, FREEZELESS')
    expect(hb.fixtureMatches[0]?.fixture).toBe('Hose bibb')
    expect(hb.confidence).toBe('exact')
  })

  it('FD-1 and ET-1: JR Smith beats Smith, a bare first-position integer is the model, ST-12 keeps its hyphen', () => {
    const fd = line(SPACEX_SCHEDULE, 'FD-1')
    expect(fd.manufacturer).toBe('JR Smith')
    expect(fd.model).toBe('2005')
    expect(fd.description).toBe('FLOOR DRAIN, NICKEL BRONZE STRAINER')
    expect(fd.fixtureMatches[0]?.fixture).toBe('Floor drain')
    const et = line(SPACEX_SCHEDULE, 'ET-1')
    expect(et.manufacturer).toBe('Amtrol')
    expect(et.model).toBe('ST-12')
    expect(et.description).toBe('EXPANSION TANK')
    expect(et.fixtureMatches[0]?.fixture).toBe('Expansion tank')
  })
})

describe('parseFixtureSchedule — tags', () => {
  it('"WC-1, WC-2" expands to two lines sharing the parse', () => {
    const parsed = parseFixtureSchedule('WC-1, WC-2 WATER CLOSET, FLOOR MOUNT KOHLER K-3493-0 4" 1/2"', FIXTURES)
    expect(parsed.lines.map((l) => l.tag)).toEqual(['WC-1', 'WC-2'])
    for (const l of parsed.lines) {
      expect(l.manufacturer).toBe('Kohler')
      expect(l.model).toBe('K-3493-0')
      expect(l.description).toBe('WATER CLOSET, FLOOR MOUNT')
    }
  })

  it('"WC-1 & 2" expands with the shared prefix', () => {
    const parsed = parseFixtureSchedule('WC-1 & 2 WATER CLOSET TOTO CST744S', FIXTURES)
    expect(parsed.lines.map((l) => l.tag)).toEqual(['WC-1', 'WC-2'])
    expect(parsed.lines[1]?.model).toBe('CST744S')
  })

  it('"WC 1" normalizes to WC-1', () => {
    const parsed = parseFixtureSchedule('WC 1 WATER CLOSET AMERICAN STANDARD 3351.101', FIXTURES)
    expect(parsed.lines[0]?.tag).toBe('WC-1')
    expect(parsed.lines[0]?.manufacturer).toBe('American Standard')
    expect(parsed.lines[0]?.model).toBe('3351.101')
  })

  it('tabs and doubled spaces collapse', () => {
    const parsed = parseFixtureSchedule('LAV-2\t\tLAVATORY,   COUNTERTOP\tKOHLER   K-2196-8\t1/2"  1/2"', FIXTURES)
    const lav = parsed.lines[0]
    expect(lav?.tag).toBe('LAV-2')
    expect(lav?.description).toBe('LAVATORY, COUNTERTOP')
    expect(lav?.manufacturer).toBe('Kohler')
    expect(lav?.model).toBe('K-2196-8')
  })

  it('a page number or note line does not become a tag or a continuation', () => {
    const parsed = parseFixtureSchedule(['FD-2 FLOOR DRAIN ZURN Z415', 'Page 3', '1. ALL FIXTURES SHALL BE WHITE.'].join('\n'), FIXTURES)
    expect(parsed.lines).toHaveLength(1)
    expect(parsed.lines[0]?.description).toBe('FLOOR DRAIN')
    expect(parsed.skipped).toEqual(['Page 3', '1. ALL FIXTURES SHALL BE WHITE.'])
  })
})

describe('parseFixtureSchedule — manufacturer and model edge cases', () => {
  it('a line with only a tag and description has no manufacturer and no model', () => {
    const parsed = parseFixtureSchedule('MS-1 MOP SINK, FLOOR MOUNTED, 24 X 24', FIXTURES)
    const ms = parsed.lines[0]
    expect(ms?.manufacturer).toBeNull()
    expect(ms?.model).toBeNull()
    expect(ms?.description).toBe('MOP SINK, FLOOR MOUNTED, 24 X 24')
    expect(ms?.fixtureMatches[0]?.fixture).toBe('Mop sink')
    expect(ms?.confidence).toBe('exact')
  })

  it('without a manufacturer the first letters+digits token is guessed as the model', () => {
    const parsed = parseFixtureSchedule('P-1 GAS WATER HEATER 50 GAL RE2HP50 3/4"', [])
    expect(parsed.lines[0]?.manufacturer).toBeNull()
    expect(parsed.lines[0]?.model).toBe('RE2HP50')
    expect(parsed.lines[0]?.description).toBe('GAS WATER HEATER 50 GAL RE2HP50')
  })

  it('a residential list with no manufacturers is fuzzy or none, never exact without a fixture match', () => {
    const text = ['WC-1 Water closet, elongated, 1.28 gpf', 'LAV-1 Lavatory, drop-in', 'KS-1 Kitchen sink, double bowl', 'P-1 Ice maker box'].join('\n')
    const noRows = parseFixtureSchedule(text, [])
    expect(noRows.lines.map((l) => l.confidence)).toEqual(['none', 'none', 'none', 'none'])
    expect(noRows.lines.every((l) => l.manufacturer === null && l.fixtureMatches.length === 0)).toBe(true)

    const withRows = parseFixtureSchedule(text, FIXTURES)
    const byTag = Object.fromEntries(withRows.lines.map((l) => [l.tag, l]))
    expect(byTag['WC-1']?.confidence).toBe('exact')
    expect(byTag['WC-1']?.fixtureMatches[0]?.fixture).toBe('Toilet')
    expect(byTag['KS-1']?.fixtureMatches[0]?.fixture).toBe('Kitchen sink')
    expect(byTag['P-1']?.confidence).toBe('none')
  })

  it('a manufacturer with no fixture match is fuzzy', () => {
    const parsed = parseFixtureSchedule('TP-1 TRAP PRIMER PRECISION PLUMBING PRODUCTS PR-500', [{ fixture: 'Toilet' }])
    expect(parsed.lines[0]?.confidence).toBe('none')
    const withBrand = parseFixtureSchedule('TP-1 TRAP PRIMER SIOUX CHIEF 695-01', [{ fixture: 'Toilet' }])
    expect(withBrand.lines[0]?.manufacturer).toBe('Sioux Chief')
    expect(withBrand.lines[0]?.model).toBe('695-01')
    expect(withBrand.lines[0]?.confidence).toBe('fuzzy')
  })

  it('flexible brand spellings: A.O. SMITH / AO SMITH / T & S, and the model finish suffix is kept', () => {
    expect(parseFixtureSchedule('WH-1 WATER HEATER A.O. SMITH BTH-120', FIXTURES).lines[0]?.manufacturer).toBe('A.O. Smith')
    expect(parseFixtureSchedule('WH-1 WATER HEATER AO SMITH BTH-120', FIXTURES).lines[0]?.model).toBe('BTH-120')
    const ts = parseFixtureSchedule('KS-1 KITCHEN SINK FAUCET T & S B-0231', FIXTURES).lines[0]
    expect(ts?.manufacturer).toBe('T&S')
    expect(ts?.model).toBe('B-0231')
    const wc = parseFixtureSchedule('WC-2 WATER CLOSET SLOAN ST-2459#SS', FIXTURES).lines[0]
    expect(wc?.model).toBe('ST-2459#SS')
  })

  it('a WH tag with a water heater description picks the heater, not the hydrant', () => {
    const wh = parseFixtureSchedule('WH-1 WATER HEATER, ELECTRIC BRADFORD WHITE RE350S6', FIXTURES).lines[0]
    expect(wh?.manufacturer).toBe('Bradford White')
    expect(wh?.fixtureMatches[0]?.fixture).toBe('Water heater')
    const hyd = parseFixtureSchedule('WH-2 WALL HYDRANT WOODFORD 65', FIXTURES).lines[0]
    expect(hyd?.fixtureMatches[0]?.fixture).toBe('Hose bibb')
  })

  it('a schedule that lists the brand before the description still gets a description', () => {
    const parsed = parseFixtureSchedule('SH-1 SYMMONS S-96-1 SHOWER VALVE AND HEAD, PRESSURE BALANCED', FIXTURES)
    expect(parsed.lines[0]?.manufacturer).toBe('Symmons')
    expect(parsed.lines[0]?.model).toBe('S-96-1')
    expect(parsed.lines[0]?.description).toBe('SHOWER VALVE AND HEAD, PRESSURE BALANCED')
    expect(parsed.lines[0]?.fixtureMatches[0]?.fixture).toBe('Shower/tub combos')
  })

  it('exports the brand list and the synonym table for growth', () => {
    expect(KNOWN_MANUFACTURERS).toContain('Zurn-Wilkins')
    expect(SCHEDULE_TAG_SYNONYMS.some((s) => s.tags.includes('WC') && s.targets.includes('toilet'))).toBe(true)
  })
})
