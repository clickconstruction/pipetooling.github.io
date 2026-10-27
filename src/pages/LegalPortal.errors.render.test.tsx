// @vitest-environment jsdom
/** Punch list #85, item 7: the firm's page never shows a raw server error; the words written for the firm still show. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LegalPortal from './LegalPortal'
import { LEGAL_PORTAL_GENERIC_ERROR } from '../lib/legal/legalPortalErrors'
import { sampleLegalPortalResponse } from '../../supabase/functions/_shared/customerSampleFixtures'
import { START_SEEN_KEY } from '../lib/legal/legalPortalStart'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function answer(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))))
  render(
    <MemoryRouter initialEntries={['/legal?t=abcdefghijklmnopqrstuvwxyz012345']}>
      <LegalPortal />
    </MemoryRouter>,
  )
}

describe('LegalPortal — error words', () => {
  it('shows the generic sentence, not the database error, on a 500', async () => {
    answer(500, { error: 'column jobs_ledger.lien_retainage_held does not exist', ref: 'AB12CD34' })
    await waitFor(() => expect(screen.getByText(`${LEGAL_PORTAL_GENERIC_ERROR} Reference AB12CD34.`)).toBeTruthy())
    expect(document.body.textContent).not.toMatch(/jobs_ledger|column/)
  })

  it('keeps the inactive-link sentence written for the firm on a 404', async () => {
    answer(404, { error: 'This link is no longer active. Please contact the office for a new one.' })
    await waitFor(() => expect(screen.getByText('This link is no longer active. Please contact the office for a new one.')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('a lost signal says No connection, not check your connection whatever failed, and Try again opens the portal (v2.5965)', async () => {
    window.localStorage.setItem(START_SEEN_KEY, 'yes')
    const payload = sampleLegalPortalResponse({ name: 'Acme Mechanical', cityLine: 'Kyle, TX', licenseLine: '', phone: '(512) 555-0100', email: 'office@example.com' } as never, new Date().toISOString().slice(0, 10))
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    vi.stubGlobal('fetch', fetchMock)
    render(
      <MemoryRouter initialEntries={['/legal?t=abcdefghijklmnopqrstuvwxyz012345']}>
        <LegalPortal />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText('No connection. Check your signal and try again.')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    const payer = (payload as { matters: Array<{ payer: { name: string } }> }).matters[0]!.payer.name
    await waitFor(() => expect(screen.getAllByText(payer).length).toBeGreaterThan(0))
    expect(document.body.textContent).not.toMatch(/We couldn’t open this page/)
    window.localStorage.removeItem(START_SEEN_KEY)
  })

  it('a page that throws for any other reason is a refusal with Try again, never the connection (v2.5965)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new SyntaxError('Unexpected token < in JSON at position 0'))))
    render(
      <MemoryRouter initialEntries={['/legal?t=abcdefghijklmnopqrstuvwxyz012345']}>
        <LegalPortal />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText('Please try again later.')).toBeTruthy())
    expect(document.body.textContent).not.toMatch(/connection/)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })
})
