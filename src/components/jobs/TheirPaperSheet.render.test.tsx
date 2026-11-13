// @vitest-environment jsdom
/**
 * Render smoke for Their paper (punch list #173, v2.6698): the sheet asks who signed for us before
 * it records, a relied-on tick asks for the day and the what, the terms are typed with their
 * clauses, and the save sends the draft as one record for the job.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import TheirPaperSheet from './TheirPaperSheet'
import { theirPaperFromRow, type TheirPaperDraft } from '../../lib/jobs/theirPaper'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }) }))
const openPayCalendar = vi.fn()
vi.mock('../../contexts/PayCalendarModalContext', () => ({ usePayCalendarModal: () => ({ openPayCalendar, closePayCalendar: () => undefined }) }))
const saveSpy = vi.fn((_input: { jobId: string; existingId: string | null; draft: TheirPaperDraft }) => Promise.resolve({ row: { id: 'c-new' }, uploadError: null }))
vi.mock('../../lib/jobs/theirPaperIo', () => ({ saveTheirPaper: (input: { jobId: string; existingId: string | null; draft: TheirPaperDraft }) => saveSpy(input) }))

describe('TheirPaperSheet', () => {
  it('records their paper: the signer first, the relied-on flag with its day and what, the terms with their clauses', async () => {
    const onDone = vi.fn()
    renderWithProviders(<TheirPaperSheet open onClose={() => undefined} onDone={onDone} job={{ id: 'j891', num: '891', partyName: 'Harrow Builders' }} existing={null} />)
    const submit = screen.getByTestId('their-paper-submit') as HTMLButtonElement
    expect(submit.textContent).toBe('Record their paper')
    expect(submit.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('What the paper is'), { target: { value: 'Harrow Builders subcontract, their form' } })
    fireEvent.change(screen.getByLabelText('Who signed for us'), { target: { value: 'D. Vasquez, RMP' } })
    expect(submit.disabled).toBe(false)
    expect(screen.getByTestId('their-paper-countersign-words').textContent).toBe('Blank means not countersigned.')
    fireEvent.click(screen.getByTestId('their-paper-relied'))
    expect(submit.disabled).toBe(true)
    expect(screen.getByTestId('their-paper-problem').textContent).toMatch(/what they relied on it for/)
    fireEvent.change(screen.getByLabelText('What they relied on it for'), { target: { value: 'their notice of termination' } })
    fireEvent.change(screen.getByLabelText('On'), { target: { value: '2026-10-02' } })
    fireEvent.blur(screen.getByLabelText('On'))
    await waitFor(() => expect(submit.disabled).toBe(false))
    fireEvent.change(screen.getByLabelText('Termination clause'), { target: { value: '§14.2' } })
    fireEvent.change(screen.getByLabelText('Termination'), { target: { value: 'for convenience, 48-hour notice' } })
    fireEvent.change(screen.getByLabelText('Venue'), { target: { value: 'Brazos County, TX' } })
    fireEvent.click(submit)
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1))
    const sent = saveSpy.mock.calls[0]![0]
    expect(sent.jobId).toBe('j891')
    expect(sent.existingId).toBeNull()
    expect(sent.draft.ourSigner).toBe('D. Vasquez, RMP')
    expect(sent.draft.reliedOn).toBe(true)
    expect(sent.draft.reliedOnOn).toBe('2026-10-02')
    expect(sent.draft.reliedOnWhat).toBe('their notice of termination')
    expect(sent.draft.terms.termination).toEqual({ clause: '§14.2', words: 'for convenience, 48-hour notice' })
    expect(sent.draft.terms.venue).toEqual({ clause: '', words: 'Brazos County, TX' })
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('opens an existing record into the form and saves it as that record', async () => {
    const existing = theirPaperFromRow({ id: 'c-their', job_id: 'j891', status: 'signed', kind: 'their_paper', voided_at: null, paper_title: 'Harrow subcontract', our_signer_name: 'D. Vasquez', our_signed_on: '2026-02-09', their_signed_on: '2026-02-12', key_terms: [{ key: 'venue', clause: '§19', words: 'Brazos County' }] })
    renderWithProviders(<TheirPaperSheet open onClose={() => undefined} job={{ id: 'j891', num: '891', partyName: 'Harrow Builders' }} existing={existing} />)
    expect(screen.getByRole('heading', { name: 'Their paper · the record' })).toBeTruthy()
    expect((screen.getByLabelText('Who signed for us') as HTMLInputElement).value).toBe('D. Vasquez')
    expect((screen.getByLabelText('Venue clause') as HTMLInputElement).value).toBe('§19')
    expect(screen.getByTestId('their-paper-countersign-words').textContent).toMatch(/Signed by both sides/)
    const submit = screen.getByTestId('their-paper-submit') as HTMLButtonElement
    expect(submit.textContent).toBe('Save the record')
    fireEvent.click(submit)
    await waitFor(() => expect(saveSpy).toHaveBeenLastCalledWith(expect.objectContaining({ existingId: 'c-their' })))
  })

  it('offers the payer’s pay calendar, carrying the paper’s clause, and offers nothing with no payer (punch list #323)', () => {
    const { unmount } = renderWithProviders(<TheirPaperSheet open onClose={() => undefined} job={{ id: 'j891', num: '891', partyName: 'Harrow Builders' }} existing={null} />)
    expect(screen.getByLabelText('Pay calendar clause')).toBeTruthy()
    expect(screen.queryByTestId('their-paper-pay-calendar')).toBeNull()
    unmount()
    renderWithProviders(<TheirPaperSheet open onClose={() => undefined} job={{ id: 'j891', num: '891', partyName: 'Harrow Builders' }} payer={{ id: 'gc-1', name: 'Harrow Builders' }} existing={null} overlayZIndex={1400} />)
    fireEvent.change(screen.getByLabelText('Pay calendar clause'), { target: { value: '§ 5.2' } })
    fireEvent.change(screen.getByLabelText('Pay calendar'), { target: { value: 'in by the 25th, paid the 30th of the next month' } })
    const press = screen.getByTestId('their-paper-pay-calendar')
    expect(press.textContent).toBe('Set Harrow Builders’s pay calendar…')
    fireEvent.click(press)
    expect(openPayCalendar).toHaveBeenCalledWith(
      { id: 'gc-1', name: 'Harrow Builders' },
      { job: { id: 'j891', label: 'Job 891' }, initial: { clause: '§ 5.2', words: 'in by the 25th, paid the 30th of the next month' }, zIndex: 1410 },
    )
  })
})
