import { describe, expect, it } from 'vitest'
import { jobMapIsEmpty, jobMapParts, jobMapSummaryWords } from './paintedJobMap'
import { BURIED_COLORS } from './paintedPlaceKind'
import type { PaintedLine, PaintedMap, PaintedPlace } from './paintedMap'

const map = (id: string, jobList: boolean, createdAt: string, jobId = 'j1'): PaintedMap => ({ id, name: jobList ? 'Places on this job' : 'The way in', words: '', jobId, developmentId: null, jobList, createdBy: 'u1', createdAt })
const line = (id: string, mapId: string): PaintedLine => ({ id, mapId, label: '', how: 'walked', points: [{ lat: 29.5, lng: -98.2 }, { lat: 29.501, lng: -98.2 }], poorParts: [], fixedByHand: false, lengthM: 30, marginM: 2, measuredFt: null, measuredHow: null, madeBy: 'u1', madeAt: '2026-11-21T15:00:00Z' })
const place = (id: string, mapId: string, name: string, setAt: string, more: Partial<PaintedPlace> = {}): PaintedPlace => ({ id, mapId, name, words: '', lat: 29.5, lng: -98.2, accuracyM: null, photoPath: null, kind: null, setBy: 'u1', setAt, ...more })

const wholes = [
  { map: map('list', true, '2026-11-18T15:00:00Z'), lines: [], places: [place('a', 'list', 'Meter', '2026-11-18T15:01:00Z'), place('b', 'list', 'Buried sewer line', '2026-11-18T15:02:00Z', { kind: 'buried_sewer', lineId: 'run' })] },
  { map: map('way', false, '2026-11-18T16:00:00Z'), lines: [line('in', 'way')], places: [place('g', 'way', 'Truck gate', '2026-11-18T16:01:00Z')] },
  { map: map('sewer', false, '2026-11-18T17:00:00Z'), lines: [line('run', 'sewer')], places: [] },
]
const earlier = [{ map: map('old', true, '2025-06-01T15:00:00Z', 'j0'), jobLabel: null, places: [{ ...place('o', 'old', 'Cleanout', '2025-06-01T15:01:00Z'), number: 1, letter: 'A' }] }]

describe('what a job’s map draws', () => {
  const parts = jobMapParts(wholes, 'j1', earlier)

  it('draws every line of the job’s painted maps, and a buried place’s line in its locator color', () => {
    expect(parts.lines.map((l) => `${l.id}:${l.color ?? 'paint'}`)).toEqual(['in:paint', `run:${BURIED_COLORS.sewer}`])
  })
  it('draws the job’s own places with their letters, then the ones an earlier job kept', () => {
    expect(parts.places.map((p) => `${p.letter} ${p.name} ${p.fromEarlier ? 'earlier' : 'own'}`)).toEqual(['A Meter own', 'B Buried sewer line own', 'A Cleanout earlier'])
  })
  it('leaves a place set on one painted map off, since its number is that map’s own', () => {
    expect(parts.places.some((p) => p.name === 'Truck gate')).toBe(false)
  })
  it('counts the painted maps, and not a list of places', () => {
    expect(parts.mapCount).toBe(2)
  })
  it('says what is on it in one line', () => {
    expect(jobMapSummaryWords(parts)).toBe('2 painted maps · 2 places on this job · 1 kept at this address')
    expect(jobMapSummaryWords({ mapCount: 1, places: [] })).toBe('1 painted map')
    expect(jobMapSummaryWords({ mapCount: 0, places: [parts.places[0]!] })).toBe('1 place on this job')
    expect(jobMapSummaryWords({ mapCount: 0, places: [] })).toBe('')
  })
  it('is empty only with no line and no place', () => {
    expect(jobMapIsEmpty(parts)).toBe(false)
    expect(jobMapIsEmpty(jobMapParts([], 'j1', []))).toBe(true)
    // A painted map with a place and no line yet draws nothing here.
    expect(jobMapIsEmpty(jobMapParts([{ map: map('way', false, '2026-11-18T16:00:00Z'), lines: [], places: [place('g', 'way', 'Truck gate', '2026-11-18T16:01:00Z')] }], 'j1', []))).toBe(true)
  })
})
