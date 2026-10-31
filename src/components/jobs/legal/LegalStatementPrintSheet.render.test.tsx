// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import LegalStatementPrintSheet from './LegalStatementPrintSheet'
import { DECLARANT_BLANK, type StatementDraft } from '../../../lib/legal/affidavitPaper'

const saved = vi.hoisted(() => ({ blobs: [] as Array<[Blob, string]> }))
vi.mock('../../../lib/storageSave', () => ({ saveBlobAs: (b: Blob, n: string) => saved.blobs.push([b, n]) }))
vi.mock('../../../lib/legal/statementPrint', async (orig) => ({ ...(await orig<typeof import('../../../lib/legal/statementPrint')>()), statementPdfBlob: async () => new Blob(['%PDF'], { type: 'application/pdf' }) }))

afterEach(() => { cleanup(); saved.blobs = [] })

const draft: StatementDraft = { title: 'Affidavit of Daniel Alvarez', affiant: { kind: 'team', userId: 'u', name: 'Daniel Alvarez', role: 'RMP' }, incidentOn: '2026-09-03', incidentTo: '', form: 'notary', venueCounty: 'Guadalupe', body: 'Northline never called us back.' }
const declaration: StatementDraft = { ...draft, affiant: { kind: 'witness', userId: null, name: 'Thanh Van Nguyen', role: 'the foreman' }, form: 'declaration', title: 'Declaration of Thanh Nguyen' }

describe('LegalStatementPrintSheet (punch list #220, v2.6211)', () => {
  it('draws the paper in a frame, prints from the frame and notes the print; Save as PDF names the file and notes it too', async () => {
    const onPrinted = vi.fn(async () => {})
    const onFace = vi.fn()
    render(<LegalStatementPrintSheet draft={draft} face="whole" onFace={onFace} accountWords="Northline Builders" declarant={null} onDeclarant={vi.fn()} onPrinted={onPrinted} onBack={vi.fn()} busy={false} />)
    const frame = document.querySelector('[data-legal-print-frame]') as HTMLIFrameElement
    expect(frame.getAttribute('srcdoc')).toContain('SWORN TO AND SUBSCRIBED BEFORE ME')
    const print = vi.fn()
    Object.defineProperty(frame.contentWindow!, 'print', { value: print, configurable: true })
    fireEvent.click(screen.getByRole('button', { name: 'Print' }))
    await waitFor(() => expect(onPrinted).toHaveBeenCalledWith('whole'))
    expect(print).toHaveBeenCalledTimes(1)
    fireEvent.click(document.querySelector('[data-legal-print-face="signing"]')!)
    expect(onFace).toHaveBeenCalledWith('signing')
    fireEvent.click(screen.getByRole('button', { name: 'Save as PDF' }))
    await waitFor(() => expect(saved.blobs).toHaveLength(1))
    expect(saved.blobs[0]![1]).toBe('affidavit-of-daniel-alvarez.pdf')
    expect(onPrinted).toHaveBeenCalledTimes(2)
  })
  it('a declaration asks for the declarant first, keeps them for the session, and offers the statement alone instead', () => {
    const onDeclarant = vi.fn()
    const onFace = vi.fn()
    render(<LegalStatementPrintSheet draft={declaration} face="whole" onFace={onFace} accountWords="" declarant={null} onDeclarant={onDeclarant} onPrinted={vi.fn(async () => {})} onBack={vi.fn()} busy={false} />)
    expect(document.querySelector('[data-legal-print-frame]')).toBeNull()
    const form = document.querySelector('[data-legal-declarant-form]')!
    expect(form.textContent).toContain('never saved to the record')
    // The first and last names are guessed from the affiant's name.
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('Thanh')
    expect((screen.getByLabelText('Last name') as HTMLInputElement).value).toBe('Nguyen')
    const put = screen.getByRole('button', { name: 'Put them on the paper' }) as HTMLButtonElement
    expect(put.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Middle name'), { target: { value: 'Van' } })
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1988-03-14' } })
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: '1400 Example Rd' } })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Round Rock' } })
    fireEvent.change(screen.getByLabelText('Zip code'), { target: { value: '78664' } })
    expect(put.disabled).toBe(false)
    fireEvent.click(put)
    expect(onDeclarant).toHaveBeenCalledWith({ ...DECLARANT_BLANK, firstName: 'Thanh', middleName: 'Van', lastName: 'Nguyen', dateOfBirth: '1988-03-14', street: '1400 Example Rd', city: 'Round Rock', zip: '78664' })
    cleanup()
    render(<LegalStatementPrintSheet draft={declaration} face="whole" onFace={onFace} accountWords="" declarant={null} onDeclarant={onDeclarant} onPrinted={vi.fn(async () => {})} onBack={vi.fn()} busy={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Print the statement alone instead' }))
    expect(onFace).toHaveBeenCalledWith('statement')
  })
  it('with the declarant held, the whole declaration draws with the details on the paper', () => {
    const details = { ...DECLARANT_BLANK, firstName: 'Thanh', middleName: 'Van', lastName: 'Nguyen', dateOfBirth: '1988-03-14', street: '1400 Example Rd', city: 'Round Rock', zip: '78664' }
    render(<LegalStatementPrintSheet draft={declaration} face="whole" onFace={vi.fn()} accountWords="" declarant={details} onDeclarant={vi.fn()} onPrinted={vi.fn(async () => {})} onBack={vi.fn()} busy={false} />)
    const frame = document.querySelector('[data-legal-print-frame]') as HTMLIFrameElement
    expect(frame.getAttribute('srcdoc')).toContain('My name is Thanh Van Nguyen, my date of birth is March 14, 1988, and my address is 1400 Example Rd, Round Rock, Texas 78664, and United States of America.')
  })
})
