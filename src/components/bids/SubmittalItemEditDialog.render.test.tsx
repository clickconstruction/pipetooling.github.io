// @vitest-environment jsdom
/**
 * Render smoke for the row editor: the supply house, the window's layout, the parts, and the
 * one line that reads the reviewer's answer and opens the window where it is recorded
 * (`SubmittalAnswerDialog`; the answer itself is no longer entered here).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const unmountAll = () => cleanup()
import { SubmittalItemEditDialog, type SubmittalItemPatch } from './SubmittalItemEditDialog'
import type { SubmittalItemRow } from '../../lib/submittals/submittalRevision'
import type { SubmittalPartRow } from '../../lib/submittals/itemParts'

const item = (o: Partial<SubmittalItemRow> = {}): SubmittalItemRow => ({ id: 'i1', submittal_id: 'r2', tag: 'WC-1', sequence_order: 1, status: 'alternate', specified_manufacturer: 'TOTO', specified_model: 'CT708UVG#01', specified_description: 'WATER CLOSET', submitted_manufacturer: 'TOTO', submitted_model: 'CT728', submitted_label: 'TOTO CT728 kit', supply_house_id: null, source_quote_line_id: null, source_count_row_id: null, reason_kind: 'lead_time', reason_note: null, lead_time_days: 14, sheet_file: null, sheet_pages: [], sheet_source: null, review_decision: null, review_note: null, reviewed_at: null, reviewed_by_name: null, reviewed_by_email: null, reviewed_by_person_id: null, carried_from_item_id: null, decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, order_only: false, created_at: '', updated_at: '', ...o })

describe('SubmittalItemEditDialog · their answer, read here and entered in its own window (2026-10-02)', () => {
  it('a row that does not exist yet shows no answer line', () => {
    renderWithProviders(<SubmittalItemEditDialog item={item()} sourceFiles={[]} onSave={() => {}} onClose={() => {}} />)
    expect(screen.queryByTestId('their-answer-line')).toBeNull()
  })

  it('reads the answer the row carries, and who entered it', () => {
    const { unmount } = renderWithProviders(<SubmittalItemEditDialog item={item()} sourceFiles={[]} canEnterDecision onSave={() => {}} onClose={() => {}} />)
    expect(screen.getByTestId('their-answer-line').textContent).toContain('None yet.')
    unmount()
    renderWithProviders(<SubmittalItemEditDialog item={item({ review_decision: 'approved', reviewed_by_name: 'Dana Whitfield', decision_source: 'entered', decision_entered_by_name: 'Wendi' })} sourceFiles={[]} canEnterDecision onSave={() => {}} onClose={() => {}} />)
    expect(screen.getByTestId('their-answer-line').textContent).toContain('Approved · Dana Whitfield · entered by Wendi')
    // Nothing about the answer is typed here any more.
    expect(screen.queryByLabelText('Who answered')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Revise' })).toBeNull()
  })

  it('Save and enter their answer… saves the row as Save would, and says to open the answer window; plain Save does not', () => {
    const onSave = vi.fn<(p: SubmittalItemPatch) => void>()
    renderWithProviders(<SubmittalItemEditDialog item={item()} sourceFiles={[]} canEnterDecision onSave={onSave} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'elongated bowl' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave.mock.calls[0]![0].reason_note).toBe('elongated bowl')
    expect('thenAnswer' in onSave.mock.calls[0]![0]).toBe(false)
    fireEvent.click(screen.getByTestId('their-answer-open'))
    expect(onSave.mock.calls[1]![0]).toMatchObject({ reason_note: 'elongated bowl', thenAnswer: true })
  })

  it('a lead time that does not read holds the door, as it holds Save', () => {
    renderWithProviders(<SubmittalItemEditDialog item={item()} sourceFiles={[]} canEnterDecision onSave={() => {}} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Lead time, typed'), { target: { value: 'soonish' } })
    expect((screen.getByTestId('their-answer-open') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
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
    const { unmount } = renderWithProviders(<SubmittalItemEditDialog item={item({ supply_house_id: 'h-gone' })} sourceFiles={[]} houses={houses} canEnterDecision onSave={() => {}} onClose={() => {}} />)
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
    renderWithProviders(<SubmittalItemEditDialog item={item()} sourceFiles={[]} houses={houses} canEnterDecision onSave={() => {}} onClose={() => {}} />)
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
    expect(body.contains(screen.getByTestId('their-answer-line'))).toBe(true)
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
    fireEvent.click(within(screen.getByRole('group', { name: 'What happens to part 2' })).getByRole('button', { name: 'Order only' }))
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
    expect(within(screen.getByRole('group', { name: 'What happens to part 1' })).getAllByRole('button').every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
    expect(screen.queryByTestId('add-part')).toBeNull()
    fireEvent.change(screen.getByLabelText('Lead time for part 2'), { target: { value: 'soonish' } })
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('2026-10-02 · each part is one of three: Left out greys it, Save takes it off the row, and it can be brought back before Save', () => {
    const onSave = vi.fn<(p: SubmittalItemPatch) => void>()
    renderWithProviders(<SubmittalItemEditDialog item={item({ tag: 'LAV-1', status: 'proposed' })} parts={parts} houses={houses} sourceFiles={[]} canEditProduct onSave={onSave} onClose={() => {}} />)
    const picks = (n: number) => within(screen.getByRole('group', { name: `What happens to part ${n}` }))
    const lit = (n: number) => picks(n).getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'true')!.textContent
    expect([lit(1), lit(2), lit(3)]).toEqual(['GC sees it', 'GC sees it', 'Order only'])
    fireEvent.click(picks(3).getByRole('button', { name: 'Left out' }))
    expect(lit(3)).toBe('Left out')
    expect(screen.getByTestId('part-left-out').textContent).toBe('not submitted, not ordered · Save takes it off')
    expect(screen.getByTestId('parts-editor').textContent).toContain('2 the GC sees · 1 left out')
    // Its house, lead time and stage are not asked while it is left out.
    expect(screen.queryByLabelText('House for part 3')).toBeNull()
    // Changed her mind on part 2: left out, then back as order only.
    fireEvent.click(picks(2).getByRole('button', { name: 'Left out' }))
    fireEvent.click(picks(2).getByRole('button', { name: 'Order only' }))
    expect(lit(2)).toBe('Order only')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const saved = onSave.mock.calls[0]![0]
    expect(saved.parts!.map((d) => [d.id, d.on_submittal, d.left_out ?? false])).toEqual([['tsl', true, false], ['faucet', false, false], ['stop', false, true]])
  })

  it('2026-10-02 · a part the log holds an order for cannot be left out; every part left out holds Save and points at the row’s ×', () => {
    renderWithProviders(<SubmittalItemEditDialog item={item({ tag: 'LAV-1', status: 'proposed' })} parts={parts} houses={houses} sourceFiles={[]} canEditProduct boughtParts={new Map([['faucet', 'Ordered 09/23, on site 09/29']])} onSave={() => {}} onClose={() => {}} />)
    const picks = (n: number) => within(screen.getByRole('group', { name: `What happens to part ${n}` }))
    expect((picks(2).getByRole('button', { name: 'Left out' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('part-bought').textContent).toBe('Ordered 09/23, on site 09/29')
    expect((picks(2).getByRole('button', { name: 'Order only' }) as HTMLButtonElement).disabled).toBe(false)
    unmountAll()
    renderWithProviders(<SubmittalItemEditDialog item={item({ tag: 'LAV-1', status: 'proposed' })} parts={parts} houses={houses} sourceFiles={[]} canEditProduct onSave={() => {}} onClose={() => {}} />)
    for (const n of [1, 2, 3]) fireEvent.click(within(screen.getByRole('group', { name: `What happens to part ${n}` })).getByRole('button', { name: 'Left out' }))
    expect(screen.getByTestId('all-parts-out').textContent).toBe('Every part is left out. To leave the whole fixture out, use the × on its row.')
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
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

describe('SubmittalItemEditDialog · the window keeps what was typed (2026-10-03)', () => {
  it('nothing typed: a click outside, Cancel and Esc each close at once', () => {
    for (const leave of [() => fireEvent.click(screen.getByRole('presentation')), () => fireEvent.click(screen.getByRole('button', { name: 'Cancel' })), () => fireEvent.keyDown(document, { key: 'Escape' })]) {
      const onClose = vi.fn()
      const { unmount } = renderWithProviders(<SubmittalItemEditDialog item={item()} sourceFiles={[]} onSave={() => {}} onClose={onClose} />)
      leave()
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(screen.queryByTestId('leave-question')).toBeNull()
      unmount()
    }
  })

  it('something typed: a click outside asks, Keep editing keeps the typing, Esc asks again and answers it, Leave closes', () => {
    const onClose = vi.fn()
    renderWithProviders(<SubmittalItemEditDialog item={item()} sourceFiles={[]} onSave={() => {}} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'elongated bowl' } })
    fireEvent.click(screen.getByRole('presentation'))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('leave-question').textContent).toContain('Leave without saving? Your changes to WC-1 are not saved yet.')
    fireEvent.click(screen.getByTestId('leave-keep'))
    expect(screen.queryByTestId('leave-question')).toBeNull()
    expect((screen.getByLabelText('Note') as HTMLTextAreaElement).value).toBe('elongated bowl')
    // Esc asks; a second Esc is Keep editing.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByTestId('leave-question')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('leave-question')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByTestId('leave-confirm'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('typed and typed back reads as nothing typed', () => {
    const onClose = vi.fn()
    renderWithProviders(<SubmittalItemEditDialog item={item()} sourceFiles={[]} onSave={() => {}} onClose={onClose} />)
    const was = (screen.getByLabelText('Note') as HTMLTextAreaElement).value
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'x' } })
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: was } })
    fireEvent.click(screen.getByRole('presentation'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('while the tab saves, Save reads Saving… and the window holds', () => {
    const onClose = vi.fn()
    const onSave = vi.fn()
    renderWithProviders(<SubmittalItemEditDialog item={item()} sourceFiles={[]} busy onSave={onSave} onClose={onClose} />)
    const save = screen.getByTestId('edit-row-save') as HTMLButtonElement
    expect(save.textContent).toBe('Saving…')
    expect(save.disabled).toBe(true)
    fireEvent.click(save)
    fireEvent.click(screen.getByRole('presentation'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
