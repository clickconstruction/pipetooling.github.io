/**
 * A job's painted maps as the Documents tab lists them (punch list #345): which maps, in what
 * order, and what each row says.
 */
import { describe, expect, it } from 'vitest'
import type { PaintedMap } from './paintedMap'
import { PAINTED_MAP_DOCUMENT_WORDS, findPaintedMapLibrary, paintedMapDocumentRows, paintedMapLibraryCountWords, paintedMapLibraryNoMatchWords, paintedMapLibraryRows } from './paintedMapDocuments'

const map = (id: string, name: string, createdAt: string, home: Partial<Pick<PaintedMap, 'jobId' | 'developmentId' | 'createdBy'>> = {}): PaintedMap => ({ id, name, words: '', jobId: null, developmentId: null, createdBy: 'dana', createdAt, ...home })
const whole = (m: PaintedMap, lengthM: number | null, places = 0) => ({ map: m, lines: lengthM == null ? [] : [{ lengthM, measuredFt: null }], places: Array.from({ length: places }, (_, i) => ({ id: `p${i}` })) })
const nameOf = (id: string | null) => (id === 'dana' ? 'Dana' : null)
const dayOf = (iso: string) => (iso.startsWith('2026-11-13') ? 'Nov 13' : iso.startsWith('2026-11-10') ? 'Nov 10' : null)

describe('paintedMapDocumentRows', () => {
  const WAY = whole(map('way', 'The way in for deliveries', '2026-11-13T15:00:00Z', { jobId: 'job-14' }), 253, 3)
  const OLDER = whole(map('park', 'Where to park', '2026-11-10T15:00:00Z', { jobId: 'job-14' }), 40)
  const SITE = whole(map('site', 'The site road', '2026-11-13T18:00:00Z', { developmentId: 'dev-1' }), 900, 1)
  const OTHER = whole(map('other', 'Another job', '2026-11-13T19:00:00Z', { jobId: 'job-99' }), 100)

  it('lists the job\'s own maps newest first, then its development\'s, and leaves other jobs\' out', () => {
    const rows = paintedMapDocumentRows([OLDER, SITE, OTHER, WAY], 'job-14', 'dev-1', 'Dry Creek Ridge', nameOf, dayOf)
    expect(rows.map((r) => r.id)).toEqual(['way', 'park', 'site'])
    expect(rows.map((r) => r.from)).toEqual([null, null, 'from Dry Creek Ridge'])
  })

  it('each row says its length, its places, who painted it and when', () => {
    const [row] = paintedMapDocumentRows([WAY], 'job-14', null, null, nameOf, dayOf)
    expect(row).toEqual({ id: 'way', name: 'The way in for deliveries', detail: 'about 830 ft · 3 places · Painted by Dana on Nov 13.', from: null })
  })

  it('reads without a painter\'s name or a day when neither can be said', () => {
    const [row] = paintedMapDocumentRows([whole(map('x', 'A map', '2026-01-01T00:00:00Z', { jobId: 'job-14', createdBy: null }), 253)], 'job-14', null, null, nameOf, dayOf)
    expect(row?.detail).toBe('about 830 ft')
  })

  it('a map with nothing on it yet says so', () => {
    const [row] = paintedMapDocumentRows([whole(map('x', 'Just started', '2026-11-13T15:00:00Z', { jobId: 'job-14' }), null)], 'job-14', null, null, nameOf, dayOf)
    expect(row?.detail).toBe(`${PAINTED_MAP_DOCUMENT_WORDS.empty} · Painted by Dana on Nov 13.`)
  })

  it('a development with no name is the development, and a job in none shows no site map', () => {
    expect(paintedMapDocumentRows([SITE], 'job-14', 'dev-1', '  ', nameOf, dayOf)[0]?.from).toBe('from the development')
    expect(paintedMapDocumentRows([SITE], 'job-14', null, null, nameOf, dayOf)).toEqual([])
  })
})

describe('every painted map, as the Documents page lists them', () => {
  const way = whole({ ...map('way', 'The way in', '2026-11-13T15:00:00Z', { jobId: 'job-14' }), words: ' Start at the truck gate. ' }, 253, 2)
  const site = whole(map('site', 'The site road', '2026-11-10T15:00:00Z', { developmentId: 'dev-1' }), 900)
  const hidden = whole(map('hidden', 'Behind the fence', '2026-11-10T15:00:00Z', { jobId: 'job-9' }), null)
  const loose = whole(map('loose', 'Where to park', '2026-11-10T15:00:00Z'), null)
  const homes = [
    { id: 'way', jobLabel: 'J14 · Juniper Ridge', developmentLabel: null },
    { id: 'site', jobLabel: null, developmentLabel: 'Juniper Ridge' },
  ]
  const rows = paintedMapLibraryRows([way, site, hidden, loose], homes, nameOf, dayOf)

  it('keeps the read\'s order and says where each map is, what is on it and who painted it', () => {
    expect(rows.map((r) => r.id)).toEqual(['way', 'site', 'hidden', 'loose'])
    expect(rows[0]).toEqual({ id: 'way', name: 'The way in', where: 'J14 · Juniper Ridge', holds: 'about 830 ft · 2 places', painted: 'Painted by Dana on Nov 13.', words: 'Start at the truck gate.' })
    expect(rows[1]?.where).toBe('Juniper Ridge, every lot')
  })

  it('a home the reader cannot see by name is a job, and a map on nothing says so', () => {
    expect(rows[2]?.where).toBe('On a job')
    expect(rows[3]?.where).toBe('On no job yet')
    expect(rows[3]?.holds).toBe(PAINTED_MAP_DOCUMENT_WORDS.empty)
  })

  it('finds by every word typed, in the name, the home, the words or the painter', () => {
    expect(findPaintedMapLibrary(rows, '  ').map((r) => r.id)).toEqual(['way', 'site', 'hidden', 'loose'])
    expect(findPaintedMapLibrary(rows, 'juniper').map((r) => r.id)).toEqual(['way', 'site'])
    expect(findPaintedMapLibrary(rows, 'TRUCK way').map((r) => r.id)).toEqual(['way'])
    expect(findPaintedMapLibrary(rows, 'zebra')).toEqual([])
  })

  it('counts what is shown, and says when only the newest are listed', () => {
    expect(paintedMapLibraryCountWords(1, 1, 400)).toBe('1 painted map')
    expect(paintedMapLibraryCountWords(3, 12, 400)).toBe('3 of 12 painted maps')
    expect(paintedMapLibraryCountWords(400, 400, 400)).toBe('400 painted maps. Only the newest 400 are listed.')
    expect(paintedMapLibraryNoMatchWords(' gate ')).toBe('Nothing matches “gate”.')
  })
})
