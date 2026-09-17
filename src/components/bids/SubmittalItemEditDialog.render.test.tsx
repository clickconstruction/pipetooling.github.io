// @vitest-environment jsdom
/**
 * Render smoke for the row editor's on-behalf-of section (Submittals stage 5b): on a shared
 * revision the office can enter a reviewer's call from their file — an existing person on the
 * room or a new one (name + email required) — and Save carries it; a draft asks nothing.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SubmittalItemEditDialog, type SubmittalItemPatch } from './SubmittalItemEditDialog'
import type { SubmittalItemRow } from '../../lib/submittals/submittalRevision'
import type { SubmittalPersonRow } from '../../lib/submittals/submittalRoom'

const item = (o: Partial<SubmittalItemRow> = {}): SubmittalItemRow => ({ id: 'i1', submittal_id: 'r2', tag: 'WC-1', sequence_order: 1, status: 'alternate', specified_manufacturer: 'TOTO', specified_model: 'CT708UVG#01', specified_description: 'WATER CLOSET', submitted_manufacturer: 'TOTO', submitted_model: 'CT728', submitted_label: 'TOTO CT728 kit', supply_house_id: null, source_quote_line_id: null, reason_kind: 'lead_time', reason_note: null, lead_time_days: 14, sheet_file: null, sheet_pages: [], sheet_source: null, review_decision: null, review_note: null, reviewed_at: null, reviewed_by_name: null, reviewed_by_email: null, reviewed_by_person_id: null, carried_from_item_id: null, decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, created_at: '', updated_at: '', ...o })
const people = [{ id: 'p1', room_id: 'room', name: 'Dana Whitfield', email: 'dana@arch.test', role: 'architect', may_decide: true, token: 't', how: 'named', invited_by: null, first_seen_at: null, last_seen_at: null, open_count: 0, closed_at: null, created_at: '', updated_at: '' }] as unknown as SubmittalPersonRow[]

describe('SubmittalItemEditDialog · entered call (5b)', () => {
  it('a draft shows no on-behalf section', () => {
    renderWithProviders(<SubmittalItemEditDialog item={item()} sourceFiles={[]} people={people} onSave={() => {}} onClose={() => {}} />)
    expect(screen.queryByTestId('entered-call')).toBeNull()
  })

  it('enters Revise on behalf of a person on the room and Save carries it', () => {
    const onSave = vi.fn<(p: SubmittalItemPatch) => void>()
    renderWithProviders(<SubmittalItemEditDialog item={item()} sourceFiles={[]} people={people} canEnterDecision onSave={onSave} onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('enter-call-open'))
    expect((screen.getByLabelText('Whose call') as HTMLSelectElement).value).toBe('p1')
    fireEvent.click(screen.getByRole('button', { name: 'Revise' }))
    fireEvent.change(screen.getByLabelText('Their note'), { target: { value: 'elongated bowl' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0]![0].entered).toEqual({ decision: 'revise', note: 'elongated bowl', person: { id: 'p1' } })
    expect(onSave.mock.calls[0]![0].clearDecision).toBe(false)
  })

  it('a reviewer not on the room needs a name and an email before Save; then the new person rides along', () => {
    const onSave = vi.fn<(p: SubmittalItemPatch) => void>()
    renderWithProviders(<SubmittalItemEditDialog item={item()} sourceFiles={[]} people={people} canEnterDecision onSave={onSave} onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('enter-call-open'))
    fireEvent.change(screen.getByLabelText('Whose call'), { target: { value: 'new' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approved' }))
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Reviewer name'), { target: { value: 'Tom Reyes' } })
    fireEvent.change(screen.getByLabelText('Reviewer email'), { target: { value: 'tom@owner.test' } })
    fireEvent.change(screen.getByLabelText('Reviewer role'), { target: { value: 'owners_rep' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave.mock.calls[0]![0].entered).toEqual({ decision: 'approved', note: '', person: { name: 'Tom Reyes', email: 'tom@owner.test', role: 'owners_rep' } })
  })

  it('an entered call reads who typed it and can be cleared', () => {
    const onSave = vi.fn<(p: SubmittalItemPatch) => void>()
    renderWithProviders(<SubmittalItemEditDialog item={item({ review_decision: 'revise', reviewed_by_name: 'Dana Whitfield', decision_source: 'entered', decision_entered_by_name: 'Wendi' })} sourceFiles={[]} people={people} canEnterDecision onSave={onSave} onClose={() => {}} />)
    expect(screen.getByTestId('entered-call').textContent).toContain('Revise · Dana Whitfield · entered by Wendi')
    fireEvent.click(screen.getByRole('button', { name: 'clear it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave.mock.calls[0]![0]).toMatchObject({ entered: null, clearDecision: true })
  })
})
