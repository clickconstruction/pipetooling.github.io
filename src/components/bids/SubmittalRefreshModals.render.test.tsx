// @vitest-environment jsdom
/**
 * A draft catching up (2026-10-01): the refresh list (each row as it reads now and as it will,
 * the rows left as they are and why), and the fold of a hand row into another row's fixture.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SubmittalFoldModal, SubmittalScheduleGradeModal, SubmittalTakeoffRefreshModal } from './SubmittalRefreshModals'
import type { SubmittalPartRow } from '../../lib/submittals/itemParts'
import type { SubmittalItemRow } from '../../lib/submittals/submittalRevision'

const row = (o: Partial<SubmittalItemRow> & { id: string; tag: string }): SubmittalItemRow => ({
  submittal_id: 's1', source_count_row_id: null, sequence_order: 1, specified_manufacturer: null, specified_model: null, specified_description: null,
  submitted_manufacturer: null, submitted_model: null, submitted_label: null, supply_house_id: null, source_quote_line_id: null, status: 'proposed',
  reason_kind: null, reason_note: null, lead_time_days: null, sheet_file: null, sheet_pages: [], sheet_source: null, carried_from_item_id: null,
  decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, order_only: false, review_decision: null, review_note: null, reviewed_by_name: null,
  reviewed_by_person_id: null, reviewed_by_email: null, reviewed_at: null, created_at: '', updated_at: '', ...o,
})
const part = (id: string, item: string, label: string, seq: number): SubmittalPartRow => ({ id, item_id: item, bid_id: 'b', sequence_order: seq, label, manufacturer: null, model: null, description: null, quantity: 1, on_submittal: true, source: 'takeoff', part_id: null, source_line_id: null, source_template_item_id: null, assembly: null, priced_label: null, reason_note: null, supply_house_id: null, lead_time_days: null, stage: null, sheet_file: null, sheet_pages: [], review_decision: null, review_note: null, reviewed_at: null, reviewed_by_name: null, reviewed_by_email: null, reviewed_by_person_id: null, decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, procure_key: `k-${id}`, carried_from_part_id: null, created_at: '', updated_at: '' })

describe('SubmittalTakeoffRefreshModal', () => {
  it('lists each row now and after, says why the others are left, and refreshes on the button', () => {
    const onConfirm = vi.fn()
    render(
      <SubmittalTakeoffRefreshModal
        rows={[{ itemId: 'lav', tag: 'LAV-1', before: 'LAV-1 ASSEMBLY', after: 'TSL.MON.B.38.2 + TOTO T25S51E#CP', parts: 3, gc: 2 }]}
        skipped={[{ itemId: 'wc', tag: 'WC-1', why: 'house_file' }, { itemId: 'ur', tag: 'UR-1', why: 'same' }, { itemId: 'mb', tag: 'MB-1', why: 'same' }]}
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    )
    expect(screen.getByRole('dialog', { name: 'Refresh from the takeoff' })).toBeTruthy()
    expect(screen.getByTestId('refresh-row').textContent).toContain('Now: LAV-1 ASSEMBLY')
    expect(screen.getByTestId('refresh-after').textContent).toBe('Will read: TSL.MON.B.38.2 + TOTO T25S51E#CP')
    expect(screen.getByTestId('refresh-row').textContent).toContain('LAV-13 parts, 2 for the GC')
    expect(screen.getByTestId('refresh-skipped').textContent).toBe('WC-1 keeps the parts read from the house’s file.UR-1, MB-1 read the same as the takeoff.')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh 1 row' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('nothing to refresh: the button stays off', () => {
    render(<SubmittalTakeoffRefreshModal rows={[]} skipped={[]} onConfirm={() => {}} onClose={() => {}} />)
    expect((screen.getByTestId('refresh-confirm') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('SubmittalFoldModal', () => {
  const wc = row({ id: 'wc', tag: 'WC-1, WC-2', submitted_label: 'TOTO CT708UVG' })
  const ur = row({ id: 'ur', tag: 'UR-1', submitted_label: 'SLOAN WEUS-1000' })
  const car = row({ id: 'car', tag: 'CAR-1', submitted_label: 'JOSAM 12674 CARRIER', reason_note: 'Carrier for WC-1 and WC-2.' })
  const parts = new Map([['ur', [part('u1', 'ur', 'SLOAN WEUS-1000', 1)]]])

  it('starts on the row its note names, shows what that row will list, and folds on the button', () => {
    const onConfirm = vi.fn<(id: string, replaceId: string | null) => void>()
    render(<SubmittalFoldModal from={car} rows={[wc, ur, car]} partsByItem={parts} suggestedIntoId="wc" onConfirm={onConfirm} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Make CAR-1 a part of another row' })).toBeTruthy()
    const pick = screen.getByRole('combobox', { name: 'The row it becomes a part of' }) as HTMLSelectElement
    expect(pick.value).toBe('wc')
    // The row itself is not offered.
    expect([...pick.options].map((o) => o.value)).toEqual(['', 'wc', 'ur'])
    expect(screen.getByTestId('fold-preview').textContent).toBe('WC-1, WC-2 will list for the GC: TOTO CT708UVG + JOSAM 12674.It goes in at Rough In, like every carrier. The CAR-1 row leaves this draft.')
    // A row with no parts yet has nothing to take the place of.
    expect(screen.queryByTestId('fold-replace')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Make it a part of WC-1, WC-2' }))
    expect(onConfirm).toHaveBeenCalledWith('wc', null)
  })

  it('2026-10-02 · in place of: on a row with its own carrier, that carrier is picked; the preview drops it; Nothing keeps it', () => {
    const onConfirm = vi.fn<(id: string, replaceId: string | null) => void>()
    const wcParts = new Map([['wc', [part('w-bowl', 'wc', 'TOTO CT728CUVG#01 TORNADO FLUSH TOILET', 1), part('w-seat', 'wc', 'MAINLINE ML1055SSC000 WHT ELONG', 2), part('w-zurn', 'wc', 'ZURN Z1201-NR4-CL12-RYK17 NH DURA-COAT CI ADJ HORIZONTAL SIPHON JET EZCARRY W/RT HAND INLET', 3)]]])
    render(<SubmittalFoldModal from={car} rows={[wc, ur, car]} partsByItem={wcParts} suggestedIntoId="wc" onConfirm={onConfirm} onClose={() => {}} />)
    const replace = screen.getByRole('combobox', { name: 'The part it takes the place of' }) as HTMLSelectElement
    expect(replace.value).toBe('w-zurn')
    expect([...replace.options].map((o) => o.textContent)).toEqual(['Nothing. Add it as an extra part', 'TOTO CT728CUVG#01', 'MAINLINE ML1055SSC000', 'ZURN Z1201-NR4-CL12-RYK17 · the same kind of part'])
    expect(screen.getByTestId('fold-preview').textContent).toBe('WC-1, WC-2 will list for the GC: TOTO CT728CUVG#01 + MAINLINE ML1055SSC000 + JOSAM 12674.JOSAM 12674 reads in place of the priced ZURN Z1201-NR4-CL12-RYK17, which comes off. It goes in at Rough In, like every carrier. The CAR-1 row leaves this draft.')
    fireEvent.click(screen.getByRole('button', { name: 'Make it a part of WC-1, WC-2' }))
    expect(onConfirm).toHaveBeenLastCalledWith('wc', 'w-zurn')
    fireEvent.change(replace, { target: { value: '' } })
    expect(screen.getByTestId('fold-preview').textContent).toContain('TOTO CT728CUVG#01 + MAINLINE ML1055SSC000 + ZURN Z1201-NR4-CL12-RYK17 + JOSAM 12674.')
    fireEvent.click(screen.getByRole('button', { name: 'Make it a part of WC-1, WC-2' }))
    expect(onConfirm).toHaveBeenLastCalledWith('wc', null)
  })

  it('with no suggestion it waits for a pick; the preview follows the pick', () => {
    render(<SubmittalFoldModal from={car} rows={[wc, ur, car]} partsByItem={parts} suggestedIntoId={null} onConfirm={() => {}} onClose={() => {}} />)
    expect((screen.getByTestId('fold-confirm') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByTestId('fold-preview')).toBeNull()
    fireEvent.change(screen.getByTestId('fold-into'), { target: { value: 'ur' } })
    expect(screen.getByTestId('fold-preview').textContent).toContain('UR-1 will list for the GC: SLOAN WEUS-1000 + JOSAM 12674.')
  })
  it('2026-10-04 · nothing is typed in these two windows: Esc closes them like the ×, and holds while a write runs', () => {
    const onClose = vi.fn()
    const { unmount } = render(<SubmittalTakeoffRefreshModal rows={[]} skipped={[]} onConfirm={() => {}} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()
    render(<SubmittalTakeoffRefreshModal rows={[]} skipped={[]} busy onConfirm={() => {}} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('SubmittalScheduleGradeModal (v2.4609)', () => {
  it('lists each Proposed row the schedule names with the plans’ product and the status it takes, says why the others stay, and grades on the button', () => {
    const onConfirm = vi.fn()
    render(
      <SubmittalScheduleGradeModal
        rows={[
          { itemId: 'wc', tag: 'WC-1, WC-2', scheduleTag: 'WC-1', specified: { manufacturer: 'TOTO', model: 'CT728CUVG#01', description: null }, product: 'TOTO CT728CUVG#01 TORNADO + TOTO TET2UB31#SS', from: 'proposed', to: 'as_specified', near: false },
          { itemId: 'hb', tag: 'HB-3', scheduleTag: 'HB-3', specified: { manufacturer: 'WOODFORD', model: 'B74', description: null }, product: 'WOODFORD B74C', from: 'proposed', to: 'as_specified', near: true },
          { itemId: 'lav', tag: 'LAV-1', scheduleTag: 'LAV-1', specified: { manufacturer: 'KOHLER', model: 'K-2005', description: null }, product: 'TSL.MON.B.38.2.PS1.BK MONOLITH', from: 'proposed', to: 'alternate', near: false },
          { itemId: 'ut', tag: 'UTILITY SINK', scheduleTag: 'UTILITY SINK', specified: { manufacturer: null, model: null, description: 'By contractor' }, product: '', from: 'missing', to: 'missing', near: false },
        ]}
        skipped={[{ itemId: 'ur', tag: 'UR-1', why: 'not_on_schedule' }, { itemId: 'mix', tag: 'LAV-2, HB-4', why: 'two_tags_differ' }]}
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    )
    const dialog = screen.getByRole('dialog', { name: 'Grade the rows against the schedule' })
    expect(screen.getByTestId('grade-summary').textContent).toBe('2 as specified (1 to check) · 1 alternate, say why · 1 still missing.')
    expect(screen.getAllByTestId('grade-to').map((x) => x.textContent)).toEqual(['As specified', 'As specified · check the model', 'Alternate', 'Missing'])
    expect(screen.getAllByTestId('grade-row').map((x) => x.textContent)).toEqual([
      'WC-1, WC-2As specifiedThe plans: TOTO CT728CUVG#01Your row: TOTO CT728CUVG#01 + TOTO TET2UB31#SS',
      'HB-3As specified · check the modelThe plans: WOODFORD B74Your row: WOODFORD B74C',
      'LAV-1AlternateThe plans: KOHLER K-2005Your row: TSL.MON.B.38.2.PS1.BK',
      'UTILITY SINKMissingThe plans: By contractorYour row: no product yet',
    ])
    expect(screen.getByTestId('grade-skipped').textContent).toBe('UR-1 is not on the schedule, so it stays Proposed.LAV-2, HB-4 lists two tags the schedule names differently; grade it with Edit.')
    expect(dialog.textContent).toContain('Parts, houses, lead times, reasons and cut sheets stay as they are.')
    fireEvent.click(screen.getByTestId('grade-confirm'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('grade-confirm').textContent).toBe('Grade 4 rows')
  })
})
