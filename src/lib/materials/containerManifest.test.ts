import { describe, expect, it } from 'vitest'
import { containerLines, type Container, type Movement } from './onSite'
import { lastRecorded, lastRecordedWords, manifestBlankRows, manifestContainers, manifestDateWords, manifestPages, manifestPickWords, manifestPressWords, MANIFEST_BLANK_ROWS, MANIFEST_MIN_ROWS } from './containerManifest'

const JOB = 'j1'
const A1 = '7d759246-8476-4a37-884f-ed1562d5663f'
const B2 = '1a2b3c4d-0000-4000-8000-000000000002'
const C3 = '5e6f7a8b-0000-4000-8000-000000000003'
const UNS = 'ffffffff-0000-4000-8000-00000000000f'

const container = (id: string, label: string, kind: Container['kind'], extra: Partial<Container> = {}): Container => ({
  id,
  jobId: JOB,
  label,
  kind,
  where: '',
  locationId: null,
  lat: null,
  lng: null,
  retiredAt: null,
  createdAt: '2026-10-01T12:00:00Z',
  ...extra,
})

const move = (id: string, partName: string, quantity: number, reason: Movement['reason'], from: string | null, to: string | null, at: string, byName = 'Jordan'): Movement => ({
  id,
  jobId: JOB,
  partId: null,
  partName,
  manufacturer: null,
  quantity,
  reason,
  fromContainerId: from,
  toContainerId: to,
  note: '',
  byUserId: null,
  byName,
  at,
  source: null,
  itemId: null,
})

const containers = [container(UNS, 'Unsorted', 'unsorted'), container(C3, 'C3', 'box', { locationId: 'p1', where: 'by the north stair' }), container(A1, 'A1', 'cage', { locationId: 'p1' }), container(B2, 'B2', 'box', { retiredAt: '2026-10-20T00:00:00Z' })]
const places = [{ id: 'p1', name: 'Level 2' }]
const movements = [
  move('m1', '3/4" copper 90', 100, 'delivered', null, UNS, '2026-10-02T15:00:00Z', 'Office'),
  move('m2', '3/4" copper 90', 60, 'moved', UNS, A1, '2026-10-03T15:00:00Z', 'Mateo'),
  move('m3', '1/2" ball valve', 12, 'delivered', null, A1, '2026-10-05T15:00:00Z', 'Office'),
  move('m4', '3/4" copper 90', 10, 'used', A1, null, '2026-10-28T23:30:00Z', 'Jordan'),
  move('m5', '1/2" ball valve', 12, 'used', A1, null, '2026-10-20T15:00:00Z', 'Jordan'),
]
/** 2026-11-02 at 7 PM Central is 2026-11-03T01:00Z: the paper must carry the Chicago day, not the UTC one. */
const NOW = new Date('2026-11-03T01:00:00Z')

describe('manifestContainers', () => {
  it('leaves out Unsorted and a retired box, and sorts the rest by stencil', () => {
    expect(manifestContainers(containers, 'all').map((c) => c.label)).toEqual(['A1', 'C3'])
  })

  it('narrows to the ids picked, in stencil order whatever the pick order', () => {
    expect(manifestContainers(containers, [C3, A1]).map((c) => c.label)).toEqual(['A1', 'C3'])
    expect(manifestContainers(containers, [UNS, B2])).toEqual([])
  })
})

describe('lastRecorded', () => {
  it('is the newest row on either side of the container', () => {
    expect(lastRecorded(movements, A1)).toEqual({ at: '2026-10-28T23:30:00Z', byName: 'Jordan' })
    expect(lastRecorded(movements, UNS)).toEqual({ at: '2026-10-03T15:00:00Z', byName: 'Mateo' })
  })

  it('is null for a container nothing ever touched', () => {
    expect(lastRecorded(movements, C3)).toBeNull()
  })
})

describe('manifestPages', () => {
  const pages = manifestPages({ containers, pick: 'all', lines: containerLines(movements), movements, places, job: 'Job 972 · Ridgeway School', site: '400 Ridgeway Dr, Blanco, TX', now: NOW })

  it('makes one page per live box in stencil order, each stamped with the app calendar day it was printed', () => {
    expect(pages.map((p) => p.stencil)).toEqual(['A1', 'C3'])
    expect(pages.every((p) => p.printedOn === '2026-11-02')).toBe(true)
    expect(pages[0]).toMatchObject({ code: '7D759246', kind: 'cage', place: 'Level 2', where: '', job: 'Job 972 · Ridgeway School', site: '400 Ridgeway Dr, Blanco, TX' })
    expect(pages[1]).toMatchObject({ kind: 'box', place: 'Level 2', where: 'by the north stair' })
  })

  it('lists what is on hand with its number, and leaves out a line used down to nothing', () => {
    expect(pages[0]!.items).toEqual([{ partName: '3/4" copper 90', manufacturer: null, onHand: 50 }])
  })

  it('dates the last record on the app calendar, with who made it', () => {
    // 2026-10-28T23:30Z is still Oct 28 in Chicago.
    expect(pages[0]!.lastRecordedOn).toBe('2026-10-28')
    expect(pages[0]!.lastRecordedBy).toBe('Jordan')
    expect(lastRecordedWords(pages[0]!)).toBe('October 28, 2026 by Jordan')
  })

  it('gives an empty container a page with no items, no last record, and a full block of ruled lines', () => {
    const empty = pages[1]!
    expect(empty.items).toEqual([])
    expect(empty.lastRecordedOn).toBeNull()
    expect(empty.lastRecordedBy).toBeNull()
    expect(lastRecordedWords(empty)).toBe('Nothing recorded yet')
    expect(empty.blankRows).toBe(MANIFEST_MIN_ROWS)
  })

  it('prints only the boxes picked', () => {
    const one = manifestPages({ containers, pick: [C3], lines: [], movements, places, job: 'j', site: '', now: NOW })
    expect(one.map((p) => p.stencil)).toEqual(['C3'])
  })
})

describe('the ruled lines', () => {
  it('fill the page under a short list and keep a minimum under a long one', () => {
    expect(manifestBlankRows(0)).toBe(MANIFEST_MIN_ROWS)
    expect(manifestBlankRows(1)).toBe(MANIFEST_MIN_ROWS - 1)
    expect(manifestBlankRows(MANIFEST_MIN_ROWS - MANIFEST_BLANK_ROWS)).toBe(MANIFEST_BLANK_ROWS)
    expect(manifestBlankRows(40)).toBe(MANIFEST_BLANK_ROWS)
  })
})

describe('the words', () => {
  it('read a calendar day as the paper does', () => {
    expect(manifestDateWords('2026-11-02')).toBe('November 2, 2026')
    expect(manifestDateWords('bad')).toBe('bad')
  })

  it('name the count on the press', () => {
    expect(manifestPressWords(1)).toBe('Print 1 manifest')
    expect(manifestPressWords(4)).toBe('Print 4 manifests')
    expect(manifestPressWords(0)).toBe('Print manifests')
  })

  it('say which boxes the press prints', () => {
    expect(manifestPickWords(0, 0)).toBe('This job has no cage or box yet.')
    expect(manifestPickWords(0, 3)).toBe('Pick a box to print.')
    expect(manifestPickWords(1, 1)).toBe('The one box on this job, one page.')
    expect(manifestPickWords(3, 3)).toBe('Every box on this job, 3 pages, one a box.')
    expect(manifestPickWords(2, 3)).toBe('2 of 3 boxes, one page each.')
  })
})
