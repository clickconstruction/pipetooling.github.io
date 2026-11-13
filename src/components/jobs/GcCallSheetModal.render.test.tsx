// @vitest-environment jsdom
/**
 * Render smoke for the call sheet: the account man is the source by default,
 * only the rows that were answered are saved, and a half-filled row is held
 * back with the reason.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import GcCallSheetModal from './GcCallSheetModal'
import type { CallSheet, CallSheetBill } from '../../lib/jobs/gcCallSheet'

vi.mock('../../lib/fetchJobActivityEventsForJobLedger', () => ({ fetchJobActivityEventsForJobLedger: vi.fn(async () => ({ data: [], error: null })) }))

const bill = (key: string, remaining: number, ageDays: number, over: Partial<CallSheetBill> = {}): CallSheetBill => ({ key, jobId: `job-${key}`, hcp: key, jobName: 'Relwyn Health', jobAddress: '', customerName: 'Cust', referenceDateDisplay: 'Jul 6, 2026', ageDays, remaining, inCollections: false, promisedYmd: null, ...over })

const sheet: CallSheet = {
  ownerUserId: 'u-malachi',
  total: 56000,
  rows: [
    { gcId: 'kestrin', gcName: 'Kestrin Contracting', amount: 26000, oldestAgeDays: 41, lastWord: { temperature: 'warm', note: 'Check run is the 20th.', by: 'Malachi', at: '2026-09-18T15:00:00Z' }, promise: { payBy: '2026-09-20', late: true, daysLate: 7 }, wordIn: false, noChangeAllowed: true, bills: [bill('813', 4421.26, 95, { promisedYmd: '2026-09-15' }), bill('898', 21578.74, 84)], collections: [bill('412', 1712.5, 200, { inCollections: true })] },
    { gcId: 'lowbeck', gcName: 'Lowbeck Contracting', amount: 30000, oldestAgeDays: 19, lastWord: null, promise: null, wordIn: false, noChangeAllowed: false },
  ],
}

const onOpenJobDetail = vi.fn()

function renderSheet(initialDrafts?: Record<string, { temperature: 'hot' | 'warm' | 'cool' | 'cold' | null; note: string; payBy: string; noChange: boolean }>) {
  const onSave = vi.fn()
  render(
    <GcCallSheetModal
      sheet={sheet}
      ownerName="Malachi"
      actorId="u-taunya"
      actorName="Taunya"
      wordSources={[
        { id: 'u-taunya', name: 'Taunya' },
        { id: 'u-malachi', name: 'Malachi' },
      ]}
      initialDrafts={initialDrafts}
      todayYmd="2026-09-28"
      onOpenJobDetail={onOpenJobDetail}
      busy={false}
      error={null}
      onSave={onSave}
      onPrint={() => {}}
      onClose={() => {}}
    />,
  )
  return onSave
}

const rowFor = (name: string) => within(screen.getAllByTestId('gc-call-sheet-row').find((el) => within(el).queryByText(name))!)

describe('GcCallSheetModal', () => {
  it('shows the broken promise and the last word, and takes the account man as the source', () => {
    renderSheet()
    expect(screen.getByRole('dialog', { name: 'Call sheet — Malachi' })).toBeTruthy()
    expect(rowFor('Kestrin Contracting').getByText('promised Sep 20 — 7 days late')).toBeTruthy()
    expect(rowFor('Lowbeck Contracting').getByText('No word yet')).toBeTruthy()
    expect((screen.getByLabelText('Whose word') as HTMLSelectElement).value).toBe('u-malachi')
    expect(screen.getByText(/Stamps Malachi’s word — entered by Taunya/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save answers' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('saves only the answered rows, as his word heard by phone', () => {
    const onSave = renderSheet()
    const kestrin = rowFor('Kestrin Contracting')
    fireEvent.click(kestrin.getByRole('radio', { name: 'Cool' }))
    fireEvent.change(kestrin.getByLabelText('What was said about Kestrin Contracting'), { target: { value: 'Missed the 20th, now says the 10th.' } })
    fireEvent.change(kestrin.getByLabelText('Kestrin Contracting expects to pay by'), { target: { value: '2026-10-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 answer' }))
    expect(onSave).toHaveBeenCalledWith([{ gcId: 'kestrin', channel: 'call', note: 'Missed the 20th, now says the 10th.', temperature: 'cool', expectedPayBy: '2026-10-10' }], {
      wordFrom: { userId: 'u-malachi', name: 'Malachi' },
      heardVia: 'call',
    })
  })

  it('holds back a row with a read and no sentence', () => {
    const onSave = renderSheet()
    fireEvent.click(rowFor('Lowbeck Contracting').getByRole('radio', { name: 'Warm' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 answer' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(rowFor('Lowbeck Contracting').getByText('A sentence, not a word.')).toBeTruthy()
  })

  it('offers "no change" only where there is a word to repeat', () => {
    const onSave = renderSheet()
    expect(rowFor('Lowbeck Contracting').queryByLabelText('no change')).toBeNull()
    fireEvent.click(rowFor('Kestrin Contracting').getByLabelText('no change'))
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 answer' }))
    expect(onSave.mock.calls[0]![0]).toEqual([{ gcId: 'kestrin', channel: 'call', note: 'No change since Sep 18: “Check run is the 20th.”', temperature: 'warm', expectedPayBy: '2026-09-20' }])
  })

  it('opens on his answers from the link, for her to read, change and save', () => {
    const onSave = renderSheet({ kestrin: { temperature: 'cool', note: 'Missed the 20th, now says the 10th.', payBy: '2026-10-10', noChange: false } })
    expect(screen.getByText(/Malachi answered these on his link/)).toBeTruthy()
    expect((rowFor('Kestrin Contracting').getByLabelText('What was said about Kestrin Contracting') as HTMLInputElement).value).toBe('Missed the 20th, now says the 10th.')
    expect(screen.getByRole('radio', { name: 'His link' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.change(rowFor('Kestrin Contracting').getByLabelText('What was said about Kestrin Contracting'), { target: { value: 'Missed the 20th; says the 10th, check by mail.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 answer' }))
    // The mark's own channel has no "link": it is filed under other, and heard via the link.
    expect(onSave).toHaveBeenCalledWith([{ gcId: 'kestrin', channel: 'other', note: 'Missed the 20th; says the 10th, check by mail.', temperature: 'cool', expectedPayBy: '2026-10-10' }], {
      wordFrom: { userId: 'u-malachi', name: 'Malachi' },
      heardVia: 'link',
    })
  })

  it('a total opens onto the bills behind it, and they come to the total', () => {
    renderSheet()
    const kestrin = rowFor('Kestrin Contracting')
    expect(screen.queryAllByTestId('gc-bill-line')).toHaveLength(0)
    fireEvent.click(kestrin.getByRole('button', { name: 'Show Kestrin Contracting’s bills' }))
    expect(kestrin.getByRole('button', { name: 'Hide Kestrin Contracting’s bills' }).textContent).toContain('2 bills · 1 over 90 days, $4,421.26 · 1 more in Collections')
    expect(kestrin.getAllByTestId('gc-bill-line')).toHaveLength(3)
    expect(kestrin.getByText('2 bills — what Kestrin Contracting owes').nextElementSibling?.textContent).toBe('$26,000.00')
    expect(kestrin.getByText(/said Sep 15 · late/)).toBeTruthy()
    // The Collections bill is listed apart, and said to be outside the total.
    expect(kestrin.getByText(/owed too, and not in the \$26,000\.00 above: \$1,712\.50/)).toBeTruthy()
    fireEvent.click(kestrin.getByRole('button', { name: 'Hide Kestrin Contracting’s bills' }))
    expect(screen.queryAllByTestId('gc-bill-line')).toHaveLength(0)
  })

  it('a bill opens its job, and what was typed stays on the sheet', () => {
    renderSheet()
    const kestrin = rowFor('Kestrin Contracting')
    fireEvent.click(kestrin.getByRole('radio', { name: 'Cool' }))
    fireEvent.change(kestrin.getByLabelText('What was said about Kestrin Contracting'), { target: { value: 'Missed the 15th, now says the 10th.' } })
    fireEvent.click(kestrin.getByRole('button', { name: 'Show Kestrin Contracting’s bills' }))
    fireEvent.click(kestrin.getByRole('button', { name: '813 · Relwyn Health' }))
    expect(onOpenJobDetail).toHaveBeenCalledWith('job-813')
    expect((kestrin.getByLabelText('What was said about Kestrin Contracting') as HTMLInputElement).value).toBe('Missed the 15th, now says the 10th.')
    expect(screen.getByRole('button', { name: 'Save 1 answer' })).toBeTruthy()
  })

  it('Show all bills opens every GC that has any; a GC with none has nothing to open', () => {
    renderSheet()
    expect(rowFor('Lowbeck Contracting').queryByRole('button', { name: /bills$/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show all bills' }))
    expect(screen.getAllByTestId('gc-call-sheet-bills')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Hide all bills' }))
    expect(screen.queryAllByTestId('gc-call-sheet-bills')).toHaveLength(0)
  })
})
