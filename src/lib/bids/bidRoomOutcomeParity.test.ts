/**
 * The sign function decides outcome writes with the _shared kernel; this keeps its decisions
 * aligned with the staff-side kernels (gcPackets.rollUpOutcome / setGcPacketOutcome semantics).
 */
import { describe, it, expect } from 'vitest'
import { planRoomOutcome, roomRollUpOutcome, isRoomDeclineCategory } from '../../../supabase/functions/_shared/bidRoomOutcome'
import { rollUpOutcome } from './gcPackets'
import { BID_LOSS_CATEGORIES } from '../bidLossCategories'

const v = (id: string, customer_id: string | null, outcome: string | null = null, sent_on: string | null = '2026-08-28') => ({
  id,
  customer_id,
  outcome,
  sent_on,
})

describe('roomRollUpOutcome parity', () => {
  const cases = [
    [{ outcome: 'won', sentOn: null }],
    [{ outcome: 'lost', sentOn: '2026-08-01' }, { outcome: 'lost', sentOn: null }],
    [{ outcome: 'lost', sentOn: '2026-08-01' }, { outcome: null, sentOn: '2026-08-02' }],
    [{ outcome: null, sentOn: null }],
    [],
  ] as const
  it('matches gcPackets.rollUpOutcome on every case', () => {
    for (const c of cases) expect(roomRollUpOutcome(c as never)).toBe(rollUpOutcome(c as never))
  })
})

describe('planRoomOutcome', () => {
  it('an unsplit bid (no versions) lands the outcome on the bid directly — the common case', () => {
    expect(planRoomOutcome({ outcome: 'won', roomCustomerId: null, bidOutcome: null, versions: [] })).toEqual({
      packetVersionIds: [],
      autoLostVersionIds: [],
      bidOutcomeSet: 'won',
    })
    expect(planRoomOutcome({ outcome: 'lost', roomCustomerId: null, bidOutcome: null, versions: [] }).bidOutcomeSet).toBe('lost')
    // Decided rules hold: a hand-set loss still flips to won on a signature; never off started.
    expect(planRoomOutcome({ outcome: 'won', roomCustomerId: null, bidOutcome: 'lost', versions: [] }).bidOutcomeSet).toBe('won')
    expect(planRoomOutcome({ outcome: 'won', roomCustomerId: null, bidOutcome: 'started_or_complete', versions: [] }).bidOutcomeSet).toBeNull()
    expect(planRoomOutcome({ outcome: 'lost', roomCustomerId: null, bidOutcome: 'won', versions: [] }).bidOutcomeSet).toBeNull()
  })

  it('a signature wins the packet, auto-loses other sent unanswered packets, sets the bid won', () => {
    const plan = planRoomOutcome({
      outcome: 'won',
      roomCustomerId: 'gc-north',
      bidOutcome: null,
      versions: [v('v1', 'gc-north'), v('v2', 'gc-planhub'), v('v3', 'gc-merit', null, null), v('v4', 'gc-answered', 'lost')],
    })
    expect(plan.packetVersionIds).toEqual(['v1'])
    // planhub was sent + unanswered → auto-lost; merit never sent → untouched; answered stays.
    expect(plan.autoLostVersionIds).toEqual(['v2'])
    expect(plan.bidOutcomeSet).toBe('won')
  })

  it('the bid-level outcome never moves off a hand-set decision except to won', () => {
    expect(
      planRoomOutcome({ outcome: 'won', roomCustomerId: null, bidOutcome: 'lost', versions: [v('v1', null)] }).bidOutcomeSet,
    ).toBe('won')
    expect(
      planRoomOutcome({ outcome: 'won', roomCustomerId: null, bidOutcome: 'started_or_complete', versions: [v('v1', null)] })
        .bidOutcomeSet,
    ).toBeNull()
  })

  it('a decline loses only its packet; the bid goes lost only when every sent packet has lost', () => {
    const oneOfTwo = planRoomOutcome({
      outcome: 'lost',
      roomCustomerId: 'gc-north',
      bidOutcome: null,
      versions: [v('v1', 'gc-north'), v('v2', 'gc-planhub')],
    })
    expect(oneOfTwo.packetVersionIds).toEqual(['v1'])
    expect(oneOfTwo.autoLostVersionIds).toEqual([])
    expect(oneOfTwo.bidOutcomeSet).toBeNull()
    const lastOne = planRoomOutcome({
      outcome: 'lost',
      roomCustomerId: 'gc-north',
      bidOutcome: null,
      versions: [v('v1', 'gc-north'), v('v2', 'gc-planhub', 'lost')],
    })
    expect(lastOne.bidOutcomeSet).toBe('lost')
  })

  it('null roomCustomerId means the bid-own-GC packet (versions with no customer_id)', () => {
    const plan = planRoomOutcome({
      outcome: 'won',
      roomCustomerId: null,
      bidOutcome: null,
      versions: [v('v1', null), v('v2', 'gc-planhub')],
    })
    expect(plan.packetVersionIds).toEqual(['v1'])
    expect(plan.autoLostVersionIds).toEqual(['v2'])
  })

  it('decline categories are real staff loss categories, minus the staff-only ones', () => {
    const keys = BID_LOSS_CATEGORIES.map((c) => c.key)
    expect(isRoomDeclineCategory('price') && keys.includes('price')).toBe(true)
    expect(isRoomDeclineCategory('other_sub') && keys.includes('other_sub')).toBe(true)
    expect(isRoomDeclineCategory('project_died') && keys.includes('project_died')).toBe(true)
    expect(isRoomDeclineCategory('gc_lost')).toBe(false)
    expect(isRoomDeclineCategory('no_answer')).toBe(false)
  })
})
