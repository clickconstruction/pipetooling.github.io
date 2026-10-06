// @vitest-environment jsdom
/** Punch list #85, item 22: the quiet ten-minute reload marks itself and never swaps the page for the error card. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { sampleLegalPortalResponse } from '../../supabase/functions/_shared/customerSampleFixtures'
import { PORTAL_QUIET_RELOAD_FAILED } from '../lib/legal/legalPortalFreshness'
import LegalPortal from './LegalPortal'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('LegalPortal — the quiet reload', () => {
  it('sends refresh=1, and a failure keeps the page and says so on the notice line', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const payload = sampleLegalPortalResponse({ name: 'Acme Mechanical', cityLine: 'Kyle, TX', licenseLine: '', phone: '(512) 555-0100', email: 'office@example.com' } as never, today)
    const fetchSpy = vi.fn((url: string) =>
      url.includes('refresh=1') ? Promise.reject(new Error('offline')) : Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    )
    vi.stubGlobal('fetch', fetchSpy)
    render(
      <MemoryRouter initialEntries={['/legal?t=tok_live']}>
        <LegalPortal />
      </MemoryRouter>,
    )
    const payer = (payload as { matters: Array<{ payer: { name: string } }> }).matters[0]!.payer.name
    await waitFor(() => expect(screen.getAllByText(payer).length).toBeGreaterThan(0))
    expect(fetchSpy.mock.calls[0]?.[0]).not.toMatch(/refresh=1/)

    // Eleven minutes later the tab is focused: the page reloads quietly, and the reload fails.
    const later = Date.now() + 11 * 60 * 1000
    vi.spyOn(Date, 'now').mockReturnValue(later)
    window.dispatchEvent(new Event('focus'))
    await waitFor(() => expect(fetchSpy.mock.calls.some((c) => String(c[0]).includes('refresh=1'))).toBe(true))
    await waitFor(() => expect(document.body.textContent).toContain(PORTAL_QUIET_RELOAD_FAILED))
    expect(screen.getAllByText(payer).length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/We couldn’t open this page/)
  })
})
