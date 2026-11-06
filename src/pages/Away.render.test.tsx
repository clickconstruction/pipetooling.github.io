// @vitest-environment jsdom
/**
 * The Away page (punch list #256 PR 8, v2.6587): the only page a signed-in archived account gets. The RPC is mocked;
 * the smoke proves the page draws the note over the kernel's model, the countdown and the city with the location
 * press, the call link to the office line, and Sign out; with no note it rests on the resting words.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'

const state = vi.hoisted(() => ({ answer: null as unknown }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: async () => ({ data: state.answer, error: null }),
    auth: { signOut: async () => ({ error: null }) },
  },
}))
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ archivedCaller: true, role: null })
})

import Away from './Away'

describe('Away', () => {
  it('draws the note, the countdown, where the office is and the call, with Sign out', async () => {
    state.answer = {
      first_name: 'Corinne',
      words: 'Your spot on the crew is waiting.',
      countdown_ymd: '2099-11-05',
      show_where: true,
      show_call: true,
      left_ymd: '2026-11-03',
      updated_ymd: '2026-11-03',
      office_address: JSON.stringify({ address: '12925 FM 20, Kingsbury, TX 78638', lat: 29.65, lng: -97.81 }),
      office_phone: '(512) 555-0142',
    }
    renderWithProviders(<Away />)
    await screen.findByText('See you soon, Corinne.')
    expect(screen.getByText('Your spot on the crew is waiting.')).toBeTruthy()
    expect(screen.getByText("We're in Kingsbury, TX")).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeTruthy()
    const call = screen.getByRole('link', { name: 'Call the office' }) as HTMLAnchorElement
    expect(call.getAttribute('href')).toBe('tel:+15125550142')
    expect(screen.getByRole('group', { name: /until you're back/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
  })

  it('with no note for them, rests on the resting words', async () => {
    state.answer = null
    renderWithProviders(<Away />)
    await screen.findByText('This account is resting.')
    expect(screen.queryByText(/See you soon/)).toBeNull()
  })
})
