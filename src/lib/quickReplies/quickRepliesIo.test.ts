import { describe, expect, it, vi } from 'vitest'
import { DatabaseError } from '../../utils/errorHandling'
import { supabaseQuickRepliesIo } from './quickRepliesIo'

vi.mock('../supabase', () => ({ supabase: {} }))

type Result = { data: unknown; error: unknown }

/** A client with only what the io touches: `from(table).select(…)` (and `.order`) and `rpc(fn, args)`. */
function fakeClient(tables: Record<string, unknown[]>, rpc: (fn: string, args: Record<string, unknown>) => Result = () => ({ data: null, error: null })) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const client = {
    from: (table: string) => {
      const result: Result = { data: tables[table] ?? [], error: null }
      const q = { select: () => q, order: () => q, then: (ok: (r: Result) => unknown) => Promise.resolve(result).then(ok) }
      return q
    },
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args })
      return Promise.resolve(rpc(fn, args))
    },
  }
  return { client, calls }
}

describe('the quick replies’ reads and presses', () => {
  it('reads the lines with their presses counted, through the rows kernel', async () => {
    const { client } = fakeClient({
      quick_replies: [{ id: 'q14', text: 'Got it, thank you.', for_kind: 'any', step_key: null, scope: 'team', added_by: 'u-rosa', added_at: '2026-09-12T14:00:00.000Z', removed_at: null }],
      quick_reply_uses: [{ quick_reply_id: 'q14', user_id: 'u-rosa', contact_id: 'c-greg', at: '2026-10-01T15:00:00.000Z' }],
    })
    const lines = await supabaseQuickRepliesIo(client).loadLines()
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ id: 'q14', for: 'any', uses: { 'u-rosa': 1 }, lastUsed: { by: 'u-rosa', contactId: 'c-greg' } })
  })

  it('reads each line’s versions', async () => {
    const { client } = fakeClient({
      quick_reply_versions: [{ id: 1, quick_reply_id: 'q14', kind: 'added', from_text: null, to_text: 'Got it, thank you.', from_for_kind: null, from_step_key: null, to_for_kind: 'any', to_step_key: null, by_user_id: 'u-rosa', at: '2026-09-12T14:00:00.000Z' }],
    })
    expect((await supabaseQuickRepliesIo(client).loadVersions()).q14?.[0]).toMatchObject({ kind: 'added', toText: 'Got it, thank you.' })
  })

  it('presses, adds, changes, removes and restores through the functions, a line for anyone with no step', async () => {
    const { client, calls } = fakeClient({}, (fn) => ({ data: fn === 'add_quick_reply' ? 'q-new' : fn === 'edit_quick_reply' ? 2 : null, error: null }))
    const io = supabaseQuickRepliesIo(client)
    await io.press('q14', 'c-greg')
    expect(await io.add('Got it.', { for: 'any', stepId: 'ask' }, true)).toBe('q-new')
    expect(await io.edit('q3', 'Checking on the number.', { for: 'trade', stepId: 'ask' })).toBe(2)
    await io.remove('q3')
    await io.restore('q3')
    expect(calls).toEqual([
      { fn: 'press_quick_reply', args: { p_id: 'q14', p_contact_id: 'c-greg' } },
      { fn: 'add_quick_reply', args: { p_text: 'Got it.', p_for: 'any', p_step: null, p_mine: true } },
      { fn: 'edit_quick_reply', args: { p_id: 'q3', p_text: 'Checking on the number.', p_for: 'trade', p_step: 'ask' } },
      { fn: 'remove_quick_reply', args: { p_id: 'q3' } },
      { fn: 'restore_quick_reply', args: { p_id: 'q3' } },
    ])
  })

  it('passes R3’s parts only when given: a clear as blank, off the phone as 0', async () => {
    const { client, calls } = fakeClient({}, () => ({ data: 1, error: null }))
    const io = supabaseQuickRepliesIo(client)
    await io.edit('r2', 'On our way.', { for: 'customer', stepId: 'onway' }, { textEs: 'Vamos en camino.', phoneOrder: 2, phoneName: 'On our way' })
    await io.edit('r2', 'On our way.', { for: 'customer', stepId: 'onway' }, { textEs: null, phoneOrder: null, phoneName: null })
    await io.edit('r2', 'On our way.', { for: 'customer', stepId: 'onway' }, { phoneOrder: 3 })
    expect(calls.map((c) => c.args)).toEqual([
      { p_id: 'r2', p_text: 'On our way.', p_for: 'customer', p_step: 'onway', p_text_es: 'Vamos en camino.', p_phone_order: 2, p_phone_name: 'On our way' },
      { p_id: 'r2', p_text: 'On our way.', p_for: 'customer', p_step: 'onway', p_text_es: '', p_phone_order: 0, p_phone_name: '' },
      { p_id: 'r2', p_text: 'On our way.', p_for: 'customer', p_step: 'onway', p_phone_order: 3 },
    ])
  })

  it('rejects a refusal with the function’s own words kept on the error', async () => {
    const { client } = fakeClient({}, () => ({ data: null, error: { message: 'Nothing changed.', code: 'P0001' } }))
    const failed = await supabaseQuickRepliesIo(client).edit('q3', 'Same words.', { for: 'trade', stepId: null }).catch((e: unknown) => e)
    expect(failed).toBeInstanceOf(DatabaseError)
    expect((failed as DatabaseError).serverMessage).toBe('Nothing changed.')
  })
})
