// @vitest-environment jsdom
/**
 * Punch list #357 PR 6: What the rating did, over a fake io. A rated GC: the bids since, the difficulty priced in,
 * the jobs against the hours priced, and the nudge when hours ran past, with the jobs behind a fold. An estimator
 * reads the bids and is told the hours are the office's. A GC nobody rated draws nothing. A failed read says so.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DIFFICULTY_FEEDBACK_WORDS as W } from '../../lib/bids/difficultyFeedback'
import type { DifficultyFeedbackIo, DifficultyFeedbackRead } from '../../lib/bids/difficultyFeedbackIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import GcDifficultyFeedbackCard from './GcDifficultyFeedbackCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const READ: DifficultyFeedbackRead = {
  firstRatedAt: '2026-11-14T20:00:00Z',
  bids: [
    { bidId: 'a', outcome: 'won', pricedOrCreatedAt: '2026-11-20T15:00:00Z', sent: true, pricedDifficultyUsd: 4200 },
    { bidId: 'b', outcome: 'lost', pricedOrCreatedAt: '2026-11-21T15:00:00Z', sent: true, pricedDifficultyUsd: 2220 },
    { bidId: 'c', outcome: null, pricedOrCreatedAt: '2026-11-22T15:00:00Z', sent: true, pricedDifficultyUsd: 0 },
  ],
  jobs: [
    { jobId: 'j1', label: '1042 Riverside Lofts', done: true, clockedHours: 544, pricedHours: 528 },
    { jobId: 'j2', label: '1043 Riverside Phase 2', done: true, clockedHours: 400, pricedHours: 420 },
  ],
}

const io = (read: DifficultyFeedbackRead | Error): DifficultyFeedbackIo => ({
  load: vi.fn(async () => {
    if (read instanceof Error) throw read
    return read
  }),
})

const lines = () => screen.getAllByTestId('gc-difficulty-feedback-line').map((l) => l.textContent)

afterEach(cleanup)

describe('GcDifficultyFeedbackCard', () => {
  it('a rated GC for the office: the bids since, the cost priced in, the hours, and the nudge with the jobs behind it', async () => {
    const fake = io(READ)
    renderWithProviders(<GcDifficultyFeedbackCard customerId="c1" withHours io={fake} />)
    expect(await screen.findByTestId('gc-difficulty-feedback')).toBeTruthy()
    expect(fake.load).toHaveBeenCalledWith('c1', { withHours: true })
    expect(lines()).toEqual(['3 bids to them since they were rated on 2026-11-14: 1 won, 1 lost, 1 waiting on an answer.', 'Difficulty priced in: $6,420 on 2 bids.', 'Hours ran 16 hours past the hours priced on 1 of 2 jobs.'])
    expect(screen.getByTestId('gc-difficulty-feedback-nudge').textContent).toContain('Hours ran 16 hours past the hours priced on 1 of 2 jobs. Rate them again?')
    expect(screen.getByRole('button', { name: W.rateAgain })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show the jobs (2)' }))
    expect(screen.getByTestId('gc-difficulty-feedback-jobs').textContent).toContain('1042 Riverside Lofts · 544 hours clocked, 528 priced · 16 hours past')
  })

  it('an estimator reads the bids and is told the hours are the office’s', async () => {
    renderWithProviders(<GcDifficultyFeedbackCard customerId="c1" withHours={false} io={io({ ...READ, jobs: null })} />)
    await waitFor(() => expect(lines()).toHaveLength(2))
    expect(screen.getByText(W.hoursHidden)).toBeTruthy()
    expect(screen.queryByTestId('gc-difficulty-feedback-nudge')).toBeNull()
  })

  it('a GC nobody has rated draws nothing; a failed read says so', async () => {
    const none = io({ firstRatedAt: null, bids: [], jobs: null })
    const { container } = renderWithProviders(<GcDifficultyFeedbackCard customerId="c1" withHours io={none} />)
    await waitFor(() => expect(none.load).toHaveBeenCalled())
    expect(container.querySelector('[data-testid="gc-difficulty-feedback"]')).toBeNull()
    cleanup()
    renderWithProviders(<GcDifficultyFeedbackCard customerId="c1" withHours io={io(new Error('boom'))} />)
    expect((await screen.findByRole('alert')).textContent).toContain('boom')
  })
})
