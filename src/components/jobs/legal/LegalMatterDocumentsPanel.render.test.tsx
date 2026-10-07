// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import LegalMatterDocumentsPanel from './LegalMatterDocumentsPanel'
import type { LegalMatterDocumentRow } from '../../../lib/legal/legalMatterDocumentsIo'

const io = vi.hoisted(() => ({ add: vi.fn(), update: vi.fn(), retire: vi.fn(), link: vi.fn() }))
vi.mock('../../../lib/legal/legalMatterDocumentsIo', () => ({
  addLegalMatterDocument: (...a: unknown[]) => io.add(...a),
  updateLegalMatterDocument: (...a: unknown[]) => io.update(...a),
  retireLegalMatterDocument: (...a: unknown[]) => io.retire(...a),
  legalMatterDocumentLink: (...a: unknown[]) => io.link(...a),
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
    expect(io.add.mock.calls[0]!.slice(1, 3)).toEqual(['m-1', { title: 'Billing report', shows: 'The itemization of both bills.' }])
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
    fireEvent.click(screen.getByRole('button', { name: 'Hold' }))
    const holdBack = screen.getByRole('button', { name: 'Hold back' }) as HTMLButtonElement
    expect(holdBack.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Why the firm should not see it'), { target: { value: 'draft' } })
    fireEvent.click(holdBack)
    await waitFor(() => expect(io.update).toHaveBeenCalledWith(expect.anything(), 'd-1', { held_reason: 'draft' }))
    fireEvent.click(screen.getByRole('button', { name: 'Release to the firm' }))
    await waitFor(() => expect(io.update).toHaveBeenCalledWith(expect.anything(), 'd-2', { held_reason: '' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]!)
    await waitFor(() => expect(io.retire).toHaveBeenCalledWith(expect.anything(), 'd-1'))
  })

  it('read only for a role that cannot edit: no drop zone and no buttons', () => {
    render(<LegalMatterDocumentsPanel matterId="m-1" documents={[row('d-1', 'Billing report')]} canEdit={false} onChanged={() => {}} />)
    expect(document.querySelector('[data-legal-documents-drop]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hold' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Billing report' })).toBeTruthy()
  })
})
