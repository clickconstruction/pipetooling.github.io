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
import type { SubmittalPartRow } from '../../lib/submittals/itemParts'

const item = (o: Partial<SubmittalItemRow> = {}): SubmittalItemRow => ({ id: 'i1', submittal_id: 'r2', tag: 'WC-1', sequence_order: 1, status: 'alternate', specified_manufacturer: 'TOTO', specified_model: 'CT708UVG#01', specified_description: 'WATER CLOSET', submitted_manufacturer: 'TOTO', submitted_model: 'CT728', submitted_label: 'TOTO CT728 kit', supply_house_id: null, source_quote_line_id: null, source_count_row_id: null, reason_kind: 'lead_time', reason_note: null, lead_time_days: 14, sheet_file: null, sheet_pages: [], sheet_source: null, review_decision: null, review_note: null, reviewed_at: null, reviewed_by_name: null, reviewed_by_email: null, reviewed_by_person_id: null, carried_from_item_id: null, decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, created_at: '', updated_at: '', ...o })
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

  it('a call carries the day they made it: an earlier day rides along, today adds nothing, a later day holds Save', () => {
    const onSave = vi.fn<(p: SubmittalItemPatch) => void>()
    renderWithProviders(<SubmittalItemEditDialog item={item()} sourceFiles={[]} people={people} canEnterDecision onSave={onSave} onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('enter-call-open'))
    fireEvent.click(screen.getByRole('button', { name: 'Approved' }))
    const day = screen.getByLabelText('The day of their call') as HTMLInputElement
    expect(day.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(day.max).toBe(day.value)
    fireEvent.change(day, { target: { value: '2099-01-01' } })
    expect(screen.getByText('Their call cannot be dated after today.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(day, { target: { value: '2026-09-12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave.mock.calls[0]![0].entered).toEqual({ decision: 'approved', note: '', person: { id: 'p1' }, on: '2026-09-12' })
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

describe('SubmittalItemEditDialog · supply house', () => {
  const houses = [{ id: 'h-moore', name: 'Moore Supply' }, { id: 'h-national', name: 'National Wholesale' }]

  it('shows the row’s house, and Save carries a new one only when it was changed', () => {
    const onSave = vi.fn<(p: SubmittalItemPatch) => void>()
    const { unmount } = renderWithProviders(<SubmittalItemEditDialog item={item({ supply_house_id: 'h-moore' })} sourceFiles={[]} houses={houses} onSave={onSave} onClose={() => {}} />)
    const picker = screen.getByLabelText('Supply house') as HTMLSelectElement
    expect(picker.value).toBe('h-moore')
    // Untouched: the patch says nothing about the house, so a save of something else cannot move it.
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect('supply_house_id' in onSave.mock.calls[0]![0]).toBe(false)
    fireEvent.change(picker, { target: { value: 'h-national' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave.mock.calls[1]![0].supply_house_id).toBe('h-national')
    fireEvent.change(picker, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave.mock.calls[2]![0].supply_house_id).toBeNull()
    unmount()
  })

  it('is there on a shared revision too, keeps a house the list does not carry, and hides with no houses', () => {
    const { unmount } = renderWithProviders(<SubmittalItemEditDialog item={item({ supply_house_id: 'h-gone' })} sourceFiles={[]} people={people} houses={houses} canEnterDecision onSave={() => {}} onClose={() => {}} />)
    const picker = screen.getByLabelText('Supply house') as HTMLSelectElement
    expect(picker.value).toBe('h-gone')
    expect(screen.getByRole('option', { name: 'The house on this row' })).toBeTruthy()
    unmount()
    renderWithProviders(<SubmittalItemEditDialog item={item()} sourceFiles={[]} onSave={() => {}} onClose={() => {}} />)
    expect(screen.queryByLabelText('Supply house')).toBeNull()
  })
})

describe('SubmittalItemEditDialog · the window fits the screen (2026-10-02)', () => {
  const houses = [{ id: 'h-moore', name: 'Moore Supply' }, { id: 'h-national', name: 'National Wholesale' }]

  it('the title and the Save row hold still; the fields between them are what scrolls, never the backdrop', () => {
    renderWithProviders(<SubmittalItemEditDialog item={item()} sourceFiles={[]} people={people} houses={houses} canEnterDecision onSave={() => {}} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    const body = screen.getByTestId('edit-row-body')
    // The window is held to the screen, so its top can never sit above the top edge.
    expect(dialog.style.maxHeight).toBe('100%')
    expect(dialog.parentElement!.style.overflowY).toBe('')
    expect(body.style.overflowY).toBe('auto')
    expect(body.style.minHeight).toBe('0')
    // Outside the scrolling body: the title and the buttons.
    expect(body.contains(screen.getByRole('heading'))).toBe(false)
    expect(body.contains(screen.getByRole('button', { name: 'Save' }))).toBe(false)
    expect(body.contains(screen.getByRole('button', { name: 'Cancel' }))).toBe(false)
    // Inside it: every field.
    expect(body.contains(screen.getByLabelText('Supply house'))).toBe(true)
    expect(body.contains(screen.getByLabelText('Note'))).toBe(true)
    expect(body.contains(screen.getByTestId('entered-call'))).toBe(true)
  })

  it('opened from a Procure line on a row with no parts: the house box is ready; opened from the row, nothing is', () => {
    const { unmount } = renderWithProviders(<SubmittalItemEditDialog item={item()} sourceFiles={[]} houses={houses} focusHouse onSave={() => {}} onClose={() => {}} />)
    expect(document.activeElement).toBe(screen.getByLabelText('Supply house'))
    unmount()
    renderWithProviders(<SubmittalItemEditDialog item={item()} sourceFiles={[]} houses={houses} onSave={() => {}} onClose={() => {}} />)
    expect(document.activeElement).not.toBe(screen.getByLabelText('Supply house'))
  })
})

describe('SubmittalItemEditDialog · parts, each bought on its own (2026-10-01)', () => {
  const part = (id: string, label: string, seq: number, extra: Partial<SubmittalPartRow> = {}): SubmittalPartRow => ({ id, item_id: 'i1', bid_id: 'b1', sequence_order: seq, label, manufacturer: null, model: null, description: null, quantity: 1, on_submittal: true, source: 'takeoff', part_id: null, source_line_id: null, source_template_item_id: null, assembly: 'LAV 1 assembly SPACEX', priced_label: null, reason_note: null, supply_house_id: null, lead_time_days: null, stage: null, sheet_file: null, sheet_pages: [], review_decision: null, review_note: null, reviewed_at: null, reviewed_by_name: null, reviewed_by_email: null, reviewed_by_person_id: null, decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, procure_key: `k-${id}`, carried_from_part_id: null, created_at: '', updated_at: '', ...extra })
  const parts = [part('tsl', 'TSL.MON.B.38.2.PS1.BK MONOLITH B SERIES', 1), part('faucet', 'TOTO T25S51E#CP', 2), part('stop', 'BRASSCRA PLB113XP ANG', 3, { on_submittal: false })]
  const houses = [{ id: 'h-moore', name: 'Moore Supply' }, { id: 'h-nws', name: 'National Wholesale' }]

  it('on a draft: every part is listed, a house, a lead time and a stage go on a part, one is switched to order only, one is typed in; Save hands back the parts', () => {
    const onSave = vi.fn<(p: SubmittalItemPatch) => void>()
    renderWithProviders(<SubmittalItemEditDialog item={item({ tag: 'LAV-1', status: 'proposed' })} parts={parts} houses={houses} sourceFiles={[]} canEditProduct onSave={onSave} onClose={() => {}} />)
    expect(screen.getAllByTestId('part-editor-row')).toHaveLength(3)
    expect(screen.getByTestId('parts-editor').textContent).toContain('2 the GC sees · 1 order only · from LAV 1 assembly SPACEX')
    // The row's own house and lead time are read from its parts.
    expect(screen.queryByRole('combobox', { name: 'Supply house' })).toBeNull()
    fireEvent.change(screen.getByLabelText('House for part 1'), { target: { value: 'h-nws' } })
    fireEvent.change(screen.getByLabelText('Lead time for part 1'), { target: { value: '6 wk' } })
    fireEvent.change(screen.getByLabelText('Stage for part 1'), { target: { value: 'trim_set' } })
    expect(screen.getByTestId('parts-roll-up').textContent).toContain('6 wk, the longest among the parts the GC sees.')
    fireEvent.click(screen.getByLabelText('The GC sees part 2'))
    fireEvent.click(screen.getByTestId('add-part'))
    fireEvent.change(screen.getByLabelText('Part 4'), { target: { value: 'LEONARD 170D-LF' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const saved = onSave.mock.calls[0]![0]
    expect(saved.parts!.map((d) => [d.id ?? 'new', d.label, d.on_submittal, d.supply_house_id, d.lead_time_days, d.stage])).toEqual([
      ['tsl', 'TSL.MON.B.38.2.PS1.BK MONOLITH B SERIES', true, 'h-nws', 42, 'trim_set'],
      ['faucet', 'TOTO T25S51E#CP', false, null, null, null],
      ['stop', 'BRASSCRA PLB113XP ANG', false, null, null, null],
      ['new', 'LEONARD 170D-LF', true, null, null, null],
    ])
    expect('submitted_label' in saved).toBe(false)
    expect('supply_house_id' in saved).toBe(false)
  })

  it('2026-10-02 · opened from a Procure line: the part tapped is ringed with its house box ready; Save leaves a tag nobody changed as it was', () => {
    const onSave = vi.fn<(p: SubmittalItemPatch) => void>()
    renderWithProviders(<SubmittalItemEditDialog item={item({ tag: 'Kitchen sinks', status: 'proposed' })} parts={parts} houses={houses} sourceFiles={[]} canEditProduct focusPartId="faucet" onSave={onSave} onClose={() => {}} />)
    const ringed = screen.getAllByTestId('part-editor-row').filter((r) => r.getAttribute('data-focused') === 'true')
    expect(ringed).toHaveLength(1)
    expect((ringed[0]!.querySelector('input[aria-label="Part 2"]') as HTMLInputElement).value).toBe('TOTO T25S51E#CP')
    expect(document.activeElement).toBe(screen.getByLabelText('House for part 2'))
    // The parts are in the body that scrolls, so the part tapped can always be brought into view.
    expect(screen.getByTestId('edit-row-body').contains(ringed[0]!)).toBe(true)
    fireEvent.change(screen.getByLabelText('House for part 2'), { target: { value: 'h-moore' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const saved = onSave.mock.calls[0]![0]
    expect(saved.parts![1]).toMatchObject({ id: 'faucet', supply_house_id: 'h-moore' })
    // Opening a row to change a house never renames it (a tag line on the log is keyed by the tag).
    expect('tag' in saved).toBe(false)
  })

  it('2026-10-02 · a tag typed in Edit is still saved, in capitals', () => {
    const onSave = vi.fn<(p: SubmittalItemPatch) => void>()
    renderWithProviders(<SubmittalItemEditDialog item={item({ tag: 'LAV-1', status: 'proposed' })} parts={parts} houses={houses} sourceFiles={[]} canEditProduct onSave={onSave} onClose={() => {}} />)
    expect(screen.getAllByTestId('part-editor-row').some((r) => r.getAttribute('data-focused') === 'true')).toBe(false)
    fireEvent.change(screen.getByLabelText('Tag'), { target: { value: 'lav-1a' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave.mock.calls[0]![0].tag).toBe('LAV-1A')
  })

  it('a lead time that does not read holds Save; on a shared revision a part’s name and switch are fixed', () => {
    renderWithProviders(<SubmittalItemEditDialog item={item({ tag: 'LAV-1' })} parts={parts} houses={houses} sourceFiles={[]} onSave={() => {}} onClose={() => {}} />)
    expect(screen.queryByLabelText('Part 1')).toBeNull()
    expect((screen.getByLabelText('The GC sees part 1') as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByTestId('add-part')).toBeNull()
    fireEvent.change(screen.getByLabelText('Lead time for part 2'), { target: { value: 'soonish' } })
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('a call entered on a row with parts covers the parts ticked; all the GC sees to start, none holds Save', () => {
    const onSave = vi.fn<(p: SubmittalItemPatch) => void>()
    renderWithProviders(<SubmittalItemEditDialog item={item({ tag: 'LAV-1' })} parts={parts} houses={houses} people={people} sourceFiles={[]} canEnterDecision onSave={onSave} onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('enter-call-open'))
    fireEvent.click(screen.getByRole('button', { name: 'Revise' }))
    const box = screen.getByTestId('entered-call-parts')
    expect(box.textContent).toContain('TSL.MON.B.38.2.PS1.BK')
    expect(box.textContent).not.toContain('BRASSCRA')
    fireEvent.click(screen.getByRole('checkbox', { name: /TSL\.MON/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /TOTO T25S51E#CP/ }))
    expect(screen.getByText('Tick at least one part.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /TOTO T25S51E#CP/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave.mock.calls[0]![0].entered).toMatchObject({ decision: 'revise', person: { id: 'p1' }, partIds: ['faucet'] })
  })

  it('a row with no parts can be listed as parts on a draft, starting from its product', () => {
    const onSave = vi.fn<(p: SubmittalItemPatch) => void>()
    renderWithProviders(<SubmittalItemEditDialog item={item()} houses={houses} sourceFiles={[]} canEditProduct onSave={onSave} onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('list-as-parts'))
    expect((screen.getByLabelText('Part 1') as HTMLInputElement).value).toBe('TOTO CT728 kit')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave.mock.calls[0]![0].parts).toEqual([{ label: 'TOTO CT728 kit', quantity: 1, on_submittal: true, supply_house_id: null, lead_time_days: 14, stage: null }])
  })
})
