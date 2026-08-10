// @vitest-environment jsdom
/**
 * Render tests for DevLogin pinning the fixed-identity contract: dev login
 * always signs in as DEV_LOGIN_EMAIL — the `?as=` value and the old email
 * input no longer pick the account.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import DevLogin, { DEV_LOGIN_EMAIL } from './DevLogin'
import { installDomShims } from '../test/renderSmokeMocks'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: {
      // No action_link in the response so the component never assigns
      // window.location.href (jsdom can't navigate).
      invoke: vi.fn(async () => ({ data: {}, error: null })),
    },
  },
}))

const invokeMock = vi.mocked(supabase.functions.invoke)

function renderAt(path: string) {
  installDomShims()
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DevLogin />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.stubEnv('VITE_DEV_LOGIN_SECRET', 'test-secret')
  invokeMock.mockClear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('DevLogin fixed identity', () => {
  it('shows the fixed account with no email input and submits as DEV_LOGIN_EMAIL', async () => {
    renderAt('/dev-login')
    expect(screen.getAllByText(DEV_LOGIN_EMAIL).length).toBeGreaterThan(0)
    expect(document.querySelector('input[type="email"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Dev Login' }))
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1))
    expect(invokeMock.mock.calls[0]?.[1]?.body).toMatchObject({ email: DEV_LOGIN_EMAIL })
  })

  it('auto-fires on ?as= but ignores its value — always signs in as DEV_LOGIN_EMAIL', async () => {
    renderAt('/dev-login?as=someone-else@example.com&to=/settings')
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1))
    const call = invokeMock.mock.calls[0]
    expect(call?.[0]).toBe('dev-login')
    expect(call?.[1]?.body).toMatchObject({ email: DEV_LOGIN_EMAIL })
    expect((call?.[1]?.body as { redirectTo: string }).redirectTo).toContain('/settings')
  })
})
