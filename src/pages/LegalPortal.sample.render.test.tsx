// @vitest-environment jsdom
/** v2.3639: the firm portal draws the sample matter `legal-portal` answers the sample token with. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { sampleLegalPortalResponse } from '../../supabase/functions/_shared/customerSampleFixtures'
import LegalPortal from './LegalPortal'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('LegalPortal — the sample matter', () => {
  it('lists Sample Contracting with its open balance', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const payload = sampleLegalPortalResponse({ name: 'Click Plumbing and Electrical', cityLine: 'Kyle, TX', phone: '(512) 555-0100', email: 'office@example.com' } as never, today)
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }))))
    render(
      <MemoryRouter initialEntries={['/legal?t=sample']}>
        <LegalPortal />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getAllByText(/Sample Contracting/).length).toBeGreaterThan(0))
    expect(document.body.textContent).toMatch(/14,400/)
    expect(document.body.textContent).not.toMatch(/NaN|undefined/)
  })
})
