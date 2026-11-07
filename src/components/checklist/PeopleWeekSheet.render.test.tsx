// @vitest-environment jsdom
/**
 * Your people's week (#273, PR 5): the subscribe sheet. The screen's people come picked, Monday at 6; Start it writes
 * one weekly chain with the people on the row; a standing chain shows its words and Stop it ends it; someone who may
 * not pick others gets their own week.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PeopleWeekSheet, type PeopleWeekIo } from './PeopleWeekSheet'
import type { PeopleWeekRequestRow } from '../../lib/peopleWeek'

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

const PEOPLE = [
  { id: 'me', name: 'Taunya' },
  { id: 'a', name: 'Mateo' },
  { id: 'b', name: 'Rosa' },
]

function makeIo(rows: PeopleWeekRequestRow[] = []): PeopleWeekIo {
  return {
    list: vi.fn().mockResolvedValue(rows),
    apply: vi.fn().mockResolvedValue(undefined),
    preview: vi.fn().mockResolvedValue({ subject: 'Your people’s week · Nov 2 to 8', html: '<p>hi</p>' }),
    test: vi.fn().mockResolvedValue(undefined),
    people: vi.fn().mockResolvedValue(PEOPLE),
  }
}

describe('PeopleWeekSheet', () => {
  it('opens with the screen’s people picked and starts a Monday chain carrying them', async () => {
    const io = makeIo()
    render(<PeopleWeekSheet open onClose={() => {}} meId="me" canPickOthers suggested={['a', 'b']} io={io} />)
    expect(screen.getByRole('dialog', { name: 'Your people’s week' })).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mateo' })).toBeTruthy())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mateo' }).getAttribute('aria-pressed')).toBe('true'))
    expect(screen.getByRole('button', { name: 'Rosa' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Taunya (me)' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Mon' }).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByLabelText('The time it goes') as HTMLInputElement).value).toBe('06:00')
    fireEvent.click(screen.getByRole('button', { name: 'Start it' }))
    await waitFor(() => expect(io.apply).toHaveBeenCalledTimes(1))
    const plan = (io.apply as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { inserts: Array<{ people_user_ids: string[]; recipient_user_id: string; requested_by: string; repeat_weekly: boolean }>; cancelIds: string[] }
    expect(plan.inserts).toHaveLength(1)
    expect(plan.inserts[0]!.people_user_ids).toEqual(['a', 'b'])
    expect(plan.inserts[0]!.recipient_user_id).toBe('me')
    expect(plan.inserts[0]!.requested_by).toBe('me')
    expect(plan.inserts[0]!.repeat_weekly).toBe(true)
    expect(plan.cancelIds).toEqual([])
    await waitFor(() => expect(screen.getByText(/Saved\./)).toBeTruthy())
  })

  it('shows a standing chain in words and stops it', async () => {
    const io = makeIo([{ id: 'r1', requested_by: 'me', recipient_user_id: 'me', people_user_ids: ['a'], send_at: '2026-11-09T12:00:00Z', repeat_weekly: true, sent_at: null }])
    render(<PeopleWeekSheet open onClose={() => {}} meId="me" canPickOthers suggested={[]} io={io} />)
    await waitFor(() => expect(screen.getByTestId('people-week-standing').textContent).toContain('Mateo · Monday 6:00 AM · every week'))
    expect(screen.getByRole('button', { name: 'Save the change' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Stop it' }))
    await waitFor(() => expect(io.apply).toHaveBeenCalledWith({ inserts: [], cancelIds: ['r1'] }))
  })

  it('holds someone who may not pick others to their own week and previews it', async () => {
    const io = makeIo()
    render(<PeopleWeekSheet open onClose={() => {}} meId="me" canPickOthers={false} suggested={['a']} io={io} />)
    await waitFor(() => expect(screen.getByText('It is about your own week.')).toBeTruthy())
    expect(io.people).not.toHaveBeenCalled()
    await waitFor(() => expect((screen.getByRole('button', { name: 'See the email as it would go now' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'See the email as it would go now' }))
    await waitFor(() => expect(io.preview).toHaveBeenCalledWith(['me']))
    await waitFor(() => expect(screen.getByText('Your people’s week · Nov 2 to 8')).toBeTruthy())
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(<PeopleWeekSheet open onClose={onClose} meId="me" canPickOthers suggested={[]} io={makeIo()} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
