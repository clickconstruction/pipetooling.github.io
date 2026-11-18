import { describe, expect, it } from 'vitest'
import { JOB_LIST_WORDS, jobListCountWords, jobListPlaces, jobListsOf, placeLetter } from './paintedJobList'
import type { PaintedMap, PaintedPlace } from './paintedMap'

const map = (id: string, over: Partial<PaintedMap> = {}): PaintedMap => ({ id, name: id, words: '', jobId: 'j1', developmentId: null, createdBy: 'u1', createdAt: '2026-11-18T15:00:00Z', ...over })
const place = (id: string, mapId: string, setAt: string, over: Partial<PaintedPlace> = {}): PaintedPlace => ({ id, mapId, name: id, words: '', lat: 29.5, lng: -98.2, accuracyM: null, photoPath: null, setBy: 'u1', setAt, ...over })

describe('the letter a place on the job wears', () => {
  it('runs A to Z, then on as a spreadsheet\'s columns do', () => {
    expect([1, 2, 26, 27, 28, 52, 53, 702, 703].map(placeLetter)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA'])
  })
  it('never hands back nothing', () => {
    expect(placeLetter(0)).toBe('A')
    expect(placeLetter(-4)).toBe('A')
    expect(placeLetter(2.9)).toBe('B')
  })
})

describe('which of a job\'s maps are its list', () => {
  const maps = [
    map('way-in'),
    map('list-new', { jobList: true, createdAt: '2026-11-18T17:00:00Z' }),
    map('list-old', { jobList: true, createdAt: '2026-11-18T16:00:00Z' }),
    map('other-job-list', { jobList: true, jobId: 'j2' }),
    map('site-map', { jobId: null, developmentId: 'd1' }),
  ]
  it('is every map marked as one on that job, the oldest first', () => {
    expect(jobListsOf(maps, 'j1').map((m) => m.id)).toEqual(['list-old', 'list-new'])
    expect(jobListsOf(maps, 'j2').map((m) => m.id)).toEqual(['other-job-list'])
  })
  it('is none for a job with no list, and for no job at all', () => {
    expect(jobListsOf(maps, 'j3')).toEqual([])
    expect(jobListsOf(maps, null)).toEqual([])
    // A list whose job is gone is a map on no job: it is nobody's list.
    expect(jobListsOf([map('orphan', { jobList: true, jobId: null })], null)).toEqual([])
  })
})

describe('a job\'s places as one list', () => {
  it('letters them in the order they were set, across every list the job has', () => {
    const lists = [
      { places: [place('gate', 'list-old', '2026-11-18T16:01:00Z', { kind: 'gate' }), place('trench', 'list-old', '2026-11-18T16:09:00Z', { kind: 'hazard' })] },
      { places: [place('meter', 'list-new', '2026-11-18T16:05:00Z')] },
    ]
    expect(jobListPlaces(lists).map((p) => `${p.letter} ${p.id} ${p.mapId}`)).toEqual(['A gate list-old', 'B meter list-new', 'C trench list-old'])
    expect(jobListPlaces(lists)[2]!.kind).toBe('hazard')
  })
  it('is empty for a job with no list', () => {
    expect(jobListPlaces([])).toEqual([])
  })
})

describe('the words of the list', () => {
  it('counts its places', () => {
    expect(jobListCountWords(1)).toBe('1 place')
    expect(jobListCountWords(3)).toBe('3 places')
  })
  it('names the list the same on its line, its window and its press', () => {
    expect(JOB_LIST_WORDS.name).toBe('Places on this job')
    expect(JOB_LIST_WORDS.add).toBe(`＋ ${JOB_LIST_WORDS.name.replace('Places', 'Place')}`)
    expect(JOB_LIST_WORDS.open).toContain(JOB_LIST_WORDS.name)
    expect(JOB_LIST_WORDS.notOnALink).toContain(JOB_LIST_WORDS.name)
  })
})
