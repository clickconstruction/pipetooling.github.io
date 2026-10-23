// @vitest-environment jsdom
/**
 * Render smokes for LienSignCodeCard (v2.5788): the status comes from the RPC, never a table;
 * setting the code calls `set_lien_sign_code` with the digits once the two fields agree; a
 * missing RPC (client ahead of the migration) reads as "not switched on yet", not an error.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const state: { calls: Array<{ fn: string; args: Record<string, unknown> }>; status: Record<string, unknown>; rpcError: { message: string } | null } = { calls: [], status: { set: false }, rpcError: null }

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      state.calls.push({ fn, args })
      if (state.rpcError) return Promise.resolve({ data: null, error: state.rpcError })
      if (fn === 'lien_sign_code_status') return Promise.resolve({ data: state.status, error: null })
      return Promise.resolve({ data: null, error: null })
    },
  },
}))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import LienSignCodeCard from './LienSignCodeCard'
import { renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'

describe('LienSignCodeCard', () => {
  it('asks the RPC for the signed-in user’s status and sets the code once both fields agree', async () => {
    state.calls = []
    state.rpcError = null
    state.status = { set: false }
    renderWithProviders(<LienSignCodeCard />)
    await waitFor(() => expect(screen.getByText('No code yet.')).toBeTruthy())
    expect(state.calls[0]).toEqual({ fn: 'lien_sign_code_status', args: { p_user_id: SMOKE_AUTH_USER_ID } })

    const btn = screen.getByRole('button', { name: 'Set the code' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Your code'), { target: { value: '12a4' } })
    expect((screen.getByLabelText('Your code') as HTMLInputElement).value).toBe('124')
    fireEvent.change(screen.getByLabelText('Your code'), { target: { value: '2468' } })
    fireEvent.change(screen.getByLabelText('Type it again'), { target: { value: '2469' } })
    expect(screen.getByText('The two codes differ.')).toBeTruthy()
    expect(btn.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Type it again'), { target: { value: '2468' } })
    expect(btn.disabled).toBe(false)

    state.status = { set: true, set_at: '2026-10-23T19:00:00Z', last_used_at: null, locked_until: null }
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByText(/^Set October 23, 2026/)).toBeTruthy())
    expect(state.calls.find((c) => c.fn === 'set_lien_sign_code')?.args).toEqual({ p_code: '2468' })
    expect(screen.getByRole('button', { name: 'Change the code' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove the code' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'How do I sign a lien notice?' }).getAttribute('href')).toBe('/help?g=send-lien-notices-from-the-lien-desk')
  })

  it('says it is not switched on when the RPC is not there yet', async () => {
    state.calls = []
    state.rpcError = { message: 'Could not find the function public.lien_sign_code_status(p_user_id) in the schema cache' }
    renderWithProviders(<LienSignCodeCard />)
    await waitFor(() => expect(screen.getByText(/Not switched on yet/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Set the code' })).toBeNull()
  })
})
