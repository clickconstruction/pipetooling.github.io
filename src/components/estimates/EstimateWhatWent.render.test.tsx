// @vitest-environment jsdom
/**
 * What went (v2.5683, punch list #133 PR 2) over a fake read: the email and the text with Open the thread; the
 * why-not when no text carried the link; a thread read that fails still shows the email.
 */
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { EstimateWhatWent } from './EstimateWhatWent'
import type { WhatWentRead } from '../../lib/estimates/whatWentIo'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const READ: WhatWentRead = {
  texts: [{ id: 'm1', atMs: Date.parse('2026-10-20T18:33:00Z'), to: '(830) 555-0121' }],
  contact: { contactId: 'contact-dana', hasPhone: true, stopped: false },
}

const mount = (read: Promise<WhatWentRead>) =>
  renderWithProviders(
    <EstimateWhatWent customerId="cust-dana" customerName="Dana Whitfield" email="dana@example.com" sentAt="2026-10-20T18:31:00Z" tokenHash="ba7816bf" io={vi.fn(() => read)} />,
  )

describe('EstimateWhatWent', { timeout: 15_000 }, () => {
  it('reads the email with its time and the text with Open the thread', async () => {
    mount(Promise.resolve(READ))
    const rows = await screen.findAllByTestId('what-went-row')
    expect(rows.map((r) => r.textContent)).toEqual([
      '📧Emailed to dana@example.comTue, Oct 20 at 1:31 PM',
      '💬Texted the link to (830) 555-0121 · Open the threadTue, Oct 20 at 1:33 PM',
    ])
    expect((screen.getByTestId('what-went-thread') as HTMLAnchorElement).getAttribute('href')).toBe('/messages?thread=contact-dana')
  })
  it('says why when no text carried the link', async () => {
    mount(Promise.resolve({ ...READ, texts: [], contact: { ...READ.contact!, stopped: true } }))
    expect((await screen.findByTestId('what-went-hold')).textContent).toContain('No text went. Their number sent STOP.')
  })
  it('a thread read that fails still shows the email', async () => {
    mount(Promise.reject(new Error('down')))
    const rows = await screen.findAllByTestId('what-went-row')
    expect(rows[0]?.textContent).toContain('Emailed to dana@example.com')
    expect(screen.getByTestId('what-went-hold').textContent).toContain('no phone number on file')
    expect(screen.queryByTestId('what-went-thread')).toBeNull()
  })
})
