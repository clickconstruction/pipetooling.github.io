import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DESK_MARKS, ESTIMATING_UNDER_WORDS } from './deskMarks'
import { SKY_UNDER_WORDS } from '../skyUnderWords'

describe('deskMarks: the header and the band read one record', () => {
  it('each desk has its word, a fill, an ink and one path on the 640 box', () => {
    expect(DESK_MARKS.dispatch.word).toBe('Dispatch')
    expect(DESK_MARKS.estimating.word).toBe('Estimating')
    expect(DESK_MARKS.dispatch.fill).toBe(SKY_UNDER_WORDS)
    expect(DESK_MARKS.estimating.fill).toBe(ESTIMATING_UNDER_WORDS)
    for (const mark of Object.values(DESK_MARKS)) {
      expect(mark.icon.viewBox).toBe('0 0 640 640')
      expect(mark.icon.path.startsWith('M')).toBe(true)
      expect(mark.ink).toBe('#ffffff')
    }
  })

  it('the header draws its two inbox presses from this file: no violet literal and neither path written in Layout.tsx', () => {
    const layout = readFileSync('src/components/Layout.tsx', 'utf8')
    expect(layout).not.toMatch(/#7c3aed/i)
    expect(layout).not.toContain(DESK_MARKS.dispatch.icon.path.slice(0, 40))
    expect(layout).not.toContain(DESK_MARKS.estimating.icon.path.slice(0, 40))
    expect(layout).toContain('DESK_MARKS.dispatch')
    expect(layout).toContain('DESK_MARKS.estimating')
  })
})
