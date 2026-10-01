// @vitest-environment jsdom
/**
 * Read its parts (2026-10-01): the review of a house's file beside the rows, on BP375's own
 * file — one card per tag, what each file part takes the place of, the row's parts the file
 * does not carry, a tag with no row, and a row found by its parts.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SubmittalHouseFileModal } from './SubmittalHouseFileModal'
import { matchFileToRows, readHouseFile, type FileTagChoice } from '../../lib/submittals/houseFileParts'
import { BP375_NWS_PAGES } from '../../lib/submittals/houseFileParts.bp375.fixture'
import type { SubmittalPartRow } from '../../lib/submittals/itemParts'

const part = (id: string, item: string, label: string, seq: number, extra: Partial<SubmittalPartRow> = {}): SubmittalPartRow => ({ id, item_id: item, bid_id: 'b', sequence_order: seq, label, manufacturer: null, model: null, description: null, quantity: 1, on_submittal: true, source: 'takeoff', part_id: null, source_line_id: null, source_template_item_id: null, assembly: null, priced_label: null, reason_note: null, supply_house_id: null, lead_time_days: null, stage: null, sheet_file: null, sheet_pages: [], review_decision: null, review_note: null, reviewed_at: null, reviewed_by_name: null, reviewed_by_email: null, reviewed_by_person_id: null, decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, procure_key: `k-${id}`, carried_from_part_id: null, created_at: '', updated_at: '', ...extra })
const rows = [{ id: 'lav2', tag: 'LAV-2' }, { id: 'mop', tag: '12" DEEP MOP SINK' }]
const parts = new Map<string, SubmittalPartRow[]>([
  ['lav2', [part('kohler', 'lav2', 'KOHLER 2215-0 LADENA WHITE', 1), part('t25', 'lav2', 'TOTO T25S51E#CP', 2), part('soap', 'lav2', 'BOBRICK B-8236', 3), part('flange', 'lav2', 'MAINLINE ML90105 POLISHED CHROME FLANGE', 4, { on_submittal: false })]],
  ['mop', [part('basin', 'mop', 'FIAT MSB2424100 MOLDED STONE MOP SERVICE BASIN', 1)]],
])
const read = readHouseFile(BP375_NWS_PAGES)!
const matches = matchFileToRows(read, rows, parts)

describe('SubmittalHouseFileModal', () => {
  it('a card per tag: where it lands, each file part with its pages and what it takes the place of; the row’s parts the file does not carry', () => {
    const onApply = vi.fn<(c: FileTagChoice[], h: string | null) => void>()
    render(<SubmittalHouseFileModal fileName="SPACEX BA-2 CORE & SHELL.pdf" read={read} matches={matches} rows={rows} partsByItem={parts} houses={[{ id: 'h-nws', name: 'National Wholesale' }]} houseId={null} onApply={onApply} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'What SPACEX BA-2 CORE & SHELL.pdf says' })).toBeTruthy()
    const cards = screen.getAllByTestId('house-file-tag')
    expect(cards).toHaveLength(10)
    const lav2 = cards.find((c) => c.textContent?.startsWith('LAV-2'))!
    expect(within(lav2).getByTestId('house-file-destination').textContent).toBe('→ LAV-2')
    const soap = within(lav2).getAllByTestId('house-file-part').find((r) => r.textContent?.includes('B-8236'))!
    expect(within(soap).getByTestId('house-file-kind').textContent).toBe('the same')
    expect(soap.textContent).toContain('p.53')
    // The Sloan stands beside nothing; put it in the Kohler's place.
    const sloan = within(lav2).getAllByTestId('house-file-part')[0]!
    expect(within(sloan).getByTestId('house-file-kind').textContent).toBe('not priced')
    fireEvent.change(within(sloan).getByRole('combobox'), { target: { value: 'kohler' } })
    expect(within(sloan).getByTestId('house-file-kind').textContent).toBe('in place of')
    // Not in the file: the T25S51E (taken off) and the flange (kept, order only).
    const notIn = within(lav2).getByTestId('house-file-not-in-file')
    expect(notIn.textContent).toContain('TOTO T25S51E#CP')
    expect(notIn.textContent).not.toContain('KOHLER')
    fireEvent.click(within(notIn).getByRole('group', { name: 'TOTO T25S51E#CP: keep or take off' }).querySelector('button')!)
    // MB-1: no row by that tag; the mop sink row by its parts.
    const mb = cards.find((c) => c.textContent?.startsWith('MB-1'))!
    expect(within(mb).getByTestId('house-file-destination').textContent).toBe('→ the row 12" DEEP MOP SINK, by its parts')
    expect((within(mb).getByRole('checkbox', { name: /call it MB-1/ }) as HTMLInputElement).checked).toBe(true)
    // ET-1: no row at all.
    const et = cards.find((c) => c.textContent?.startsWith('ET-1'))!
    expect(within(et).getByTestId('house-file-destination').textContent).toBe('no row yet')
    fireEvent.click(within(et).getByRole('checkbox', { name: /add it as a row/ }))
    fireEvent.change(screen.getByLabelText('The house this file is from'), { target: { value: 'h-nws' } })
    expect(screen.getByTestId('house-file-apply').textContent).toBe('Use the file’s parts on 9 rows')
    fireEvent.click(screen.getByTestId('house-file-apply'))
    const [choices, house] = onApply.mock.calls[0]!
    expect(house).toBe('h-nws')
    const lavChoice = choices[matches.findIndex((m) => m.tag === 'LAV-2')]!
    expect(lavChoice.inPlaceOf[0]).toBe('kohler')
    expect(lavChoice.keep).toMatchObject({ t25: true, flange: true })
    expect(choices[matches.findIndex((m) => m.tag === 'ET-1')]!.addRow).toBe(false)
  })
})
