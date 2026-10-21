import { describe, expect, it } from 'vitest'
import { estimateEventLine } from '../../supabase/functions/_shared/estimateEventLine'

const INPUT = { estimateId: 'e-212', estimateNumber: 212, customerName: 'Dana Whitfield' }

describe('estimateEventLine (v2.5705, punch list #139)', () => {
  it('names an open, an accept with its signature, and a decline, each keyed once per estimate', () => {
    expect(estimateEventLine('public_link_view', INPUT)).toEqual({ body: '👀 Dana opened estimate #212.', key: 'estimate:e-212:opened' })
    expect(estimateEventLine('public_accept_submitted', { ...INPUT, metadata: { had_signature: true } })).toEqual({ body: '✍️ Dana accepted estimate #212. Signed.', key: 'estimate:e-212:accepted' })
    expect(estimateEventLine('public_accept_submitted', INPUT)?.body).toBe('✍️ Dana accepted estimate #212.')
    expect(estimateEventLine('declined', INPUT)).toEqual({ body: '🚫 Dana declined estimate #212.', key: 'estimate:e-212:declined' })
  })
  it('draws nothing for an option viewed or an accept the page repeated, and copes with no name or number', () => {
    expect(estimateEventLine('option_viewed', INPUT)).toBeNull()
    expect(estimateEventLine('public_accept_submitted', { ...INPUT, metadata: { repeat_after_accepted: true } })).toBeNull()
    expect(estimateEventLine('public_link_view', { estimateId: 'e-1', estimateNumber: null, customerName: null })?.body).toBe('👀 The customer opened the estimate.')
  })
})
