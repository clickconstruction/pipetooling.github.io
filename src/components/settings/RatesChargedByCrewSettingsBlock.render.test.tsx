// @vitest-environment jsdom
/**
 * Render smokes for Settings → Jobs, bills and liens → Rates charged by crew (punch list #254, PR 1; the live pass of
 * 2026-11-03): the seven rows read from app_settings with a blank where the owner has not set a rate; Save the rates is
 * dead, saying every rate is saved as shown, until a row changes, then writes one row per key, null for a blank; Who counts as what
 * lists every person with their Charged as, hides samples, twins and walk testers, lists people no longer here apart
 * (their past days still price by it), and saves a pick at once for a dev, read-only for anyone else.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

type UserRow = { id: string; name: string; role: string; charge_standing: string | null; is_sample?: boolean; is_digital_twin?: boolean; is_walk_tester?: boolean; archived_at?: string | null }
const state: {
  rows: Array<{ key: string; value_num: number | null }>
  upserts: Array<{ key: string; value_num: number | null }>
  users: UserRow[]
  userWrites: Array<{ id: string; patch: Record<string, unknown> }>
  failUserWrite: string | null
} = { rows: [], upserts: [], users: [], userWrites: [], failUserWrite: null }

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) =>
      table === 'users'
        ? {
            select: () => ({ order: () => Promise.resolve({ data: state.users, error: null }) }),
            update: (patch: Record<string, unknown>) => ({
              eq: (_col: string, id: string) => {
                if (state.failUserWrite) return Promise.resolve({ error: { message: state.failUserWrite } })
                state.userWrites.push({ id, patch })
                return Promise.resolve({ error: null })
              },
            }),
          }
        : {
            select: () => ({
              in: () => Promise.resolve({ data: state.rows, error: null }),
              eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.rows[0] ?? null, error: null }) }),
            }),
            upsert: (row: { key: string; value_num: number | null }) => {
              state.upserts.push(row)
              return Promise.resolve({ error: null })
            },
          },
  },
}))
const auth = { role: 'dev' as string }
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const real = useAuthModuleMock({ role: 'dev' }) as { useAuth: () => Record<string, unknown> }
  return { ...real, useAuth: () => ({ ...real.useAuth(), role: auth.role, readOnly: false }) }
})

import RatesChargedByCrewSettingsBlock from './RatesChargedByCrewSettingsBlock'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const input = (key: string) => screen.getByTestId(`rate-${key}`) as HTMLInputElement
const save = () => screen.getByTestId('rates-by-crew-save') as HTMLButtonElement

// Every name here is made up.
const PEOPLE: UserRow[] = [
  { id: 'u1', name: 'Avery', role: 'primary', charge_standing: 'master' },
  { id: 'u2', name: 'Blake', role: 'helpers', charge_standing: null },
  { id: 'u3', name: 'Casey', role: 'subcontractor', charge_standing: 'tech' },
  { id: 's1', name: 'Sample helper', role: 'helpers', charge_standing: null, is_sample: true },
  { id: 't1', name: 'Twin Estimator 1', role: 'estimator', charge_standing: null, is_digital_twin: true },
  { id: 'w1', name: 'Walk tester', role: 'assistant', charge_standing: null, is_walk_tester: true },
  { id: 'a1', name: 'Gone', role: 'helpers', charge_standing: null, archived_at: '2026-01-01T00:00:00Z' },
]

describe('RatesChargedByCrewSettingsBlock', () => {
  beforeEach(() => {
    state.users = PEOPLE
    state.userWrites = []
    state.failUserWrite = null
    auth.role = 'dev'
  })

  it("reads the owner's four rows and leaves the rows she has not set blank", async () => {
    state.rows = [
      { key: 'hourly_charge_rate_v1', value_num: 285 },
      { key: 'charge_rate_two_techs_v1', value_num: 285 },
      { key: 'charge_rate_tech_alone_v1', value_num: 185 },
      { key: 'charge_rate_helper_alone_v1', value_num: 75 },
    ]
    renderWithProviders(<RatesChargedByCrewSettingsBlock />)
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

  it('Save the rates is dead and says every rate is saved until a row changes, then writes one row per key and goes dead again', async () => {
    state.rows = [{ key: 'hourly_charge_rate_v1', value_num: 285 }]
    state.upserts = []
    renderWithProviders(<RatesChargedByCrewSettingsBlock />)
    await waitFor(() => expect(input('hourly_charge_rate_v1').value).toBe('285.00'))
    expect(save().disabled).toBe(true)
    expect(screen.getByTestId('rates-by-crew-nothing').textContent).toBe('Every rate is saved as shown.')
    fireEvent.change(input('hourly_charge_rate_v1'), { target: { value: '285' } })
    expect(save().disabled).toBe(true)
    fireEvent.change(input('charge_rate_master_alone_v1'), { target: { value: '240' } })
    expect(save().disabled).toBe(false)
    expect(screen.queryByTestId('rates-by-crew-nothing')).toBeNull()
    fireEvent.click(save())
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
    await waitFor(() => expect(save().disabled).toBe(true))
  })

  it('Who counts as what lists the active people with their standing and saves a pick at once', async () => {
    state.rows = []
    renderWithProviders(<RatesChargedByCrewSettingsBlock />)
    await waitFor(() => expect(screen.getAllByTestId('who-counts-row')).toHaveLength(4))
    expect(screen.getByTestId('who-counts-count').textContent).toBe('2 of 3 people count as a master, a tech or a helper.')
    const list = screen.getByTestId('who-counts-as-what')
    expect(within(list).queryByText('Sample helper')).toBeNull()
    expect(within(list).queryByText('Twin Estimator 1')).toBeNull()
    // Someone no longer here is listed apart and still settable: their past days price by it.
    expect(within(screen.getByTestId('who-counts-archived')).getByText('Gone')).toBeTruthy()
    expect(screen.getByLabelText('Gone is charged as')).toBeTruthy()
    const blake = screen.getByLabelText('Blake is charged as') as HTMLSelectElement
    expect(blake.value).toBe('none')
    fireEvent.change(blake, { target: { value: 'helper' } })
    await waitFor(() => expect(state.userWrites).toEqual([{ id: 'u2', patch: { charge_standing: 'helper' } }]))
    expect(screen.getByTestId('who-counts-count').textContent).toBe('3 of 3 people count as a master, a tech or a helper.')
  })

  it('a refused pick goes back and names the reason; anyone but a dev reads the list', async () => {
    state.rows = []
    state.failUserWrite = 'permission denied for table users'
    const first = renderWithProviders(<RatesChargedByCrewSettingsBlock />)
    await waitFor(() => expect(screen.getAllByTestId('who-counts-row')).toHaveLength(4))
    fireEvent.change(screen.getByLabelText('Blake is charged as'), { target: { value: 'tech' } })
    await waitFor(() => expect((screen.getByLabelText('Blake is charged as') as HTMLSelectElement).value).toBe('none'))
    first.unmount()
    auth.role = 'controller'
    renderWithProviders(<RatesChargedByCrewSettingsBlock />)
    await waitFor(() => expect(screen.getAllByTestId('who-counts-row')).toHaveLength(4))
    expect(screen.queryByLabelText('Blake is charged as')).toBeNull()
    expect(within(screen.getByTestId('who-counts-as-what')).getByText(/A dev sets these\./)).toBeTruthy()
  })
})
