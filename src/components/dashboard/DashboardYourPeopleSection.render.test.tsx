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

const view = vi.hoisted(() => ({ phone: false }))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => view.phone }))

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
    hookState.headline = '3 tasks done this week · 1 moved · 1 stuck'
    renderWithProviders(<DashboardYourPeopleSection authUserId="me" enabled />)
    expect(screen.getByText('Team’s open tasks')).toBeTruthy()
    expect(screen.getByTestId('your-people-headline').textContent).toBe('3 tasks done this week · 1 moved · 1 stuck')
    expect(screen.getAllByTestId('your-people-row')).toHaveLength(2)
    expect(screen.getByText('moved today')).toBeTruthy()
    expect(screen.getByText('stuck 32 days')).toBeTruthy()
    expect(screen.getByText(/Put the plumbing tools in a neat home · 67%/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remind Rosa' }))
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('send-checklist-notification', expect.objectContaining({ body: expect.objectContaining({ recipient_user_id: 'u2', push_body: 'You have 1 outstanding task: Clear the floor' }) })))
  })

  it('lays a row out to fit a phone: it wraps, the name keeps its room, and the chip with Remind can shrink (the walk of 2026-11-21)', () => {
    // A long chip beside the press was 284 px in a row with 247 to give, and Remind hung out of the card.
    hookState.rows = [row({ state: 'quiet', words: 'nothing moved · oldest 1 days' })]
    hookState.headline = ''
    renderWithProviders(<DashboardYourPeopleSection authUserId="me" enabled />)
    const li = screen.getByTestId('your-people-row')
    expect(li.style.flexWrap).toBe('wrap')
    const name = li.querySelector<HTMLElement>('a')!
    expect([name.style.flexGrow, name.style.flexShrink, name.style.flexBasis, name.style.minWidth]).toEqual(['1', '1', '9rem', '0'])
    const acts = screen.getByTestId('your-people-acts')
    expect([acts.style.flexShrink, acts.style.maxWidth, acts.style.marginLeft, acts.style.flexWrap]).toEqual(['1', '100%', 'auto', 'wrap'])
    expect(acts.textContent).toContain('nothing moved · oldest 1 days')
    expect(acts.querySelector('button')?.getAttribute('aria-label')).toBe('Remind Mateo')
  })

  it('stands Remind a thumb tall on a phone and gives the height back to its row, and leaves the desk as it was (punch list #365)', () => {
    hookState.rows = [row({})]
    hookState.headline = ''
    view.phone = true
    const { unmount } = renderWithProviders(<DashboardYourPeopleSection authUserId="me" enabled />)
    const press = screen.getByRole('button', { name: 'Remind Mateo' })
    expect(press.style.minHeight).toBe('44px')
    // 44 less the 27 it was drawn at, half above and half below: the row is as tall as it was.
    expect([press.style.marginTop, press.style.marginBottom]).toEqual(['-8.5px', '-8.5px'])
    unmount()
    view.phone = false
    renderWithProviders(<DashboardYourPeopleSection authUserId="me" enabled />)
    const atDesk = screen.getByRole('button', { name: 'Remind Mateo' })
    expect(atDesk.style.minHeight).toBe('')
    expect(atDesk.style.marginTop).toBe('')
  })

  it('draws nothing while nobody has an open card, and nothing when not enabled', () => {
    hookState.rows = []
    hookState.headline = ''
    const onVisibleChange = vi.fn()
    renderWithProviders(<DashboardYourPeopleSection authUserId="me" enabled onVisibleChange={onVisibleChange} />)
    expect(screen.queryByText('Team’s open tasks')).toBeNull()
    expect(onVisibleChange).toHaveBeenCalledWith(false)
  })
})
