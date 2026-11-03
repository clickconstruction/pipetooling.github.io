// @vitest-environment jsdom
/**
 * Render smokes for Settings → Jobs & dispatch → Rates charged by crew (punch list #254, PR 1): the seven rows read
 * from app_settings with a blank where the owner has not set a rate, and Save the rates writes one row per key,
 * null for a blank.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const state: { rows: Array<{ key: string; value_num: number | null }>; upserts: Array<{ key: string; value_num: number | null }> } = { rows: [], upserts: [] }

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: () => Promise.resolve({ data: state.rows, error: null }),
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.rows[0] ?? null, error: null }) }),
      }),
      upsert: (row: { key: string; value_num: number | null }) => {
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

import RatesChargedByCrewSettingsBlock from './RatesChargedByCrewSettingsBlock'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const input = (key: string) => screen.getByTestId(`rate-${key}`) as HTMLInputElement

describe('RatesChargedByCrewSettingsBlock', () => {
  it("reads the owner's four rows and leaves the rows she has not set blank", async () => {
    state.rows = [
      { key: 'hourly_charge_rate_v1', value_num: 285 },
      { key: 'charge_rate_two_techs_v1', value_num: 285 },
      { key: 'charge_rate_tech_alone_v1', value_num: 185 },
      { key: 'charge_rate_helper_alone_v1', value_num: 75 },
    ]
    renderWithProviders(<RatesChargedByCrewSettingsBlock />)
    fireEvent.click(screen.getByTestId('rates-by-crew-toggle'))
    await waitFor(() => expect(input('hourly_charge_rate_v1').value).toBe('285.00'))
    expect(input('charge_rate_two_techs_v1').value).toBe('285.00')
    expect(input('charge_rate_tech_alone_v1').value).toBe('185.00')
    expect(input('charge_rate_helper_alone_v1').value).toBe('75.00')
    expect(input('charge_rate_master_alone_v1').value).toBe('')
    expect(input('charge_rate_master_alone_v1').placeholder).toBe('not set')
    expect(input('charge_rate_extra_person_v1').value).toBe('')
    expect(screen.getByText('Master with a helper')).toBeTruthy()
    expect(screen.getByText('Each person beyond two')).toBeTruthy()
  })

  it('Save the rates writes one row per key, the typed rate to the cent and null for a blank', async () => {
    state.rows = [{ key: 'hourly_charge_rate_v1', value_num: 285 }]
    state.upserts = []
    renderWithProviders(<RatesChargedByCrewSettingsBlock />)
    fireEvent.click(screen.getByTestId('rates-by-crew-toggle'))
    await waitFor(() => expect(input('hourly_charge_rate_v1').value).toBe('285.00'))
    fireEvent.change(input('charge_rate_master_alone_v1'), { target: { value: '240' } })
    fireEvent.click(screen.getByTestId('rates-by-crew-save'))
    await waitFor(() => expect(state.upserts).toHaveLength(7))
    const byKey = Object.fromEntries(state.upserts.map((u) => [u.key, u.value_num]))
    expect(byKey).toEqual({
      hourly_charge_rate_v1: 285,
      charge_rate_two_techs_v1: null,
      charge_rate_master_alone_v1: 240,
      charge_rate_tech_alone_v1: null,
      charge_rate_two_helpers_v1: null,
      charge_rate_helper_alone_v1: null,
      charge_rate_extra_person_v1: null,
    })
  })
})
