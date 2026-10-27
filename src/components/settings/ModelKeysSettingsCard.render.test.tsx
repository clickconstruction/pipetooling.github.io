// @vitest-environment jsdom
/**
 * Settings → Phone and texts → Model keys (punch list #186, v2.5916): the card reads the key's status for the owner or
 * a dev, says what is held without the key, saves a pasted key through the io and shows the new status, refuses a key
 * with a space before sending it, forgets a saved key, and draws nothing for anyone else.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModelKeyStatus, ModelKeyTest } from '../../lib/models/modelKeys'
import type { ModelKeysIo } from '../../lib/models/modelKeysIo'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import { ModelKeysSettingsCard } from './ModelKeysSettingsCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const auth = vi.hoisted(() => ({ role: 'dev' as string }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => useAuthModuleMock({ role: auth.role }).useAuth() }))

afterEach(() => {
  cleanup()
  auth.role = 'dev'
})

const NOW = '2026-10-26T15:00:00.000Z'
const NONE: ModelKeyStatus = { provider: 'anthropic', set: false, source: 'none', last4: null, savedAt: null, savedBy: null }
const SAVED: ModelKeyStatus = { provider: 'anthropic', set: true, source: 'vault', last4: '4f2a', savedAt: '2026-10-25T15:00:00.000Z', savedBy: 'Robert' }

function fakeIo(start: ModelKeyStatus, testAnswer: ModelKeyTest = { ok: true, model: 'claude-opus-5-5', seconds: 1.4 }): ModelKeysIo & { saved: string[] } {
  const saved: string[] = []
  let current = start
  return {
    saved,
    status: async () => current,
    save: async (_p, key) => {
      saved.push(key)
      current = { ...SAVED, last4: key.slice(-4) }
      return current
    },
    forget: async () => {
      current = NONE
      return current
    },
    test: async () => testAnswer,
  }
}

describe('ModelKeysSettingsCard', () => {
  it('reads the status, saves a pasted key and shows its last four', async () => {
    const io = fakeIo(NONE)
    renderWithProviders(<ModelKeysSettingsCard io={io} nowIso={NOW} />)
    expect(screen.getByText('Model keys')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('No key yet.')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Anthropic API key'), { target: { value: 'sk-ant-made-up-key-0000-4f2a' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the key' }))
    await waitFor(() => expect(screen.getByText(/Key ending in 4f2a is saved\./)).toBeTruthy())
    expect(io.saved).toEqual(['sk-ant-made-up-key-0000-4f2a'])
    expect((screen.getByLabelText('Anthropic API key') as HTMLInputElement).value).toBe('')
  })

  it('refuses a key with a space before sending it, and forgets a saved key', async () => {
    const io = fakeIo(SAVED)
    renderWithProviders(<ModelKeysSettingsCard io={io} nowIso={NOW} />)
    await waitFor(() => expect(screen.getByText(/Key ending in 4f2a is saved\. Saved yesterday by Robert\./)).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Anthropic API key'), { target: { value: 'sk ant with a space in it' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the key' }))
    expect(screen.getByRole('alert').textContent).toBe('The key has a space in it. Paste it again.')
    expect(io.saved).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Forget the key' }))
    await waitFor(() => expect(screen.getByText('No key yet.')).toBeTruthy())
  })

  it('tests a saved key and says it works, or names Anthropic’s reason with where to look (v2.5991)', async () => {
    renderWithProviders(<ModelKeysSettingsCard io={fakeIo(SAVED)} nowIso={NOW} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Test the key' }))
    await waitFor(() => expect(screen.getByText('The key works. Claude answered in 1.4 seconds.')).toBeTruthy())
    cleanup()
    renderWithProviders(<ModelKeysSettingsCard io={fakeIo(SAVED, { ok: false, why: 'invalid_request_error: Your credit balance is too low to access the Anthropic API.' })} nowIso={NOW} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Test the key' }))
    await waitFor(() => expect(screen.getByText('Anthropic refused it. invalid_request_error: Your credit balance is too low to access the Anthropic API.')).toBeTruthy())
    expect(screen.getByText('Check the credits on the Billing page at platform.claude.com. Check that the key has a workspace.')).toBeTruthy()
  })

  it('offers no test before a key is saved', async () => {
    renderWithProviders(<ModelKeysSettingsCard io={fakeIo(NONE)} nowIso={NOW} />)
    await waitFor(() => expect(screen.getByText('No key yet.')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Test the key' })).toBeNull()
  })

  it('draws nothing for the office', () => {
    auth.role = 'assistant'
    const { container } = renderWithProviders(<ModelKeysSettingsCard io={fakeIo(NONE)} nowIso={NOW} />)
    expect(container.querySelector('[data-settings-model-keys]')).toBeNull()
  })
})
