// @vitest-environment jsdom
/**
 * The office's signed record of a paper built from clauses (Messages, cut 4c, v2.5294): it draws the clauses the copy was
 * signed with, frozen on it, with the version line, and folds the paper's body under *The full agreement*. A copy that
 * kept no clauses draws its body as before.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

const db = vi.hoisted(() => ({ kept: null as unknown }))

vi.mock('../../lib/supabase', () => {
  const row = {
    id: 'pcd-1',
    document_name: 'Master services agreement',
    person_name: 'gc-company:co-hillside',
    signing_body_html: '<p>The standard terms.</p>',
    signing_body_format: 'html',
    canonical_document_url: null,
    url: null,
    status: 'signed',
    signed_at: '2026-10-12',
    signer_printed_name: 'Greg Paulk',
    signer_consented_at: '2026-10-12T16:00:00Z',
    signer_signature_storage_path: null,
    form_template_id: null,
  }
  const chain = (columns: string) => ({
    eq: () => ({ maybeSingle: () => Promise.resolve(columns === 'clause_versions' ? { data: { clause_versions: db.kept }, error: null } : { data: row, error: null }) }),
  })
  return { supabase: { auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'jwt' } } }) }, from: () => ({ select: (columns: string) => chain(columns) }), storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null, error: null }) }) } } }
})

import { PersonContractSignedRecordModal } from './PersonContractSignedRecordModal'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const KEPT = {
  paperId: 'doc-msa',
  revision: 3,
  lang: 'en',
  title: 'Master services agreement',
  between: 'Click Construction and Hillside Excavation',
  clauses: [{ id: 'msa-1', v: 2, n: 1, text: 'Term: one year from signing.' }],
  exhibit: [{ id: 'msa-6', v: 1, n: 2, text: 'Utilities: a locate before any dig.' }],
  exhibitFor: ['Sitework'],
}

beforeEach(() => {
  db.kept = null
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('PersonContractSignedRecordModal · clauses', () => {
  it('draws the clauses the copy was signed with, and its version line', async () => {
    db.kept = KEPT
    renderWithProviders(<PersonContractSignedRecordModal open documentId="pcd-1" onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('Utilities: a locate before any dig.')).toBeTruthy())
    expect(screen.getByText('Between Click Construction and Hillside Excavation.')).toBeTruthy()
    expect(screen.getByText('Version 3, with the Sitework exhibit.')).toBeTruthy()
    expect(screen.getByText('The full agreement')).toBeTruthy()
  })

  it('draws the body as before for a copy that kept no clauses', async () => {
    renderWithProviders(<PersonContractSignedRecordModal open documentId="pcd-1" onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('The standard terms.')).toBeTruthy())
    expect(screen.queryByText('The full agreement')).toBeNull()
    expect(document.querySelector('[data-signed-clauses]')).toBeNull()
  })

  // Punch list #376: a paper of plain words or clauses had no PDF. Its record now opens one through its own door.
  it('a signed paper of plain words carries Open the PDF, which asks the door for this paper and opens the link', async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) })
      return { ok: true, json: async () => ({ ok: true, url: 'https://files.example/signed-paper.pdf' }) }
    })
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderWithProviders(<PersonContractSignedRecordModal open documentId="pcd-1" onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('The standard terms.')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Open the PDF' }))
    await waitFor(() => expect(opened).toHaveBeenCalledWith('https://files.example/signed-paper.pdf', '_blank', 'noopener'))
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toMatch(/\/functions\/v1\/person-paper-pdf$/)
    expect(calls[0]?.body).toEqual({ person_contract_document_id: 'pcd-1' })
  })

  it('says why when the door refuses, and opens nothing', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, json: async () => ({ error: 'Only the office opens a signed paper’s PDF.' }) }))
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null)
    db.kept = KEPT
    renderWithProviders(<PersonContractSignedRecordModal open documentId="pcd-1" onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('Utilities: a locate before any dig.')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Open the PDF' }))
    expect(await screen.findByText('Only the office opens a signed paper’s PDF.')).toBeTruthy()
    expect(opened).not.toHaveBeenCalled()
  })
})
