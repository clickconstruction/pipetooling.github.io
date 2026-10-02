// @vitest-environment jsdom
/**
 * Render smoke for the window that records what a reviewer said about one row (2026-10-02): who
 * answered (the bid's GC first, an email never required), the day, and one answer per part the
 * GC sees, saved once. The numbers are BP375's WC-1, WC-2 as Wendi had it.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SubmittalAnswerDialog, type AnswerSave } from './SubmittalAnswerDialog'
import type { SubmittalItemRow } from '../../lib/submittals/submittalRevision'
import type { SubmittalPersonRow } from '../../lib/submittals/submittalRoom'
import type { SubmittalPartRow } from '../../lib/submittals/itemParts'

const item = (o: Partial<SubmittalItemRow> = {}): SubmittalItemRow => ({ id: 'i1', submittal_id: 'r1', tag: 'WC-1, WC-2', sequence_order: 1, status: 'proposed', specified_manufacturer: null, specified_model: null, specified_description: 'WC 1&2', submitted_manufacturer: null, submitted_model: null, submitted_label: 'TOTO CT728CUVG#01', supply_house_id: null, source_quote_line_id: null, source_count_row_id: null, reason_kind: null, reason_note: null, lead_time_days: null, sheet_file: null, sheet_pages: [], sheet_source: null, review_decision: null, review_note: null, reviewed_at: null, reviewed_by_name: null, reviewed_by_email: null, reviewed_by_person_id: null, carried_from_item_id: null, decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, created_at: '', updated_at: '', ...o } as SubmittalItemRow)
const part = (id: string, label: string, seq: number, extra: Partial<SubmittalPartRow> = {}): SubmittalPartRow => ({ id, item_id: 'i1', bid_id: 'b1', sequence_order: seq, label, manufacturer: null, model: null, description: null, quantity: 1, on_submittal: true, source: 'takeoff', part_id: null, source_line_id: null, source_template_item_id: null, assembly: null, priced_label: null, reason_note: null, supply_house_id: null, lead_time_days: null, stage: null, sheet_file: null, sheet_pages: [], review_decision: null, review_note: null, reviewed_at: null, reviewed_by_name: null, reviewed_by_email: null, reviewed_by_person_id: null, decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, procure_key: `k-${id}`, carried_from_part_id: null, created_at: '', updated_at: '', ...extra })
const parts = [
  part('bowl', 'TOTO CT728CUVG#01', 1),
  part('valve', 'TOTO TET2UB31#SS', 2),
  part('seat', 'MAINLINE ML1055SSC000 WHT ELONG', 3),
  part('zurn', 'ZURN Z1201-NR4-CL12-RYK17 NH DURA-COAT', 4),
  part('carrier', 'JOSAM 12694 4" NH double adjustable horizontal closet carrier', 5),
  part('stop', 'BRASSCRA PLB113XP ANG', 6, { on_submittal: false }),
]
const sources = { gcName: 'Structura', contacts: [{ id: 'c1', name: 'Marco Ruiz', email: 'marco@structura.test' }] }
const dana = [{ id: 'p1', room_id: 'room', name: 'Dana Whitfield', email: 'dana@arch.test', role: 'architect', may_decide: true, token: 't', how: 'named', invited_by: null, first_seen_at: null, last_seen_at: null, open_count: 0, closed_at: null, created_at: '', updated_at: '' }] as unknown as SubmittalPersonRow[]
const line = (head: string) => screen.getByRole('group', { name: `Their answer on ${head}` })
const tap = (head: string, answer: string) => fireEvent.click(within(line(head)).getByRole('button', { name: answer }))

describe('SubmittalAnswerDialog', () => {
  it('"approved, except the flush valve" is one Save: no email asked, the GC first, each part its own answer', () => {
    const onSave = vi.fn<(a: AnswerSave) => void>()
    renderWithProviders(<SubmittalAnswerDialog item={item()} parts={parts} sources={sources} revLabel="Rev 1" onSave={onSave} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Their answer on WC-1, WC-2' })).toBeTruthy()
    expect(screen.getByTestId('answer-scope').textContent).toBe('Rev 1 · 5 parts the GC sees')
    // Nobody is on the room: the picker opens on the bid's GC, and asks for nothing.
    const who = screen.getByLabelText('Who answered') as HTMLSelectElement
    expect(who.value).toBe('gc')
    expect(Array.from(who.options).map((o) => o.text)).toEqual(['Structura · the GC on this bid', 'Marco Ruiz · at Structura', 'Someone else…'])
    expect(screen.queryByLabelText('Reviewer email')).toBeNull()
    expect(screen.getByTestId('reviewer-no-contact').textContent).toBe('Only for the record. Nobody is emailed or contacted.')
    // The order-only stop has no line; nothing is picked, so there is nothing to save.
    expect(screen.getAllByTestId('answer-line')).toHaveLength(5)
    const save = screen.getByTestId('answer-save') as HTMLButtonElement
    expect(save.textContent).toBe('Nothing to save')
    expect(save.disabled).toBe(true)

    tap('TOTO TET2UB31#SS', 'Rejected')
    fireEvent.change(screen.getByLabelText('Their note on TOTO TET2UB31#SS'), { target: { value: 'They want TET2UA31#SS' } })
    fireEvent.click(screen.getByTestId('answer-all-approved'))
    expect(screen.getByTestId('answer-summary').textContent).toBe('4 approved · 1 rejected · every part answered')
    expect(save.textContent).toBe('Record 5 answers')
    fireEvent.click(save)
    const saved = onSave.mock.calls[0]![0]
    expect(saved.person).toEqual({ name: 'Structura', email: null, role: 'builder' })
    expect('on' in saved).toBe(false)
    expect(saved.writes.sets).toEqual([
      { decision: 'approved', note: '', partIds: ['bowl', 'seat', 'zurn', 'carrier'], row: false },
      { decision: 'rejected', note: 'They want TET2UA31#SS', partIds: ['valve'], row: false },
    ])
    expect(saved.writes.counts).toEqual({ approved: 4, revise: 0, rejected: 1 })
  })

  it('someone else needs only a name; a half-typed email holds Save with the reason beside the boxes', () => {
    const onSave = vi.fn<(a: AnswerSave) => void>()
    renderWithProviders(<SubmittalAnswerDialog item={item()} parts={parts} sources={sources} revLabel="Rev 1" onSave={onSave} onClose={() => {}} />)
    tap('TOTO CT728CUVG#01', 'Approved')
    fireEvent.change(screen.getByLabelText('Who answered'), { target: { value: 'new' } })
    expect(screen.getByTestId('reviewer-no-contact').textContent).toContain('The email is optional. It stays in the office.')
    const save = screen.getByTestId('answer-save') as HTMLButtonElement
    expect(save.disabled).toBe(true)
    expect(screen.getByTestId('answer-who-problem').textContent).toBe('Type their name, so the record says who answered.')
    fireEvent.change(screen.getByLabelText('Reviewer name'), { target: { value: 'Tom Reyes' } })
    expect(save.disabled).toBe(false)
    fireEvent.change(screen.getByLabelText('Reviewer email'), { target: { value: 'tom@' } })
    expect(save.disabled).toBe(true)
    expect(screen.getByTestId('answer-who-problem').textContent).toBe('That email does not read as an email. Fix it or leave it out.')
    fireEvent.change(screen.getByLabelText('Reviewer email'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('The day they answered'), { target: { value: '2026-01-05' } })
    fireEvent.click(save)
    expect(onSave.mock.calls[0]![0]).toMatchObject({ person: { name: 'Tom Reyes', email: null, role: 'architect' }, on: '2026-01-05' })
  })

  it('opens on what each part already carries: an entered answer can be taken back alone, with no one to name; a room call cannot be emptied', () => {
    const onSave = vi.fn<(a: AnswerSave) => void>()
    const carried = [
      part('bowl', 'TOTO CT728CUVG#01', 1, { review_decision: 'approved', reviewed_by_name: 'Dana Whitfield', decision_source: 'room' }),
      part('valve', 'TOTO TET2UB31#SS', 2, { review_decision: 'rejected', review_note: 'TET2UA31#SS', reviewed_by_name: 'structura', decision_source: 'entered' }),
    ]
    renderWithProviders(<SubmittalAnswerDialog item={item({ review_decision: 'rejected' })} parts={carried} people={dana} sources={sources} revLabel="Rev 2" onSave={onSave} onClose={() => {}} />)
    // Dana is on the room and may decide, so she is the opening pick; the GC is still offered.
    expect((screen.getByLabelText('Who answered') as HTMLSelectElement).value).toBe('p1')
    const lines = screen.getAllByTestId('answer-line')
    expect(lines.map((l) => l.getAttribute('data-answer'))).toEqual(['approved', 'rejected'])
    expect(lines[0]!.textContent).toContain('now Approved · Dana Whitfield · their own call, it can be changed but not emptied')
    expect((screen.getByLabelText('Their note on TOTO TET2UB31#SS') as HTMLInputElement).value).toBe('TET2UA31#SS')
    // A tap on Dana's own Approved leaves it; a tap on the entered Rejected takes that one back.
    tap('TOTO CT728CUVG#01', 'Approved')
    expect(screen.getAllByTestId('answer-line')[0]!.getAttribute('data-answer')).toBe('approved')
    tap('TOTO TET2UB31#SS', 'Rejected')
    const save = screen.getByTestId('answer-save') as HTMLButtonElement
    expect(save.textContent).toBe('Take back 1 answer')
    fireEvent.click(save)
    expect(onSave.mock.calls[0]![0]).toMatchObject({ person: null, writes: { sets: [], clearPartIds: ['valve'], clearRow: false } })
  })

  it('a row with no parts is one line; the title and the buttons hold still and the lines scroll', () => {
    const onSave = vi.fn<(a: AnswerSave) => void>()
    renderWithProviders(<SubmittalAnswerDialog item={item({ tag: 'HB-3', submitted_label: 'WOODFORD B74C' })} parts={[]} sources={{ gcName: null, contacts: [] }} revLabel="Rev 1" onSave={onSave} onClose={() => {}} />)
    expect(screen.getByTestId('answer-scope').textContent).toBe('Rev 1 · one product')
    expect(screen.queryByTestId('answer-all-approved')).toBeNull()
    const dialog = screen.getByRole('dialog')
    const body = screen.getByTestId('answer-body')
    expect(dialog.style.maxHeight).toBe('100%')
    expect(body.style.overflowY).toBe('auto')
    expect(body.contains(screen.getByTestId('answer-save'))).toBe(false)
    expect(body.contains(screen.getByRole('heading'))).toBe(false)
    // No GC on the bid and nobody on the room: a typed name is the only way to say who.
    expect((screen.getByLabelText('Who answered') as HTMLSelectElement).value).toBe('new')
    tap('WOODFORD B74C', 'Revise')
    fireEvent.change(screen.getByLabelText('Reviewer name'), { target: { value: 'Dana Whitfield' } })
    fireEvent.click(screen.getByTestId('answer-save'))
    expect(onSave.mock.calls[0]![0].writes.sets).toEqual([{ decision: 'revise', note: '', partIds: [], row: true }])
  })
})
