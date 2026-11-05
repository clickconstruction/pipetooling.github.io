import { describe, expect, it } from 'vitest'
import type { Container, Movement, Place } from './onSite'
import { boxWords, buildSiteMaterialsReport, countsWords, footWords, jobWords, lastRecordedWords, nothingHeading, nothingWords, reportSections, unitOfPart, type SiteMaterialsRows } from './siteMaterialsReport'

const NOW = new Date('2026-11-04T17:00:00Z')
const SITE = { name: 'Harlow Ranch', customer: 'Ridgeway Builders', address: '4100 Harlow Ranch Rd, Blanco, TX' }
const J1 = { id: 'j1', label: 'J1042', name: 'Lodge rough-in' }
const J2 = { id: 'j2', label: 'J1047', name: 'Bunkhouse gas line' }
const J3 = { id: 'j3', label: 'J1051', name: 'Water wells' }
const J4 = { id: 'j4', label: 'J1053', name: 'Septic field' }

const A1 = '7d759246-8476-4a37-884f-ed1562d5663f'
const A2 = '0e0b5e41-5dd8-45ce-872c-b43891de645b'
const B1 = '3b5a0319-c1f5-454b-ab9f-2f465f9cadcd'
const C3 = '833c8327-3e32-4934-a0e8-1e013ba153cc'
const G1 = 'b4b0e605-17ae-440b-a064-f523bb4b0b12'
const S1 = '1dc28159-3589-4da1-a546-12d4ba868bd6'
const RET = 'cdb76211-fa3b-48f2-9600-d135cd4981e4'
const UNS1 = 'ffffffff-0000-4000-8000-000000000001'

const place = (id: string, jobId: string, name: string): Place => ({ id, jobId, name, createdAt: '2026-10-01T12:00:00Z' })
const container = (id: string, jobId: string, label: string, kind: Container['kind'], extra: Partial<Container> = {}): Container => ({ id, jobId, label, kind, where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T12:00:00Z', ...extra })
const move = (id: string, jobId: string, partName: string, quantity: number, reason: Movement['reason'], from: string | null, to: string | null, at: string, byName = 'Jordan', note = ''): Movement => ({ id, jobId, partId: null, partName, manufacturer: null, quantity, reason, fromContainerId: from, toContainerId: to, note, byUserId: null, byName, at, source: null, itemId: null })

const places = [place('p1', 'j1', 'Lodge level 1'), place('p2', 'j1', 'Lodge level 2'), place('p3', 'j1', 'Arena'), place('p4', 'j2', 'arena'), place('p6', 'j4', 'Field edge')]
const containers = [
  container(A1, 'j1', 'A1', 'cage', { locationId: 'p1', where: 'by the north stair' }),
  container(A2, 'j1', 'A2', 'cage', { locationId: 'p1' }),
  container(B1, 'j1', 'B1', 'box', { locationId: 'p2' }),
  container(C3, 'j1', 'C3', 'box'),
  container(UNS1, 'j1', 'Unsorted', 'unsorted'),
  container(RET, 'j1', 'A3', 'cage', { locationId: 'p1', retiredAt: '2026-10-20T12:00:00Z' }),
  container(G1, 'j2', 'G1', 'cage', { locationId: 'p4' }),
  container(S1, 'j4', 'S1', 'box', { locationId: 'p6' }),
]
const movements = [
  move('m1', 'j1', '3/4" copper 90', 100, 'delivered', null, UNS1, '2026-10-02T15:00:00Z', 'Office', 'ea'),
  move('m2', 'j1', '3/4" copper 90', 60, 'moved', UNS1, A1, '2026-10-03T15:00:00Z', 'Mateo'),
  move('m3', 'j1', '1/2" ball valve', 12, 'delivered', null, A1, '2026-10-05T15:00:00Z', 'Jordan', 'added on site'),
  move('m4', 'j1', '3/4" copper 90', 10, 'used', A1, null, '2026-10-28T23:30:00Z', 'Jordan'),
  // The rest of the copper moves on to B1 at Lodge level 2: the same part on hand in two places over time.
  move('m5', 'j1', '3/4" copper 90', 20, 'moved', A1, B1, '2026-11-01T15:00:00Z', 'Mateo'),
  move('m6', 'j1', 'Wax ring', 9, 'delivered', null, B1, '2026-10-31T15:00:00Z', 'Mateo', 'added on site'),
  move('m7', 'j1', 'Shower valve', 6, 'delivered', null, C3, '2025-10-29T15:00:00Z', 'Office', 'ea'),
  move('m8', 'j1', 'Left behind', 5, 'delivered', null, RET, '2026-10-01T15:00:00Z', 'Jordan', 'ea'),
  move('m9', 'j2', 'Gas valve 3/4"', 14, 'delivered', null, G1, '2026-10-27T15:00:00Z', 'Reyes', 'ea'),
  move('m10', 'j2', 'Gas valve 3/4"', 14, 'counted', G1, null, '2026-11-02T15:00:00Z', 'Reyes'),
  // S1 was filled and then emptied: the job has a box and nothing on site.
  move('m11', 'j4', 'Riser', 4, 'delivered', null, S1, '2026-10-20T15:00:00Z', 'Office', 'ea'),
  move('m12', 'j4', 'Riser', 4, 'used', S1, null, '2026-10-22T15:00:00Z', 'Jordan'),
]
const rows: SiteMaterialsRows = { places, containers, movements }

const build = (r: SiteMaterialsRows = rows, jobs = [J1, J2, J3, J4]) => buildSiteMaterialsReport({ site: SITE, jobs, rows: r, now: NOW, printedBy: 'Dana Example' })

describe('buildSiteMaterialsReport', () => {
  it('an empty site: no job, nothing on hand, the counts at zero', () => {
    const r = build({ places: [], containers: [], movements: [] }, [])
    expect(r.jobs).toEqual([])
    expect(r.nothing).toEqual([])
    expect(r.counts).toEqual({ jobs: 0, withMaterial: 0, places: 0, boxes: 0, lines: 0 })
    expect(r.printedOn).toBe('2026-11-04')
    expect(countsWords(r.counts)).toBe('0 jobs on the site · 0 with material · 0 places · 0 cages and boxes · 0 lines on hand')
    expect(reportSections(r, 'job')).toEqual([])
    expect(reportSections(r, 'location')).toEqual([])
  })

  it('a job with no places and no boxes is one line in the closing block; a job whose box was emptied names the box', () => {
    const r = build()
    expect(r.nothing).toEqual([
      { jobId: 'j3', label: 'J1051', name: 'Water wells', words: 'no cages or boxes on this job yet.' },
      { jobId: 'j4', label: 'J1053', name: 'Septic field', words: 'S1 at Field edge is empty. Nothing on site.' },
    ])
    expect(nothingHeading(r.nothing.length)).toBe('Nothing on site · 2 jobs')
    expect(nothingHeading(1)).toBe('Nothing on site · 1 job')
  })

  it('a part on hand in two places over time: the ledger’s sums in each, with the line’s own last recorded', () => {
    const r = build()
    const j1 = r.jobs[0]!
    const a1 = j1.boxes.find((b) => b.containerId === A1)!
    const b1 = j1.boxes.find((b) => b.containerId === B1)!
    expect(a1.lines.map((l) => [l.partName, l.onHand, l.unit, l.lastRecordedBy])).toEqual([
      ['1/2" ball valve', 12, null, 'Jordan'],
      ['3/4" copper 90', 30, 'ea', 'Mateo'],
    ])
    expect(a1.lines[1]!.lastRecordedAt).toBe('2026-11-01T15:00:00Z')
    expect(b1.lines.map((l) => [l.partName, l.onHand, l.unit])).toEqual([
      ['3/4" copper 90', 20, 'ea'],
      ['Wax ring', 9, null],
    ])
    // Unsorted still holds the 40 the crew never put away.
    const uns = j1.boxes.find((b) => b.kind === 'unsorted')!
    expect(uns.lines.map((l) => [l.partName, l.onHand])).toEqual([['3/4" copper 90', 40]])
    expect(a1.placeName).toBe('Lodge level 1')
    expect(a1.where).toBe('by the north stair')
    expect(a1.code).toBe('7D759246')
    expect(uns.code).toBe('')
  })

  it('a retired container is on no paper, and a counted box keeps the count', () => {
    const r = build()
    const all = r.jobs.flatMap((j) => j.boxes)
    expect(all.some((b) => b.containerId === RET)).toBe(false)
    expect(all.some((b) => b.stencil === 'A3')).toBe(false)
    const g1 = r.jobs[1]!.boxes[0]!
    expect(g1.lines).toEqual([{ partKey: 'text:gas valve 3/4"', partName: 'Gas valve 3/4"', manufacturer: null, onHand: 14, unit: 'ea', lastRecordedAt: '2026-11-02T15:00:00Z', lastRecordedBy: 'Reyes' }])
    expect(r.counts).toEqual({ jobs: 4, withMaterial: 2, places: 3, boxes: 6, lines: 7 })
    expect(countsWords(r.counts)).toBe('4 jobs on the site · 2 with material · 3 places · 6 cages and boxes · 7 lines on hand')
  })

  it('an empty box in a job with material prints with no lines, and A2 keeps its place', () => {
    const r = build()
    const a2 = r.jobs[0]!.boxes.find((b) => b.containerId === A2)!
    expect(a2.lines).toEqual([])
    expect(a2.placeName).toBe('Lodge level 1')
    expect(boxWords(a2)).toBe('A2 · cage')
    expect(boxWords({ stencil: 'Unsorted', kind: 'unsorted' })).toBe('Unsorted · delivered, not yet put away')
    expect(boxWords({ stencil: 'T1', kind: 'pile' })).toBe('T1 · pile')
  })
})

describe('reportSections', () => {
  it('by job: a section per job with material, its places in name order, Unsorted when it holds anything, No place yet last', () => {
    const s = reportSections(build(), 'job')
    expect(s.map((x) => [x.key, x.title, x.meta])).toEqual([
      ['job:j1', 'J1042 · Lodge rough-in', '2 places · 4 cages and boxes · 6 lines on hand'],
      ['job:j2', 'J1047 · Bunkhouse gas line', '1 place · 1 cage or box · 1 line on hand'],
    ])
    // Arena holds no live box on J1042 (A3 is retired), so it is not a place of the section.
    expect(s[0]!.groups.map((g) => [g.heading, g.boxes.map((b) => b.stencil)])).toEqual([
      ['Lodge level 1', ['A1', 'A2']],
      ['Lodge level 2', ['B1']],
      ['Unsorted', ['Unsorted']],
      ['No place yet', ['C3']],
    ])
    expect(s[1]!.groups.map((g) => [g.heading, g.boxes.map((b) => b.stencil)])).toEqual([['arena', ['G1']]])
  })

  it('by location: a section per place name folded across jobs, a group per job, then Unsorted and No place yet by job', () => {
    const twoArenas: SiteMaterialsRows = { ...rows, containers: rows.containers.map((c) => (c.id === C3 ? { ...c, locationId: 'p3' } : c)) }
    const s = reportSections(build(twoArenas), 'location')
    expect(s.map((x) => [x.key, x.title, x.meta])).toEqual([
      ['place:arena', 'Arena', '2 jobs each name a place Arena · 2 cages and boxes'],
      ['place:lodge level 1', 'Lodge level 1', 'one job · 2 cages and boxes'],
      ['place:lodge level 2', 'Lodge level 2', 'one job · 1 cage or box'],
      ['unsorted', 'Unsorted, by job', 'delivered, not yet put away'],
    ])
    expect(s[0]!.groups.map((g) => [g.heading, g.boxes.map((b) => `${b.stencil}@${b.jobLabel}`)])).toEqual([
      ['J1042 · Lodge rough-in', ['C3@J1042']],
      ['J1047 · Bunkhouse gas line', ['G1@J1047']],
    ])
    expect(s[3]!.groups.map((g) => [g.heading, g.boxes.map((b) => b.kind)])).toEqual([['J1042 · Lodge rough-in', ['unsorted']]])
  })

  it('by location: a box with no place sits in No place yet under its job', () => {
    const s = reportSections(build(), 'location')
    const none = s.find((x) => x.key === 'no-place')!
    expect(none.title).toBe('No place yet')
    expect(none.groups.map((g) => [g.heading, g.boxes.map((b) => b.stencil)])).toEqual([['J1042 · Lodge rough-in', ['C3']]])
  })
})

describe('the words', () => {
  it('unitOfPart reads the newest delivery that named a unit, never the phone’s added on site', () => {
    expect(unitOfPart(movements, 'j1', 'text:3/4" copper 90')).toBe('ea')
    expect(unitOfPart(movements, 'j1', 'text:1/2" ball valve')).toBeNull()
    expect(unitOfPart([...movements, move('x', 'j1', '3/4" copper 90', 5, 'delivered', null, UNS1, '2026-11-03T15:00:00Z', 'Office', 'FT')], 'j1', 'text:3/4" copper 90')).toBe('ft')
  })

  it('jobWords, footWords, lastRecordedWords, nothingWords', () => {
    expect(jobWords(J1)).toBe('J1042 · Lodge rough-in')
    expect(jobWords({ label: '', name: 'Water wells' })).toBe('Water wells')
    expect(jobWords({ label: 'J—', name: '' })).toBe('J—')
    expect(jobWords({ label: '', name: '' })).toBe('a job with no name')
    expect(footWords({ printedOn: '2026-11-04', printedBy: 'Dana Example' })).toBe('Read from the Materials on site ledger, every press on the phone and in the office summed to what is on hand. Printed November 4, 2026 by Dana Example.')
    expect(footWords({ printedOn: '2026-11-04', printedBy: null })).toBe('Read from the Materials on site ledger, every press on the phone and in the office summed to what is on hand. Printed November 4, 2026.')
    expect(lastRecordedWords({ lastRecordedAt: '2026-11-01T15:00:00Z', lastRecordedBy: 'Mateo' }, '2026-11-04')).toBe('Nov 1 · Mateo')
    expect(lastRecordedWords({ lastRecordedAt: '2025-10-29T15:00:00Z', lastRecordedBy: 'Office' }, '2026-11-04')).toBe('Oct 29, 2025 · Office')
    expect(lastRecordedWords({ lastRecordedAt: '2026-11-01T15:00:00Z', lastRecordedBy: null }, '2026-11-04')).toBe('Nov 1')
    expect(lastRecordedWords({ lastRecordedAt: null, lastRecordedBy: null }, '2026-11-04')).toBe('—')
    expect(nothingWords([])).toBe('no cages or boxes on this job yet.')
    expect(nothingWords([{ stencil: 'S1', placeName: 'Field edge', kind: 'box' }, { stencil: 'G2', placeName: null, kind: 'cage' }, { stencil: 'Unsorted', placeName: null, kind: 'unsorted' }])).toBe('G2, S1 at Field edge are empty. Nothing on site.')
  })
})
