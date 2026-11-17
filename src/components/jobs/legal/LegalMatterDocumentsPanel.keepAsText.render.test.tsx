// @vitest-environment jsdom
/**
 * Keep an old text file's words as text (v2.7694): a `.txt` or `.md` kept only as a stored file has **Keep its words as
 * text** on its ⋯ menu, and more than one of them puts a counted press beside the filters that takes them one by one,
 * keeps going past one that fails and names it afterwards with its reason. Once a row has its words it shows **Read**.
 * Made-up rows only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

const io = vi.hoisted(() => ({ keep: vi.fn(async (..._a: unknown[]) => 't-new'), read: vi.fn(async (..._a: unknown[]) => 'Dear Pat,\n\nThank you for the work.') }))
vi.mock('../../../lib/legal/legalMatterDocumentsIo', () => ({
  addLegalMatterDocument: vi.fn(),
  updateLegalMatterDocument: vi.fn(),
  retireLegalMatterDocument: vi.fn(),
  legalMatterDocumentLink: vi.fn(),
  openLegalMatterDocument: vi.fn(),
  markLegalMatterDocumentSent: vi.fn(),
  markLegalMatterDocumentReceived: vi.fn(),
  setLegalMatterDocumentState: vi.fn(),
  setLegalMatterDocumentDatedOn: vi.fn(),
  setLegalMatterDocumentWhose: vi.fn(),
  setLegalMatterDocumentCounselOnly: vi.fn(),
  readLegalMatterDocumentText: io.read,
  keepLegalMatterDocumentAsText: io.keep,
}))
vi.mock('../../../lib/supabase', () => ({ supabase: {} }))

import LegalMatterDocumentsPanel from './LegalMatterDocumentsPanel'
import type { LegalMatterDocumentRow } from '../../../lib/legal/legalMatterDocumentsIo'
import { renderWithProviders } from '../../../test/renderSmokeMocks'

const row = (id: string, title: string, over: Partial<LegalMatterDocumentRow> = {}): LegalMatterDocumentRow => ({ id, matter_id: 'm-1', title, shows: `What ${title} shows.`, storage_path: `m-1/${id}-x.txt`, mime: 'text/plain', size_bytes: 900, original_name: 'x.txt', added_by: 'u-1', added_at: '2026-10-30T15:00:00Z', held_reason: '', voided_at: null, dated_on: null, state: 'final', sent_on: null, sent_how: '', sent_to: '', proof_document_id: null, received_on: null, whose: null, text_document_id: null, ...over })

/** Three old text files, a picture and a text document already kept. */
const rows = () => [
  row('d-1', 'Thank you letter'),
  row('d-2', 'Old memo'),
  row('d-3', 'Call notes', { mime: 'text/markdown', counsel_only: true }),
  row('d-4', 'Site photo', { mime: 'image/jpeg' }),
  row('d-5', 'Notice to customers', { mime: 'text/markdown', text_document_id: 't-5' }),
]

const el = (sel: string) => document.querySelector(sel) as HTMLElement | null
const batch = () => el('[data-legal-documents-keep-as-text]')
const menuLines = (id: string) => {
  fireEvent.click(el(`[data-legal-document="${id}"] [data-legal-document-menu]`)!)
  const lines = [...document.querySelectorAll('[data-legal-document-menu-open] [role="menuitem"]')].map((b) => b.textContent)
  fireEvent.click(el(`[data-legal-document="${id}"] [data-legal-document-menu]`)!)
  return lines
}

beforeEach(() => {
  io.keep.mockResolvedValue('t-new')
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LegalMatterDocumentsPanel · keep an old text file’s words as text (v2.7694)', () => {
  it('the counted press takes each waiting paper, keeps going past one that fails and names it with its reason', async () => {
    io.keep.mockImplementation(async (_db: unknown, d: unknown) => {
      if ((d as LegalMatterDocumentRow).id === 'd-2') throw new Error('The stored file has no words to keep.')
      return 't-new'
    })
    const onChanged = vi.fn()
    const { rerender } = renderWithProviders(<LegalMatterDocumentsPanel matterId="m-1" documents={rows()} canEdit onChanged={onChanged} />)
    // Only the three text files kept as files count: not the picture, not the paper that already reads.
    expect(batch()!.textContent).toBe('Keep 3 as text')
    for (const id of ['d-1', 'd-2', 'd-3', 'd-4']) expect(el(`[data-legal-document="${id}"] [data-legal-document-read]`)).toBeNull()
    expect(el('[data-legal-document="d-5"] [data-legal-document-read]')).toBeTruthy()

    fireEvent.click(batch()!)
    expect(await screen.findByText('Kept 2 papers as text. 1 did not keep.')).toBeTruthy()
    // One by one, in the list's order, past the one that failed.
    expect(io.keep.mock.calls.map((c) => (c[1] as LegalMatterDocumentRow).id)).toEqual(['d-1', 'd-2', 'd-3'])
    expect(onChanged).toHaveBeenCalledTimes(1)
    const failed = el('[data-legal-documents-keep-failed]')!
    expect(failed.textContent).toContain('1 paper did not keep. It stays here with the reason.')
    expect(el('[data-legal-documents-keep-failed-row="d-2"]')!.textContent).toBe('Old memo: The stored file has no words to keep.')

    // The list reloads: the two that took show Read, the one that did not keeps its menu line and its reason.
    rerender(<LegalMatterDocumentsPanel matterId="m-1" documents={rows().map((d) => (d.id === 'd-1' || d.id === 'd-3' ? { ...d, text_document_id: `t-${d.id}` } : d))} canEdit onChanged={onChanged} />)
    expect(el('[data-legal-document="d-1"] [data-legal-document-read]')).toBeTruthy()
    expect(el('[data-legal-document="d-3"] [data-legal-document-read]')).toBeTruthy()
    expect(batch()).toBeNull()
    expect(el('[data-legal-documents-keep-failed-row="d-2"]')).toBeTruthy()
    expect(menuLines('d-2')).toContain('Keep its words as text')
    expect(menuLines('d-1')).not.toContain('Keep its words as text')

    // Read on a kept paper opens its words with the copy presses over them.
    fireEvent.click(el('[data-legal-document="d-1"] [data-legal-document-read]')!)
    expect(await screen.findByRole('button', { name: 'Copy the letter' })).toBeTruthy()
    expect(io.read).toHaveBeenCalledWith(expect.anything(), 't-d-1')
  })

  it('one waiting paper has the menu line and no counted press; a refusal says why', async () => {
    const onChanged = vi.fn()
    renderWithProviders(<LegalMatterDocumentsPanel matterId="m-1" documents={[row('d-1', 'Thank you letter'), row('d-4', 'Site photo', { mime: 'image/jpeg' })]} canEdit onChanged={onChanged} />)
    expect(batch()).toBeNull()
    expect(menuLines('d-4')).not.toContain('Keep its words as text')

    fireEvent.click(el('[data-legal-document="d-1"] [data-legal-document-menu]')!)
    expect(el('[data-legal-document-file-only]')!.textContent).toBe('Kept as a file only. Keep its words as text to read and copy them here.')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Keep its words as text' }))
    expect(await screen.findByText('Kept 1 paper as text.')).toBeTruthy()
    expect(io.keep).toHaveBeenCalledTimes(1)
    expect((io.keep.mock.calls[0]![1] as LegalMatterDocumentRow).id).toBe('d-1')
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))

    io.keep.mockRejectedValueOnce(new Error('Could not read the stored file: Object not found'))
    fireEvent.click(el('[data-legal-document="d-1"] [data-legal-document-menu]')!)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Keep its words as text' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Could not read the stored file: Object not found')
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('a hand that cannot edit has neither press', () => {
    renderWithProviders(<LegalMatterDocumentsPanel matterId="m-1" documents={rows()} canEdit={false} onChanged={() => {}} />)
    expect(batch()).toBeNull()
    expect(el('[data-legal-document-menu]')).toBeNull()
  })

  it('when every paper fails the toast says nothing took, and the list stays as it was', async () => {
    io.keep.mockRejectedValue(new Error('Could not read the stored file: Object not found'))
    const onChanged = vi.fn()
    renderWithProviders(<LegalMatterDocumentsPanel matterId="m-1" documents={rows()} canEdit onChanged={onChanged} />)
    fireEvent.click(batch()!)
    expect(await screen.findByText('Nothing kept. 3 did not keep.')).toBeTruthy()
    expect(el('[data-legal-documents-keep-failed]')!.textContent).toContain('3 papers did not keep. They stay here with the reason.')
    expect(document.querySelectorAll('[data-legal-documents-keep-failed-row]')).toHaveLength(3)
    expect(onChanged).not.toHaveBeenCalled()
    // Still waiting, so the press still offers all three.
    expect(batch()!.textContent).toBe('Keep 3 as text')
    expect((batch() as HTMLButtonElement).disabled).toBe(false)
  })
})
