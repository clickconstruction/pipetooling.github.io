import { describe, expect, it } from 'vitest'
import { fieldPhotoAgeRows, fieldPhotosAgedNextLine, fieldPhotosCounts, fieldPhotosMarkNote, fieldPhotosSince } from './fieldPhotosAge'

const NOW = '2026-10-26T15:00:00.000Z'
const DAY = 86_400_000
const ago = (days: number) => new Date(Date.parse(NOW) - days * DAY).toISOString()

const GROUPS = [
  { estimateId: 'e1', label: 'Estimate #1042 — Ridgeway Builders', oldestAt: ago(12), photos: [1, 2, 3, 4, 5, 6] },
  { estimateId: 'e2', label: 'Estimate #1051 — Cedar Bend Partners', oldestAt: ago(4), photos: [1, 2, 3] },
  { estimateId: 'e3', label: 'CO #1057 — Harlan Freight', oldestAt: ago(1), photos: [1, 2] },
]

describe('field photos with an age', () => {
  const rows = fieldPhotoAgeRows(GROUPS, NOW)

  it('gives each estimate its days in storage and marks the ones past the limit', () => {
    expect(rows.map((r) => `${r.group.estimateId}:${r.ageDays}:${r.past}`)).toEqual(['e1:12:true', 'e2:4:false', 'e3:1:false'])
    expect(fieldPhotoAgeRows(GROUPS, NOW, 3).filter((r) => r.past)).toHaveLength(2)
    expect(fieldPhotosCounts(rows)).toEqual({ estimates: 3, photos: 11, past: 1, oldestDays: 12 })
    expect(fieldPhotosCounts([])).toEqual({ estimates: 0, photos: 0, past: 0, oldestDays: null })
  })

  it('names the oldest, says what moved, and writes the note, a clean day included', () => {
    expect(fieldPhotosAgedNextLine(rows)).toBe('Move 6 photos for Estimate #1042 — Ridgeway Builders to Drive · 12 days in storage')
    expect(fieldPhotosAgedNextLine([])).toBeNull()
    const since = fieldPhotosSince(rows, [{ moved_at: ago(1) }, { moved_at: ago(10) }], ago(3), () => 'Friday at 9:55 AM')
    expect(since).toEqual({ newSince: 1, movedSince: 1, stillSince: 2, words: 'Since the last look, Friday at 9:55 AM' })
    expect(fieldPhotosMarkNote(rows, 7, since)).toBe('3 estimates holding photos · 11 photos · oldest 12d (Estimate #1042 — Ridgeway Builders) · 1 past 7 days · +1 new, 1 moved to Drive since the last look')
    expect(fieldPhotosMarkNote([], 7, null)).toBe('0 estimates holding photos')
    expect(fieldPhotosSince(rows, [], null, () => '')).toBeNull()
  })
})
