// @vitest-environment jsdom
/**
 * Punch list #174, PR 2: the proceedings beside the claim. The list draws the kind, the agency, where it stands and
 * the second line with the contact, the documents and the keep-out words; the form refuses an unnamed proceeding
 * client side and sends the ticked documents and the hold; the firm's table draws the contact's role in words, a
 * travelling document as a link and the kept-out line, and nothing when the matter has none.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import LegalProceedingsTable from './LegalProceedingsTable'
import { FirmProceedingsTable } from './LegalFirmMatterView'
import { peopleFromRows } from '../../../lib/legal/legalMatterPeople'
import { proceedingsFromRows } from '../../../lib/legal/legalProceedings'

const people = peopleFromRows([
  { id: 'p1', name: 'R. Calloway', role: 'president', organization: 'Sable Ridge Builders', email: 'rcalloway@srb-partners.example', phone: '', mailing_address: '', use: 'letters', reason: '', seeded_from: null, added_at: '2026-10-20T15:00:00Z' },
])
const documents = [{ id: 'd1', title: 'Board complaint — filed copy.pdf' }, { id: 'd2', title: 'Site photos.pdf' }]
const proceedings = proceedingsFromRows([
  { id: 'pr1', kind: 'agency_complaint', title: 'Complaint to the State Plumbing Board', agency: 'State Plumbing Board', reference: 'C-2026-0431', person_id: 'p1', status: 'open', status_on: null, note: 'the inspector took the call', document_ids: ['d1'], keep_out: true, added_at: '2026-10-28T15:00:00Z' },
  { id: 'pr2', kind: 'records_request', title: 'Permit file from the city', agency: 'City of Brenham', reference: '', person_id: null, status: 'answered', status_on: '2026-11-03', note: '', document_ids: [], keep_out: false, added_at: '2026-10-29T15:00:00Z' },
])

describe('LegalProceedingsTable', () => {
  it('draws each proceeding with its kind, agency, status and the second line, read only without acts', () => {
    render(<LegalProceedingsTable proceedings={proceedings} panel={{ people, documents, acts: null }} />)
    const list = document.querySelector('[data-legal-proceedings]') as HTMLElement
    expect(within(list).getAllByRole('row')).toHaveLength(3)
    const first = list.querySelector('[data-legal-proceeding="pr1"]') as HTMLElement
    expect(first.getAttribute('data-legal-proceeding-kept-out')).toBe('yes')
    expect(first.textContent).toContain('Agency complaint')
    expect(first.textContent).toContain('State Plumbing Board')
    expect(first.querySelector('[data-legal-proceeding-detail]')?.textContent).toBe('ref C-2026-0431 · contact: R. Calloway · 1 document · kept out of settlement letters')
    expect(first.textContent).toContain('Board complaint — filed copy.pdf')
    const second = list.querySelector('[data-legal-proceeding="pr2"]') as HTMLElement
    expect(second.textContent).toContain('answered 2026-11-03')
    expect(second.getAttribute('data-legal-proceeding-kept-out')).toBe('no')
    expect(within(list).queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(list.querySelector('[data-legal-proceedings-add]')).toBeNull()
  })

  it('refuses an unnamed proceeding before the RPC, then sends the ticked documents and the hold', async () => {
    const save = vi.fn(() => Promise.resolve(null))
    render(<LegalProceedingsTable proceedings={[]} panel={{ people, documents, acts: { save, remove: vi.fn(() => Promise.resolve(null)) } }} />)
    expect(document.querySelector('[data-legal-proceedings-empty]')?.textContent).toContain('Nothing runs beside the claim yet')
    fireEvent.click(screen.getByRole('button', { name: '＋ Add a proceeding' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save the proceeding' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Name the proceeding.')
    expect(save).not.toHaveBeenCalled()
    fireEvent.change(document.querySelector('[data-legal-proceeding-title]') as HTMLInputElement, { target: { value: 'Complaint to the State Plumbing Board' } })
    fireEvent.change(document.querySelector('[data-legal-proceeding-person]') as HTMLSelectElement, { target: { value: 'p1' } })
    fireEvent.click(document.querySelector('[data-legal-proceeding-document="d1"]') as HTMLInputElement)
    fireEvent.click(screen.getByRole('button', { name: 'Save the proceeding' }))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'agency_complaint', title: 'Complaint to the State Plumbing Board', personId: 'p1', documentIds: ['d1'], keepOut: true }), null)
  })

  it('removes behind a confirm whose button names the act', async () => {
    const remove = vi.fn(() => Promise.resolve(null))
    render(<LegalProceedingsTable proceedings={proceedings} panel={{ people, documents, acts: { save: vi.fn(() => Promise.resolve(null)), remove } }} />)
    fireEvent.click(within(document.querySelector('[data-legal-proceeding="pr1"]') as HTMLElement).getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove the proceeding…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Remove it' }))
    expect(remove).toHaveBeenCalledWith('pr1')
  })
})

describe('FirmProceedingsTable', () => {
  it('draws the contact’s role in words, a travelling document as a link, the kept-out line, and nothing when there are none', () => {
    const forFirm = [
      { id: 'pr1', kind: 'agency_complaint' as const, title: 'Complaint to the State Plumbing Board', agency: 'State Plumbing Board', reference: 'C-2026-0431', contactName: 'R. Calloway', contactRole: 'president', status: 'open' as const, statusOn: null, documentIds: ['d1', 'd-held'], keepOut: true },
    ]
    render(<FirmProceedingsTable proceedings={forFirm} documents={[{ id: 'd1', title: 'Board complaint — filed copy.pdf', shows: 'the filed copy', mime: 'application/pdf', sizeBytes: 100, addedOn: '2026-10-28', addedByName: 'Taunya', url: 'https://signed.example/d1', datedOn: '', state: 'final', sentOn: '', sentHow: '', sentTo: '', proofDocumentId: '', receivedOn: '' }]} />)
    const table = document.querySelector('[data-legal-firm-proceedings]') as HTMLElement
    expect(table.textContent).toContain('R. Calloway · their president')
    expect(table.textContent).toContain('State Plumbing Board · ref C-2026-0431')
    expect(within(table).getByRole('link', { name: 'Board complaint — filed copy.pdf ↗' }).getAttribute('href')).toBe('https://signed.example/d1')
    expect(table.textContent).toContain('a document the office holds')
    expect(table.querySelector('[data-legal-firm-proceeding-kept-out]')?.textContent).toBe('kept out of settlement letters')
    expect(table.textContent).not.toContain('inspector')
    document.body.innerHTML = ''
    render(<FirmProceedingsTable proceedings={[]} documents={[]} />)
    expect(document.querySelector('[data-legal-firm-proceedings]')).toBeNull()
  })
})
