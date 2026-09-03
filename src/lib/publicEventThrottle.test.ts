/** Pure decision of the public-telemetry throttle (the ctRosterDiff import pattern). */
import { describe, it, expect } from 'vitest'
import {
  decidePublicEvent,
  PUBLIC_EVENT_IP_CAP,
  PUBLIC_EVENT_DEDUPE_MS,
  PUBLIC_EVENT_CAP_WINDOW_MS,
} from '../../supabase/functions/_shared/publicEventThrottleDecision'

describe('decidePublicEvent', () => {
  it('records a fresh event', () => {
    expect(decidePublicEvent({ identicalRecent: 0, fromIpInWindow: 0 })).toEqual({ record: true, reason: 'ok' })
  })
  it('drops an identical event seen inside the dedupe window — a re-tap is one signal', () => {
    expect(decidePublicEvent({ identicalRecent: 1, fromIpInWindow: 1 })).toEqual({ record: false, reason: 'duplicate' })
  })
  it('drops once an IP hits the cap on a subject — a loop, not a person', () => {
    expect(decidePublicEvent({ identicalRecent: 0, fromIpInWindow: PUBLIC_EVENT_IP_CAP })).toEqual({ record: false, reason: 'rate_cap' })
    expect(decidePublicEvent({ identicalRecent: 0, fromIpInWindow: PUBLIC_EVENT_IP_CAP - 1 })).toEqual({ record: true, reason: 'ok' })
  })
  it('duplicate wins over rate cap when both apply', () => {
    expect(decidePublicEvent({ identicalRecent: 3, fromIpInWindow: 999 }).reason).toBe('duplicate')
  })
  it('the cap only bites at machine rates — a maximal human re-tapper stays under it', () => {
    // With dedupe, the most a person can RECORD is one event per option per dedupe window.
    // Over the cap window that is optionCount × (capWindow / dedupe) — for the product max of
    // 4 options, 80. The cap is 60, so a person hammering every option every 30 s for ten
    // straight minutes would trip it around minute 7. Nobody deliberates that hard; a loop does
    // it in seconds. Pin both facts so a future tweak can't quietly make the cap toothless.
    const maxHumanRecordable = 4 * (PUBLIC_EVENT_CAP_WINDOW_MS / PUBLIC_EVENT_DEDUPE_MS)
    expect(maxHumanRecordable).toBe(80)
    expect(PUBLIC_EVENT_IP_CAP).toBeLessThan(maxHumanRecordable)
    expect(PUBLIC_EVENT_IP_CAP).toBeGreaterThanOrEqual(40)
  })
})
