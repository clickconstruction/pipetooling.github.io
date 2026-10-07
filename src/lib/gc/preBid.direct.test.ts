/**
 * Main's own test for who is asked to the pre-bid meeting (the owner, 2026-10-04; the Board's
 * B2-i): every company asked on a trade we hire out, once, with its trades, and none that said no,
 * run through the kernel on the test data.
 */
import { describe, expect, it } from 'vitest'
import { preBidInvited } from './preBid'
import { initialGcState } from './schedule/testState'

describe('the pre-bid meeting', () => {
  it('invites each company asked on a trade we hire out, once, and none that said no', () => {
    const s = initialGcState()
    const invited = (id: string) => preBidInvited(s, s.projects.find((p) => p.id === id)!).map((r) => `${r.partner.id}: ${r.trades.join(', ')}`)
    expect(invited('helotes')).toEqual([
      'brightline: Electrical',
      'cedar: Millwork',
      'hillcountry: Framing and drywall',
      'kendall: HVAC',
      'sawtooth: Millwork',
      'voltage: Electrical',
    ])
    expect(invited('boerne')).not.toContain('comal: Structural steel')
    expect(invited('padb')).toEqual([])
  })
})
