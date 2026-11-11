// @vitest-environment jsdom
/**
 * Render smokes for UsersTabAwayGroup (v2.6863): the Away group on People → Users drawn as roster rows, the
 * note on the row's second line, the door in the ⋯ menu until the day back is here, and the phone card.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { splitAwayFromArchived, type AwayRow } from '../../lib/people/awaySection'
import { UsersTabAwayGroup, type UsersTabAwayGroupProps } from './UsersTabAwayGroup'

const TODAY = '2026-11-10'

/** Three made-up people: one due back three days ago, one back in three years with the alert on, one with no day and no words. */
function rows(): AwayRow[] {
  return splitAwayFromArchived({
    logins: [
      { id: 'u-corinne', name: 'Corinne Vela', email: 'corinne@example.com', role: 'estimator', archived_at: '2026-08-29T17:00:00Z' },
      { id: 'u-marisol', name: 'Marisol Reyes', email: 'marisol@example.com', role: 'dev', archived_at: '2026-11-02T17:00:00Z' },
      { id: 'u-tobias', name: 'Tobias Lindqvist', email: null, role: 'helpers', archived_at: '2026-09-14T17:00:00Z' },
    ],
    rosterRows: [
      { id: 'p-corinne', name: 'Corinne Vela', email: null, archived_at: '2026-08-29T17:00:00Z', end_date: '2026-08-29', account_user_id: 'u-corinne' },
      { id: 'p-marisol', name: 'Marisol Reyes', email: null, archived_at: '2026-11-02T17:00:00Z', end_date: '2026-11-02', account_user_id: 'u-marisol' },
    ],
    notes: [
      { user_id: 'u-corinne', countdown_ymd: '2026-11-07', alert_on_day: false, words: 'Rest up, Corinne.\nYour desk is as you left it.' },
      { user_id: 'u-marisol', countdown_ymd: '2029-11-06', alert_on_day: true, words: 'See you after the sabbatical.' },
      { user_id: 'u-tobias', countdown_ymd: null, words: '' },
    ],
    todayYmd: TODAY,
  }).away
}

function renderGroup(over: Partial<UsersTabAwayGroupProps> = {}) {
  const props: UsersTabAwayGroupProps = {
    rows: rows(),
    narrowViewport: false,
    bringBackThroughDesk: true,
    onSee: vi.fn(),
    onEditNote: vi.fn(),
    onDoor: vi.fn(),
    openDesk: vi.fn(),
    restoringUserId: null,
    swipeOpenId: null,
    onSwipeChange: vi.fn(),
    ...over,
  }
  render(<UsersTabAwayGroup {...props} />)
  return props
}

describe('UsersTabAwayGroup', () => {
  it('draws nothing when nobody is away', () => {
    renderGroup({ rows: [] })
    expect(screen.queryByRole('region', { name: 'Away' })).toBeNull()
  })

  it('heads the group like the roster and gives each person one line of days and the note they will read', () => {
    renderGroup()
    const group = screen.getByRole('region', { name: 'Away' })
    expect(within(group).getByRole('heading', { level: 2 }).textContent).toBe('Away 3 · 1 due back')
    expect(within(group).getByText('Their sign-in opens to the note you left.')).toBeTruthy()
    const [corinne, marisol, tobias] = within(group).getAllByTestId('users-tab-away-row')
    // Due first: the day gone by, the door on the row, no bell.
    expect(within(corinne!).getByTestId('away-when').textContent).toBe('Left Aug 29 · due back Nov 7, 3 days ago')
    expect(within(corinne!).getByText('Estimator')).toBeTruthy()
    expect(within(corinne!).getByText('“Rest up, Corinne.”')).toBeTruthy()
    expect(within(corinne!).queryByRole('img')).toBeNull()
    // Three years off: the year shows, the long day sits on the title, the bell says what the alert does.
    expect(within(marisol!).getByTestId('away-when').textContent).toBe('Left Nov 2 · back Nov 6, 2029, in 3 years')
    expect(within(marisol!).getByTestId('away-when').getAttribute('title')).toBe('Left Nov 2, 2026 · Back on Tuesday, Nov 6, 2029 · 1,092 days')
    expect(within(marisol!).getByRole('img', { name: 'You get a Needs you item on the day the countdown ends.' })).toBeTruthy()
    // No day and no words say so.
    expect(within(tobias!).getByTestId('away-when').textContent).toBe('Archived Sep 14 · no day back set')
    expect(within(tobias!).getByText('No words in the note.')).toBeTruthy()
  })

  it('keeps See what they see on the row and the rare presses in the menu', () => {
    const props = renderGroup()
    const marisol = screen.getAllByTestId('users-tab-away-row')[1]!
    fireEvent.click(within(marisol).getByRole('button', { name: 'See what they see' }))
    expect(props.onSee).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-marisol' }))
    expect(within(marisol).queryByRole('button', { name: 'Bring back…' })).toBeNull()
    fireEvent.click(within(marisol).getByRole('button', { name: 'Actions for Marisol Reyes' }))
    expect(within(marisol).getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Open desk', 'Edit the note…', 'Bring back…'])
    fireEvent.click(within(marisol).getByRole('menuitem', { name: 'Edit the note…' }))
    expect(props.onEditNote).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-marisol' }))
    fireEvent.click(within(marisol).getByRole('button', { name: 'Actions for Marisol Reyes' }))
    fireEvent.click(within(marisol).getByRole('menuitem', { name: 'Bring back…' }))
    expect(props.onDoor).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-marisol' }), 'bring_back')
  })

  it('brings the door out onto the row once the day back is here, and drops it from the menu', () => {
    const props = renderGroup()
    const corinne = screen.getAllByTestId('users-tab-away-row')[0]!
    fireEvent.click(within(corinne).getByRole('button', { name: 'Bring back…' }))
    expect(props.onDoor).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-corinne' }), 'bring_back')
    fireEvent.click(within(corinne).getByRole('button', { name: 'Actions for Corinne Vela' }))
    expect(within(corinne).getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Open desk', 'Edit the note…'])
  })

  it('offers Restore where the employment never ended, and where there is no desk to bring back through', () => {
    const props = renderGroup({ bringBackThroughDesk: false, openDesk: undefined })
    const [, marisol, tobias] = screen.getAllByTestId('users-tab-away-row')
    fireEvent.click(within(tobias!).getByRole('button', { name: 'Actions for Tobias Lindqvist' }))
    expect(within(tobias!).getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Edit the note…', 'Restore'])
    fireEvent.click(within(tobias!).getByRole('menuitem', { name: 'Restore' }))
    expect(props.onDoor).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-tobias' }), 'restore')
    fireEvent.click(within(marisol!).getByRole('button', { name: 'Actions for Marisol Reyes' }))
    expect(within(marisol!).getByRole('menuitem', { name: 'Restore' })).toBeTruthy()
  })

  it('on a phone is one card of avatar rows: a tap opens the desk and the presses sit behind the swipe', () => {
    const props = renderGroup({ narrowViewport: true, swipeOpenId: 'away-u-marisol' })
    const group = screen.getByRole('region', { name: 'Away' })
    expect(within(group).getByRole('heading', { level: 2 }).textContent).toBe('Away')
    expect(within(group).getByText('3 · 1 due back')).toBeTruthy()
    const [corinne, marisol] = within(group).getAllByTestId('users-tab-away-phone-row')
    expect(within(marisol!).getByTestId('away-when').textContent).toBe('back Nov 6, 2029, in 3 years')
    expect(within(marisol!).getByTestId('away-note-line').textContent).toBe('“See you after the sabbatical.”')
    // The open row's strip holds the three presses by name.
    fireEvent.click(within(marisol!).getByRole('button', { name: 'See what they see — Marisol Reyes' }))
    expect(props.onSee).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-marisol' }))
    expect(props.onSwipeChange).toHaveBeenCalledWith('away-u-marisol', false)
    expect(within(marisol!).getByRole('button', { name: 'Edit the note… — Marisol Reyes' })).toBeTruthy()
    expect(within(marisol!).getByRole('button', { name: 'Bring back… — Marisol Reyes' })).toBeTruthy()
    // The row due back carries its door under it, and a tap on a shut row opens the desk.
    expect(within(corinne!).getByTestId('away-when').textContent).toBe('due back Nov 7, 3 days ago')
    fireEvent.click(within(corinne!).getByRole('button', { name: 'Bring back…' }))
    expect(props.onDoor).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-corinne' }), 'bring_back')
    fireEvent.click(within(corinne!).getByRole('button', { name: /Corinne Vela — swipe left for actions/ }))
    expect(props.openDesk).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-corinne' }))
  })
})
