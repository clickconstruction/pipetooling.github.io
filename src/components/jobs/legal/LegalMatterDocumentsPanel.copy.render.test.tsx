// @vitest-environment jsdom
/**
 * The copy presses over a text document's words (v2.7683): Read draws one press per piece to send, the copy leaves
 * out the draft note at the top and the internal section, the view lists the blanks still to fill and the toast
 * counts them; *Copy everything as text* takes the whole; a counsel-only paper has no press. A made-up letter only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

const LETTER = ['# DRAFT: notice to customers', '', '*Not sent. Counsel reads it first.*', '', '## Letter', '', '[DATE]', '', 'Dear [CUSTOMER NAME],', '', 'As of [DATE], **Pat Sample** no longer acts for Sample Plumbing Co.', '', 'Sincerely,', 'Lee Example', '', '## Short version', '', 'Pat Sample no longer acts for us.', '', '## INTERNAL: notes', '', 'Do not send before the review.'].join('\n')

const io = vi.hoisted(() => ({ read: vi.fn(async (..._a: unknown[]) => '') }))
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
}))
vi.mock('../../../lib/supabase', () => ({ supabase: {} }))

import LegalMatterDocumentsPanel from './LegalMatterDocumentsPanel'
import type { LegalMatterDocumentRow } from '../../../lib/legal/legalMatterDocumentsIo'
import { renderWithProviders } from '../../../test/renderSmokeMocks'

const row = (id: string, title: string, over: Partial<LegalMatterDocumentRow> = {}): LegalMatterDocumentRow => ({ id, matter_id: 'm-1', title, shows: `What ${title} shows.`, storage_path: `m-1/${id}-x.md`, mime: 'text/markdown', size_bytes: 900, original_name: 'x.md', added_by: 'u-1', added_at: '2026-11-10T15:00:00Z', held_reason: '', voided_at: null, dated_on: null, state: 'final', sent_on: null, sent_how: '', sent_to: '', proof_document_id: null, received_on: null, whose: null, text_document_id: `t-${id}`, ...over })

const written: string[] = []
beforeEach(() => {
  written.length = 0
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async (t: string) => { written.push(t) }) } })
  io.read.mockResolvedValue(LETTER)
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const bar = () => document.querySelector('[data-legal-document-copy-bar]') as HTMLElement

describe('LegalMatterDocumentsPanel · copy a letter into an email (v2.7683)', () => {
  it('Read offers a press per piece; the copy is plain text without the draft note or the internal section, and the toast counts the blanks', async () => {
    renderWithProviders(<LegalMatterDocumentsPanel matterId="m-1" documents={[row('d-1', 'Notice to customers'), row('d-2', 'Site photo', { text_document_id: null })]} canEdit={false} onChanged={() => {}} />)
    // A paper kept only as a file has no Read, so no copy press.
    expect(document.querySelector('[data-legal-document="d-2"] [data-legal-document-read]')).toBeNull()
    fireEvent.click(document.querySelector('[data-legal-document="d-1"] [data-legal-document-read]')!)
    const first = await screen.findByRole('button', { name: 'Copy the draft “Letter”' })
    expect(io.read).toHaveBeenCalledWith(expect.anything(), 't-d-1')
    expect(screen.getByRole('button', { name: 'Copy the draft “Short version”' })).toBeTruthy()
    expect(bar().querySelector('[data-legal-document-copy-left-out]')!.textContent).toBe('The copy leaves out the draft note at the top and the section “INTERNAL: notes”.')
    expect(bar().querySelector('[data-legal-document-copy-blanks="0"]')!.textContent).toBe('Still to fill in “Letter”: [DATE] ×2 · [CUSTOMER NAME]')
    expect(bar().querySelector('[data-legal-document-copy-blanks="1"]')).toBeNull()
    // The words under the presses are the whole document, as before.
    expect(document.querySelector('[data-legal-document-text]')!.textContent).toContain('Do not send before the review.')

    fireEvent.click(first)
    await waitFor(() => expect(written).toHaveLength(1))
    expect(written[0]).toBe('[DATE]\n\nDear [CUSTOMER NAME],\n\nAs of [DATE], Pat Sample no longer acts for Sample Plumbing Co.\n\nSincerely,\nLee Example')
    expect(await screen.findByText('Copied the draft “Letter”. 3 blanks are still open in it.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Copy everything as text' }))
    await waitFor(() => expect(written).toHaveLength(2))
    expect(written[1]).toContain('DRAFT: notice to customers')
    expect(written[1]).toContain('INTERNAL: notes\n\nDo not send before the review.')
    expect(written[1]).not.toMatch(/[*#]/)
  })

  it('a letter with nothing to leave out is one press, named a draft by the row’s state; a refused clipboard says why', async () => {
    io.read.mockResolvedValue('Dear Pat,\n\nThank you for the work.\n\nLee Example')
    const { rerender } = renderWithProviders(<LegalMatterDocumentsPanel matterId="m-1" documents={[row('d-1', 'Thank you letter', { state: 'draft' })]} canEdit onChanged={() => {}} />)
    fireEvent.click(document.querySelector('[data-legal-document-read]')!)
    const press = await screen.findByRole('button', { name: 'Copy the draft letter' })
    expect(bar().querySelector('[data-legal-document-copy-left-out]')).toBeNull()
    fireEvent.click(press)
    expect(await screen.findByText('Copied the draft letter.')).toBeTruthy()
    expect(written).toEqual(['Dear Pat,\n\nThank you for the work.\n\nLee Example'])
    // Marked final, the same paper reads as the letter.
    rerender(<LegalMatterDocumentsPanel matterId="m-1" documents={[row('d-1', 'Thank you letter')]} canEdit onChanged={() => {}} />)
    expect(screen.getByRole('button', { name: 'Copy the letter' })).toBeTruthy()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => { throw new Error('Write permission denied.') }) } })
    fireEvent.click(screen.getByRole('button', { name: 'Copy the letter' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Write permission denied.')
  })

  it('a counsel-only paper reads but has no copy press', async () => {
    renderWithProviders(<LegalMatterDocumentsPanel matterId="m-1" documents={[row('d-1', 'Memo for counsel', { counsel_only: true })]} canEdit onChanged={() => {}} />)
    fireEvent.click(document.querySelector('[data-legal-document-read]')!)
    await waitFor(() => expect(bar()).toBeTruthy())
    expect(bar().textContent).toBe('A counsel-only paper has no copy press.')
    expect(document.querySelector('[data-legal-document-copy]')).toBeNull()
    expect(document.querySelector('[data-legal-document-copy-all]')).toBeNull()
  })
})
