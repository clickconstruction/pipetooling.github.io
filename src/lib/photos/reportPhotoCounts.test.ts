import { describe, expect, it } from 'vitest'
import { chunkIds, countPhotosByReport, idsToRead, photoBadge, PHOTO_COUNT_CHUNK } from './reportPhotoCounts'

describe('reportPhotoCounts (punch list #229, PR 3)', () => {
  it('chunks the ids, keeps their order, and drops empty and repeated ones', () => {
    expect(chunkIds([])).toEqual([])
    expect(chunkIds(['a', '', 'b', 'a', 'c'])).toEqual([['a', 'b', 'c']])
    const many = Array.from({ length: PHOTO_COUNT_CHUNK + 2 }, (_, i) => `r${i}`)
    const chunks = chunkIds(many)
    expect(chunks.map((c) => c.length)).toEqual([PHOTO_COUNT_CHUNK, 2])
    expect(chunks[1]).toEqual([`r${PHOTO_COUNT_CHUNK}`, `r${PHOTO_COUNT_CHUNK + 1}`])
    expect(chunkIds(['a', 'b', 'c'], 2)).toEqual([['a', 'b'], ['c']])
  })

  it('counts the rows per report and leaves a report with none absent', () => {
    const counts = countPhotosByReport([{ report_id: 'r1' }, { report_id: 'r2' }, { report_id: 'r1' }, { report_id: null }])
    expect(counts.get('r1')).toBe(2)
    expect(counts.get('r2')).toBe(1)
    expect(counts.has('r3')).toBe(false)
  })

  it('draws the badge for a report with photos and nothing for one without', () => {
    expect(photoBadge(undefined)).toBeNull()
    expect(photoBadge(0)).toBeNull()
    expect(photoBadge(1)).toEqual({ text: '📷 1', label: '1 photo' })
    expect(photoBadge(3)).toEqual({ text: '📷 3', label: '3 photos' })
  })

  it('reads only the ids the list does not hold or has not asked for', () => {
    const known = new Map([['r1', 2]])
    const asked = new Set(['r2'])
    expect(idsToRead(['r1', 'r2', 'r3', ''], known, asked)).toEqual(['r3'])
  })
})
