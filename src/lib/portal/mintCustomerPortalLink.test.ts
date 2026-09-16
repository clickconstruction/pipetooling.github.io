import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../supabase', () => ({ supabase: { rpc } }))

import { mintCustomerPortalLink } from './mintCustomerPortalLink'

describe('mintCustomerPortalLink', () => {
  beforeEach(() => rpc.mockReset())

  it('calls the RPC with the customer, the audience (all by default) and no rotate, and resolves the token', async () => {
    rpc.mockResolvedValue({ data: { token: 'tok-1', audience: 'all' }, error: null })
    await expect(mintCustomerPortalLink('cust-1')).resolves.toBe('tok-1')
    expect(rpc).toHaveBeenCalledWith('mint_customer_portal_link', { p_customer_id: 'cust-1', p_audience: 'all', p_rotate: false })
  })

  it('passes an explicit audience and rotate through', async () => {
    rpc.mockResolvedValue({ data: { token: 'tok-2' }, error: null })
    await mintCustomerPortalLink('cust-1', 'gc', true)
    expect(rpc).toHaveBeenCalledWith('mint_customer_portal_link', { p_customer_id: 'cust-1', p_audience: 'gc', p_rotate: true })
  })

  it('throws the RPC error, and a refusal carried in the payload', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('permission denied') })
    await expect(mintCustomerPortalLink('cust-1')).rejects.toThrow('permission denied')
    rpc.mockResolvedValue({ data: { error: 'customer has no portal' }, error: null })
    await expect(mintCustomerPortalLink('cust-1')).rejects.toThrow('customer has no portal')
  })

  it('resolves null when the payload carries no token', async () => {
    rpc.mockResolvedValue({ data: { exists: true }, error: null })
    await expect(mintCustomerPortalLink('cust-1')).resolves.toBeNull()
  })
})
