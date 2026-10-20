// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobsFollowupModal } from './JobsFollowupModal'

/**
 * The deck's Idle lens, clock chip and Next line (v2.5511). The store is mocked with one idle Working job (no crew
 * on site in 60 days, a note yesterday) and one quiet Billed job; the kernel is real.
 */

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'assistant' }) }))
vi.mock('../../lib/fetchStreetViewPreview', () => ({
  fetchStreetViewMeta: () => Promise.resolve(null),
  fetchStreetViewImageBlob: () => Promise.reject(new Error('no imagery')),
  googleStreetViewPanoUrl: () => '',
}))
vi.mock('../../lib/jobs/jobFollowupStore', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobs/jobFollowupStore')>('../../lib/jobs/jobFollowupStore')
  const { DEFAULT_JOB_FOLLOWUP_SETTINGS } = await import('../../lib/jobs/jobFollowupQueue')
  const ymdAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const candidates = [
    {
      id: 'idle',
      stage: 'working' as const,
      hcpNumber: '683',
      jobName: 'The Learning Experience',
      address: '1 Learning Way, Austin, TX',
      customerName: 'Malachi Builders',
      pctComplete: 70,
      revenue: 41550,
      paymentsMade: 0,
      latestActivityAt: new Date(Date.now() - 86400000).toISOString(),
      nextScheduledOn: null,
      lastWorkYmd: ymdAgo(60),
      createdYmd: ymdAgo(120),
      masterUserId: 'u2',
    },
    {
      id: 'quiet',
      stage: 'billed' as const,
      hcpNumber: '742',
      jobName: 'David Stimson',
      address: '2 Quiet Ln, Austin, TX',
      customerName: 'David Stimson',
      pctComplete: 100,
      revenue: 9000,
      paymentsMade: 0,
      latestActivityAt: new Date(Date.now() - 12 * 86400000).toISOString(),
      nextScheduledOn: null,
      lastWorkYmd: ymdAgo(30),
      createdYmd: ymdAgo(90),
      masterUserId: 'u1',
    },
  ]
  return {
    ...actual,
    fetchJobFollowupCandidates: () => Promise.resolve(candidates),
    fetchJobFollowupReviews: () => Promise.resolve([]),
    fetchJobFollowupSettings: () => Promise.resolve(DEFAULT_JOB_FOLLOWUP_SETTINGS),
  }
})

describe('JobsFollowupModal (v2.5511: the Idle lens, the clock chip, the Next line)', () => {
  it('an idle card deals first with its field-day chip and its Next line; the Idle lens narrows the deck to idle cards', async () => {
    renderWithProviders(<JobsFollowupModal open onClose={() => {}} />)
    const lens = await screen.findByTestId('followups-lens-idle')
    expect(lens.textContent).toBe('Idle 21+ (1)')
    expect(lens.getAttribute('aria-pressed')).toBe('false')
    // Two cards in the deck, the idle one on top: the clock chip counts field days, not quiet days.
    expect((await screen.findByText('2 to review')).textContent).toBe('2 to review')
    // The app's calendar day (Texas) can sit a day off UTC's, so the count is 59 to 61.
    expect(screen.getByTestId('followup-clock-chip').textContent).toMatch(/^idle (59|60|61) days$/)
    expect(screen.getByText(/Why it's here: No field work in (59|60|61) days · 70% done · \$41,550 bid/)).toBeTruthy()
    const next = screen.getByTestId('followup-next-line')
    expect(next.textContent).toContain('Next: Schedule the next visit or close it')
    expect(screen.getByRole('button', { name: 'Schedule it ↗' })).toBeTruthy()
    // The lens on: the quiet Billed card leaves the count.
    fireEvent.click(lens)
    expect((await screen.findByText('1 to review')).textContent).toBe('1 to review')
    expect(lens.getAttribute('aria-pressed')).toBe('true')
  })

  it('opened from the Dashboard’s idle card (initialLens="idle"), the lens starts on', async () => {
    renderWithProviders(<JobsFollowupModal open onClose={() => {}} initialLens="idle" />)
    const lens = await screen.findByTestId('followups-lens-idle')
    expect(lens.getAttribute('aria-pressed')).toBe('true')
    expect((await screen.findByText('1 to review')).textContent).toBe('1 to review')
  })
})
