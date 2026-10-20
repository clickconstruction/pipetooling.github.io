// @vitest-environment jsdom
/**
 * My way (v2.5597) over a fake io: the card shows for the office with both moments on Ask me first, a press saves at
 * once and says so, and a tech sees no card.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MyWayIo } from '../../lib/tellCustomer/myWayIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { MyWayCard } from './MyWayCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

function fakeIo(): MyWayIo & { set: ReturnType<typeof vi.fn> } {
  return {
    load: vi.fn(async () => ({ booked: 'ask' as const, estimate: 'send' as const })),
    set: vi.fn(async (_u: string, moment: 'booked' | 'estimate', way: 'ask' | 'send') => ({ booked: moment === 'booked' ? way : 'ask', estimate: moment === 'estimate' ? way : 'send' })),
  }
}

afterEach(cleanup)

describe('MyWayCard', () => {
  it('shows the office both moments as saved, and a press saves at once with the words', async () => {
    const io = fakeIo()
    renderWithProviders(<MyWayCard role="assistant" userId="u-rosa" io={io} />)
    const booked = within(await screen.findByText('A booking’s first visit').then((el) => el.closest('fieldset')!))
    await waitFor(() => expect((booked.getByLabelText('Ask me first') as HTMLInputElement).checked).toBe(true))
    const estimate = within(screen.getByText('An estimate').closest('fieldset')!)
    expect((estimate.getByLabelText('Send it and show me the receipt') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(booked.getByLabelText('Send it and show me the receipt'))
    await waitFor(() => expect(io.set).toHaveBeenCalledWith('u-rosa', 'booked', 'send'))
    expect(await screen.findByText('A booking’s first visit: the app sends and shows you the receipt.')).toBeTruthy()
  })

  it('draws nothing for a tech', () => {
    renderWithProviders(<MyWayCard role="helpers" userId="u-luis" io={fakeIo()} />)
    expect(screen.queryByTestId('my-way-card')).toBeNull()
  })
})
