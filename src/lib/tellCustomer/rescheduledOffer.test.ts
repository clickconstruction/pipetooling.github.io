import { describe, expect, it } from 'vitest'
import type { QuickReply } from '../quickReplies/kernel'
import { rescheduledOfferBody } from './rescheduledOffer'

const BOOKED: QuickReply = { id: 'q1', text: '{first}, booked {day}, {window}.', for: 'customer', stepId: 'booked', scope: 'team', addedBy: 'robert', addedAt: 0, removed: false, uses: {}, lastUsed: null }

describe('a moved first visit’s text (v2.5597)', () => {
  const input = {
    customerName: 'Dana Whitfield',
    lang: 'en' as const,
    me: 'Rosa Perez',
    jobName: 'Whitfield water heater',
    jobAddress: null,
    block: { workDate: '2026-10-24', timeStart: '13:00:00', timeEnd: '15:00:00', techName: 'Luis Ortega' },
    lines: [BOOKED],
    userId: 'rosa',
  }

  it('takes the app’s own Rescheduled words, never the office’s Booked line, filled for the new day', () => {
    expect(rescheduledOfferBody(input)).toBe('Dana, this is Rosa with Click Plumbing. Your visit moved to Saturday, October 24, 2026, 1:00 PM to 3:00 PM. Luis will text you when on the way.')
  })

  it('makes nothing when a blank nobody can fill is left', () => {
    expect(rescheduledOfferBody({ ...input, block: { ...input.block, techName: null } })).toBeNull()
    expect(rescheduledOfferBody({ ...input, me: null })).toBeNull()
  })
})
