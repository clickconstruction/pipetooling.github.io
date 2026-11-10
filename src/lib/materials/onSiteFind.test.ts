import { describe, expect, it } from 'vitest'

import type { Container, ContainerLine, Place } from './onSite'
import { findOnSite, findOnSiteWords, otherJobsWithBoxes, otherJobsWords, type OnSiteFindJob } from './onSiteFind'

function box(id: string, jobId: string, label: string, over: Partial<Container> = {}): Container {
  return { id, jobId, label, kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z', ...over }
}
function line(containerId: string, partName: string, onHand: number, manufacturer: string | null = 'Mueller'): ContainerLine {
  return { containerId, partKey: partName.toLowerCase(), partId: null, partName, manufacturer, onHand, lastTouchedAt: null, lastTouchedBy: null, lastCountAt: null, lastCountBy: null, lastCountDiff: null, cannotFindSinceCount: 0 }
}
const yard: Place = { id: 'p1', jobId: 'j2', name: 'Laydown yard', createdAt: '2026-11-01T00:00:00Z' }

const jobs: OnSiteFindJob[] = [
  {
    jobId: 'j2',
    label: 'JP1063 · Mill Street Lofts',
    containers: [box('b1', 'j2', 'B1', { kind: 'box', locationId: 'p1' }), box('old', 'j2', 'B9', { retiredAt: '2026-11-02T00:00:00Z' })],
    lines: [line('b1', '3/4" copper 90', 6), line('old', '3/4" copper 90', 2)],
    places: [yard],
  },
  {
    jobId: 'j1',
    label: 'JP1042 · Oak Hollow',
    containers: [box('a1', 'j1', 'A1'), box('a2', 'j1', 'A2'), box('un', 'j1', 'Unsorted', { kind: 'unsorted' })],
    lines: [line('a2', '3/4" copper 90', 18), line('a1', '1/2" copper 90', 40), line('a1', 'Ball valve', 4, 'Apollo')],
    places: [],
  },
]

describe('findOnSite', () => {
  it('finds a part across every job, by label order, and leaves a retired box out', () => {
    const found = findOnSite(jobs, 'copper 90')
    expect(found.total).toBe(3)
    expect(found.hits.map((h) => [h.jobLabel, h.container.label, h.line?.partName, h.line?.onHand])).toEqual([
      ['JP1042 · Oak Hollow', 'A1', '1/2" copper 90', 40],
      ['JP1042 · Oak Hollow', 'A2', '3/4" copper 90', 18],
      ['JP1063 · Mill Street Lofts', 'B1', '3/4" copper 90', 6],
    ])
    expect(found.hits[2]?.place).toBe('Laydown yard')
    expect(found.hits[0]?.place).toBe('')
  })

  it('puts the job the phone is on first', () => {
    expect(findOnSite(jobs, 'copper', { firstJobId: 'j2' }).hits.map((h) => h.jobId)).toEqual(['j2', 'j1', 'j1'])
  })

  it('finds a box by the start of its stencil, as a hit with no line', () => {
    const found = findOnSite(jobs, 'a')
    expect(found.hits.filter((h) => h.line === null).map((h) => h.container.label)).toEqual(['A1', 'A2'])
    expect(findOnSite(jobs, 'b1').hits.map((h) => [h.container.label, h.line])).toEqual([['B1', null]])
  })

  it('matches the maker, returns nothing for nothing typed, and caps the list', () => {
    expect(findOnSite(jobs, 'apollo').hits.map((h) => h.line?.partName)).toEqual(['Ball valve'])
    expect(findOnSite(jobs, '   ')).toEqual({ hits: [], total: 0 })
    const capped = findOnSite(jobs, 'copper', { max: 2 })
    expect(capped.hits).toHaveLength(2)
    expect(capped.total).toBe(3)
  })
})

describe('findOnSiteWords', () => {
  it('counts lines, boxes and jobs, and says what the cap left out', () => {
    expect(findOnSiteWords(findOnSite(jobs, 'copper 90'))).toBe('3 lines in 3 boxes on 2 jobs')
    expect(findOnSiteWords(findOnSite(jobs, 'apollo'))).toBe('1 line in 1 box on 1 job')
    expect(findOnSiteWords(findOnSite(jobs, 'b1'))).toBe('1 box on 1 job')
    expect(findOnSiteWords(findOnSite(jobs, 'copper', { max: 2 }))).toBe('2 lines in 2 boxes on 1 job, the first 2 of 3')
    expect(findOnSiteWords(findOnSite(jobs, 'zzz'))).toBe('')
  })
})

describe('otherJobsWithBoxes', () => {
  it('names the other jobs that hold a box, never Unsorted or a retired one', () => {
    expect(otherJobsWithBoxes(jobs, 'j3')).toEqual([
      { jobId: 'j1', label: 'JP1042 · Oak Hollow', boxes: 2 },
      { jobId: 'j2', label: 'JP1063 · Mill Street Lofts', boxes: 1 },
    ])
    expect(otherJobsWithBoxes(jobs, 'j1')).toEqual([{ jobId: 'j2', label: 'JP1063 · Mill Street Lofts', boxes: 1 }])
    expect(otherJobsWords(1)).toBe('Your boxes are on 1 other job.')
    expect(otherJobsWords(2)).toBe('Your boxes are on 2 other jobs.')
  })
})
