// @vitest-environment jsdom
/**
 * Documents for the firm's door to the job's messages (punch list #230 PR 5): **From the job's messages…** shows only
 * where a paper may be put on an open matter and opens its window over the account's jobs; a row made from a Messages
 * line names it and opens **The line in Messages** in a new tab.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'

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
  isSourceLineNotPushed: () => false,
}))
vi.mock('../../../lib/supabase', () => ({ supabase: {} }))
const made = vi.hoisted(() => ({ opts: [] as unknown[] }))
vi.mock('../../../lib/legal/evidenceFromMessagesIo', async () => {
  const { conversationsOf } = await import('../../../lib/legal/evidenceFromMessages')
  const conversations = conversationsOf(
    [{ id: 'm-1', contactId: 'c-dale', contactName: 'Dale Okafor', contactKind: 'customer', contactAddress: 'dale@ridgeway.example', jobKey: 'pipeline:j-1077', direction: 'in', at: '2026-10-24T19:03:00Z', subject: 'Re: 4 Elm Ct water heater', body: 'Go ahead.', whoUserId: null, whoText: '', mailbox: 'bids', mailUserId: null, gmailId: 'g-1', gmailThreadId: 't-elm', rfcMessageId: null, files: [] }],
    [],
    { users: {} },
    { words: { 'pipeline:j-1077': 'J1077 · 4 Elm Ct' }, todayYmd: '2026-11-01' },
  )
  return {
    evidenceFromMessagesIo: (_db: unknown, opts: unknown) => {
      made.opts.push(opts)
      return { load: async () => ({ conversations, onMatter: new Set<string>(), rawBytes: {}, ctx: { todayYmd: '2026-11-01', boxes: {}, users: {}, appFrom: 'x <x@y.example>' }, people: { users: {} } }), put: vi.fn() }
    },
  }
})

import LegalMatterDocumentsPanel from './LegalMatterDocumentsPanel'
import type { LegalMatterDocumentRow } from '../../../lib/legal/legalMatterDocumentsIo'
import { renderWithProviders, settle } from '../../../test/renderSmokeMocks'

afterEach(() => {
  cleanup()
  made.opts.length = 0
})

const job = { id: 'j-1077', hcp_number: 'J1077', click_number: null, job_name: '4 Elm Ct', status: 'billed', bid_id: null }
const row = (id: string, over: Partial<LegalMatterDocumentRow> = {}): LegalMatterDocumentRow => ({ id, matter_id: 'm-1', title: 'Re: 4 Elm Ct water heater · 1 of 2 · Oct 24, 2026', shows: 'Email between Dale Okafor and Click Plumbing and Electrical on J1077 · 4 Elm Ct, as received.', storage_path: `m-1/${id}-x.eml`, mime: 'message/rfc822', size_bytes: 4200, original_name: 'x.eml', added_by: 'u-1', added_at: '2026-11-01T15:00:00Z', held_reason: '', voided_at: null, dated_on: '2026-10-24', state: 'received', sent_on: null, sent_how: '', sent_to: '', proof_document_id: null, received_on: '2026-10-24', whose: 'theirs', ...over })

describe('LegalMatterDocumentsPanel → From the job’s messages… (v2.6276)', () => {
  it('shows the door only to a hand that may put a paper, with the account given, and opens the window on its jobs', async () => {
    const { rerender } = renderWithProviders(<LegalMatterDocumentsPanel matterId="m-1" documents={[]} canEdit={false} onChanged={() => {}} fromMessages={{ accountName: 'Ridgeway Builders', jobs: [job] }} />)
    expect(document.querySelector('[data-legal-documents-from-messages]')).toBeNull()
    rerender(<LegalMatterDocumentsPanel matterId="m-1" documents={[]} canEdit onChanged={() => {}} fromMessages={null} />)
    expect(document.querySelector('[data-legal-documents-from-messages]')).toBeNull()
    rerender(<LegalMatterDocumentsPanel matterId="m-1" documents={[]} canEdit onChanged={() => {}} fromMessages={{ accountName: 'Ridgeway Builders', jobs: [job] }} />)
    const door = screen.getByRole('button', { name: 'From the job’s messages…' })
    fireEvent.click(door)
    await settle()
    const sheet = await screen.findByRole('dialog', { name: 'From the job’s messages' })
    expect(within(sheet).getByText('· emails on J1077')).toBeTruthy()
    expect(await within(sheet).findByText('Re: 4 Elm Ct water heater · 1 email, Oct 24')).toBeTruthy()
    expect(made.opts).toEqual([{ matterId: 'm-1', jobs: [job] }])
    fireEvent.click(within(sheet).getByRole('button', { name: 'Not now' }))
    expect(screen.queryByRole('dialog', { name: 'From the job’s messages' })).toBeNull()
  })

  it('a row made from a Messages line names it, and its ⋯ opens the line in a new tab', () => {
    renderWithProviders(<LegalMatterDocumentsPanel matterId="m-1" documents={[row('d-1', { source_message_id: 'm-1', source_contact_id: 'c-dale' }), row('d-2', { title: 'Billing report', mime: 'application/pdf' })]} canEdit onChanged={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Re: 4 Elm Ct water heater · 1 of 2 · Oct 24, 2026' }))
    const menu = screen.getByRole('menu')
    expect(menu.querySelector('[data-legal-document-source-line]')!.textContent).toBe('Made from an email in Messages.')
    const line = within(menu).getByRole('menuitem', { name: 'The line in Messages ↗' })
    expect([line.getAttribute('href'), line.getAttribute('target'), line.getAttribute('rel')]).toEqual(['/messages?thread=c-dale&at=m-1', '_blank', 'noopener noreferrer'])
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Billing report' }))
    expect(within(screen.getByRole('menu')).queryByRole('menuitem', { name: 'The line in Messages ↗' })).toBeNull()
  })
})
