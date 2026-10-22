// @vitest-environment jsdom
/**
 * The Console's Rounds card (v2.5733, punch list #142): one row per key with the light's word,
 * the check-in, Now, Recently and the one press, which calls robot_rounds_stop.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { TwinRoundsCard } from './TwinRoundsCard'

const NOW = Date.now()
const ago = (m: number) => new Date(NOW - m * 60_000).toISOString()
const rpc = vi.fn(async (name: string, args?: Record<string, unknown>) => {
  if (name === 'robot_agents') {
    return {
      data: [
        {
          credential_id: 'k1', key_label: "Robert's Mac Mini", key_created_at: ago(60 * 24), twin_user_id: 't1', twin_name: 'Twin Estimator 1', twin_kind: 'estimator',
          last_seen_at: ago(2), stopped_at: null, stopped_by_name: null, heartbeat_at: ago(2), heartbeat_state: 'working', heartbeat_stage: 'STG-2',
          heartbeat_progress: { step: 'reading', read: '12 of 31 sheets' }, heartbeat_is_round: true, heartbeat_bid_number: '2041', heartbeat_project: 'ZZ Shadow Oak Hollow',
          heartbeat_source_bid_number: '511', heartbeat_source_bid_id: 'bid-511', holds_open_shell: true, idle_rounds_today: 88,
          recent: [{ kind: 'sealed', at: ago(60), bid_id: 'bid-509', bid_number: '509', project: 'Cedar Park Vet Clinic', shell_number: '2038', count: 2, label: null, delta_pct: null }],
        },
        {
          credential_id: 'k2', key_label: "Stephen's MacBook", key_created_at: ago(60 * 24 * 5), twin_user_id: 't1', twin_name: 'Twin Estimator 1', twin_kind: 'estimator',
          last_seen_at: ago(60 * 24 * 3), stopped_at: null, stopped_by_name: null, heartbeat_at: null, heartbeat_state: null, heartbeat_stage: null, heartbeat_progress: null,
          heartbeat_is_round: false, heartbeat_bid_number: null, heartbeat_project: null, heartbeat_source_bid_number: null, heartbeat_source_bid_id: null, holds_open_shell: false, idle_rounds_today: 0, recent: [],
        },
      ],
      error: null,
    }
  }
  if (name === 'robot_rounds_stop') return { data: { credential_id: args?.p_credential_id, stopped_at: args?.p_stop ? new Date().toISOString() : null }, error: null }
  return { data: null, error: null }
})
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(a[0] as string, a[1] as Record<string, unknown> | undefined) } }))

describe('TwinRoundsCard', () => {
  it('draws one row per key: the word, the check-in, Now on the human bid, Recently open on the first row, and Stop the rounds', async () => {
    renderWithProviders(<TwinRoundsCard canStop />)
    await waitFor(() => expect(screen.getAllByTestId('twin-rounds-row').length).toBe(2))
    await settle()
    const words = screen.getAllByTestId('twin-rounds-word').map((w) => w.textContent)
    expect(words).toEqual(['Alive', 'Asleep'])
    const checkins = screen.getAllByTestId('twin-rounds-checkin').map((c) => c.textContent)
    expect(checkins[0]).toBe('Checked in 2m ago.')
    expect(checkins[1]).toBe('Last check-in 3d ago.')
    expect(screen.getByText('Reading the sheets, 12 of 31 sheets on b511.').getAttribute('href')).toBe('/bids?tab=bid-board&bidId=bid-511')
    expect(screen.getByTestId('twin-rounds-recent').textContent).toContain('Sealed b2038 for b509 Cedar Park Vet Clinic. Asked 2 questions.')
    expect(screen.getByText(/88 rounds found nothing to do\./)).toBeTruthy()
    fireEvent.click(screen.getAllByText('Stop the rounds')[0]!)
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('robot_rounds_stop', { p_credential_id: 'k1', p_stop: true }))
  })
  it('with no key yet, says so', async () => {
    rpc.mockImplementationOnce(async () => ({ data: [], error: null }))
    renderWithProviders(<TwinRoundsCard canStop />)
    await waitFor(() => expect(screen.getByTestId('twin-rounds-empty')).toBeTruthy())
  })
})
