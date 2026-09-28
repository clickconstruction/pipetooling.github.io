// @vitest-environment jsdom
/**
 * Render smoke for the call sheet: the account man is the source by default,
 * only the rows that were answered are saved, and a half-filled row is held
 * back with the reason.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import GcCallSheetModal from './GcCallSheetModal'
import type { CallSheet } from '../../lib/jobs/gcCallSheet'

const sheet: CallSheet = {
  ownerUserId: 'u-malachi',
  total: 56000,
  rows: [
    { gcId: 'knight', gcName: 'Knight Contracting', amount: 26000, oldestAgeDays: 41, lastWord: { temperature: 'warm', note: 'Check run is the 20th.', by: 'Malachi', at: '2026-09-18T15:00:00Z' }, promise: { payBy: '2026-09-20', late: true, daysLate: 7 }, wordIn: false, noChangeAllowed: true },
    { gcId: 'loberg', gcName: 'Loberg Contracting', amount: 30000, oldestAgeDays: 19, lastWord: null, promise: null, wordIn: false, noChangeAllowed: false },
  ],
}

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
    expect(rowFor('Knight Contracting').getByText('promised Sep 20 — 7 days late')).toBeTruthy()
    expect(rowFor('Loberg Contracting').getByText('No word yet')).toBeTruthy()
    expect((screen.getByLabelText('Whose word') as HTMLSelectElement).value).toBe('u-malachi')
    expect(screen.getByText(/Stamps Malachi’s word — entered by Taunya/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save answers' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('saves only the answered rows, as his word heard by phone', () => {
    const onSave = renderSheet()
    const knight = rowFor('Knight Contracting')
    fireEvent.click(knight.getByRole('radio', { name: 'Cool' }))
    fireEvent.change(knight.getByLabelText('What was said about Knight Contracting'), { target: { value: 'Missed the 20th, now says the 10th.' } })
    fireEvent.change(knight.getByLabelText('Knight Contracting expects to pay by'), { target: { value: '2026-10-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 answer' }))
    expect(onSave).toHaveBeenCalledWith([{ gcId: 'knight', channel: 'call', note: 'Missed the 20th, now says the 10th.', temperature: 'cool', expectedPayBy: '2026-10-10' }], {
      wordFrom: { userId: 'u-malachi', name: 'Malachi' },
      heardVia: 'call',
    })
  })

  it('holds back a row with a read and no sentence', () => {
    const onSave = renderSheet()
    fireEvent.click(rowFor('Loberg Contracting').getByRole('radio', { name: 'Warm' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 answer' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(rowFor('Loberg Contracting').getByText('A sentence, not a word.')).toBeTruthy()
  })

  it('offers "no change" only where there is a word to repeat', () => {
    const onSave = renderSheet()
    expect(rowFor('Loberg Contracting').queryByLabelText('no change')).toBeNull()
    fireEvent.click(rowFor('Knight Contracting').getByLabelText('no change'))
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 answer' }))
    expect(onSave.mock.calls[0]![0]).toEqual([{ gcId: 'knight', channel: 'call', note: 'No change since Sep 18: “Check run is the 20th.”', temperature: 'warm', expectedPayBy: '2026-09-20' }])
  })

  it('opens on his answers from the link, for her to read, change and save', () => {
    const onSave = renderSheet({ knight: { temperature: 'cool', note: 'Missed the 20th, now says the 10th.', payBy: '2026-10-10', noChange: false } })
    expect(screen.getByText(/Malachi answered these on his link/)).toBeTruthy()
    expect((rowFor('Knight Contracting').getByLabelText('What was said about Knight Contracting') as HTMLInputElement).value).toBe('Missed the 20th, now says the 10th.')
    expect(screen.getByRole('radio', { name: 'His link' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.change(rowFor('Knight Contracting').getByLabelText('What was said about Knight Contracting'), { target: { value: 'Missed the 20th; says the 10th, check by mail.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 answer' }))
    // The mark's own channel has no "link": it is filed under other, and heard via the link.
    expect(onSave).toHaveBeenCalledWith([{ gcId: 'knight', channel: 'other', note: 'Missed the 20th; says the 10th, check by mail.', temperature: 'cool', expectedPayBy: '2026-10-10' }], {
      wordFrom: { userId: 'u-malachi', name: 'Malachi' },
      heardVia: 'link',
    })
  })
})
