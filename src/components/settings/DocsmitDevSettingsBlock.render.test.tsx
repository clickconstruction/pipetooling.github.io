// @vitest-environment jsdom
/**
 * Render smokes for the Docsmit Developer block (the Docsmit train, PR 9): the status reads from
 * mail-config and never shows a hash; saving the connection sends the password as its SHA-512 only;
 * the switches read from app_settings with defaults and write back one row per key; Test the
 * connection shows the account's answer.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const state: { rows: Record<string, unknown>[]; upserts: unknown[]; invokes: Array<{ name: string; body: Record<string, unknown> }>; answers: Record<string, unknown> } = { rows: [], upserts: [], invokes: [], answers: {} }

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ in: () => Promise.resolve({ data: state.rows, error: null }) }),
      upsert: (rows: unknown) => {
        state.upserts.push(rows)
        return Promise.resolve({ error: null })
      },
    }),
    functions: {
      invoke: async (name: string, opts: { body: Record<string, unknown> }) => {
        state.invokes.push({ name, body: opts.body })
        return { data: state.answers[`${name}:${String(opts.body.action)}`] ?? { ok: false, error: 'no answer' }, error: null }
      },
    },
  },
}))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})

import DocsmitDevSettingsBlock from './DocsmitDevSettingsBlock'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const status = { ok: true, ready: true, set: { DOCSMIT_EMAIL: true, DOCSMIT_PASSWORD_SHA512: true, DOCSMIT_SOFTWARE_ID: true, DOCSMIT_BASE_URL: false }, source: { DOCSMIT_EMAIL: 'vault', DOCSMIT_PASSWORD_SHA512: 'vault', DOCSMIT_SOFTWARE_ID: 'env', DOCSMIT_BASE_URL: 'none' }, email: 'bids@clickplumbing.com', base_url: 'https://secure.tracksmit.com/api/v1', env: 'tracksmit' }

function openBlock() {
  state.invokes = []
  state.upserts = []
  renderWithProviders(<DocsmitDevSettingsBlock />)
  fireEvent.click(screen.getByTestId('docsmit-dev-toggle'))
}

describe('DocsmitDevSettingsBlock', () => {
  it('reads the status and the switches on open; the status names what is set and never a value', async () => {
    state.answers = { 'mail-config:status': status }
    state.rows = [{ key: 'docsmit_paused', value_text: 'true' }, { key: 'docsmit_cutoff_local', value_text: '14:30' }]
    openBlock()
    await waitFor(() => expect(screen.getByTestId('docsmit-status').textContent).toBe('Ready: email set (vault), password set (vault), software id set (env) · Tracksmit, the sandbox · bids@clickplumbing.com'))
    expect((screen.getByTestId('docsmit-email') as HTMLInputElement).value).toBe('bids@clickplumbing.com')
    expect((screen.getByTestId('docsmit-paused') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByTestId('docsmit-cutoff') as HTMLInputElement).value).toBe('14:30')
    expect((screen.getByTestId('docsmit-buffer') as HTMLInputElement).value).toBe('1')
  })

  it('saves the connection with the password as its SHA-512 only, and the switches as one row per key', async () => {
    state.answers = { 'mail-config:status': status, 'mail-config:set': status }
    state.rows = []
    openBlock()
    await waitFor(() => expect(screen.getByTestId('docsmit-save-switches')).toBeTruthy())
    fireEvent.change(screen.getByTestId('docsmit-password'), { target: { value: 'abc' } })
    fireEvent.change(screen.getByTestId('docsmit-software-id'), { target: { value: 'soft-9' } })
    fireEvent.click(screen.getByTestId('docsmit-save-secrets'))
    await waitFor(() => expect(state.invokes.some((i) => i.body.action === 'set')).toBe(true))
    const set = state.invokes.find((i) => i.body.action === 'set')!.body
    expect(set).toEqual({ action: 'set', email: 'bids@clickplumbing.com', software_id: 'soft-9', base_url: 'https://secure.tracksmit.com/api/v1', password_sha512: 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f' })
    expect(JSON.stringify(state.invokes)).not.toContain('"abc"')

    fireEvent.click(screen.getByTestId('docsmit-paused'))
    fireEvent.change(screen.getByTestId('docsmit-return-receipt'), { target: { value: 'card' } })
    fireEvent.click(screen.getByTestId('docsmit-save-switches'))
    await waitFor(() => expect(state.upserts).toHaveLength(1))
    const rows = state.upserts[0] as Array<{ key: string; value_text: string }>
    expect(rows).toHaveLength(11)
    expect(rows.find((r) => r.key === 'docsmit_paused')!.value_text).toBe('true')
    expect(rows.find((r) => r.key === 'docsmit_return_receipt')!.value_text).toBe('card')
  })

  it('Test the connection shows the account’s answer; Poll now shows what the read-back did', async () => {
    state.answers = { 'mail-config:status': status, 'mail-config:ping': { ok: true, env: 'tracksmit', account: { name: 'Click Plumbing', credit_balance: 42.5 } }, 'mail-send-docsmit:refresh': { ok: true, read: 3, updated: ['p1'], errors: [] } }
    state.rows = []
    openBlock()
    await waitFor(() => expect(screen.getByTestId('docsmit-poll-now')).toBeTruthy())
    fireEvent.click(screen.getByTestId('docsmit-test'))
    await waitFor(() => expect(screen.getByTestId('docsmit-test-words').textContent).toBe('Docsmit answered for Click Plumbing: balance $42.50 · Tracksmit.'))
    fireEvent.click(screen.getByTestId('docsmit-poll-now'))
    await waitFor(() => expect(screen.getByTestId('docsmit-poll-words').textContent).toBe('Read 3 open pieces: 1 changed.'))
  })
})
