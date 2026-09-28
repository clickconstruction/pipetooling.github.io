// @vitest-environment jsdom
/**
 * Render smoke for the Mark form (v2.2761 → v2.2813): Email is preselected
 * on a send; switching to "Spoke with them" drops Email, demands a
 * temperature pick and a real sentence, and hands the parent the contacted
 * payload with the pay date. Labels live in gcStatementRounds.test.ts.
 *
 * Given the GC's bills the pay date is a promise: what they said last time
 * sits above the form, a tap picks the date, and the payload names the jobs
 * to file it on — every bill unless unticked, never one already on that date.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import GcStatementMarkSentForm from './GcStatementMarkSentForm'

describe('GcStatementMarkSentForm', () => {
  it('defaults to a send by email and saves the picked channel with a trimmed note', () => {
    const onSave = vi.fn()
    render(<GcStatementMarkSentForm gcName="Southern Post" actorName="Malachi" busy={false} onSave={onSave} onCancel={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Email' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('radio', { name: 'Text' }))
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: '  texted Dave the PDF  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save mark' }))
    expect(onSave).toHaveBeenCalledWith({ action: 'sent', channel: 'text', note: 'texted Dave the PDF', temperature: null, expectedPayBy: null })
  })

  it('a contact needs a temperature and a sentence, then saves the contacted payload', () => {
    const onSave = vi.fn()
    render(<GcStatementMarkSentForm gcName="Knight" actorName="Malachi" busy={false} onSave={onSave} onCancel={() => {}} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Spoke with them · no statement' }))
    expect(screen.queryByRole('radio', { name: 'Email' })).toBeNull()
    expect(screen.getByRole('radio', { name: 'Call' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Save · spoke with them' }))
    expect(screen.getByText('Pick their temperature.')).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('radio', { name: /^Warm/ }))
    fireEvent.change(screen.getByLabelText('Temperature answer'), { target: { value: 'fine' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save · spoke with them' }))
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Temperature answer'), { target: { value: 'Warm — Dave says the check run is the 10th.' } })
    fireEvent.change(screen.getByLabelText('When did they say they’ll pay?'), { target: { value: '2026-09-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save · spoke with them' }))
    expect(onSave).toHaveBeenCalledWith({ action: 'contacted', channel: 'call', note: 'Warm — Dave says the check run is the 10th.', temperature: 'warm', expectedPayBy: '2026-09-10' })
  })

  it('asks whose word it is — the account man by default — and how she heard it', () => {
    const onSave = vi.fn()
    render(
      <GcStatementMarkSentForm
        gcName="Knight"
        actorName="Taunya"
        actorId="u-taunya"
        wordSources={[
          { id: 'u-taunya', name: 'Taunya' },
          { id: 'u-malachi', name: 'Malachi' },
        ]}
        defaultWordSourceId="u-malachi"
        defaultAction="contacted"
        busy={false}
        onSave={onSave}
        onCancel={() => {}}
      />,
    )
    expect((screen.getByLabelText('Whose word is this?') as HTMLSelectElement).value).toBe('u-malachi')
    expect(screen.getByText('How did you hear it from Malachi?')).toBeTruthy()
    // Hearing it from him can be an email; it defaults to a call.
    expect(screen.getByRole('radio', { name: 'Email' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Call' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText(/Stamps Malachi’s word — entered by Taunya/)).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /^Warm/ }))
    fireEvent.change(screen.getByLabelText('Temperature answer'), { target: { value: 'Warm — Malachi says the check run is the 10th.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save · spoke with them' }))
    expect(onSave).toHaveBeenCalledWith({
      action: 'contacted',
      channel: 'call',
      note: 'Warm — Malachi says the check run is the 10th.',
      temperature: 'warm',
      expectedPayBy: null,
      wordFrom: { userId: 'u-malachi', name: 'Malachi' },
      heardVia: 'call',
    })
  })

  it('her own word carries her name and no "heard via"', () => {
    const onSave = vi.fn()
    render(
      <GcStatementMarkSentForm
        gcName="Knight"
        actorName="Taunya"
        actorId="u-taunya"
        wordSources={[
          { id: 'u-taunya', name: 'Taunya' },
          { id: 'u-malachi', name: 'Malachi' },
        ]}
        defaultWordSourceId="u-malachi"
        defaultAction="contacted"
        busy={false}
        onSave={onSave}
        onCancel={() => {}}
      />,
    )
    fireEvent.change(screen.getByLabelText('Whose word is this?'), { target: { value: 'u-taunya' } })
    expect(screen.queryByRole('radio', { name: 'Email' })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: /^Hot/ }))
    fireEvent.change(screen.getByLabelText('Temperature answer'), { target: { value: 'Hot — their AP says the check is cut.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save · spoke with them' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ wordFrom: { userId: 'u-taunya', name: 'Taunya' }, heardVia: null }))
  })

  describe('the pay date as a promise', () => {
    const bills = [
      { jobId: 'j-barton', label: '4412 · 1200 Barton Springs', amount: 11250, promisedYmd: '2026-09-25' },
      { jobId: 'j-rainey', label: '4431 · 88 Rainey St', amount: 8900, promisedYmd: '2026-10-09' },
      { jobId: 'j-fifth', label: '4450 · 310 E 5th', amount: 4349.49, promisedYmd: null },
    ]
    const open = (onSave = vi.fn()) => {
      render(<GcStatementMarkSentForm gcName="Knight" actorName="Taunya" defaultAction="contacted" bills={bills} todayYmd="2026-09-27" busy={false} onSave={onSave} onCancel={() => {}} />)
      return onSave
    }

    it('shows what they said last time and asks for the date when the read is hot', () => {
      open()
      expect(screen.getByTestId('gc-mark-last-promise').textContent).toBe('They said Sep 25 · 2 days late · 1 of 3 bills')
      expect(screen.getByText('optional')).toBeTruthy()
      fireEvent.click(screen.getByRole('radio', { name: /^Hot/ }))
      expect(screen.getByText('Hot means they gave a date')).toBeTruthy()
      expect(screen.queryByTestId('gc-mark-promise-cover')).toBeNull()
    })

    it('a tap picks the date; every bill not already on it is filed', () => {
      const onSave = open()
      fireEvent.click(screen.getByRole('button', { name: 'Still Oct 9' }))
      expect((screen.getByLabelText('When did they say they’ll pay?') as HTMLInputElement).value).toBe('2026-10-09')
      const cover = screen.getByTestId('gc-mark-promise-cover')
      expect(cover.textContent).toContain('Goes on all 3 bills · $24,499.49')
      expect(cover.textContent).toContain('1 bill had a different date — that promise goes on record as broken · 1 already says Oct 9')
      expect(screen.getByText(/Oct 9 shows on the Stages board and in the forecast\./)).toBeTruthy()
      fireEvent.click(screen.getByRole('radio', { name: /^Hot/ }))
      fireEvent.change(screen.getByLabelText('Temperature answer'), { target: { value: 'Hot — Dana says the check run is the 9th.' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save · spoke with them' }))
      expect(onSave).toHaveBeenCalledWith({ action: 'contacted', channel: 'call', note: 'Hot — Dana says the check run is the 9th.', temperature: 'hot', expectedPayBy: '2026-10-09', promiseJobIds: ['j-barton', 'j-fifth'] })
    })

    it('an unticked bill is left alone', () => {
      const onSave = open()
      fireEvent.click(screen.getByRole('button', { name: 'This Fri · Oct 2' }))
      fireEvent.click(screen.getByRole('button', { name: 'Choose bills' }))
      fireEvent.click(screen.getByRole('checkbox', { name: /1200 Barton Springs/ }))
      expect(screen.getByTestId('gc-mark-promise-cover').textContent).toContain('Goes on 2 of 3 bills · $13,249.49')
      fireEvent.click(screen.getByRole('radio', { name: /^Warm/ }))
      fireEvent.change(screen.getByLabelText('Temperature answer'), { target: { value: 'Warm — two of the three go out Friday.' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save · spoke with them' }))
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ expectedPayBy: '2026-10-02', promiseJobIds: ['j-rainey', 'j-fifth'] }))
    })

    it('no date, nothing to file', () => {
      const onSave = open()
      // Next Friday is the date they already gave, so it reads "Still Oct 9" and is offered once.
      expect(screen.queryByRole('button', { name: 'Next Fri · Oct 9' })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'End of Oct' }))
      fireEvent.click(screen.getByRole('button', { name: 'No date' }))
      fireEvent.click(screen.getByRole('radio', { name: /^Cool/ }))
      fireEvent.change(screen.getByLabelText('Temperature answer'), { target: { value: 'Cool — would not name a day.' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save · spoke with them' }))
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ expectedPayBy: null, promiseJobIds: [] }))
    })
  })
})
