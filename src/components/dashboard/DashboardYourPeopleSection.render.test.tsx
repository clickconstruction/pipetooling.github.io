// @vitest-environment jsdom
/**
 * Your people (#273, PR 3c): the office's section draws one row per person with the newest card's ring, the moved or
 * stuck chip and Remind; the headline up top; nothing while nobody has an open card.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { ringState } from '../../lib/taskProgress'
import type { YourPersonRow } from '../../lib/dashboardYourPeople'

const invoke = vi.fn().mockResolvedValue({ data: { push_sent: 2 }, error: null })
vi.mock('../../lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }))

const hookState = vi.hoisted(() => ({ rows: [] as unknown[], headline: '', loading: false }))
vi.mock('../../hooks/useDashboardYourPeople', () => ({
  useDashboardYourPeople: () => ({ rows: hookState.rows, headline: hookState.headline, loading: hookState.loading, error: null, reload: vi.fn(), titlesFor: () => ['Clear the floor'] }),
}))

import { DashboardYourPeopleSection } from './DashboardYourPeopleSection'

const row = (over: Partial<YourPersonRow>): YourPersonRow => ({
  userId: 'u1',
  name: 'Mateo',
  openCount: 2,
  card: { instanceId: 'i1', title: 'Put the plumbing tools in a neat home', ring: ringState({ completedAt: null, percentComplete: 0, lines: 3, ticked: 2 }), movedAt: '2026-11-06T15:40:00Z' },
  oldestAgeDays: 2,
  state: 'moved_today',
  words: 'moved today',
  ...over,
})

describe('DashboardYourPeopleSection', () => {
  it('draws the headline, a row per person with the ring and the chip, and reminds through the function', async () => {
    hookState.rows = [row({}), row({ userId: 'u2', name: 'Rosa', openCount: 1, state: 'stuck', words: 'stuck 32 days', card: { instanceId: 'i2', title: 'One marker every mile', ring: ringState({ completedAt: null, percentComplete: 0, lines: 0, ticked: 0 }), movedAt: null } })]
    hookState.headline = '3 cards done this week · 1 moved · 1 stuck'
    renderWithProviders(<DashboardYourPeopleSection authUserId="me" enabled />)
    expect(screen.getByText('Your people')).toBeTruthy()
    expect(screen.getByTestId('your-people-headline').textContent).toBe('3 cards done this week · 1 moved · 1 stuck')
    expect(screen.getAllByTestId('your-people-row')).toHaveLength(2)
    expect(screen.getByText('moved today')).toBeTruthy()
    expect(screen.getByText('stuck 32 days')).toBeTruthy()
    expect(screen.getByText(/Put the plumbing tools in a neat home · 67%/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remind Rosa' }))
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('send-checklist-notification', expect.objectContaining({ body: expect.objectContaining({ recipient_user_id: 'u2', push_body: 'You have 1 outstanding task: Clear the floor' }) })))
  })

  it('draws nothing while nobody has an open card, and nothing when not enabled', () => {
    hookState.rows = []
    hookState.headline = ''
    const onVisibleChange = vi.fn()
    renderWithProviders(<DashboardYourPeopleSection authUserId="me" enabled onVisibleChange={onVisibleChange} />)
    expect(screen.queryByText('Your people')).toBeNull()
    expect(onVisibleChange).toHaveBeenCalledWith(false)
  })
})
