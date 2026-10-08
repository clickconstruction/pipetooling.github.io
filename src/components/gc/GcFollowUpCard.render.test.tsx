// @vitest-environment jsdom
/**
 * Render smoke for the Follow up cards (owner, 2026-10-04: "I feel like there is some unnecessary
 * redundancy here"; `to-dos/gc-mode/follow-up-card-mockup.html`): each card says its status once,
 * in the chip, the bid date sits with the job, and the last call does not repeat the promised day.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { GcFollowUpTab } from './GcAskThread.proto'
import { initialGcState } from '../../lib/gcMode/gcFixture'

afterEach(cleanup)

describe('the Follow up cards', () => {
  it('say each thing once', () => {
    render(<GcFollowUpTab state={initialGcState()} dispatch={() => undefined} onMap={() => undefined} />)
    // The promise is in the chip, not in a sentence and not again on the last call.
    expect(screen.getByText('promised Wed Sep 30, 2 days past')).toBeTruthy()
    expect(screen.queryByText(/Promised a quote by Wed Sep 30/)).toBeNull()
    expect(screen.queryByText(/Quote by Sep 30\./)).toBeNull()
    // The bid date sits with the job, once per card.
    expect(screen.getAllByText('Boerne Retail Shell · Sitework · bid Thu Oct 8').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Our bid is due/)).toBeNull()
    // A company that never opened it: the chip says when we asked.
    expect(screen.getByText('asked Sat Sep 19, 13 days ago')).toBeTruthy()
    // Call and Follow up log the contact: no third way on the card.
    expect(screen.queryByText('Log a contact')).toBeNull()
    // The paragraph keeps no count of its own.
    expect(screen.queryByText(/to call now/)).toBeNull()
  })
})
