import { describe, expect, it } from 'vitest'
import type { ResearchPermitRow } from './permitResearch'
import { findLastMoveWords, findMoreWords, findPermits, findPlaceWords, findReady, findTokens, matchesFind } from './permitFind'

// Every name, street and number here is made up.
function row(over: Partial<ResearchPermitRow> = {}): ResearchPermitRow {
  return {
    id: 'p1',
    city: 'San Antonio',
    source: 'sa-applied',
    permit_number: 'COM-PRJ-APP26-00000001',
    permit_type: 'Commercial Project Application',
    stage: 'applied',
    residential: false,
    work_type: 'New commercial',
    project_name: 'Sample Retail Shell',
    address: '100 SAMPLE ST',
    zip: '78245',
    lat: 29.5,
    lng: -98.6,
    submitted_on: '2026-11-06',
    issued_on: null,
    filed_on: '2026-11-06',
    declared_value: null,
    area_sf: null,
    contact: 'Tall Pine Development',
    plumber: null,
    plumber_permit_on: null,
    verdict: null,
    verdict_reason: null,
    verdict_look_again_on: null,
    verdict_prospect_id: null,
    verdict_by: null,
    verdict_by_name: null,
    verdict_at: null,
    ...over,
  }
}
const passed = (over: Partial<ResearchPermitRow> = {}) => row({ verdict: 'not_for_us', verdict_reason: 'Passed on the skim: too far.', verdict_reason_code: 'too_far', verdict_by: 'sam', verdict_by_name: 'Sam', verdict_at: '2026-11-09T18:00:00Z', ...over })

describe('what a person types to find a permit (punch list #302)', () => {
  it('reads the words typed and waits for two letters', () => {
    expect(findTokens('  100   Sample, ST ')).toEqual(['100', 'sample', 'st'])
    expect(findReady('s')).toBe(false)
    expect(findReady('sa')).toBe(true)
    expect(findReady('  ')).toBe(false)
  })

  it('finds by street, zip, city, number, project, work, who pulled it and the plumber, every word somewhere', () => {
    const r = row({ plumber: 'Sample Plumbing Co', builder_name: 'Tall Pine' })
    for (const q of ['sample st', '78245', 'san antonio', 'app26-00000001', 'retail shell', 'new commercial', 'tall pine', 'sample plumbing', 'antonio retail pine']) {
      expect(matchesFind(r, findTokens(q)), q).toBe(true)
    }
    expect(matchesFind(r, findTokens('austin'))).toBe(false)
    expect(matchesFind(r, findTokens('sample austin'))).toBe(false)
    expect(matchesFind(r, [])).toBe(false)
    // Two fields do not run together: the end of the street and the start of the zip are not one word.
    expect(matchesFind(row({ address: '100 MAIN', zip: '78245' }), findTokens('main78245'))).toBe(false)
  })

  it('puts the number typed whole first, then a number begun, then a street begun, then the most recently touched', () => {
    const rows = [
      row({ id: 'street', permit_number: 'X-1', address: '2026 OAK ST', filed_on: '2026-10-01' }),
      row({ id: 'exact', permit_number: '2026-000777', address: '9 ELM ST' }),
      row({ id: 'begun', permit_number: '2026-000777 BP', address: '9 ELM ST' }),
      row({ id: 'other-new', permit_number: 'Y-2', address: '5 PINE ST', project_name: 'Lot 2026', verdict: 'look', verdict_at: '2026-11-09T12:00:00Z' }),
      row({ id: 'other-old', permit_number: 'Y-1', address: '5 PINE ST', project_name: 'Lot 2026', filed_on: '2026-09-01' }),
    ]
    expect(findPermits(rows, '2026-000777').found.map((r) => r.id)).toEqual(['exact', 'begun'])
    expect(findPermits(rows, '2026').found.map((r) => r.id)).toEqual(['exact', 'begun', 'street', 'other-new', 'other-old'])
  })

  it('finds a permit on any list and in any city, and says how many more there are', () => {
    const rows = [row({ id: 'sa' }), passed({ id: 'atx', city: 'Austin', address: '100 SAMPLE LN' }), row({ id: 'nb', city: 'New Braunfels', address: '7 OTHER RD', project_name: null, contact: null })]
    expect(findPermits(rows, 'sample').found.map((r) => r.id).sort()).toEqual(['atx', 'sa'])
    expect(findPermits(rows, 'sample austin').found.map((r) => r.id)).toEqual(['atx'])
    expect(findPermits(rows, 's').found).toEqual([])
    const many = Array.from({ length: 45 }, (_, i) => row({ id: `p${i}`, permit_number: `N-${String(i).padStart(3, '0')}` }))
    const out = findPermits(many, 'sample')
    expect(out.found).toHaveLength(40)
    expect(out.more).toBe(5)
    expect(findMoreWords(5)).toBe('and 5 more. Add a word to narrow it.')
    expect(findMoreWords(0)).toBeNull()
  })
})

describe('what a result says', () => {
  it('where the permit sits now', () => {
    expect(findPlaceWords(row())).toBe('Skim')
    expect(findPlaceWords(row({ verdict: 'look' }))).toBe('Investigating')
    expect(findPlaceWords(row({ verdict: 'approach' }))).toBe('Pursuing')
    expect(findPlaceWords(passed())).toBe('Closed · passed')
    expect(findPlaceWords(passed({ verdict_reason_code: 'np_no_answer' }))).toBe('Closed · not pursuing')
    expect(findPlaceWords(row({ plumber_permit_on: '2026-11-05' }))).toBe('Closed · has a plumber')
  })

  it('the last thing done to it', () => {
    expect(findLastMoveWords(row())).toBe('Waiting on a skim')
    expect(findLastMoveWords(passed())).toBe('Sam passed, Nov 9: too far')
    expect(findLastMoveWords(row({ verdict: 'look', verdict_reason: 'Marked to investigate on the skim.', verdict_by_name: 'Eve', verdict_for_name: 'Kim', verdict_at: '2026-11-08T18:00:00Z' }))).toBe('Eve chose to investigate for Kim, Nov 8')
    expect(findLastMoveWords(row({ plumber: 'Sample Plumbing Co', plumber_permit_on: '2026-11-05' }))).toBe('Sample Plumbing Co has it, Nov 5')
    expect(findLastMoveWords(row({ plumber_permit_on: '2026-11-05' }))).toBe('A plumbing permit is on file, Nov 5')
    // A permit passed and then paired with a plumbing permit reads the plumber: that is what closed it.
    expect(findLastMoveWords(passed({ plumber: 'Sample Plumbing Co', plumber_permit_on: '2026-11-10' }))).toBe('Sample Plumbing Co has it, Nov 10')
  })
})
