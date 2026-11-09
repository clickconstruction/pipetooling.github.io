import { describe, expect, it } from 'vitest'
import {
  canResearchPermits,
  defaultLookAgainYmd,
  leadDoor,
  leadFromPermit,
  lensCounts,
  newSinceLooked,
  pulledWords,
  rowLens,
  rowsShowing,
  shortDay,
  shortMoney,
  sqFtWords,
  verdictHold,
  windowSinceYmd,
  workWords,
  type ResearchPermitRow,
} from './permitResearch'

function row(over: Partial<ResearchPermitRow> = {}): ResearchPermitRow {
  return {
    id: 'p1',
    city: 'San Antonio',
    source: 'sa-issued',
    permit_number: 'COM-BLG-PMT26-00000001',
    permit_type: 'Comm New Building Permit',
    stage: 'issued',
    residential: false,
    work_type: 'New commercial',
    project_name: 'Building No: N/A; Unit No: N/A',
    address: '100 SAMPLE ST',
    zip: '78245',
    lat: 29.4,
    lng: -98.5,
    submitted_on: '2026-10-02',
    issued_on: '2026-11-06',
    filed_on: '2026-11-06',
    declared_value: 1_400_000,
    area_sf: 6200,
    contact: 'Ridgeway Builders',
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

describe('canResearchPermits', () => {
  it('opens to the office and every estimator, and to nobody in the field', () => {
    expect(canResearchPermits('dev')).toBe(true)
    expect(canResearchPermits('assistant')).toBe(true)
    expect(canResearchPermits('controller')).toBe(true)
    expect(canResearchPermits('estimator')).toBe(true)
    expect(canResearchPermits('subcontractor')).toBe(false)
    expect(canResearchPermits('primary')).toBe(false)
    expect(canResearchPermits(null)).toBe(false)
  })
})

describe('the lenses', () => {
  it('puts a bare row on waiting, a plumber on taken, a verdict on its own lens', () => {
    expect(rowLens(row())).toBe('waiting')
    expect(rowLens(row({ plumber: 'Lone Star Plumbing Co.' }))).toBe('taken')
    expect(rowLens(row({ verdict: 'look' }))).toBe('look')
    expect(rowLens(row({ plumber: 'Someone', verdict: 'approach' }))).toBe('approach')
  })
  it('counts and filters by lens, and everything shows everything', () => {
    const rows = [row(), row({ id: 'p2', plumber: 'X' }), row({ id: 'p3', verdict: 'not_for_us' })]
    expect(lensCounts(rows)).toEqual({ waiting: 1, look: 0, approach: 0, not_for_us: 1, taken: 1 })
    expect(rowsShowing(rows, 'waiting').map((r) => r.id)).toEqual(['p1'])
    expect(rowsShowing(rows, 'all')).toHaveLength(3)
  })
  it('counts rows filed after the day the reader last looked', () => {
    const rows = [row({ filed_on: '2026-11-06' }), row({ id: 'p2', filed_on: '2026-11-03' })]
    expect(newSinceLooked(rows, '2026-11-04')).toBe(1)
    expect(newSinceLooked(rows, null)).toBe(2)
  })
})

describe('the words', () => {
  it('shortens money and area for a cell', () => {
    expect(shortMoney(1_400_000)).toBe('$1.4M')
    expect(shortMoney(12_000_000)).toBe('$12M')
    expect(shortMoney(420_000)).toBe('$420k')
    expect(shortMoney(9_500)).toBe('$9,500')
    expect(shortMoney(null)).toBeNull()
    expect(shortMoney(0)).toBeNull()
    expect(sqFtWords(6200)).toBe('6,200 sq ft')
    expect(sqFtWords(1)).toBeNull()
  })
  it('writes the Work cell from the kind, the size, the money and a real project name', () => {
    expect(workWords(row())).toEqual({ main: 'New commercial · 6,200 sq ft', detail: '$1.4M declared' })
    expect(workWords(row({ declared_value: null, area_sf: null, project_name: 'Site Work - Sample Plaza' }))).toEqual({
      main: 'New commercial',
      detail: 'value not declared · Site Work - Sample Plaza',
    })
  })
  it('names the day short and the window since-day right', () => {
    expect(shortDay('2026-11-06')).toBe('Nov 6')
    expect(shortDay(null)).toBe('—')
    expect(windowSinceYmd('2026-11-09', 30)).toBe('2026-10-10')
    expect(defaultLookAgainYmd('2026-11-09')).toBe('2026-11-23')
  })
  it('writes the Pulled line with the counts, and says when nothing was pulled', () => {
    const counts = { waiting: 9, look: 2, approach: 3, not_for_us: 22, taken: 31 }
    const line = pulledWords({ ranAt: null, error: null, newCount: 14, lastLookedYmd: '2026-11-05', counts })
    expect(line).toContain('Not pulled yet')
    expect(line).toContain('14 new since you looked')
    expect(line).toContain('9 wait on a look')
    expect(line).toContain('31 already have a plumber')
    const stopped = pulledWords({ ranAt: new Date().toISOString(), error: 'the feed answered 503', newCount: 0, lastLookedYmd: null, counts })
    expect(stopped).toMatch(/^Pulled /)
    expect(stopped).toContain('the last pull stopped: the feed answered 503')
  })
})

describe('the verdict', () => {
  it('refuses an empty reason', () => {
    expect(verdictHold('   ')).toBe('Say why in a line. The next estimator reads it.')
    expect(verdictHold('Our size, we have won with them.')).toBeNull()
  })
  it('makes a GC lead and its job from the permit, source A permit', () => {
    const { prospect, job, companyName } = leadFromPermit(row(), 'gc', { userId: 'u1', masterUserId: 'm1' })
    expect(companyName).toBe('Ridgeway Builders')
    expect(prospect).toMatchObject({ kind: 'gc_lead', source: 'A permit', company_role: 'gc', company_name: 'Ridgeway Builders', created_by: 'u1', master_user_id: 'm1', address: '100 SAMPLE ST, San Antonio, 78245' })
    expect(String(prospect.notes)).toContain('COM-BLG-PMT26-00000001')
    expect(job).toMatchObject({ name: 'New commercial · 6,200 sq ft at 100 SAMPLE ST', sq_ft: 6200, status: 'open' })
    expect(leadDoor('abc')).toBe('/prospects?tab=follow-up&kind=gc-leads&prospect_id=abc')
  })
  it('names an unnamed puller so the lead still has a company', () => {
    expect(leadFromPermit(row({ contact: null }), 'owner', { userId: 'u1', masterUserId: 'm1' }).companyName).toBe('Who pulled the permit')
  })
})
