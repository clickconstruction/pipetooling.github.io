import { describe, expect, it, vi } from 'vitest'
import { sentCopyFacts } from './appLines'
import { copyIdsOf, stampsOfRow, supabaseSentStampsIo } from './sentStampsIo'

vi.mock('../supabase', () => ({ supabase: {} }))

describe('sentStampsIo', () => {
  it('reads a row as the small print says it: a payment’s day kept whatever the clock, its how in one word', () => {
    const stamps = stampsOfRow({ id: 'sd-1', from_email: 'office@clickplumbing.example', opened_at: '2026-10-10T23:12:00.000Z', paid_on: '2026-10-11', paid_how: 'Check' })
    expect(stamps).toEqual({ id: 'sd-1', fromEmail: 'office@clickplumbing.example', openedAt: '2026-10-10T23:12:00.000Z', paid: { at: '2026-10-11T17:00:00.000Z', how: 'check' } })
    expect(sentCopyFacts(stamps)).toEqual(['from office@clickplumbing.example', 'opened Oct 10, 6:12 PM', 'paid Oct 11 by check'])
    // A winter day keeps its day too, and an import's marker says no how.
    expect(sentCopyFacts(stampsOfRow({ id: 'sd-2', from_email: null, opened_at: null, paid_on: '2026-01-05', paid_how: 'HCP import' }))).toEqual(['paid Jan 5'])
    expect(stampsOfRow({ id: 'sd-3', from_email: null, opened_at: null, paid_on: null, paid_how: null }).paid).toBeNull()
  })

  it('names the copies behind a thread’s sent lines once each, and none of its own lines', () => {
    expect(copyIdsOf(['m-1', 'sent:sd-1', 'sent:sd-2', 'sent:sd-1'])).toEqual(['sd-1', 'sd-2'])
    expect(copyIdsOf(['m-1'])).toEqual([])
  })

  it('reads only the function, a hundred and fifty copies a call, and rejects with its words when it is refused', async () => {
    const rpc = vi.fn(async (_fn: string, args: { p_ids: string[] }) => ({ data: args.p_ids.map((id) => ({ id, from_email: null, opened_at: null, paid_on: null, paid_how: null })), error: null }))
    const io = supabaseSentStampsIo({ rpc } as never)
    const ids = Array.from({ length: 160 }, (_, i) => `sd-${i}`)
    expect((await io.load(ids)).map((s) => s.id)).toEqual(ids)
    expect(rpc.mock.calls.map(([fn, args]) => [fn, args.p_ids.length])).toEqual([
      ['sent_copy_stamps', 150],
      ['sent_copy_stamps', 10],
    ])
    expect(await io.load([])).toEqual([])
    expect(rpc).toHaveBeenCalledTimes(2)

    const refused = supabaseSentStampsIo({ rpc: vi.fn(async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })) } as never)
    await expect(refused.load(['sd-1'])).rejects.toThrow()
  })
})
