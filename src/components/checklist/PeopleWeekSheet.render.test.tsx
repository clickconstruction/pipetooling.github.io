// @vitest-environment jsdom
/**
 * Your people's week (#273, PR 5): the subscribe sheet. The screen's people come picked, Monday at 6; the blue press
 * writes one weekly chain with the people on the row; a standing chain shows its words and Stop it ends it; someone
 * who may not pick others gets their own week. Since v2.8041 the top is a small sample of the email in place of a
 * paragraph, the real email draws in the sample's place, and a long list folds the people not picked.
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
    // 'sub-co' is a subcontractor on the board: the picker does not list it, so it is never picked out of sight (v2.6644).
    render(<PeopleWeekSheet open onClose={() => {}} meId="me" canPickOthers suggested={['a', 'b', 'sub-co']} io={io} />)
    expect(screen.getByRole('dialog', { name: 'Your people’s week' })).toBeTruthy()
    // The top shows the email, it does not describe it.
    const glance = screen.getByTestId('people-week-glance')
    expect(glance.textContent).toContain('Your people’s week · ')
    expect(glance.textContent).toContain('Sample')
    expect(glance.textContent).toContain('Mateo · 2 cards done · 1 moved · 4 photos')
    expect(screen.queryByText(/One email each week about the people you pick/)).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mateo' })).toBeTruthy())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mateo' }).getAttribute('aria-pressed')).toBe('true'))
    expect(screen.getByRole('button', { name: 'Rosa' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Taunya (me)' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Mon' }).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByLabelText('The time it goes') as HTMLInputElement).value).toBe('06:00')
    fireEvent.click(screen.getByRole('button', { name: 'Email me every Monday at 6:00 AM' }))
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
    await waitFor(() => expect(screen.getByText('About your own week.')).toBeTruthy())
    expect(io.people).not.toHaveBeenCalled()
    await waitFor(() => expect((screen.getByRole('button', { name: 'See yours now' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'See yours now' }))
    await waitFor(() => expect(io.preview).toHaveBeenCalledWith(['me']))
    // The real email takes the sample's place, and one press brings the sample back.
    await waitFor(() => expect(screen.getByTitle('Your people’s week · Nov 2 to 8')).toBeTruthy())
    expect(screen.queryByTestId('people-week-glance')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to the sample' }))
    expect(screen.getByTestId('people-week-glance')).toBeTruthy()
    expect(screen.queryByTitle('Your people’s week · Nov 2 to 8')).toBeNull()
  })

  it('leads a long list with the people picked and folds the rest behind a count', async () => {
    const crowd = Array.from({ length: 24 }, (_, i) => ({ id: `p${i}`, name: `Person ${String(i).padStart(2, '0')}` }))
    const io = { ...makeIo(), people: vi.fn().mockResolvedValue([{ id: 'me', name: 'Taunya' }, ...crowd]) }
    render(<PeopleWeekSheet open onClose={() => {}} meId="me" canPickOthers suggested={['p20', 'p3']} io={io} />)
    const group = await screen.findByRole('group', { name: 'The people in it' })
    await waitFor(() => expect(screen.getByRole('button', { name: '＋ 23 more' })).toBeTruthy())
    expect(Array.from(group.querySelectorAll('button[aria-pressed]')).map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['✓ Person 03', '✓ Person 20'])
    expect(screen.queryByLabelText('Find a name')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '＋ 23 more' }))
    expect(screen.getByLabelText('Find a name')).toBeTruthy()
    expect(group.querySelectorAll('button[aria-pressed]')).toHaveLength(25)
    // A pick made in the open list stays where it is: nothing moves from under a finger.
    fireEvent.click(screen.getByRole('button', { name: 'Person 07' }))
    const names = Array.from(group.querySelectorAll('button[aria-pressed]')).map((b) => b.textContent)
    expect(names.slice(0, 3)).toEqual(['✓ Person 03', '✓ Person 20', 'Taunya (me)'])
    expect(names).toContain('✓ Person 07')
    expect(screen.getByRole('button', { name: 'Person 07' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(<PeopleWeekSheet open onClose={onClose} meId="me" canPickOthers suggested={[]} io={makeIo()} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
