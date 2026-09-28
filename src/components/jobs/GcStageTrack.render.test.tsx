// @vitest-environment jsdom
/**
 * Render smoke for GC Review's stage track: the pin sits on the first stage
 * with work left, each stop says what is waiting there, and a stop is the
 * filter — press it to pick the stage, press it again to clear.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import GcStageTrack from './GcStageTrack'
import type { GcStageTrack as Track } from '../../lib/jobs/gcReviewStages'

const track: Track = {
  stops: [
    { key: 'check', n: 1, name: 'Check', waiting: 1, waitingTotal: 30000, done: 13, of: 14, complete: false },
    { key: 'send', n: 2, name: 'Send', waiting: 10, waitingTotal: 287900, done: 3, of: 14, complete: false },
    { key: 'word', n: 3, name: 'Word', waiting: 1, waitingTotal: 21000, done: 2, of: 9, complete: false },
  ],
  here: 'check',
  finished: { done: 2, skipped: 0, of: 14 },
}

describe('GcStageTrack', () => {
  it('says what is waiting at each stage and pins the first with work left', () => {
    render(<GcStageTrack track={track} stage={null} onPick={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Check: 1 to check, 13 of 14 done — you are here' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send: 10 to send, 3 of 14 done' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Word: 1 word due, 2 of 9 done' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Done: 2 of 14' })).toBeTruthy()
    expect(screen.getAllByText('You are here')).toHaveLength(1)
  })

  it('a stop picks its stage; the stop already picked clears it', () => {
    const onPick = vi.fn()
    const { rerender } = render(<GcStageTrack track={track} stage={null} onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: /^Send:/ }))
    expect(onPick).toHaveBeenLastCalledWith('send')
    rerender(<GcStageTrack track={track} stage="send" onPick={onPick} />)
    expect(screen.getByRole('button', { name: /^Send:/ }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /^Send:/ }))
    expect(onPick).toHaveBeenLastCalledWith(null)
    fireEvent.click(screen.getByRole('button', { name: /^Done:/ }))
    expect(onPick).toHaveBeenLastCalledWith('done')
  })

  it('a finished step turns green and the pin moves on', () => {
    const moved: Track = { ...track, here: 'send', stops: [{ ...track.stops[0]!, waiting: 0, waitingTotal: 0, done: 14, complete: true }, track.stops[1]!, track.stops[2]!] }
    render(<GcStageTrack track={moved} stage={null} onPick={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Check: all checked, 14 of 14 done' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send: 10 to send, 3 of 14 done — you are here' })).toBeTruthy()
  })

  it('a finished week pins Done', () => {
    const done: Track = { here: 'done', finished: { done: 13, skipped: 1, of: 14 }, stops: track.stops.map((s) => ({ ...s, waiting: 0, waitingTotal: 0, done: s.of, complete: true })) }
    render(<GcStageTrack track={done} stage={null} onPick={vi.fn()} />)
    expect(screen.getByText('Week done')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Done: 13 of 14, 1 skipped' })).toBeTruthy()
    expect(screen.queryByText('You are here')).toBeNull()
  })
})
