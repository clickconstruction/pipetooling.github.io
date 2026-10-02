// @vitest-environment jsdom
/**
 * Render smoke for the whole-submittal approval (Submittals stage 5b): the dialog says what
 * the one entry covers and what it leaves, asks who approved it and on what day, and Save
 * hands the choice to the tab.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SubmittalApproveAllDialog, type ApproveAllChoice } from './SubmittalApproveAllDialog'
import type { SubmittalPersonRow } from '../../lib/submittals/submittalRoom'

const people = [{ id: 'p1', room_id: 'room', name: 'Dana Whitfield', email: 'dana@arch.test', role: 'architect', may_decide: true, token: 't', how: 'named', invited_by: null, first_seen_at: null, last_seen_at: null, open_count: 0, closed_at: null, created_at: '', updated_at: '' }] as unknown as SubmittalPersonRow[]

describe('SubmittalApproveAllDialog', () => {
  it('names the rows it covers, opens on a person who may decide and on today, and Save carries who and the note', () => {
    const onSave = vi.fn<(c: ApproveAllChoice) => void>()
    renderWithProviders(<SubmittalApproveAllDialog revLabel="Rev 1" rows={14} alreadyDecided={0} missing={0} people={people} onSave={onSave} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'They approved Rev 1' })).toBeTruthy()
    expect(screen.getByTestId('approve-all-scope').textContent).toBe('This marks 14 rows Approved in one entry.')
    expect((screen.getByLabelText('Whose call') as HTMLSelectElement).value).toBe('p1')
    const day = screen.getByLabelText('Approved on') as HTMLInputElement
    expect(day.max).toBe(day.value)
    fireEvent.change(screen.getByLabelText('Their note'), { target: { value: 'approved as submitted' } })
    fireEvent.click(screen.getByTestId('approve-all-save'))
    // Today adds no day: the record takes the moment it was typed.
    expect(onSave.mock.calls[0]![0]).toEqual({ person: { id: 'p1' }, note: 'approved as submitted' })
  })

  it('an earlier day rides along; a later day, a reviewer with no email, or nothing to approve holds the button', () => {
    const onSave = vi.fn<(c: ApproveAllChoice) => void>()
    const { unmount } = renderWithProviders(<SubmittalApproveAllDialog revLabel="Rev 2" rows={1} alreadyDecided={3} missing={2} people={[]} onSave={onSave} onClose={() => {}} />)
    expect(screen.getByTestId('approve-all-scope').textContent).toBe('This marks 1 row Approved in one entry. 3 rows already have a call and keep it. 2 rows have no product and are left out.')
    const save = screen.getByTestId('approve-all-save') as HTMLButtonElement
    expect(save.textContent).toBe('Approve 1 row')
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Reviewer name'), { target: { value: 'Tom Reyes' } })
    fireEvent.change(screen.getByLabelText('Reviewer email'), { target: { value: 'tom@owner.test' } })
    expect(save.disabled).toBe(false)
    fireEvent.change(screen.getByLabelText('Approved on'), { target: { value: '2099-01-01' } })
    expect(save.disabled).toBe(true)
    expect(screen.getByText('Their call cannot be dated after today.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Approved on'), { target: { value: '2026-09-12' } })
    fireEvent.click(save)
    expect(onSave.mock.calls[0]![0]).toEqual({ person: { name: 'Tom Reyes', email: 'tom@owner.test', role: 'architect' }, note: '', on: '2026-09-12' })
    unmount()
    renderWithProviders(<SubmittalApproveAllDialog revLabel="Rev 2" rows={0} alreadyDecided={4} missing={0} people={people} onSave={onSave} onClose={() => {}} />)
    expect((screen.getByTestId('approve-all-save') as HTMLButtonElement).disabled).toBe(true)
  })

  it('the title and the buttons hold still; the fields between them are what scrolls, never the backdrop', () => {
    renderWithProviders(<SubmittalApproveAllDialog revLabel="Rev 1" rows={14} alreadyDecided={0} missing={0} people={people} onSave={() => {}} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    const body = screen.getByTestId('approve-all-body')
    // The window is held to the screen, so its top can never sit above the top edge.
    expect(dialog.style.maxHeight).toBe('100%')
    expect(dialog.style.minHeight).toBe('0')
    expect(dialog.parentElement!.style.overflowY).toBe('')
    expect(body.style.overflowY).toBe('auto')
    expect(body.style.minHeight).toBe('0')
    // Outside the scrolling body: the title and the buttons.
    expect(body.contains(screen.getByRole('heading'))).toBe(false)
    expect(body.contains(screen.getByTestId('approve-all-scope'))).toBe(false)
    expect(body.contains(screen.getByRole('button', { name: 'Cancel' }))).toBe(false)
    expect(body.contains(screen.getByTestId('approve-all-save'))).toBe(false)
    // Inside it: every field.
    expect(body.contains(screen.getByLabelText('Whose call'))).toBe(true)
    expect(body.contains(screen.getByLabelText('Approved on'))).toBe(true)
    expect(body.contains(screen.getByLabelText('Their note'))).toBe(true)
  })
})
