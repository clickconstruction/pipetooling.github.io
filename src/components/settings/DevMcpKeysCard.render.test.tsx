// @vitest-environment jsdom
/**
 * Render smokes for DevMcpKeysCard (v2.3640; Copy since v2.5899): issuing goes through
 * dev_mcp_issue_key with the key and the dev's label — never an insert — and shows the key;
 * while the function is missing (client ahead of the migration) the old hash-only insert
 * runs and the key is shown once; Copy on a kept key asks, calls dev_mcp_reveal_key, puts the
 * key on the clipboard and shows it; a key with no secret says it cannot be copied; a missing
 * secret_id column retries the read without it; a missing table reads as "not switched on yet".
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

type Row = Record<string, unknown>
const state: {
  inserts: Row[]
  rows: Row[]
  calls: Row[]
  rpcCalls: { fn: string; args: Record<string, unknown> }[]
  rpcMissing: boolean
  revealKey: string
  loadError: { message: string; code?: string } | null
  noSecretColumn: boolean
  selectsSeen: string[]
} = { inserts: [], rows: [], calls: [], rpcCalls: [], rpcMissing: false, revealKey: '', loadError: null, noSecretColumn: false, selectsSeen: [] }

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'dev_mcp_calls') {
        return { select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: state.calls, error: null }) }) }) }) }) }
      }
      return {
        select: (cols: string) => {
          state.selectsSeen.push(cols)
          const error = state.loadError ?? (state.noSecretColumn && cols.includes('secret_id') ? { message: 'column dev_mcp_credentials.secret_id does not exist', code: '42703' } : null)
          return { eq: () => ({ order: () => Promise.resolve({ data: error ? null : state.rows, error }) }) }
        },
        insert: (v: Row) => {
          state.inserts.push(v)
          return Promise.resolve({ error: null })
        },
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }
    },
    rpc: (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args })
      if (state.rpcMissing) return Promise.resolve({ data: null, error: { message: `Could not find the function public.${fn} in the schema cache`, code: 'PGRST202' } })
      if (fn === 'dev_mcp_issue_key') return Promise.resolve({ data: 'new-row-id', error: null })
      if (fn === 'dev_mcp_reveal_key') return Promise.resolve({ data: state.revealKey, error: null })
      return Promise.resolve({ data: null, error: { message: `unexpected rpc ${fn}` } })
    },
  },
}))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import DevMcpKeysCard from './DevMcpKeysCard'
import { renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'

const KEPT_KEY = `ptd_${'a'.repeat(64)}`
const writeText = vi.fn(async () => {})

beforeEach(() => {
  state.inserts = []
  state.rows = []
  state.calls = []
  state.rpcCalls = []
  state.rpcMissing = false
  state.revealKey = ''
  state.loadError = null
  state.noSecretColumn = false
  state.selectsSeen = []
  writeText.mockClear()
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

describe('DevMcpKeysCard', () => {
  it('issues a key through dev_mcp_issue_key: the key and the label go to the function, never an insert, and the key is shown', async () => {
    state.rows = [{ id: 'k1', label: 'Old laptop', created_at: new Date().toISOString(), last_used_at: null, revoked_at: null, secret_id: null }]
    renderWithProviders(<DevMcpKeysCard />)
    await waitFor(() => expect(screen.getByText('Old laptop')).toBeTruthy())

    fireEvent.change(screen.getByLabelText('Key label'), { target: { value: "Robert's MacBook" } })
    fireEvent.click(screen.getByText('Issue a key'))
    await waitFor(() => expect(screen.getByText('Your new key')).toBeTruthy())

    expect(state.inserts).toHaveLength(0)
    const issue = state.rpcCalls.filter((c) => c.fn === 'dev_mcp_issue_key')
    expect(issue).toHaveLength(1)
    expect(String(issue[0]?.args.p_token)).toMatch(/^ptd_[0-9a-f]{64}$/)
    expect(issue[0]?.args.p_label).toBe("Robert's MacBook")
    // v2.3686: the panel walks a non-technical person through both ways to use it
    expect(screen.getByText(/^ptd_[0-9a-f]{64}$/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy setup command' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy header value' })).toBeTruthy()
    const panel = screen.getByText('Your new key').parentElement as HTMLElement
    expect(panel.textContent).toContain('Terminal')
    expect(panel.textContent).toContain('Add custom connector')
    // v2.5899: a kept key can be copied again, and the panel says so
    expect(panel.textContent).toContain('copy it again from this card')
    expect(panel.textContent).not.toContain('shown ONCE')
    expect(screen.getByRole('link', { name: 'How do I connect Claude with it?' }).getAttribute('href')).toBe('/help?g=connect-a-coding-agent')
  })

  it('falls back to the hash-only insert while the function is missing, and shows that key once', async () => {
    state.rpcMissing = true
    renderWithProviders(<DevMcpKeysCard />)
    await waitFor(() => expect(screen.getByText('No live keys.')).toBeTruthy())

    fireEvent.click(screen.getByText('Issue a key'))
    await waitFor(() => expect(screen.getByText('Your new key — shown ONCE')).toBeTruthy())

    expect(state.inserts).toHaveLength(1)
    const row = state.inserts[0] ?? {}
    expect(row.user_id).toBe(SMOKE_AUTH_USER_ID)
    expect(row.label).toBe('unlabeled')
    expect(String(row.token_hash)).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(row)).not.toContain('ptd_')
    const panel = screen.getByText('Your new key — shown ONCE').parentElement as HTMLElement
    expect(panel.textContent).toContain('Lose it, and you issue another')
  })

  it('Copy on a kept key asks, reveals through dev_mcp_reveal_key, puts the key on the clipboard and shows it; a key with no secret cannot be copied', async () => {
    state.revealKey = KEPT_KEY
    const now = new Date().toISOString()
    state.rows = [
      { id: 'k1', label: 'Kept laptop', created_at: now, last_used_at: null, revoked_at: null, secret_id: 'vault-1' },
      { id: 'k0', label: 'Old laptop', created_at: now, last_used_at: null, revoked_at: null, secret_id: null },
    ]
    state.calls = [{ credential_id: 'k1', created_at: now }]
    renderWithProviders(<DevMcpKeysCard />)
    await waitFor(() => expect(screen.getByText('Kept laptop')).toBeTruthy())

    // One Copy, on the kept key; the old key says why it has none; the log shows on the row.
    expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(1)
    expect(screen.getByText('cannot be copied')).toBeTruthy()
    expect((screen.getByText('Kept laptop').parentElement as HTMLElement).textContent).toContain('copied ')

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Copy "Kept laptop"?' })
    expect(dialog.textContent).toContain('logged with your name')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy' }))

    await waitFor(() => expect(screen.getByText('Your key for "Kept laptop"')).toBeTruthy())
    const reveal = state.rpcCalls.filter((c) => c.fn === 'dev_mcp_reveal_key')
    expect(reveal).toHaveLength(1)
    expect(reveal[0]?.args.p_credential_id).toBe('k1')
    expect(writeText).toHaveBeenCalledWith(KEPT_KEY)
    expect(screen.getByText(KEPT_KEY)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy setup command' })).toBeTruthy()
  })

  it('selects the text when the page has no clipboard', async () => {
    state.revealKey = KEPT_KEY
    state.rows = [{ id: 'k1', label: 'Kept laptop', created_at: new Date().toISOString(), last_used_at: null, revoked_at: null, secret_id: 'vault-1' }]
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    renderWithProviders(<DevMcpKeysCard />)
    await waitFor(() => expect(screen.getByText('Kept laptop')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Copy "Kept laptop"?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy' }))

    await waitFor(() => expect(screen.getByTestId('dev-mcp-select-text').textContent).toBe(KEPT_KEY))
    expect(window.getSelection()?.toString()).toBe(KEPT_KEY)
  })

  it('lists the keys without Copy while the secret_id column is missing', async () => {
    state.noSecretColumn = true
    state.rows = [{ id: 'k1', label: 'Old laptop', created_at: new Date().toISOString(), last_used_at: null, revoked_at: null }]
    renderWithProviders(<DevMcpKeysCard />)
    await waitFor(() => expect(screen.getByText('Old laptop')).toBeTruthy())
    expect(state.selectsSeen.some((c) => c.includes('secret_id'))).toBe(true)
    expect(state.selectsSeen.some((c) => !c.includes('secret_id'))).toBe(true)
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull()
    expect(screen.queryByText('cannot be copied')).toBeNull()
  })

  it('says it is not switched on when the table is not there yet', async () => {
    state.loadError = { message: 'relation "public.dev_mcp_credentials" does not exist' }
    renderWithProviders(<DevMcpKeysCard />)
    await waitFor(() => expect(screen.getByText(/Not switched on yet/)).toBeTruthy())
    expect(screen.queryByText('Issue a key')).toBeNull()
  })
})
