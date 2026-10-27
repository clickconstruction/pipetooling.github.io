// @vitest-environment jsdom
/**
 * The sign page for a paper built from clauses (Messages, cut 4c, v2.5294): Greg reads the master agreement as its clauses,
 * the Sitework exhibit and the version line, in English or Spanish, with the paper's own body folded under *The full
 * agreement*; signing sends the revision he read and the language; a paper that moved on since is refused in the
 * page's own words for the answer's code (v2.5965). A paper not built from clauses reads its body as before.
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

const PAPER_EN = {
  paperId: 'doc-msa',
  revision: 3,
  lang: 'en',
  clauses: [{ id: 'msa-1', v: 2, n: 1, text: 'Term: one year from signing.' }],
  exhibit: [{ id: 'msa-6', v: 1, n: 2, text: 'Utilities: a locate before any dig.' }],
  exhibitFor: ['Sitework'],
  between: 'Click Construction and Hillside Excavation',
}
const PAPER_ES = { ...PAPER_EN, lang: 'es', clauses: [{ id: 'msa-1', v: 2, n: 1, text: 'Plazo: un año desde la firma.' }], between: 'Click Construction y Hillside Excavation' }
const LOADED = {
  id: 'pcd-1',
  person_name: 'Hillside Excavation',
  document_name: 'Master services agreement',
  signing_body_html: '<p>The standard terms.</p>',
  signing_body_format: 'html',
  canonical_document_url: null,
  form: null,
  clause_paper: { revision: 3, en: PAPER_EN, es: PAPER_ES },
}

const posts: Record<string, unknown>[] = []
let acceptReply: { status: number; json: Record<string, unknown> } = { status: 200, json: { ok: true, documentId: 'pcd-1' } }
let loaded: Record<string, unknown> = LOADED

beforeEach(() => {
  posts.length = 0
  acceptReply = { status: 200, json: { ok: true, documentId: 'pcd-1' } }
  loaded = LOADED
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
        <MemoryRouter initialEntries={['/contract/accept?t=tok-1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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

describe('ContractAccept · a paper built from clauses', () => {
  it('reads as its clauses, the exhibit and the version line, with the body folded', async () => {
    open()
    await waitFor(() => expect(screen.getByText('Term: one year from signing.')).toBeTruthy())
    expect(screen.getByText('Between Click Construction and Hillside Excavation.')).toBeTruthy()
    expect(screen.getByText('Exhibit for Sitework')).toBeTruthy()
    expect(screen.getByText('Version 3, with the Sitework exhibit.')).toBeTruthy()
    expect(screen.getByText('The full agreement')).toBeTruthy()
  })

  it('reads in Spanish with the Spanish sign words, and signs in Spanish at the revision read', async () => {
    open()
    await waitFor(() => expect(screen.getByText('Term: one year from signing.')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Español' }))
    expect(screen.getByText('Plazo: un año desde la firma.')).toBeTruthy()
    expect(screen.getByText('Entre Click Construction y Hillside Excavation.')).toBeTruthy()
    expect(screen.getByText('Versión 3, con el anexo de Sitework.')).toBeTruthy()
    expect(screen.getByText('El acuerdo completo')).toBeTruthy()
    sign('Greg Paulk', 'Enviar la firma')
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({ token: 'tok-1', printedName: 'Greg Paulk', paperRevision: 3, paperLang: 'es' })
  })

  it('sends the revision it showed, in English', async () => {
    open()
    await waitFor(() => expect(screen.getByText('Term: one year from signing.')).toBeTruthy())
    sign('Greg Paulk')
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({ paperRevision: 3, paperLang: 'en' })
  })

  it('a paper that moved on since it was opened reads the page’s own words by the answer’s code, in the language read (v2.5965)', async () => {
    acceptReply = { status: 409, json: { error: 'any words the function sends', code: 'paper_changed' } }
    open()
    await waitFor(() => expect(screen.getByText('Term: one year from signing.')).toBeTruthy())
    sign('Greg Paulk')
    await waitFor(() => expect(screen.getByText('The paper changed since you opened it. Reload to read the new version.')).toBeTruthy())
    expect(screen.queryByText('any words the function sends')).toBeNull()
    cleanup()
    open()
    await waitFor(() => expect(screen.getByText('Term: one year from signing.')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Español' }))
    sign('Greg Paulk', 'Enviar la firma')
    await waitFor(() => expect(screen.getByText('El documento cambió desde que lo abrió. Vuelva a cargar la página para leer la versión nueva.')).toBeTruthy())
  })

  it('a refusal with no code reads the class in the language read, never the function’s words (v2.5965)', async () => {
    acceptReply = { status: 500, json: { error: 'Could not store signature' } }
    open()
    await waitFor(() => expect(screen.getByText('Term: one year from signing.')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Español' }))
    sign('Greg Paulk', 'Enviar la firma')
    await waitFor(() => expect(screen.getByText('No pudimos registrar eso. Intente de nuevo más tarde.')).toBeTruthy())
    expect(screen.queryByText('Could not store signature')).toBeNull()
  })

  it('a lost signal on the load reads No connection with Try again, which opens the paper (v2.5965)', async () => {
    let offline = true
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('get-contract-for-signer')) {
          if (offline) throw new TypeError('Failed to fetch')
          return new Response(JSON.stringify(loaded), { status: 200 })
        }
        return new Response(JSON.stringify(acceptReply.json), { status: acceptReply.status })
      }),
    )
    open()
    await waitFor(() => expect(screen.getByText('No connection. Check your signal and try again.')).toBeTruthy())
    offline = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByText('Term: one year from signing.')).toBeTruthy())
  })

  it('reads a paper not built from clauses as its body, and sends no revision', async () => {
    loaded = { ...LOADED, clause_paper: null }
    open()
    await waitFor(() => expect(screen.getByText('The standard terms.')).toBeTruthy())
    expect(screen.queryByText('The full agreement')).toBeNull()
    sign('Greg Paulk')
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).not.toHaveProperty('paperRevision')
  })
})
