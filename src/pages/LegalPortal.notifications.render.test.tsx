// @vitest-environment jsdom
/** v2.4632 (punch list #85 item 26): a person whose emails are not going through carries the line on the firm's Notifications page. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

const company = { name: 'Click Plumbing and Electrical', cityLine: 'Kyle, TX', phone: '(512) 555-0100', email: 'office@example.com' }

async function openNotifications(failingSince: string | null, paused = false) {
  const payload = sampleLegalPortalResponse(company as never, new Date().toISOString().slice(0, 10)) as { recipients: Array<Record<string, unknown>> }
  payload.recipients = payload.recipients.map((r, i) => (i === 1 ? { ...r, confirmed: true, paused, failingSince } : r))
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }))))
  render(
    <MemoryRouter initialEntries={['/legal?t=sample']}>
      <LegalPortal />
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.getAllByText(/Sample Contracting/).length).toBeGreaterThan(0))
  fireEvent.click(screen.getByRole('button', { name: /^Notifications/ }))
  await waitFor(() => expect(document.body.textContent).toMatch(/Add a person at the firm/))
}

describe('LegalPortal — Notifications · a person not reaching', () => {
  it('shows the line against the person, with the day it began', async () => {
    await openNotifications('2026-10-05')
    const lines = document.querySelectorAll('[data-legal-not-reaching]')
    expect(lines).toHaveLength(1)
    expect(lines[0]?.textContent).toBe('Our emails to bo@samplepartner.example.com have not gone through since 2026-10-05. We try the digest again every five minutes for the rest of its day. If the address is wrong, press Stop emails to this person and add the right one.')
  })

  it('shows nothing while emails go through, or once the person is stopped', async () => {
    await openNotifications(null)
    expect(document.querySelector('[data-legal-not-reaching]')).toBeNull()
    cleanup()
    await openNotifications('2026-10-05', true)
    expect(document.querySelector('[data-legal-not-reaching]')).toBeNull()
  })
})
