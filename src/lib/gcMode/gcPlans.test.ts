import { describe, expect, it } from 'vitest'
import {
  gcReducer,
  initialGcState,
  nextSetLabel,
  packagesForSheets,
  planEmail,
  planRecipients,
  sheetAsIndexed,
  sheetsAtRev,
  sheetsInText,
  type GcAction,
  type GcProject,
} from './gcModel'

const state = initialGcState()
function project(id: string): GcProject {
  const p = state.projects.find((x) => x.id === id)
  if (!p) throw new Error(`no project ${id}`)
  return p
}

describe('sheetsInText', () => {
  it('reads sheet numbers with a dash, without one, and with a dot', () => {
    expect(sheetsInText('E-201 boxes. A101 and a1.01 changed. FP-101 heads. A-101A enlarged.')).toEqual(['E-201', 'A101', 'A1.01', 'FP-101', 'A-101A'])
  })

  it('does not take a word like R30, T24 or RTU-3 for a sheet', () => {
    expect(sheetsInText('R30 insulation, Title T24, RTU-3 moved 6 ft.')).toEqual([])
  })
})

describe('sheetAsIndexed', () => {
  it('writes a sheet the way the index does', () => {
    expect(sheetAsIndexed(project('boerne'), 'a401')).toBe('A-401')
    expect(sheetAsIndexed(project('boerne'), 'A-401')).toBe('A-401')
  })

  it('writes a sheet the index lacks with a dash when the index uses dashes', () => {
    expect(sheetAsIndexed(project('boerne'), 'S301')).toBe('S-301')
  })
})

describe('nextSetLabel', () => {
  it('counts each numbered kind on its own', () => {
    expect(nextSetLabel(project('boerne'), 'Addendum')).toBe('Addendum 2')
    expect(nextSetLabel(project('boerne'), 'Bulletin')).toBe('Bulletin 1')
    expect(nextSetLabel(project('helotes'), 'Addendum')).toBe('Addendum 1')
  })

  it('names a whole set once, then numbers a second one', () => {
    expect(nextSetLabel(project('boerne'), 'Permit set')).toBe('Permit set')
    expect(nextSetLabel(project('helotes'), 'Permit set')).toBe('Permit set 2')
  })
})

describe('packagesForSheets', () => {
  it('guesses from the sheet titles as well as the letters', () => {
    // S-201 is the roof framing plan: concrete from the letters, steel and roofing from the title.
    expect(packagesForSheets(project('boerne'), ['S-201'])).toEqual(['conc', 'steel', 'roof'])
  })

  it('reads the title the set gives a sheet it adds', () => {
    expect(packagesForSheets(project('boerne'), ['A-601'], [{ id: 'A-601', title: 'Roof plan' }])).toEqual(['roof'])
    expect(packagesForSheets(project('boerne'), ['A-601'])).toEqual([])
  })
})

describe('issuePlanSet', () => {
  const action: GcAction = {
    type: 'issuePlanSet',
    projectId: 'boerne',
    label: 'Addendum 2',
    note: 'A canopy over the storefront.',
    sheets: ['A-401', 'S-301', 'L-101'],
    addedSheets: [
      { id: 'S-301', title: 'Canopy framing plan' },
      { id: 'L-101', title: '' },
    ],
    touches: ['steel'],
    recipients: ['bexar', 'lonestar'],
    newTrades: [{ trade: 'Landscaping', budget: 22_000, ours: false, scope: ['Planting', 'Irrigation'] }],
  }
  const next = gcReducer(state, action)
  const boerne = next.projects.find((p) => p.id === 'boerne')
  const set = boerne?.planSets[boerne.planSets.length - 1]

  it('adds the set with its name, its new sheets and the trade it brings', () => {
    expect(set?.label).toBe('Addendum 2')
    expect(set?.rev).toBe(2)
    expect(set?.touches).toEqual(['steel', 'boerne-landscaping'])
    expect(boerne?.packages.map((p) => p.trade).slice(0, 3)).toEqual(['Sitework', 'Landscaping', 'Concrete'])
    expect(boerne?.packages.find((p) => p.trade === 'Landscaping')?.scope.map((s) => s.label)).toEqual(['Planting', 'Irrigation'])
  })

  it('emails only the companies ticked, and says it in the log', () => {
    expect(set?.sentTo?.map((x) => [x.partnerId, x.touched])).toEqual([
      ['bexar', true],
      ['lonestar', false],
    ])
    expect(next.log[0]?.text).toBe(
      'Issued Addendum 2 on Boerne Retail Shell and emailed 2 companies. 1 was told it changes their trade. It adds landscaping. Nobody is asked yet.',
    )
  })

  it('gives an added sheet the title the office typed, or says which set added it', () => {
    if (!boerne) return
    const sheets = sheetsAtRev(boerne, 2)
    expect(sheets.find((s) => s.id === 'S-301')).toMatchObject({ title: 'Canopy framing plan', added: true, changedInRev: 2 })
    expect(sheets.find((s) => s.id === 'L-101')).toMatchObject({ title: 'Added by Addendum 2', added: true })
  })

  it('counts the next addendum from the addenda only', () => {
    if (!boerne) return
    const withBulletin = gcReducer(next, { ...action, label: 'Bulletin 1', addedSheets: [], newTrades: [] })
    const p = withBulletin.projects.find((x) => x.id === 'boerne')
    expect(p ? nextSetLabel(p, 'Addendum') : '').toBe('Addendum 3')
  })
})

describe('planEmail', () => {
  const last = (lines: string[]) => lines[lines.length - 1]
  const boerne = project('boerne')
  const voltage = planRecipients(state, boerne, ['elec']).find((r) => r.partner.id === 'voltage') ?? null

  it('names the scope lines the new set touches', () => {
    const one = planEmail(boerne, 'Addendum 2', 'More fixtures.', ['E-101'], voltage, ['Lighting'])
    expect(last(one.body)).toMatch(/^This changes electrical\. The line it touches is lighting\. Please open the plans/)
    const two = planEmail(boerne, 'Addendum 2', 'More fixtures.', ['E-101'], voltage, ['Lighting', 'Site lighting'])
    expect(last(two.body)).toMatch(/The lines it touches are lighting and site lighting\./)
  })

  it('says nothing about lines when none are named', () => {
    expect(last(planEmail(boerne, 'Addendum 2', 'More fixtures.', ['E-101'], voltage).body)).toMatch(/^This changes electrical\. Please open the plans/)
  })
})
