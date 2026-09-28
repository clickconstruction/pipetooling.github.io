import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { bidTradeToSwitchTo } from './bidTradeSwitch'

type Result = { data: { service_type_id: string | null } | null; error: { message: string } | null }

function clientAnswering(result: Result | Error) {
  const single = vi.fn(async () => {
    if (result instanceof Error) throw result
    return result
  })
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return { client: { from } as unknown as Pick<SupabaseClient, 'from'>, from, select, eq, single }
}

describe('bidTradeToSwitchTo', () => {
  it('reads the one column of the one bid', async () => {
    const c = clientAnswering({ data: { service_type_id: 'trade-b' }, error: null })
    await bidTradeToSwitchTo(c.client, 'bid-1', 'trade-a')
    expect(c.from).toHaveBeenCalledWith('bids')
    expect(c.select).toHaveBeenCalledWith('service_type_id')
    expect(c.eq).toHaveBeenCalledWith('id', 'bid-1')
    expect(c.single).toHaveBeenCalledTimes(1)
  })

  it('answers the bid’s trade when it is not the one on screen', async () => {
    const c = clientAnswering({ data: { service_type_id: 'trade-b' }, error: null })
    expect(await bidTradeToSwitchTo(c.client, 'bid-1', 'trade-a')).toBe('trade-b')
  })

  it('answers the bid’s trade when no trade is picked yet', async () => {
    const c = clientAnswering({ data: { service_type_id: 'trade-b' }, error: null })
    expect(await bidTradeToSwitchTo(c.client, 'bid-1', '')).toBe('trade-b')
    expect(await bidTradeToSwitchTo(c.client, 'bid-1', null)).toBe('trade-b')
  })

  it('answers nothing when the bid is under the trade on screen', async () => {
    const c = clientAnswering({ data: { service_type_id: 'trade-a' }, error: null })
    expect(await bidTradeToSwitchTo(c.client, 'bid-1', 'trade-a')).toBeNull()
  })

  it('answers nothing when the bid cannot be read', async () => {
    const c = clientAnswering({ data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } })
    expect(await bidTradeToSwitchTo(c.client, 'bid-1', 'trade-a')).toBeNull()
  })

  it('answers nothing for a bid with no trade', async () => {
    const c = clientAnswering({ data: { service_type_id: null }, error: null })
    expect(await bidTradeToSwitchTo(c.client, 'bid-1', 'trade-a')).toBeNull()
  })

  it('never throws', async () => {
    const c = clientAnswering(new Error('network down'))
    expect(await bidTradeToSwitchTo(c.client, 'bid-1', 'trade-a')).toBeNull()
  })
})
