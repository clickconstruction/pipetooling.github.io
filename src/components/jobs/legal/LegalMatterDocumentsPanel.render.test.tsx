// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import LegalMatterDocumentsPanel from './LegalMatterDocumentsPanel'
import type { LegalMatterDocumentRow } from '../../../lib/legal/legalMatterDocumentsIo'

const io = vi.hoisted(() => ({ add: vi.fn(), update: vi.fn(), retire: vi.fn(), link: vi.fn() }))
vi.mock('../../../lib/legal/legalMatterDocumentsIo', () => ({
  addLegalMatterDocument: (...a: unknown[]) => io.add(...a),
  updateLegalMatterDocument: (...a: unknown[]) => io.update(...a),
  retireLegalMatterDocument: (...a: unknown[]) => io.retire(...a),
  legalMatterDocumentLink: (...a: unknown[]) => io.link(...a),
  // v2.5846: the send and receipt records go through the same spy as a change.
  markLegalMatterDocumentSent: (...a: unknown[]) => io.update(...a),
  markLegalMatterDocumentReceived: (...a: unknown[]) => io.update(...a),
  setLegalMatterDocumentState: (...a: unknown[]) => io.update(...a),
  setLegalMatterDocumentDatedOn: (...a: unknown[]) => io.update(...a),
}))
vi.mock('../../../lib/supabase', () => ({ supabase: {} }))

const row = (id: string, title: string, held = ''): LegalMatterDocumentRow => ({ id, matter_id: 'm-1', title, shows: `What ${title} shows.`, storage_path: `m-1/${id}-x.pdf`, mime: 'application/pdf', size_bytes: 64075, original_name: 'x.pdf', added_by: 'u-1', added_at: '2026-10-07T15:00:00Z', held_reason: held, voided_at: null })

afterEach(() => {
  cleanup()
  for (const f of Object.values(io)) f.mockReset()
})

describe('LegalMatterDocumentsPanel (v2.4810)', () => {
  it('a dropped file needs a title and one line on what it shows before it saves; Save stores it on the matter', async () => {
    io.add.mockResolvedValue('d-new')
    const onChanged = vi.fn()
    render(<LegalMatterDocumentsPanel matterId="m-1" documents={[]} canEdit onChanged={onChanged} />)
    expect(screen.getByText(/Nothing yet/)).toBeTruthy()
    const file = new File(['%PDF-1.4'], 'Billing_report.pdf', { type: 'application/pdf' })
    fireEvent.drop(document.querySelector('[data-legal-documents-drop]')!, { dataTransfer: { files: [file] } })
    const title = screen.getByLabelText('Title') as HTMLInputElement
    expect(title.value).toBe('Billing report')
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    expect(document.querySelector('[data-legal-document-pending]')!.textContent).toContain('Say in one line what it shows.')
    fireEvent.change(screen.getByLabelText('What it shows'), { target: { value: 'The itemization of both bills.' } })
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(io.add).toHaveBeenCalledTimes(1))
    expect(io.add.mock.calls[0]!.slice(1, 3)).toEqual(['m-1', { title: 'Billing report', shows: 'The itemization of both bills.', datedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), state: 'final', receivedOn: '' }])
    expect(io.add.mock.calls[0]).toHaveLength(4)
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(document.querySelector('[data-legal-document-pending]')).toBeNull()
  })

  it('a kind the portal does not take is refused with its reason', () => {
    render(<LegalMatterDocumentsPanel matterId="m-1" documents={[]} canEdit onChanged={() => {}} />)
    fireEvent.drop(document.querySelector('[data-legal-documents-drop]')!, { dataTransfer: { files: [new File(['x'], 'clip.mp4', { type: 'video/mp4' })] } })
    fireEvent.change(screen.getByLabelText('What it shows'), { target: { value: 'A video.' } })
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    expect(document.querySelector('[data-legal-document-pending]')!.textContent).toContain('not a kind the portal takes')
  })

  it('lists the documents, holds one back with a reason, releases a held one, and removes one', async () => {
    io.update.mockResolvedValue(undefined)
    io.retire.mockResolvedValue(undefined)
    render(<LegalMatterDocumentsPanel matterId="m-1" documents={[row('d-1', 'Billing report'), row('d-2', 'Aging report', 'internal, not an exhibit')]} canEdit onChanged={() => {}} />)
    expect(document.querySelector('[data-legal-matter-documents]')!.textContent).toContain('1 shown · 1 held')
    expect(document.querySelector('[data-legal-document="d-2"]')!.textContent).toContain('Held from the firm: internal, not an exhibit')
    // v2.5850: the row's actions sit behind one ⋯ menu.
    const menu = (title: string) => { fireEvent.click(screen.getByRole('button', { name: `Actions for ${title}` })); return screen.getByRole('menu') }
    fireEvent.click(within(menu('Billing report')).getByRole('menuitem', { name: 'Hold from the firm…' }))
    const holdBack = screen.getByRole('button', { name: 'Hold back' }) as HTMLButtonElement
    expect(holdBack.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Why the firm should not see it'), { target: { value: 'draft' } })
    fireEvent.click(holdBack)
    await waitFor(() => expect(io.update).toHaveBeenCalledWith(expect.anything(), 'd-1', { held_reason: 'draft' }))
    fireEvent.click(within(menu('Aging report')).getByRole('menuitem', { name: 'Release to the firm' }))
    await waitFor(() => expect(io.update).toHaveBeenCalledWith(expect.anything(), 'd-2', { held_reason: '' }))
    fireEvent.click(within(menu('Billing report')).getByRole('menuitem', { name: 'Remove' }))
    await waitFor(() => expect(io.retire).toHaveBeenCalledWith(expect.anything(), 'd-1'))
  })

  it('read only for a role that cannot edit: no drop zone and no buttons', () => {
    render(<LegalMatterDocumentsPanel matterId="m-1" documents={[row('d-1', 'Billing report')]} canEdit={false} onChanged={() => {}} />)
    expect(document.querySelector('[data-legal-documents-drop]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hold' })).toBeNull()
    expect(document.querySelector('[data-legal-document-menu]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Billing report' })).toBeTruthy()
  })
})

describe('LegalMatterDocumentsPanel · the paper’s day and its state (punch list #168, v2.5846)', () => {
  const dated = (id: string, title: string, over: Partial<LegalMatterDocumentRow>): LegalMatterDocumentRow => ({ ...row(id, title), added_at: '2026-10-24T15:00:00Z', ...over })
  it('a new file carries the day it is from and a state; a received paper its day in', async () => {
    io.add.mockResolvedValue('d-new')
    render(<LegalMatterDocumentsPanel matterId="m-1" documents={[]} canEdit onChanged={vi.fn()} />)
    fireEvent.drop(document.querySelector('[data-legal-documents-drop]')!, { dataTransfer: { files: [new File(['%PDF-1.4'], 'Subcontract.pdf', { type: 'application/pdf' })] } })
    fireEvent.change(screen.getByLabelText('What it shows'), { target: { value: 'Their form, signed by us in May.' } })
    fireEvent.change(screen.getByLabelText('Day the paper is from'), { target: { value: '2026-05-12' } })
    fireEvent.change(screen.getByLabelText('State of the paper'), { target: { value: 'received' } })
    fireEvent.change(screen.getByLabelText('Day it was received'), { target: { value: '2026-05-14' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(io.add).toHaveBeenCalledTimes(1))
    expect(io.add.mock.calls[0]!.slice(1, 3)).toEqual(['m-1', { title: 'Subcontract', shows: 'Their form, signed by us in May.', datedOn: '2026-05-12', state: 'received', receivedOn: '2026-05-14' }])
  })
  it('a draft wears its chip; Mark sent… records the day, how, to whom and the proof; a sent paper reads its record and can be unsent', async () => {
    io.update.mockResolvedValue(undefined)
    const onChanged = vi.fn()
    const docs = [
      dated('d-letter', 'Response letter', { dated_on: '2026-10-27', state: 'draft' }),
      dated('d-receipt', 'Certified mail receipt', { dated_on: '2026-10-27', state: 'final' }),
      dated('d-sent', 'Demand letter', { dated_on: '2026-09-02', state: 'sent', sent_on: '2026-09-02', sent_how: 'email', sent_to: 'Burd & Assoc.', proof_document_id: 'd-receipt' }),
    ]
    render(<LegalMatterDocumentsPanel matterId="m-1" documents={docs} canEdit onChanged={onChanged} />)
    const letter = document.querySelector('[data-legal-document="d-letter"]')!
    expect(letter.querySelector('[data-legal-document-draft]')!.textContent).toBe('Draft')
    expect(letter.textContent).toContain('dated Oct 27 · added Oct 24')
    const sent = document.querySelector('[data-legal-document="d-sent"]')!
    expect(sent.querySelector('[data-legal-document-state-words]')!.textContent).toBe('Sent Sep 2 by email to Burd & Assoc. · proof: Certified mail receipt')
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Demand letter' }))
    expect(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Not sent after all' })).toBeTruthy()
    // Mark the draft letter sent, from its menu.
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Response letter' }))
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Mark sent…' }))
    const form = document.querySelector('[data-legal-document-sent-form]')!
    const save = () => form.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(save().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('How it went out'), { target: { value: 'certified_mail' } })
    fireEvent.change(screen.getByLabelText('Who it went to'), { target: { value: 'Burd & Assoc., attn. the president' } })
    fireEvent.change(screen.getByLabelText('Document that proves the send'), { target: { value: 'd-receipt' } })
    // The panel reads the real today, so the day is one safely in the past.
    fireEvent.change(screen.getByLabelText('Day it went out'), { target: { value: '2026-10-20' } })
    expect(save().disabled).toBe(false)
    fireEvent.click(save())
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })
})
