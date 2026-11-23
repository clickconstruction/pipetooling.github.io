import { describe, expect, it } from 'vitest'
import { DatabaseError } from '../../utils/errorHandling'
import { supabaseFollowUpThreadIo } from './followUpThreadIo'

/** A client that records each call's name and arguments, and answers them all one way. */
function fakeClient(error: { message: string; code: string } | null = null) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const client = {
    from: () => {
      throw new Error('no table is read here')
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args })
      return error ? { data: null, error, status: 400 } : { data: null, error: null, status: 200 }
    },
  }
  return { client, calls }
}

describe('writeDownPayment (v2.8271, punch list #129)', () => {
  it('marks a line with the day, and with no day leaves the day off the call so the mark comes off', async () => {
    const { client, calls } = fakeClient()
    const io = supabaseFollowUpThreadIo(client)
    await io.writeDownPayment!('m1', '2026-11-27')
    await io.writeDownPayment!('m1', null)
    expect(calls).toEqual([
      { fn: 'write_down_payment', args: { p_message_id: 'm1', p_day: '2026-11-27' } },
      { fn: 'write_down_payment', args: { p_message_id: 'm1' } },
    ])
  })
  it('rejects with the database’s own words on a refusal', async () => {
    const { client } = fakeClient({ message: 'Someone has said what that day is already.', code: 'P0001' })
    const refused = await supabaseFollowUpThreadIo(client)
      .writeDownPayment!('m1', '2026-11-27')
      .then(
        () => null,
        (e: unknown) => e,
      )
    expect(refused).toBeInstanceOf(DatabaseError)
    expect((refused as DatabaseError).serverMessage).toBe('Someone has said what that day is already.')
  })
})

describe('writeDownPayment with its job (punch list #421 PR 5)', () => {
  it('names the job with a day, and never when the mark comes off', async () => {
    const { client, calls } = fakeClient()
    const io = supabaseFollowUpThreadIo(client)
    await io.writeDownPayment!('m1', '2026-11-27', 'j2')
    await io.writeDownPayment!('m1', null, 'j2')
    expect(calls).toEqual([
      { fn: 'write_down_payment', args: { p_message_id: 'm1', p_day: '2026-11-27', p_job_id: 'j2' } },
      { fn: 'write_down_payment', args: { p_message_id: 'm1' } },
    ])
  })
})

describe('writeDownHeard (punch list #421)', () => {
  it('writes the day and its kind, a double kind with the one written, and just talk with no kind', async () => {
    const { client, calls } = fakeClient()
    const io = supabaseFollowUpThreadIo(client)
    await io.writeDownHeard!('m1', 'quote', '2026-11-25', null)
    await io.writeDownHeard!('m2', 'papers', '2026-11-27', 'insurance')
    await io.writeDownHeard!('m3', null, '2026-11-25', null)
    expect(calls).toEqual([
      { fn: 'write_down_heard', args: { p_message_id: 'm1', p_kind: 'quote', p_day: '2026-11-25' } },
      { fn: 'write_down_heard', args: { p_message_id: 'm2', p_kind: 'papers', p_day: '2026-11-27', p_writes: 'insurance' } },
      { fn: 'write_down_heard', args: { p_message_id: 'm3', p_kind: null, p_day: '2026-11-25' } },
    ])
  })
  it('rejects with the database’s own words on a refusal', async () => {
    const { client } = fakeClient({ message: 'Someone has said what that day is already.', code: 'P0001' })
    const refused = await supabaseFollowUpThreadIo(client)
      .writeDownHeard!('m1', 'quote', '2026-11-25', null)
      .then(
        () => null,
        (e: unknown) => e,
      )
    expect(refused).toBeInstanceOf(DatabaseError)
    expect((refused as DatabaseError).serverMessage).toBe('Someone has said what that day is already.')
  })
})
