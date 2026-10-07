// @vitest-environment jsdom
/** Punch list #85, item 22: the office previews the firm's portal by firm id, signed in, without the firm's key. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LegalPortal from './LegalPortal'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('LegalPortal — the office preview by firm', () => {
  it('asks the function by firm id with the preview flag and says nothing here is saved', async () => {
    const payload = { company: { name: 'Click Plumbing and Electrical' }, preparedOn: '2026-10-05', firm: { id: 'firm-1', name: 'Sample & Partner, PLLC' }, particulars: {}, recipients: [], firmPaused: false, matters: [], lienBook: null }
    const fetchSpy = vi.fn((_url: string) => Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    vi.stubGlobal('fetch', fetchSpy)
    render(
      <MemoryRouter initialEntries={['/legal?firm=firm-1&preview=1']}>
        <LegalPortal />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getAllByText(/Sample & Partner, PLLC/).length).toBeGreaterThan(0))
    expect(String(fetchSpy.mock.calls[0]?.[0])).toMatch(/legal-portal\?firm=firm-1&preview=1$/)
    expect(document.querySelector('[data-legal-office-preview]')?.textContent).toMatch(/Nothing you do here is saved/)
    expect(document.body.textContent).not.toMatch(/missing its key/)
  })
})
