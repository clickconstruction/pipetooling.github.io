// @vitest-environment jsdom
/** Punch list #85, item 7: the firm's page never shows a raw server error; the words written for the firm still show. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LegalPortal from './LegalPortal'
import { LEGAL_PORTAL_GENERIC_ERROR } from '../lib/legal/legalPortalErrors'

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
  })
})
