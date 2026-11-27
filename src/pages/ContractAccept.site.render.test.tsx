// @vitest-environment jsdom
/**
 * The sign page and a paper's site (punch list #439, piece 3, part 3e). When the office ticked **Print the site's
 * address on the paper**, the signer's function hands the address over and the page shows it above the paper, on a
 * line of its own. The signature then says which address the page showed. With the box off, or from a function older
 * than the box, the page shows nothing of a site and signs as it always did. Every name and address here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('../test/renderSmokeMocks')).makeSupabaseStub() }))
vi.mock('../hooks/useAuth', async () => {
  const m = await import('../test/renderSmokeMocks')
  return m.useAuthModuleMock({ user: null, role: null })
})

import { ToastProvider } from '../contexts/ToastContext'
import ContractAccept from './ContractAccept'
import { installDomShims } from '../test/renderSmokeMocks'

const QUARRY = '118 Old Quarry Trl, Sampleton, TX'
const PLAIN = {
  id: 'pcd-9',
  person_name: 'Lena Park',
  signer_name: 'Lena Park',
  signer_title: 'Branch manager',
  signing_for: 'Tallgrass Supply Co.',
  audience: 'outside',
  document_name: 'Vendor NDA',
  signing_body_html: '<p>Keep what we send you secret.</p>',
  signing_body_format: 'html',
  canonical_document_url: null,
  form: null,
  clause_paper: null,
}
const PAPER_EN = { paperId: 'doc-nda', revision: 2, lang: 'en', clauses: [{ id: 'nda-1', v: 1, n: 1, text: 'Keep it secret.' }], exhibit: [], exhibitFor: [], between: null }
const PAPER_ES = { ...PAPER_EN, lang: 'es', clauses: [{ id: 'nda-1', v: 1, n: 1, text: 'Guarde el secreto.' }] }

const posts: Record<string, unknown>[] = []
let acceptReply: { status: number; json: Record<string, unknown> } = { status: 200, json: { ok: true, documentId: 'pcd-9' } }
let loaded: Record<string, unknown> = PLAIN

beforeEach(() => {
  posts.length = 0
  acceptReply = { status: 200, json: { ok: true, documentId: 'pcd-9' } }
  loaded = PLAIN
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('get-contract-for-signer')) return new Response(JSON.stringify(loaded), { status: 200 })
      posts.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>)
      return new Response(JSON.stringify(acceptReply.json), { status: acceptReply.status })
    }),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function open() {
  installDomShims()
  return render(<ContractAccept />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ToastProvider>
        <MemoryRouter initialEntries={['/contract/accept?t=tok-9']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          {children}
        </MemoryRouter>
      </ToastProvider>
    ),
  })
}

function sign(name: string, submit = 'Submit signature') {
  fireEvent.change(screen.getByPlaceholderText(/full legal name|nombre legal completo/), { target: { value: name } })
  for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box)
  fireEvent.click(screen.getByRole('button', { name: submit }))
}

describe('ContractAccept · a paper that prints its site’s address', () => {
  it('shows the address on its own line above the paper, and the signature says which address the page showed', async () => {
    loaded = { ...PLAIN, site_address: QUARRY }
    open()
    const line = await screen.findByTestId('contract-accept-site')
    expect(line.textContent).toBe(`Site address${QUARRY}`)
    // Above the paper: the line comes before the paper's words in the page.
    const words = screen.getByText('Keep what we send you secret.')
    expect(line.compareDocumentPosition(words) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    sign('Lena Park')
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({ token: 'tok-9', printedName: 'Lena Park', siteAddress: QUARRY })
  })

  it('shows nothing of a site when the box is off, and signs with no address', async () => {
    loaded = { ...PLAIN, site_address: null }
    open()
    await screen.findByText('Keep what we send you secret.')
    expect(screen.queryByTestId('contract-accept-site')).toBeNull()
    expect(document.body.textContent).not.toContain('Site address')
    sign('Lena Park')
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).not.toHaveProperty('siteAddress')
  })

  it('reads a function older than the box as before: no line, the paper, and a signature with no address', async () => {
    // PLAIN has no site_address key at all, as the function answered before part 3e.
    open()
    await screen.findByText('Keep what we send you secret.')
    expect(screen.queryByTestId('contract-accept-site')).toBeNull()
    expect(screen.getByTestId('contract-accept-says').textContent).toContain('Tallgrass Supply Co.')
    sign('Lena Park')
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).not.toHaveProperty('siteAddress')
  })

  it('takes only an address in words: a blank or a thing that is no word shows no line', async () => {
    loaded = { ...PLAIN, site_address: '   ' }
    open()
    await screen.findByText('Keep what we send you secret.')
    expect(screen.queryByTestId('contract-accept-site')).toBeNull()
    cleanup()

    loaded = { ...PLAIN, site_address: { address: QUARRY } }
    open()
    await screen.findByText('Keep what we send you secret.')
    expect(screen.queryByTestId('contract-accept-site')).toBeNull()
  })

  it('labels the line in the language a clause paper is read in', async () => {
    loaded = { ...PLAIN, signing_body_html: null, clause_paper: { revision: 2, en: PAPER_EN, es: PAPER_ES }, site_address: QUARRY }
    open()
    await screen.findByText('Keep it secret.')
    expect(screen.getByTestId('contract-accept-site').textContent).toBe(`Site address${QUARRY}`)
    fireEvent.click(screen.getByRole('button', { name: 'Español' }))
    expect(screen.getByTestId('contract-accept-site').textContent).toBe(`Dirección de la obra${QUARRY}`)
  })

  it('a signature the function turns back as a changed paper says so, and the page stays to be read again', async () => {
    loaded = { ...PLAIN, site_address: QUARRY }
    acceptReply = { status: 409, json: { error: 'The paper changed since you opened it. Reload to read the new version.', code: 'paper_changed' } }
    open()
    await screen.findByTestId('contract-accept-site')
    sign('Lena Park')
    expect(await screen.findByText('The paper changed since you opened it. Reload to read the new version.')).toBeTruthy()
    expect(screen.getByTestId('contract-accept-site')).toBeTruthy()
  })
})
