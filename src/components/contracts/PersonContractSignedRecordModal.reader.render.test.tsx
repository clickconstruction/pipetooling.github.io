// @vitest-environment jsdom
/**
 * The signed record, for a reader two of its reads are closed to (punch list #403, step 4): an estimator opens an
 * outside company's signed paper, and their role is refused the form's layout and the signature's image. The window
 * says each in words. It used to wait on both without end. Every name is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

const db = vi.hoisted(() => ({ form: false, layout: null as unknown, imageOpens: true }))

vi.mock('../../lib/supabase', () => {
  const row = () => ({
    id: 'pcd-9',
    document_name: db.form ? 'W-9' : 'Mutual secrecy agreement',
    person_name: 'party:11111111-1111-4111-8111-111111111111',
    party_name: 'Tallgrass Supply Co.',
    signer_name: 'Lena Park',
    signer_title: 'Branch manager',
    signing_for: 'Tallgrass Supply Co.',
    signing_body_html: db.form ? null : '<p>The terms.</p>',
    signing_body_format: 'html',
    canonical_document_url: null,
    url: null,
    status: 'signed',
    signed_at: '2026-11-20',
    signer_printed_name: 'Lena Park',
    signer_consented_at: '2026-11-20T16:00:00Z',
    signer_signature_storage_path: 'pcd-9/signature.png',
    form_template_id: db.form ? 'tpl-w9' : null,
    form_values: {},
    form_pdf_storage_path: db.form ? 'pcd-9/form.pdf' : null,
  })
  const answer = (table: string, columns: string) => {
    if (table === 'contract_form_templates') return { data: db.layout, error: null }
    if (columns === 'clause_versions') return { data: { clause_versions: null }, error: null }
    return { data: row(), error: null }
  }
  return {
    supabase: {
      from: (table: string) => ({ select: (columns: string) => ({ eq: () => ({ maybeSingle: () => Promise.resolve(answer(table, columns)) }) }) }),
      storage: {
        from: () => ({
          createSignedUrl: () => Promise.resolve(db.imageOpens ? { data: { signedUrl: 'https://files.example/signature.png' }, error: null } : { data: null, error: { message: 'Object not found', statusCode: '404' } }),
        }),
      },
    },
  }
})

import { PersonContractSignedRecordModal } from './PersonContractSignedRecordModal'
import { renderWithProviders } from '../../test/renderSmokeMocks'

beforeEach(() => {
  db.form = false
  db.layout = null
  db.imageOpens = true
})

describe('PersonContractSignedRecordModal · a reader its reads are closed to', () => {
  it('draws the signature’s image when it opens', async () => {
    renderWithProviders(<PersonContractSignedRecordModal open documentId="pcd-9" onClose={() => {}} />)
    const image = await screen.findByAltText('Signer signature')
    expect(image.getAttribute('src')).toBe('https://files.example/signature.png')
  })

  it('says the signature’s image did not open, and does not wait on it', async () => {
    db.imageOpens = false
    renderWithProviders(<PersonContractSignedRecordModal open documentId="pcd-9" onClose={() => {}} />)
    expect(await screen.findByText('The signature’s image did not open. It is kept for the office.', {}, { timeout: 8000 })).toBeTruthy()
    expect(screen.queryByText('Loading signature…')).toBeNull()
  }, 12000)

  it('says a form’s layout did not read and that the PDF holds its answers, and keeps the PDF’s press', async () => {
    db.form = true
    renderWithProviders(<PersonContractSignedRecordModal open documentId="pcd-9" onClose={() => {}} />)
    const words = await screen.findByTestId('signed-record-layout-closed')
    expect(words.textContent).toBe('The form’s layout did not read, so its answers are not listed here. The PDF holds them.')
    expect(screen.queryByText('Loading the form’s layout…')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open signed PDF' })).toBeTruthy()
    expect(screen.getByText(/An estimator opens an outside company’s\./)).toBeTruthy()
  })
})
