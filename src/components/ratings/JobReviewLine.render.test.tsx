// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OfficeRating } from '../../lib/ratings/ratingsOffice'
import type { RatingsOfficeIo } from '../../lib/ratings/ratingsOfficeIo'
import { JobReviewLine } from './JobReviewLine'

const auth = vi.hoisted(() => ({ role: 'assistant' as string, readOnly: false }))
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return { useAuth: () => makeUseAuthValue({ role: auth.role, readOnly: auth.readOnly }), useOptionalAuth: () => makeUseAuthValue({ role: auth.role }) }
})

const row = (p: Partial<OfficeRating>): OfficeRating => ({
  id: 'r-1',
  contactId: 'c-dana',
  jobId: 'job-1312',
  customerName: 'Dana Whitfield',
  askedAt: '2026-10-27T14:12:00Z',
  openedAt: '2026-10-27T15:00:00Z',
  answeredAt: '2026-10-27T15:01:00Z',
  score: 2,
  words: 'The floor was left a mess.',
  googlePressedAt: null,
  calledAt: null,
  callNote: '',
  ...p,
})

function ioWith(rows: OfficeRating[][]): RatingsOfficeIo & { recordCall: ReturnType<typeof vi.fn> } {
  let i = 0
  return {
    forJob: vi.fn(async () => rows[Math.min(i++, rows.length - 1)] ?? []),
    lowOwed: vi.fn(async () => []),
    recent: vi.fn(async () => []),
    jobWord: vi.fn(async () => null),
    recordCall: vi.fn(async (_id: string, _note: string) => undefined),
    googleLink: vi.fn(async () => ''),
    saveGoogleLink: vi.fn(async () => undefined),
  }
}

afterEach(() => {
  cleanup()
  auth.role = 'assistant'
  auth.readOnly = false
})

describe('JobReviewLine (v2.5946, punch list #185)', () => {
  it('draws a low answer with its words, and I called records the call with what was said', async () => {
    const io = ioWith([[row({})], [row({ calledAt: '2026-10-28T15:00:00Z', callNote: 'Going back Friday.' })]])
    render(<JobReviewLine jobId="job-1312" io={io} />)
    expect(await screen.findByText('2 stars')).toBeTruthy()
    expect(screen.getByText('“The floor was left a mess.”')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'I called' }))
    fireEvent.change(screen.getByLabelText('What was said on the call'), { target: { value: 'Going back Friday.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the call' }))
    await waitFor(() => expect(io.recordCall).toHaveBeenCalledWith('r-1', 'Going back Friday.'))
    expect(await screen.findByText('The call: Going back Friday.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'I called' })).toBeNull()
  })

  it('a five reads as five stars with the Google press and offers no call', async () => {
    render(<JobReviewLine jobId="job-1312" io={ioWith([[row({ score: 5, words: '', googlePressedAt: '2026-10-27T15:02:00Z' })]])} />)
    expect(await screen.findByText('5 stars')).toBeTruthy()
    expect(screen.getByText(/pressed Post it on Google/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'I called' })).toBeNull()
  })

  it('an ask not answered says so, and a job never asked draws nothing', async () => {
    render(<JobReviewLine jobId="job-1312" io={ioWith([[row({ openedAt: null, answeredAt: null, score: null, words: '' })]])} />)
    expect(await screen.findByText('Asked Oct 27, not opened yet')).toBeTruthy()
    cleanup()
    const { container } = render(<JobReviewLine jobId="job-1312" io={ioWith([[]])} />)
    await waitFor(() => expect(container.textContent).toBe(''))
  })

  it('is the office team’s: a crew lead sees nothing, and a training account cannot record a call', async () => {
    auth.role = 'primary'
    const { container } = render(<JobReviewLine jobId="job-1312" io={ioWith([[row({})]])} />)
    await waitFor(() => expect(container.textContent).toBe(''))
    cleanup()
    auth.role = 'assistant'
    auth.readOnly = true
    render(<JobReviewLine jobId="job-1312" io={ioWith([[row({})]])} />)
    expect(await screen.findByText('2 stars')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'I called' })).toBeNull()
  })
})
