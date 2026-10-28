import { describe, expect, it } from 'vitest'
import { parsePushHours } from './pushHours'
import { supabasePushHoursIo } from './pushHoursIo'

/** A client whose every chain resolves `result`, and remembers each call. */
function fakeClient(result: { data?: unknown; error?: unknown }) {
  const calls: { method: string; args: unknown[] }[] = []
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'upsert', 'delete', 'maybeSingle']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: result.data ?? null, error: result.error ?? null })
  return { client: { from: (table: string) => (calls.push({ method: 'from', args: [table] }), builder) }, calls }
}

describe('Push me: the person’s own row', () => {
  it('reads the row as hours', async () => {
    const { client, calls } = fakeClient({ data: { days: [1, 2, 3, 4, 5], opens: '06:00', closes: '20:00' } })
    const hours = await supabasePushHoursIo(client).load('u-rosa')
    expect(hours).toEqual(parsePushHours({ days: [1, 2, 3, 4, 5], opens: '06:00', closes: '20:00' }))
    expect(calls.map((c) => c.method)).toEqual(['from', 'select', 'eq', 'maybeSingle'])
    expect(calls[0]!.args).toEqual(['user_push_hours'])
    expect(calls[2]!.args).toEqual(['user_id', 'u-rosa'])
  })

  it('reads no row, and a read that fails, as any time', async () => {
    expect(await supabasePushHoursIo(fakeClient({ data: null }).client).load('u-rosa')).toBeNull()
    expect(await supabasePushHoursIo(fakeClient({ error: { code: '42P01', message: 'relation does not exist' } }).client).load('u-rosa')).toBeNull()
  })

  it('writes the row whole, the times padded, on the person’s key', async () => {
    const { client, calls } = fakeClient({})
    await supabasePushHoursIo(client).save('u-rosa', parsePushHours({ days: [5, 1], opens: '6:00', closes: '20:00' })!)
    const upsert = calls.find((c) => c.method === 'upsert')!
    expect(upsert.args[0]).toMatchObject({ user_id: 'u-rosa', days: [1, 5], opens: '06:00', closes: '20:00' })
    expect(typeof (upsert.args[0] as { updated_at: unknown }).updated_at).toBe('string')
    expect(upsert.args[1]).toEqual({ onConflict: 'user_id' })
  })

  it('removes the row for any time', async () => {
    const { client, calls } = fakeClient({})
    await supabasePushHoursIo(client).clear('u-rosa')
    expect(calls.map((c) => c.method)).toEqual(['from', 'delete', 'eq'])
    expect(calls[2]!.args).toEqual(['user_id', 'u-rosa'])
  })

  it('says why a write failed', async () => {
    const { client } = fakeClient({ error: { message: 'new row violates row-level security policy' } })
    await expect(supabasePushHoursIo(client).save('u-rosa', parsePushHours({ days: [1], opens: '06:00', closes: '20:00' })!)).rejects.toThrow()
  })
})
