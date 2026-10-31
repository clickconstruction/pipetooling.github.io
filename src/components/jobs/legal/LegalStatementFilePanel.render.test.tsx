// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import LegalStatementFilePanel from './LegalStatementFilePanel'
import { statementMetaOf, type StatementDraft, type StatementFilingDraft } from '../../../lib/legal/affidavitPaper'

afterEach(cleanup)

const TODAY = '2026-10-31'
const draft: StatementDraft = { title: 'Affidavit of Daniel Alvarez', affiant: { kind: 'team', userId: 'u', name: 'Daniel Alvarez', role: 'RMP' }, incidentOn: '2026-09-03', incidentTo: '2026-09-17', form: 'notary', venueCounty: 'Guadalupe', body: 'x' }
const meta = statementMetaOf({ title: draft.title, affiant: { kind: 'team', name: 'Daniel Alvarez' }, form: 'notary', venue_county: 'Guadalupe', incident_to: '2026-09-17', state: 'printed', prints: [{ at: '2026-10-28T19:14:00Z', by: 'u', face: 'whole', text: '' }] })

describe('LegalStatementFilePanel (punch list #220, v2.6212)', () => {
  it('asks for the scan and the two days, names the last print, prefills the shows line from the signing day, and files', async () => {
    const onFile = vi.fn(async (_file: File, _filing: StatementFilingDraft): Promise<boolean> => true)
    const onBack = vi.fn()
    render(<LegalStatementFilePanel draft={draft} meta={meta} payerName="Northline Builders" todayYmd={TODAY} busy={false} onFile={onFile} onBack={onBack} />)
    const press = document.querySelector('[data-legal-statement-file-press]') as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.title).toBe('Choose the signed scan.')
    expect(screen.getByText(/Is the signed paper the text as last printed, Oct 28 at \d{1,2}:\d{2} [AP]M\?/)).toBeTruthy()
    expect((screen.getByLabelText('The day it is about, confirmed') as HTMLInputElement).value).toBe('2026-09-03')
    expect((screen.getByLabelText('Shows, one line') as HTMLInputElement).value).toBe('Sworn before a notary in Guadalupe County. What was seen or heard on Sep 3 to Sep 17.')
    const file = new File(['%PDF-1.4'], 'Affidavit - signed.pdf', { type: 'application/pdf' })
    fireEvent.drop(document.querySelector('[data-legal-statement-drop]')!, { dataTransfer: { files: [file] } })
    expect(document.querySelector('[data-legal-statement-file-name]')!.textContent).toContain('Affidavit - signed.pdf')
    expect(press.title).toBe('Type the day it was signed, off the jurat.')
    fireEvent.change(screen.getByLabelText('The day it was signed'), { target: { value: '2026-10-29' } })
    expect((screen.getByLabelText('Shows, one line') as HTMLInputElement).value).toBe('Sworn Oct 29 before a notary in Guadalupe County. What was seen or heard on Sep 3 to Sep 17.')
    expect(press.disabled).toBe(false)
    fireEvent.click(document.querySelector('[data-legal-statement-as-printed="no"]')!)
    fireEvent.change(screen.getByLabelText('Whose paper'), { target: { value: 'supplier' } })
    fireEvent.click(press)
    await waitFor(() => expect(onFile).toHaveBeenCalledTimes(1))
    expect(onFile.mock.calls[0]![0]).toBe(file)
    expect(onFile.mock.calls[0]![1]).toEqual({ signedOn: '2026-10-29', asPrinted: false, incidentOn: '2026-09-03', incidentTo: '2026-09-17', whose: 'supplier', shows: 'Sworn Oct 29 before a notary in Guadalupe County. What was seen or heard on Sep 3 to Sep 17.' })
    await waitFor(() => expect(onBack).toHaveBeenCalled())
  })
  it('a kind the portal does not take is refused with its reason; with no print the question asks about the text as saved', () => {
    render(<LegalStatementFilePanel draft={draft} meta={statementMetaOf({ ...(meta as object), prints: [] })} payerName="" todayYmd={TODAY} busy={false} onFile={vi.fn(async () => true)} onBack={vi.fn()} />)
    expect(screen.getByText('Is the signed paper the text as saved here?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Yes, as saved' })).toBeTruthy()
    fireEvent.drop(document.querySelector('[data-legal-statement-drop]')!, { dataTransfer: { files: [new File(['x'], 'clip.mp4', { type: 'video/mp4' })] } })
    expect(screen.getByRole('alert').textContent).toContain('clip.mp4 is not a kind the portal takes')
    expect((document.querySelector('[data-legal-statement-file-press]') as HTMLButtonElement).disabled).toBe(true)
  })
})
