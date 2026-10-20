import { describe, expect, it, vi } from 'vitest'
import { estimateAcceptUrl, estimateLinkNote, supabaseEstimateLinkIo } from './estimateLinkIo'

vi.mock('../supabase', () => ({ supabase: {} }))

describe('a link to an estimate for a message (#127 PR 3)', () => {
  it('is the live app’s accept page with the token', () => {
    expect(estimateAcceptUrl('AbC-_9')).toBe('https://clicktooling.com/estimate/accept?t=AbC-_9')
    expect(estimateAcceptUrl('a b', 'http://localhost:5173/')).toBe('http://localhost:5173/estimate/accept?t=a%20b')
  })

  it('asks share_estimate_link for the token and gives back the URL', async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: 'tok123', error: null }))
    expect(await supabaseEstimateLinkIo({ rpc }).share('est-1')).toBe('https://clicktooling.com/estimate/accept?t=tok123')
    expect(rpc).toHaveBeenCalledWith('share_estimate_link', { p_estimate_id: 'est-1' })
  })

  it('throws the function’s words, and throws when no token came back', async () => {
    const refused = { rpc: () => Promise.resolve({ data: null, error: { message: 'Only a sent estimate can be shared.', code: 'P0001' } }) }
    await expect(supabaseEstimateLinkIo(refused).share('est-1')).rejects.toBeTruthy()
    const empty = { rpc: () => Promise.resolve({ data: '', error: null }) }
    await expect(supabaseEstimateLinkIo(empty).share('est-1')).rejects.toThrow('The estimate’s link was not made.')
  })

  it('says under the box that the emailed link keeps working', () => {
    expect(estimateLinkNote('1044')).toBe('A second link to estimate 1044 was made for this message. The link in their email keeps working.')
    expect(estimateLinkNote('')).toBe('A second link to estimate was made for this message. The link in their email keeps working.')
  })
})
