// @vitest-environment jsdom
/**
 * Dev login signs in once per URL (v2.4993). React's StrictMode runs effects twice on the dev
 * server; two `dev-login` calls minted two magic links, the newer cancelled the older, and the
 * older one's verify answered 403 in the console of every dev-login. The page runs here under
 * StrictMode with the function and the verify stood in for.
 */
import { StrictMode } from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  invokes: [] as Array<{ name: string; body: unknown }>,
  verifies: [] as unknown[],
  links: 0,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (name: string, opts: { body: unknown }) => {
        h.invokes.push({ name, body: opts.body })
        h.links += 1
        return Promise.resolve({ data: { action_link: `https://example.supabase.co/auth/v1/verify?token=hash-${h.links}` }, error: null })
      },
    },
    auth: {
      verifyOtp: (args: unknown) => {
        h.verifies.push(args)
        return Promise.resolve({ error: null })
      },
    },
  },
}))

import DevLogin from './DevLogin'

const originalLocation = window.location
const assign = vi.fn()

beforeEach(() => {
  h.invokes = []
  h.verifies = []
  h.links = 0
  assign.mockReset()
  vi.stubEnv('VITE_DEV_LOGIN_SECRET', 'test-secret')
  Object.defineProperty(window, 'location', { value: { ...originalLocation, origin: 'http://localhost:5184', assign }, writable: true })
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
})

function mount(url: string) {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/dev-login" element={<DevLogin />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  )
}

describe('DevLogin under StrictMode', () => {
  it('asks the dev-login function once, verifies its one link, and goes where `to` says', async () => {
    mount('/dev-login?as=1&to=/bids')
    await waitFor(() => expect(assign).toHaveBeenCalledWith('http://localhost:5184/bids'))
    expect(h.invokes).toHaveLength(1)
    expect(h.invokes[0]).toMatchObject({ name: 'dev-login', body: { email: 'robert@douglasmining.com', redirectTo: 'http://localhost:5184/bids' } })
    expect(h.verifies).toEqual([{ type: 'magiclink', token_hash: 'hash-1' }])
    expect(assign).toHaveBeenCalledTimes(1)
  })
})
