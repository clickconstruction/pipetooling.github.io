// @vitest-environment jsdom
/**
 * The signed record's two reads past the paper's own row: the form's layout and the signature's image (punch list
 * #403). Since the owner's second decision an estimator is answered both for an outside company's paper, as the
 * office is, so the window lists the form's answers and draws the signature, with a sensitive answer in the PDF only.
 * A read that does not come back is said in words, never waited on without end. Every name is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

const db = vi.hoisted(() => ({ form: false, layout: null as unknown, imageOpens: true, values: {} as Record<string, unknown>, hints: null as Record<string, string> | null }))

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
    form_values: db.values,
    form_hints: db.hints,
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
import { emptyFormSchema } from '../../lib/forms/formSchema'

beforeEach(() => {
  db.form = false
  db.layout = null
  db.imageOpens = true
  db.values = {}
  db.hints = null
})

const box = (key: string, type: string, order: number, label: string, more: Record<string, unknown> = {}) => ({ key, type, page: 1, rect: { x: 1, y: 1, w: 1, h: 1 }, order, label, ...more })
/** A W-9's layout, as `contract_form_templates.schema` keeps it: two answers kept on the row, and a tax number that is not. */
const W9_LAYOUT = {
  schema: {
    ...emptyFormSchema([{ width: 612, height: 792 }]),
    boxes: [
      box('business', 'text', 10, 'Business name'),
      box('title', 'text', 20, 'Signer’s title'),
      box('tin', 'digits', 30, 'Tax number', { mask: '##-#######', sensitive: true }),
      box('signature', 'signature', 40, 'Signature'),
    ],
  },
}

describe('PersonContractSignedRecordModal · the form’s layout and the signature’s image', () => {
  it('lists the form’s answers and draws the signature when both reads answer, a sensitive answer in the PDF only', async () => {
    db.form = true
    db.layout = W9_LAYOUT
    db.values = { business: 'Tallgrass Supply Co.', title: 'Branch manager' }
    db.hints = { tin: '4410' }
    renderWithProviders(<PersonContractSignedRecordModal open documentId="pcd-9" onClose={() => {}} />)
    const image = await screen.findByAltText('Signer signature')
    expect(image.getAttribute('src')).toBe('https://files.example/signature.png')
    const answers = Array.from(document.querySelectorAll('dl > div')).map((d) => `${d.querySelector('dt')?.textContent}: ${d.querySelector('dd')?.textContent}`)
    expect(answers).toEqual(['Business name: Tallgrass Supply Co.', 'Signer’s title: Branch manager', 'Tax number: ••••4410in the PDF only'])
    // Neither of the words for a read that did not come back is drawn.
    expect(screen.queryByTestId('signed-record-layout-closed')).toBeNull()
    expect(screen.queryByTestId('signed-record-signature-wait')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open signed PDF' })).toBeTruthy()
    expect(screen.getByText(/An estimator opens an outside company’s\. A training estimator opens none\./)).toBeTruthy()
  })

  it('draws the signature’s image when it opens', async () => {
    renderWithProviders(<PersonContractSignedRecordModal open documentId="pcd-9" onClose={() => {}} />)
    const image = await screen.findByAltText('Signer signature')
    expect(image.getAttribute('src')).toBe('https://files.example/signature.png')
  })

  it('says the signature’s image did not open, and does not wait on it', async () => {
    db.imageOpens = false
    renderWithProviders(<PersonContractSignedRecordModal open documentId="pcd-9" onClose={() => {}} />)
    expect(await screen.findByText('The signature’s image did not open. It opens for the office, and for an estimator on an outside company’s paper.', {}, { timeout: 8000 })).toBeTruthy()
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
