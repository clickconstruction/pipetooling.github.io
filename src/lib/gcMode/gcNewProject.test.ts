import { describe, expect, it } from 'vitest'
import {
  SAMPLE_SHEET_INDEX,
  buildNewProject,
  guessLineSheets,
  lineReads,
  lineSheets,
  linesOnSheets,
  tradeSheets,
  gcReducer,
  initialGcState,
  newProjectId,
  proposalTotals,
  sheetIndexInText,
  stageProgress,
  tradesForSheets,
  usualScope,
  type NewProjectDraft,
} from './gcModel'

function draft(over: Partial<NewProjectDraft> = {}): NewProjectDraft {
  return {
    name: 'Leon Springs Urgent Care',
    address: '24165 IH-10 W, San Antonio',
    town: 'San Antonio',
    customerId: null,
    ownerName: 'Leon Springs Health',
    architectId: 'marshvale',
    architectName: 'Marsh & Vale Architects',
    bidDue: '2026-10-16',
    sizeNote: '6,800 sq ft clinic, one story',
    setLabel: 'Bid set',
    issuedOn: '2026-10-02',
    setNote: '',
    sheets: sheetIndexInText(SAMPLE_SHEET_INDEX).sheets,
    trades: [
      { trade: 'Plumbing', budget: 72_000, ours: true, scope: usualScope('Plumbing') },
      { trade: 'Sitework', budget: 0, ours: false, scope: ['Clearing and grading', '  ', 'Detention pond'] },
    ],
    ...over,
  }
}

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

  it('reads the made-up index as 21 sheets', () => {
    const r = sheetIndexInText(SAMPLE_SHEET_INDEX)
    expect(r.sheets).toHaveLength(21)
    expect(r.unread).toEqual([])
  })
})

describe('tradesForSheets', () => {
  it('guesses the trades in build order and names the sheets behind each guess', () => {
    const guesses = tradesForSheets(sheetIndexInText(SAMPLE_SHEET_INDEX).sheets)
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

  it('guesses the same eight trades the Boerne Retail Shell was split into', () => {
    const boerne = initialGcState().projects.find((p) => p.id === 'boerne')
    expect(tradesForSheets(boerne?.sheets ?? []).map((g) => g.trade).sort()).toEqual(
      (boerne?.packages ?? []).map((p) => p.trade).sort(),
    )
  })
})

describe('buildNewProject', () => {
  it('makes a project under Bidding to the owner with its first set and its trades', () => {
    const state = initialGcState()
    const { project, customers } = buildNewProject(state, draft())
    expect(project.id).toBe('leon-springs-urgent-care')
    expect(project.stage).toBe('pursuing')
    expect(project.planSets).toEqual([
      { rev: 0, label: 'Bid set', issuedOn: '2026-10-02', note: '21 sheets.', changedSheets: [], touches: [] },
    ])
    expect(project.packages.map((p) => p.trade)).toEqual(['Sitework', 'Plumbing'])
    expect(project.packages[0]?.scope).toEqual([
      { id: 'leon-springs-urgent-care-sitework-1', label: 'Clearing and grading' },
      { id: 'leon-springs-urgent-care-sitework-2', label: 'Detention pond' },
    ])
    expect(project.packages[1]?.selfPerform?.value).toBe(72_000)
    expect(project.packages[1]?.carried).toBe('self')
    expect(customers.map((c) => [c.id, c.name, c.kind])).toEqual([['leon-springs-health', 'Leon Springs Health', 'Owner']])
    expect(project.customerId).toBe('leon-springs-health')
    expect(project.architectId).toBe('marshvale')
  })

  it('uses the record already there when a new name matches one', () => {
    const { project, customers } = buildNewProject(initialGcState(), draft({ ownerName: 'cibolo creek partners' }))
    expect(customers).toEqual([])
    expect(project.customerId).toBe('cibolo')
    expect(project.owner).toBe('Cibolo Creek Partners')
  })

  it('never reuses a project id', () => {
    const once = gcReducer(initialGcState(), { type: 'createProject', draft: draft() })
    expect(newProjectId(once, draft())).toBe('leon-springs-urgent-care-2')
  })
})

describe('createProject', () => {
  it('adds the project and the new owner, and says so in the log', () => {
    const next = gcReducer(initialGcState(), { type: 'createProject', draft: draft() })
    const project = next.projects.find((p) => p.id === 'leon-springs-urgent-care')
    expect(project).toBeDefined()
    expect(next.customers.some((c) => c.id === 'leon-springs-health')).toBe(true)
    expect(next.log[0]?.text).toBe('Started Leon Springs Urgent Care. The bid set has 21 sheets, split into 2 trades.')
    if (!project) return
    expect(proposalTotals(project).holes.map((p) => p.trade)).toEqual(['Sitework'])
    expect(stageProgress(next, project).center).toMatch(/\d+\/\d+/)
  })
})

describe('scope lines and their sheets', () => {
  const index = sheetIndexInText(SAMPLE_SHEET_INDEX).sheets
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

  it('keeps the sheets the office tied to each line, and leaves the field off when it said nothing', () => {
    const { project } = buildNewProject(
      initialGcState(),
      draft({
        trades: [
          { trade: 'Electrical', budget: 0, ours: false, scope: ['Lighting', '  ', 'Devices'], scopeSheets: [['E-101'], ['E-999'], []] },
          { trade: 'Plumbing', budget: 0, ours: true, scope: ['Rough in'] },
        ],
      }),
    )
    const elecPkg = project.packages.find((p) => p.trade === 'Electrical')
    expect(elecPkg?.scope).toEqual([
      { id: 'leon-springs-urgent-care-electrical-1', label: 'Lighting', sheets: ['E-101'] },
      { id: 'leon-springs-urgent-care-electrical-2', label: 'Devices', sheets: [] },
    ])
    expect(project.packages.find((p) => p.trade === 'Plumbing')?.scope[0]).toEqual({ id: 'leon-springs-urgent-care-plumbing-1', label: 'Rough in' })
  })

  it('reads a line\'s sheets as said, or guesses them on a project written before lines had sheets', () => {
    const boerne = initialGcState().projects.find((p) => p.id === 'boerne')
    const elecPkg = boerne?.packages.find((p) => p.id === 'elec')
    if (!boerne || !elecPkg) throw new Error('no Boerne electrical')
    expect(tradeSheets(boerne, 'Electrical').map((x) => x.id)).toEqual(['E-101', 'E-201', 'E-301'])
    const lighting = elecPkg.scope.find((i) => i.label === 'Lighting')
    expect(lighting ? lineSheets(boerne, elecPkg, lighting) : null).toEqual({ sheets: ['E-101'], guessed: true })
    // Lighting and Site lighting name E-101; Service and gear and Fire alarm name no sheet, so they read all of Electrical.
    expect(linesOnSheets(boerne, elecPkg, ['E-101']).map((i) => i.label)).toEqual(['Service and gear', 'Lighting', 'Fire alarm', 'Site lighting'])
    expect(linesOnSheets(boerne, elecPkg, ['M-101'])).toEqual([])
    expect(lighting ? lineSheets(boerne, elecPkg, { ...lighting, sheets: ['E-201'] }) : null).toEqual({ sheets: ['E-201'], guessed: false })
  })

  it('counts a line that names no sheet as reading every sheet of its trade', () => {
    const boerne = initialGcState().projects.find((p) => p.id === 'boerne')
    const hvac = boerne?.packages.find((p) => p.id === 'hvac')
    if (!boerne || !hvac) throw new Error('no Boerne HVAC')
    const ducts = hvac.scope.find((i) => i.label === 'Ductwork')
    expect(ducts ? lineReads(boerne, hvac, ducts) : null).toEqual({ sheets: ['M-101', 'M-201'], guessed: true, wholeTrade: true })
    expect(linesOnSheets(boerne, hvac, ['M-101']).map((i) => i.label)).toEqual(['Rooftop units', 'Ductwork', 'Controls', 'Test and balance'])
    expect(ducts ? lineReads(boerne, hvac, { ...ducts, sheets: [] }) : null).toEqual({ sheets: ['M-101', 'M-201'], guessed: false, wholeTrade: true })
  })
})
