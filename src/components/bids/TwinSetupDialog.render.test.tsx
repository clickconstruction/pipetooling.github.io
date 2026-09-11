// @vitest-environment jsdom
/**
 * Render smokes for TwinSetupDialog (Price Matrix PR 6, "Set up on this Mac"):
 * the label face mints a setup code through twin-setup and turns into the
 * command face with the code inside and the key nowhere; a refused mint shows
 * the server's words.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { TwinSetupDialog } from './TwinSetupDialog'

const state: { bodies: Record<string, unknown>[]; reply: { data: unknown; error: { message: string } | null } } = {
  bodies: [],
  reply: {
    data: {
      code: 'K7Q2-M9XD-4T',
      expires_at: new Date(Date.now() + 600_000).toISOString(),
      twin_email: 'twin-pricer-1@twins.pipetooling.local',
      twin_kind: 'pricer',
      label: "Wendi's MacBook",
      setup_url: 'https://abc.supabase.co/functions/v1/twin-setup',
      connector_url: 'https://abc.supabase.co/functions/v1/twin-mcp',
    },
    error: null,
  },
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (_name: string, opts: { body: Record<string, unknown> }) => {
        state.bodies.push(opts.body)
        return Promise.resolve(state.reply)
      },
    },
  },
}))

describe('TwinSetupDialog', () => {
  it('mints a code for the pricing twin and shows the command with the code inside and no key', async () => {
    renderWithProviders(<TwinSetupDialog open onClose={() => {}} target={{ kind: 'pricer' }} />)
    expect(screen.getByText('Set up the pricing robot on this Mac')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText("e.g. Wendi's MacBook"), { target: { value: "Wendi's MacBook" } })
    fireEvent.click(screen.getByText('Make my setup command'))
    await waitFor(() => expect(screen.getByText('Copy the command')).toBeTruthy())
    expect(state.bodies[0]).toEqual({ action: 'mint', label: "Wendi's MacBook", kind: 'pricer' })
    const pre = screen.getByTestId('twin-setup-command').textContent ?? ''
    expect(pre).toContain('SETUP_CODE="K7Q2-M9XD-4T"')
    expect(pre).toContain('TWIN_SETUP_URL="https://abc.supabase.co/functions/v1/twin-setup"')
    expect(pre).not.toMatch(/[0-9a-f]{32,}/)
    expect(screen.getByText(/one-time code for twin-pricer-1@twins.pipetooling.local/)).toBeTruthy()
    expect(screen.getByText(/prices every queued request/)).toBeTruthy()
  })

  it('addresses a named twin by id and shows the server’s refusal', async () => {
    state.bodies = []
    state.reply = { data: null, error: { message: 'Only a dev can set up a bid robot; the pricing robot is open to estimating staff.' } }
    renderWithProviders(<TwinSetupDialog open onClose={() => {}} target={{ twinUserId: 'u-est-1', twinEmail: 'twin-estimator-1@twins.pipetooling.local', kind: 'estimator' }} />)
    expect(screen.getByText('Set up twin-estimator-1@twins.pipetooling.local on this Mac')).toBeTruthy()
    fireEvent.click(screen.getByText('Make my setup command'))
    await waitFor(() => expect(screen.getByText(/Only a dev can set up a bid robot/)).toBeTruthy())
    expect(state.bodies[0]).toEqual({ action: 'mint', label: '', twin_user_id: 'u-est-1' })
    expect(screen.queryByText('Copy the command')).toBeNull()
  })
})
