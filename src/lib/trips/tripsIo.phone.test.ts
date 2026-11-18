/**
 * The phone's two calls (punch list #379, PR 7b): `trip_phone_state` is read as it came, and `trip_phone`
 * throws its own refusal as the database's words alone, so the screen can say them. Everything is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatErrorMessage } from '../../utils/errorHandling'

const rpc = vi.fn()
vi.mock('../supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }))

import { readTripPhoneState, sendTripPhoneAct } from './tripsIo'

const thrownBy = async (run: () => Promise<unknown>): Promise<unknown> => {
  try {
    await run()
  } catch (e) {
    return e
  }
  throw new Error('nothing was thrown')
}

beforeEach(() => rpc.mockReset())

describe('readTripPhoneState', () => {
  it('asks for the job and hands the reply back as it came', async () => {
    rpc.mockResolvedValue({ data: { ok: true, development_id: 'd-heron' }, error: null })
    await expect(readTripPhoneState('j2101')).resolves.toEqual({ ok: true, development_id: 'd-heron' })
    expect(rpc).toHaveBeenCalledWith('trip_phone_state', { p_job_id: 'j2101' })
  })

  it('throws a failed read, so the phone asks nothing', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Could not find the function public.trip_phone_state', code: 'PGRST202' } })
    await expect(readTripPhoneState('j2101')).rejects.toMatchObject({ code: 'PGRST202' })
  })
})

describe('sendTripPhoneAct', () => {
  it('sends the act whole', async () => {
    rpc.mockResolvedValue({ data: { did: 'day' }, error: null })
    await sendTripPhoneAct({ action: 'day', job_id: 'j2101', trip_id: 't1', kind: 'road' })
    expect(rpc).toHaveBeenCalledWith('trip_phone', { p: { action: 'day', job_id: 'j2101', trip_id: 't1', kind: 'road' } })
  })

  it('throws the function’s own refusal as its words, which the screen then says', async () => {
    for (const [code, words] of [
      ['42501', 'Training mode is read-only. No trip was changed.'],
      ['22023', 'That trip has ended. Start a trip, or ask the office.'],
      ['22023', 'This job is not in a development yet. The office can add the trip.'],
    ] as const) {
      rpc.mockResolvedValue({ data: null, error: { message: words, code } })
      const e = await thrownBy(() => sendTripPhoneAct({ action: 'start', job_id: 'j2101' }))
      expect(formatErrorMessage(e, 'The trip could not be started. You are still clocked in.')).toBe(words)
    }
  })

  it('throws anything else as it came, so its class decides the words', async () => {
    const missing = { message: 'Could not find the function public.trip_phone', code: 'PGRST202' }
    rpc.mockResolvedValue({ data: null, error: missing })
    expect(await thrownBy(() => sendTripPhoneAct({ action: 'start', job_id: 'j2101' }))).toBe(missing)
  })
})
