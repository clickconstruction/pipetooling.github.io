import { describe, expect, it } from 'vitest'
import {
  budgetFromSize,
  guessLineSheets,
  guessLineSpecs,
  indexDiff,
  inSentence,
  scopeGaps,
  sheetDiscipline,
  sheetIndexInText,
  sheetsInText,
  specDivision,
  specIndexInText,
  specsInText,
  sqFtInText,
  takenOutInText,
  tradeForSpec,
  tradesForPlans,
  tradesForSheets,
  usualExcludes,
  usualScope,
} from './plans'

// Made-up indexes for a made-up clinic, as a cover sheet and a project manual print them.
const SHEET_INDEX = [
  'SHEET INDEX',
  'GENERAL',
  'G-001  COVER SHEET AND CODE SUMMARY',
  'CIVIL',
  'C-101  SITE PLAN',
  'C-201  GRADING AND DRAINAGE PLAN',
  'C-301  UTILITY PLAN',
  'L-101  LANDSCAPE AND IRRIGATION PLAN',
  'ARCHITECTURAL',
  'A-101  FLOOR PLAN',
  'A-102  REFLECTED CEILING PLAN',
  'A-201  EXTERIOR ELEVATIONS',
  'A-301  WALL SECTIONS',
  'A-401  DOOR AND HARDWARE SCHEDULE',
  'A-501  ROOF PLAN AND DETAILS',
  'ID-101 FINISH PLAN',
  'STRUCTURAL',
  'S-101  FOUNDATION PLAN',
  'S-201  ROOF FRAMING PLAN',
  'MECHANICAL, ELECTRICAL AND PLUMBING',
  'M-101  HVAC PLAN',
  'P-101  PLUMBING PLAN',
  'P-201  PLUMBING RISERS',
  'E-101  LIGHTING PLAN',
  'E-201  POWER PLAN',
  'E-301  PANEL SCHEDULES',
  'FP-101 FIRE SPRINKLER PLAN',
].join('\n')

const SPEC_INDEX = [
  'PROJECT MANUAL, TABLE OF CONTENTS',
  'DIVISION 01 - GENERAL REQUIREMENTS',
  '01 10 00  SUMMARY',
  '01 25 00  SUBSTITUTION PROCEDURES',
  'DIVISION 03 - CONCRETE',
  '03 30 00  CAST-IN-PLACE CONCRETE',
  'DIVISION 05 - METALS',
  '05 12 00  STRUCTURAL STEEL FRAMING',
  '05 31 00  STEEL DECKING',
  'DIVISION 07 - THERMAL AND MOISTURE PROTECTION',
  '07 54 23  THERMOPLASTIC POLYOLEFIN ROOFING',
  '07 62 00  SHEET METAL FLASHING AND TRIM',
  'DIVISION 08 - OPENINGS',
  '08 11 13  HOLLOW METAL DOORS AND FRAMES',
  '08 41 13  ALUMINUM-FRAMED ENTRANCES AND STOREFRONTS',
  '08 71 00  DOOR HARDWARE',
  'DIVISION 09 - FINISHES',
  '09 22 16  NON-STRUCTURAL METAL FRAMING',
  '09 29 00  GYPSUM BOARD',
  '09 51 13  ACOUSTICAL PANEL CEILINGS',
  '09 65 19  RESILIENT TILE FLOORING',
  '09 91 23  INTERIOR PAINTING',
  'DIVISION 21 - FIRE SUPPRESSION',
  '21 13 13  WET-PIPE SPRINKLER SYSTEMS',
  'DIVISION 22 - PLUMBING',
  '22 11 16  DOMESTIC WATER PIPING',
  '22 40 00  PLUMBING FIXTURES',
  'DIVISION 23 - HVAC',
  '23 31 13  METAL DUCTS',
  '23 74 13  PACKAGED ROOFTOP AIR-CONDITIONING UNITS',
  'DIVISION 26 - ELECTRICAL',
  '26 24 16  PANELBOARDS',
  '26 51 00  INTERIOR LIGHTING',
  'DIVISION 31 - EARTHWORK',
  '31 23 00  EXCAVATION AND FILL',
  'DIVISION 32 - EXTERIOR IMPROVEMENTS',
  '32 12 16  ASPHALT PAVING',
  '32 84 00  PLANTING IRRIGATION',
].join('\n')

describe('sheetIndexInText', () => {
  it('reads the sheet number and title from each line, and passes over headings', () => {
    const r = sheetIndexInText('SHEET INDEX\nARCHITECTURAL\nA-101  FLOOR PLAN\nM-101 HVAC PLAN\nE-201: Power plan')
    expect(r.sheets).toEqual([
      { id: 'A-101', title: 'Floor plan' },
      { id: 'M-101', title: 'HVAC plan' },
      { id: 'E-201', title: 'Power plan' },
    ])
    expect(r.unread).toEqual([])
  })

  it('reads the numbering styles architects use, each sheet once', () => {
    const r = sheetIndexInText('A101 Floor plan\nA1.01 Floor plan\nfp-101 sprinkler plan\nA 201 Elevations\nA-101A Enlarged plan\nA101 again')
    expect(r.sheets.map((s) => s.id)).toEqual(['A101', 'A1.01', 'FP-101', 'A-201', 'A-101A'])
  })

  it('keeps a line with a number that does not start with a sheet number, so nothing goes missing unsaid', () => {
    expect(sheetIndexInText('Issued 9/18 for bid\nC-101 Site plan').unread).toEqual(['Issued 9/18 for bid'])
  })

  it('reads the made-up index as 21 sheets, each in its discipline', () => {
    const r = sheetIndexInText(SHEET_INDEX)
    expect(r.sheets).toHaveLength(21)
    expect(r.unread).toEqual([])
    expect(sheetDiscipline('FP-101')).toBe('Fire protection')
    expect(sheetDiscipline('ID-101')).toBe('Interiors')
    expect(sheetDiscipline('Q-1')).toBe('Other')
  })
})

describe('tradesForSheets', () => {
  it('guesses the trades in the list order and names the sheets behind each guess', () => {
    const guesses = tradesForSheets(sheetIndexInText(SHEET_INDEX).sheets)
    expect(guesses.map((g) => g.trade)).toEqual([
      'Sitework',
      'Landscaping',
      'Concrete',
      'Structural steel',
      'Framing and drywall',
      'Roofing',
      'Doors and hardware',
      'Painting',
      'Flooring',
      'Fire sprinkler',
      'Plumbing',
      'HVAC',
      'Electrical',
    ])
    expect(guesses.find((g) => g.trade === 'Roofing')?.from).toEqual(['A-501', 'S-201'])
  })
})

describe('a scope line and its sheets', () => {
  const index = sheetIndexInText(SHEET_INDEX).sheets
  const civil = index.filter((x) => x.id.startsWith('C-'))
  const elec = index.filter((x) => x.id.startsWith('E-'))

  it('guesses a line\'s sheets from the words it shares with the trade\'s sheet titles', () => {
    expect(guessLineSheets('Utilities to 5 ft of the building', civil)).toEqual(['C-301'])
    expect(guessLineSheets('Clearing and grading', civil)).toEqual(['C-201'])
    expect(guessLineSheets('Lighting', elec)).toEqual(['E-101'])
    expect(guessLineSheets('Panels and feeders', elec)).toEqual(['E-301'])
  })

  it('gives a line that meets no title no sheet, which reads as the trade as a whole', () => {
    expect(guessLineSheets('Devices', elec)).toEqual([])
    expect(guessLineSheets('and the plan', elec)).toEqual([])
  })
})

describe('budgets from the size', () => {
  it('reads the square feet in a size line', () => {
    expect(sqFtInText('6,800 sq ft clinic, one story')).toBe(6800)
    expect(sqFtInText('A 4200 SF pad building')).toBe(4200)
    expect(sqFtInText('three tenant bays')).toBeNull()
  })

  it('rounds a trade\'s rough budget to the nearest $500, and has none for a trade with no rate', () => {
    expect(budgetFromSize('Sitework', 6800)).toBe(81_500)
    expect(budgetFromSize('Electrical', 6800)).toBe(122_500)
    expect(budgetFromSize('Elevator', 6800)).toBeNull()
  })
})

describe('the project manual', () => {
  const manual = specIndexInText(SPEC_INDEX).sections

  it('reads the made-up table of contents as 25 sections in 12 divisions, passing over the headings', () => {
    const r = specIndexInText(SPEC_INDEX)
    expect(r.sections).toHaveLength(25)
    expect(r.unread).toEqual([])
    expect(r.sections[0]).toEqual({ id: '01 10 00', title: 'Summary' })
    expect(new Set(r.sections.map((x) => specDivision(x.id))).size).toBe(12)
  })

  it('reads the numbering styles manuals use, each section once, and keeps a line it could not read', () => {
    const r = specIndexInText('DIVISION 07\n075423 TPO roofing\nSection 09 91 23 - Interior painting\n09-29-00: GYPSUM BOARD\n07 54 23 Roofing again\nAddendum 2 items\nFinishes')
    expect(r.sections).toEqual([
      { id: '07 54 23', title: 'TPO roofing' },
      { id: '09 91 23', title: 'Interior painting' },
      { id: '09 29 00', title: 'Gypsum board' },
    ])
    expect(r.unread).toEqual(['Addendum 2 items'])
  })

  it('gives each section a trade by the start of its number, the longest match first', () => {
    expect(tradeForSpec('09 91 23')).toBe('Painting')
    expect(tradeForSpec('09 29 00')).toBe('Framing and drywall')
    expect(tradeForSpec('08 41 13')).toBe('Glass and storefront')
    expect(tradeForSpec('32 84 00')).toBe('Landscaping')
    expect(tradeForSpec('01 10 00')).toBeNull()
  })

  it('adds the trades the sections suggest to the ones the sheets suggest', () => {
    const guesses = tradesForPlans([{ id: 'P-101', title: 'Plumbing plan' }], manual)
    expect(guesses.find((g) => g.trade === 'Plumbing')).toEqual({ trade: 'Plumbing', from: ['P-101'], specs: ['22 11 16', '22 40 00'] })
    expect(guesses.find((g) => g.trade === 'Glass and storefront')).toEqual({ trade: 'Glass and storefront', from: [], specs: ['08 41 13'] })
  })

  it('ties a scope line to the trade sections that share a word with it', () => {
    const roofing = manual.filter((x) => tradeForSpec(x.id) === 'Roofing')
    expect(guessLineSpecs('Roof membrane', roofing)).toEqual(['07 54 23'])
    expect(guessLineSpecs('Sheet metal and flashing', roofing)).toEqual(['07 62 00'])
    expect(guessLineSpecs('Insulation', roofing)).toEqual([])
  })
})

describe('a later set', () => {
  it('reads sheet numbers with a dash, without one, and with a dot, and not a word like R30', () => {
    expect(sheetsInText('E-201 boxes. A101 and a1.01 changed. FP-101 heads. A-101A enlarged.')).toEqual(['E-201', 'A101', 'A1.01', 'FP-101', 'A-101A'])
    expect(sheetsInText('R30 insulation, Title T24, RTU-3 moved 6 ft.')).toEqual([])
  })

  it('reads section numbers out of the notes, each once, and not amounts or dates', () => {
    expect(specsInText('Section 09 91 23: low-VOC paint. 22-40-00 fixtures changed, and 07.54.23 too. Paid $120000 on 2026-10-03. Section 099123 again. 48 12 34 is no division.')).toEqual([
      '09 91 23',
      '22 40 00',
      '07 54 23',
    ])
  })

  it('reads what a note takes out, and not a word that takes out work', () => {
    expect(takenOutInText('Delete sheet C-201.\nA-101 is deleted.\nDelete the detention pond per C-101.\nE-201 removed', sheetsInText)).toEqual(['C-201', 'A-101', 'E-201'])
    expect(takenOutInText('Section 09-30-13 removed. Revise section 09 91 23.', specsInText)).toEqual(['09 30 13'])
  })

  it('compares a pasted index with ours, numbers without their dashes and titles without capitals', () => {
    const have = [
      { id: 'C-101', title: 'Site plan' },
      { id: 'C-201', title: 'Grading and drainage plan' },
      { id: 'A-101', title: 'Floor plan' },
    ]
    const d = indexDiff(have, [
      { id: 'C101', title: 'Site, grading and drainage plan' },
      { id: 'A-101', title: 'FLOOR PLAN' },
      { id: 'A-601', title: 'Interior details' },
    ])
    expect(d.added).toEqual([{ id: 'A-601', title: 'Interior details' }])
    expect(d.gone).toEqual([{ id: 'C-201', title: 'Grading and drainage plan' }])
    expect(d.renamed).toEqual([{ id: 'C-101', from: 'Site plan', to: 'Site, grading and drainage plan' }])
    expect(d.same).toEqual([{ id: 'A-101', title: 'Floor plan' }])
  })
})

describe('what a trade leaves out, and the gaps between the trades', () => {
  const trades = ['Sitework', 'Roofing', 'Plumbing', 'HVAC', 'Electrical'].map((trade) => ({ trade, scope: usualScope(trade), excludes: usualExcludes(trade) }))

  it('finds what one trade leaves to another that the other does not list, and skips the owner and us', () => {
    expect(scopeGaps(trades)).toEqual([
      { trade: 'Plumbing', label: 'Gas piping', by: 'HVAC', problem: 'not in their scope' },
      { trade: 'HVAC', label: 'Power wiring to the units', by: 'Electrical', problem: 'not in their scope' },
    ])
  })

  it('names a gap left to a trade the job does not have, and closes one once the line is added', () => {
    expect(scopeGaps(trades.filter((t) => t.trade !== 'Roofing'))).toContainEqual({ trade: 'HVAC', label: 'Flashing at the roof curbs', by: 'Roofing', problem: 'not on the job' })
    const fixed = trades.map((t) => (t.trade === 'HVAC' ? { ...t, scope: [...t.scope, 'Gas piping'] } : t))
    expect(scopeGaps(fixed).map((g) => g.label)).toEqual(['Power wiring to the units'])
  })

  it('keeps capitals inside a sentence', () => {
    expect(inSentence('HVAC')).toBe('HVAC')
    expect(inSentence('Framing and drywall')).toBe('framing and drywall')
  })
})
