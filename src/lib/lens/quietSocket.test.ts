import { describe, expect, it } from 'vitest'
import { QuietSocket, quietReply } from './quietSocket'

describe('the quiet socket', () => {
  it('answers a join with its postgres_changes bindings echoed, as the server does', () => {
    const join = ['1', '1', 'realtime:jobs', 'phx_join', { config: { postgres_changes: [{ event: '*', schema: 'public', table: 'jobs' }] } }]
    expect(quietReply(join)).toEqual(['1', '1', 'realtime:jobs', 'phx_reply', { status: 'ok', response: { postgres_changes: [{ event: '*', schema: 'public', table: 'jobs', id: 1 }] } }])
  })

  it('answers heartbeats and leaves, and stays quiet otherwise', () => {
    expect(quietReply([null, '7', 'phoenix', 'heartbeat', {}])).toEqual([null, '7', 'phoenix', 'phx_reply', { status: 'ok', response: {} }])
    expect(quietReply(['1', '2', 'realtime:jobs', 'access_token', {}])).toBeNull()
    expect(quietReply({ event: 'phx_join' })).toBeNull()
  })

  it('opens, replies to what it is sent, and closes', async () => {
    const s = new QuietSocket('wss://x.supabase.co/realtime/v1/websocket')
    const got: unknown[] = []
    await new Promise<void>((r) => (s.onopen = () => r()))
    expect(s.readyState).toBe(1)
    s.onmessage = (e) => got.push(JSON.parse(String(e.data)))
    s.send(JSON.stringify([null, '3', 'phoenix', 'heartbeat', {}]))
    await new Promise((r) => setTimeout(r, 5))
    expect(got).toEqual([[null, '3', 'phoenix', 'phx_reply', { status: 'ok', response: {} }]])
    const closed = new Promise<number>((r) => (s.onclose = (e) => r(e.code)))
    s.close()
    expect(await closed).toBe(1000)
  })
})
