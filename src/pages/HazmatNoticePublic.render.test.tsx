// @vitest-environment jsdom
/**
 * The public fee notice when it cannot load (punch list #184, v2.5965): a lost signal reads No connection with Try
 * again, which reads the notice; a token that matches no notice is a gone link; never *check your connection*
 * whatever failed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }))

import HazmatNoticePublic from './HazmatNoticePublic'

const TOKEN = '0b7e1c9a-4f2d-4c51-9a1e-6d2f8b3c7e10'
const NOTICE = { incident_at: '2026-10-01T15:00:00Z', description: 'Sewage in the crawlspace.', exposed_people: 'Two plumbers', fee_amount: 350, job_number: '1482', job_name: 'Lago Vista', job_address: '1 Test St', customer_name: 'Pat Customer', testimonials: [], photo_links: [] }

function mount() {
  return render(
    <MemoryRouter initialEntries={[`/hazmat-notice?token=${TOKEN}`]}>
      <HazmatNoticePublic />
    </MemoryRouter>,
  )
}

beforeEach(() => rpc.mockReset())
afterEach(() => cleanup())

describe('HazmatNoticePublic failures (v2.5965)', () => {
  it('a lost signal reads No connection with Try again, which reads the notice', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' } }).mockResolvedValue({ data: NOTICE, error: null })
    mount()
    expect(await screen.findByText('No connection. Check your signal and try again.')).toBeTruthy()
    expect(screen.queryByText(/Check your connection/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByTitle('Biohazard Remediation Fee Notice')).toBeTruthy())
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it('a token that matches no notice reads as a gone link, with no Try again', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    mount()
    expect(await screen.findByText('This link is no longer active. Please call the office for a new one.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })
})
