// @vitest-environment jsdom
/**
 * The age of the board this device remembered (v2.3610; its own file since the Stages map's step 25).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { BoardSnapshotAgeChip } from './BoardSnapshotAgeChip'

const NOW = new Date('2026-11-18T15:00:00Z').getTime()
const MIN = 60_000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('BoardSnapshotAgeChip', () => {
  it('names how old the remembered board is', () => {
    for (const [ago, words] of [
      [20_000, 'board from just now'],
      [5 * MIN, 'board from 5 min ago'],
      [59 * MIN, 'board from 59 min ago'],
      [3 * 60 * MIN, 'board from 3 h ago'],
      [30 * 60 * MIN, 'board from yesterday'],
    ] as const) {
      const view = render(<BoardSnapshotAgeChip savedAt={NOW - ago} />)
      expect(view.container.textContent).toBe(words)
      cleanup()
    }
  })

  it('a stamp from the future reads as just now', () => {
    const view = render(<BoardSnapshotAgeChip savedAt={NOW + 10 * MIN} />)
    expect(view.container.textContent).toBe('board from just now')
  })

  it('wears the amber pill', () => {
    const view = render(<BoardSnapshotAgeChip savedAt={NOW - 5 * MIN} />)
    const pill = view.container.querySelector('span') as HTMLElement
    expect(pill.style.background).toBe('var(--bg-amber-100)')
    expect(pill.style.color).toBe('var(--text-amber-800)')
    expect(pill.style.borderRadius).toBe('999px')
  })
})
