// @vitest-environment jsdom
/**
 * Punch list #319 PR 5: an estimate started from the customer's own photos says so on their page, with the line that
 * the tech confirms the price at the home. An estimate started any other way reads as it always has.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { installDomShims } from '../test/renderSmokeMocks'
import EstimateAccept from './EstimateAccept'

const line = (description: string, cents: number) => ({ line_item: '', description, quantity: 1, unit_price_cents: cents, amount_cents: cents })
const ESTIMATE = { id: 'est-1', title: 'Kitchen faucet', line_items_snapshot: [line('Faucet', 48000)], terms_snapshot: 'Net 15.', total_cents: 48000, valid_until: null }
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response
const WORDS = 'Priced from your photos. The tech confirms the price at your home before any work starts.'

function mount() {
  return render(
    <MemoryRouter initialEntries={['/estimate?t=tok-1']}>
      <EstimateAccept />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  installDomShims()
  vi.stubGlobal('scrollTo', vi.fn())
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('an estimate priced from the customer’s photos (punch list #319 PR 5)', () => {
  it('says so, and that the tech confirms the price at the home', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ ...ESTIMATE, priced_from_photos: true })))
    mount()
    expect(await screen.findByText('Kitchen faucet')).toBeTruthy()
    expect(screen.getByText(WORDS)).toBeTruthy()
  })

  it('an estimate started any other way does not', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok(ESTIMATE)))
    mount()
    expect(await screen.findByText('Kitchen faucet')).toBeTruthy()
    expect(screen.queryByText(WORDS)).toBeNull()
  })
})
