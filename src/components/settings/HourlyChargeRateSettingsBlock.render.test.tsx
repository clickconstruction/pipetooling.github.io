// @vitest-environment jsdom
/**
 * Render smokes for the rate charged for an hour (punch list #251, v2.6431): the card reads its row on open with
 * $285.00 as the fallback, and Save writes one row under its key.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const state: { row: { value_num: number } | null; upserts: unknown[] } = { row: null, upserts: [] }

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.row, error: null }) }) }),
      upsert: (row: unknown) => {
        state.upserts.push(row)
        return Promise.resolve({ error: null })
      },
    }),
  },
}))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})

import HourlyChargeRateSettingsBlock from './HourlyChargeRateSettingsBlock'
import { renderWithProviders } from '../../test/renderSmokeMocks'

function openBlock() {
  state.upserts = []
  renderWithProviders(<HourlyChargeRateSettingsBlock />)
  fireEvent.click(screen.getByTestId('hourly-charge-rate-toggle'))
}

describe('HourlyChargeRateSettingsBlock', () => {
  it('reads the row on open and falls back to $285.00 when there is none', async () => {
    state.row = null
    openBlock()
    await waitFor(() => expect((screen.getByTestId('hourly-charge-rate-input') as HTMLInputElement).value).toBe('285.00'))
  })

  it('shows the saved rate and writes one row under its key on Save', async () => {
    state.row = { value_num: 310 }
    openBlock()
    await waitFor(() => expect((screen.getByTestId('hourly-charge-rate-input') as HTMLInputElement).value).toBe('310.00'))
    fireEvent.change(screen.getByTestId('hourly-charge-rate-input'), { target: { value: '295.5' } })
    fireEvent.click(screen.getByTestId('hourly-charge-rate-save'))
    await waitFor(() => expect(state.upserts).toHaveLength(1))
    expect(state.upserts[0]).toEqual({ key: 'hourly_charge_rate_v1', value_num: 295.5 })
  })
})
