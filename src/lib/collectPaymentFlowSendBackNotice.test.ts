import { describe, expect, it } from 'vitest'
import { paragraphForSendBackCollectPaymentFlow } from './collectPaymentFlowSendBackNotice'

describe('paragraphForSendBackCollectPaymentFlow', () => {
  it('returns copy for draft, pending_dispatch, approved_for_terminal', () => {
    expect(paragraphForSendBackCollectPaymentFlow('draft')).toContain('step 1 of 3')
    expect(paragraphForSendBackCollectPaymentFlow('pending_dispatch')).toContain('step 2 of 3')
    expect(paragraphForSendBackCollectPaymentFlow('approved_for_terminal')).toContain('step 3 of 3')
  })

  it('returns null for terminal or unknown statuses', () => {
    expect(paragraphForSendBackCollectPaymentFlow('cancelled')).toBeNull()
    expect(paragraphForSendBackCollectPaymentFlow('terminal_completed')).toBeNull()
    expect(paragraphForSendBackCollectPaymentFlow(null)).toBeNull()
  })
})
