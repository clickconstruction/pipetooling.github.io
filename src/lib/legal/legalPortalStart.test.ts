import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  companyLines,
  companyShortName,
  contingencyPercent,
  matterLines,
  portalStepLines,
  portalTourStops,
  rulesLinkWords,
  startCounties,
  startStepWords,
  startStopLabel,
  START_STOPS,
  startStops,
  intakeNudgeWords,
  tourStepWords,
  workLines,
  type StartBookRow,
} from './legalPortalStart'

const row = (gcId: string | null, county: string, openBalance: number, lens: StartBookRow['lens'] = 'later'): StartBookRow => ({ lens, job: { gcId, county, openBalance } })

// Made-up figures: nine jobs across four counties, one big balance, three due.
const rows: StartBookRow[] = [
  row('gc-a', 'Bexar', 5200, 'due'),
  row('gc-a', 'Bexar', 3100),
  row('gc-b', 'Bexar', 16800, 'due'),
  row('gc-b', 'Guadalupe', 41000, 'due'),
  row('gc-c', 'Guadalupe', 6400),
  row(null, 'Hays', 1900),
  row('gc-c', 'Comal', 2500),
  row('gc-d', 'Comal', 3300),
  row('gc-d', '', 4700),
]

const TABS = [
  { key: 'account', label: 'Account' },
  { key: 'paper', label: 'Paper' },
  { key: 'their_word', label: 'Record of contact' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'fees_steps', label: 'Fees & steps' },
]

describe('Start here (v2.4820)', () => {
  it('names the office by its first word and labels the rail', () => {
    expect(companyShortName('Click Plumbing and Electrical')).toBe('Click')
    expect(companyShortName('The Pipe Co')).toBe('The office')
    expect(companyShortName('  ')).toBe('The office')
    expect(START_STOPS.map((s) => startStopLabel(s, 'Click'))).toEqual(['Click', 'Each matter', 'How we work', 'Your answers', 'The portal'])
    expect(startStops(false)).toEqual(['company', 'matter', 'work', 'portal'])
    expect(startStops(true)).toEqual(['company', 'matter', 'work', 'answers', 'portal'])
    expect(startStepWords(1, 4)).toBe('Step 2 of 4')
  })

  it('reads every figure of step 1 from the book and the matters', () => {
    expect(companyLines({ rows, matterCount: 1, matterBalance: 14400 })).toEqual([
      'Most of the work is for general contractors. 8 of 9 jobs on the lien grid have one.',
      'Counties: Bexar, Comal, Guadalupe and Hays.',
      '8 of 9 jobs owe $20,000 or less, the justice court limit.',
      'On the lien grid now: 9 jobs, $84,900 open.',
      'Due in the next 30 days: 3 jobs, $63,000.',
      'With your firm now: 1 matter, $14,400 in balance.',
    ])
  })

  it('counts the counties past five, words a minority of GC work, and says only what it knows with no book', () => {
    const wide = ['Bexar', 'Comal', 'Guadalupe', 'Hays', 'Travis', 'Medina', 'Blanco'].map((c) => row(null, c, 900))
    expect(startCounties(wide)).toEqual({ names: ['Bexar', 'Blanco', 'Comal', 'Guadalupe', 'Hays'], more: 2 })
    const lines = companyLines({ rows: wide, matterCount: 0, matterBalance: 0 })
    expect(lines[0]).toBe('0 of 7 jobs on the lien grid are for a general contractor.')
    expect(lines[1]).toBe('Counties: Bexar, Blanco, Comal, Guadalupe, Hays and 2 more.')
    expect(lines).not.toContain(expect.stringContaining('Due in the next 30 days'))
    expect(lines[lines.length - 1]).toBe('No matters with your firm yet.')
    expect(companyLines({ rows: [], matterCount: 2, matterBalance: 30500.4 })).toEqual(['With your firm now: 2 matters, $30,500 in balance.'])
  })

  it('states the fee from the firm row, whole percent either way, and leaves it out when unset', () => {
    expect(contingencyPercent(33)).toBe(33)
    expect(contingencyPercent(0.33)).toBe(33)
    expect(contingencyPercent(null)).toBe(0)
    expect(workLines({ short: 'Click', contingencyPct: 33, filingCost: 350 })[0]).toBe('Your fee is 33% contingency. Filing cost is $350.')
    expect(workLines({ short: 'Click', contingencyPct: 0, filingCost: 0 })[0]).toBe('Up to $20,000, file in justice court. Over it, county or district court.')
  })

  it('tours Matters, each tab the matter shows, the Lien grid and Notifications; three stops with no matter', () => {
    const full = portalTourStops({ short: 'Click', hasMatters: true, hasGrid: true, matterTabs: [{ key: 'narrative', label: 'Narrative' }, ...TABS, { key: 'unknown', label: 'Unknown' }] })
    expect(full.map((s) => s.key)).toEqual(['matters', 'narrative', 'account', 'paper', 'their_word', 'evidence', 'fees_steps', 'grid', 'notifications'])
    expect(full[3]).toMatchObject({ title: 'Paper', panel: 'matters', tab: 'paper', target: 'matter' })
    expect(full[7]).toMatchObject({ panel: 'grid', target: 'grid' })
    const none = portalTourStops({ short: 'Click', hasMatters: false, hasGrid: false, matterTabs: TABS })
    expect(none.map((s) => s.key)).toEqual(['matters', 'notifications'])
    expect(none[0]!.text).toBe('No matters yet. Each account Click refers appears here.')
    expect(tourStepWords(2, 8)).toBe('Tour · stop 3 of 8')
  })

  it('every sentence a first-timer reads passes the plain-words rule', () => {
    const words = [
      ...companyLines({ rows, matterCount: 3, matterBalance: 52000 }),
      ...companyLines({ rows: [row(null, 'San Patricio', 25000)], matterCount: 0, matterBalance: 0 }),
      ...matterLines('Click'),
      ...workLines({ short: 'Click', contingencyPct: 33, filingCost: 350 }),
      rulesLinkWords('Click'),
      intakeNudgeWords('Click'),
      ...portalStepLines(9),
      ...portalTourStops({ short: 'Click', hasMatters: true, hasGrid: true, matterTabs: [{ key: 'narrative', label: 'Narrative' }, ...TABS] }).map((s) => s.text),
      ...portalTourStops({ short: 'Click', hasMatters: false, hasGrid: true, matterTabs: TABS }).map((s) => s.text),
    ]
    expect(words.flatMap((w) => plainWordsFailures(w))).toEqual([])
  })
})
