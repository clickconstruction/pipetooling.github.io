import { describe, expect, it } from 'vitest'
import type { JobTile } from './jobTiles'
import { tieSheetRows } from './tieSheet'

const tile = (key: string, num: string, name: string, words: string): JobTile => ({ key, kind: key.startsWith('bid') ? 'bid' : 'project', num, name, day: { words, tone: '' } })
const TILES: Record<string, JobTile> = {
  'bid:boerne': tile('bid:boerne', 'B482', 'Boerne Retail Shell', 'bid due Thu Oct 8 · 6 days'),
  'project:stoneoak': tile('project:stoneoak', '#42', 'Stone Oak Pharmacy', 'building · since Sep 14'),
  'project:helotes': tile('project:helotes', '#51', 'Helotes Dental Office', 'building · since Aug 3'),
}

describe('Tie this message to (cut 10)', () => {
  it('puts the job their new messages land on first, then the rail’s order', () => {
    const { rows, untie } = tieSheetRows(['bid:boerne', 'project:stoneoak'], TILES, 'project:stoneoak', null)
    expect(rows.map((r) => [r.num, r.star, r.here])).toEqual([
      ['#42', true, false],
      ['B482', false, false],
    ])
    expect(rows[1]?.words).toBe('bid due Thu Oct 8 · 6 days')
    expect(untie).toBe(false)
  })

  it('marks the job the line is tied to, and offers to untie it', () => {
    const { rows, untie } = tieSheetRows(['bid:boerne', 'project:stoneoak'], TILES, 'project:stoneoak', 'bid:boerne')
    expect(rows.find((r) => r.here)?.num).toBe('B482')
    expect(untie).toBe(true)
  })

  it('shows the line’s own job when the rail does not hold it, and leaves out a job with no tile', () => {
    const { rows } = tieSheetRows(['bid:boerne', 'bid:gone'], TILES, null, 'project:helotes')
    expect(rows.map((r) => r.num)).toEqual(['#51', 'B482'])
    expect(rows[0]?.here).toBe(true)
  })

  it('has no rows for a person with no jobs, so the sheet offers Another job alone', () => {
    expect(tieSheetRows([], TILES, null, null)).toEqual({ rows: [], untie: false })
  })
})
