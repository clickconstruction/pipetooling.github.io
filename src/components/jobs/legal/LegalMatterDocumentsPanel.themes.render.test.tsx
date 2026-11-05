// @vitest-environment jsdom
/**
 * Themes under Documents for the firm (v2.6548, punch list #269 T2b): a paper waiting to be saved carries the strip
 * when the catalog is given, and Save writes the marks after the paper stands; a row with marks draws them as chips;
 * a hand with no catalog sees neither. Made-up rows only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'

const io = vi.hoisted(() => ({
  addLegalMatterDocument: vi.fn(async () => 'd-new'),
  addMarks: vi.fn(async () => ({ ok: true as const, made: 1, already: 0, failWhy: null })),
}))
vi.mock('../../../lib/legal/legalMatterDocumentsIo', () => ({
  addLegalMatterDocument: io.addLegalMatterDocument,
  updateLegalMatterDocument: vi.fn(),
  retireLegalMatterDocument: vi.fn(),
  legalMatterDocumentLink: vi.fn(),
  openLegalMatterDocument: vi.fn(),
  markLegalMatterDocumentSent: vi.fn(),
  markLegalMatterDocumentReceived: vi.fn(),
  setLegalMatterDocumentState: vi.fn(),
  setLegalMatterDocumentDatedOn: vi.fn(),
  setLegalMatterDocumentWhose: vi.fn(),
  isSourceLineNotPushed: () => false,
}))
vi.mock('../../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../../lib/legal/legalThemesIo', () => ({ addMarks: io.addMarks, authUserIdNow: vi.fn(async () => 'u-dev') }))

import LegalMatterDocumentsPanel from './LegalMatterDocumentsPanel'
import type { LegalMatterDocumentRow } from '../../../lib/legal/legalMatterDocumentsIo'
import type { LegalTheme, LegalThemeMark } from '../../../lib/legal/legalThemes'
import { renderWithProviders } from '../../../test/renderSmokeMocks'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const row = (id: string, title: string): LegalMatterDocumentRow => ({ id, matter_id: 'm-1', title, shows: `What ${title} shows.`, storage_path: `m-1/${id}-x.pdf`, mime: 'application/pdf', size_bytes: 64075, original_name: 'x.pdf', added_by: 'u-1', added_at: '2026-10-07T15:00:00Z', held_reason: '', voided_at: null, dated_on: null, state: 'final', sent_on: null, sent_how: '', sent_to: '', proof_document_id: null, received_on: null, whose: null })
const theme = (id: string, name: string): LegalTheme => ({ id, name, what_counts: '', counsel_words: '', created_by: null, created_at: '2026-11-05T00:00:00Z', updated_at: '2026-11-05T00:00:00Z', retired_at: null, retired_by: null, proposed_by_agent: false, kept_at: null })
const mark = (over: Partial<LegalThemeMark>): LegalThemeMark => ({ id: 'm1', theme_id: 't1', target_kind: 'matter_document', target_id: 'd1', person_id: null, matter_id: 'm-1', why: 'the statement itself', proves_by: 'document', marked_by: 'u-1', marked_at: '2026-11-05T00:00:00Z', author_label: null, proposed: false, kept_at: '2026-11-05T00:00:00Z', kept_by: 'u-1', removed_at: null, removed_by: null, removed_why: '', ...over })
const THEMES = [theme('t1', 'Dishonesty'), theme('t2', 'Interference with the business')]

describe('LegalMatterDocumentsPanel · themes (v2.6548)', () => {
  it('draws the marks as chips on a row, and the strip under a pending paper whose Save writes the marks after it stands', async () => {
    renderWithProviders(<LegalMatterDocumentsPanel matterId="m-1" documents={[row('d1', 'Bank statement')]} canEdit onChanged={() => {}} themes={THEMES} marks={[mark({ id: 'm1' })]} onMarksChanged={() => {}} />)
    const chip = document.querySelector('[data-legal-document="d1"] [data-legal-document-theme="t1"]')!
    expect(chip.textContent).toBe('Dishonesty')
    expect(chip.getAttribute('title')).toBe('why: the statement itself · proves it by a document')

    const file = new File(['%PDF-1.4'], 'charges.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Choose documents'), { target: { files: [file] } })
    const pending = document.querySelector('[data-legal-document-pending]') as HTMLElement
    fireEvent.change(within(pending).getByLabelText('What it shows'), { target: { value: 'Charges on a day with no job.' } })
    const picker = pending.querySelector('[data-legal-document-themes]') as HTMLElement
    fireEvent.click(within(picker).getByTestId('theme-pick-t2'))
    fireEvent.click(within(picker).getByTestId('theme-proves-document'))
    fireEvent.click(within(pending).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(io.addLegalMatterDocument).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(io.addMarks).toHaveBeenCalledWith({ themeIds: ['t2'], targets: [{ kind: 'matter_document', id: 'd-new' }], personId: null, matterId: 'm-1', why: '', provesBy: 'document', authUserId: 'u-dev' }))
  })

  it('a hand with no catalog sees no strip and no chips', () => {
    renderWithProviders(<LegalMatterDocumentsPanel matterId="m-1" documents={[row('d1', 'Bank statement')]} canEdit onChanged={() => {}} />)
    expect(document.querySelector('[data-legal-document-theme]')).toBeNull()
    const file = new File(['%PDF-1.4'], 'charges.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Choose documents'), { target: { files: [file] } })
    expect(document.querySelector('[data-legal-document-pending]')).not.toBeNull()
    expect(document.querySelector('[data-legal-document-themes]')).toBeNull()
  })
})
