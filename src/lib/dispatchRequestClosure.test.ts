import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }))
vi.mock('./navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

import {
  composeDispatchClosurePush,
  DISPATCH_CLOSURE_NOTE_MAX,
  DISPATCH_PUSH_BODY_MAX,
  dispatchRequestClosedTarget,
  requestClosureNotification,
} from './dispatchRequestClosure'

const request = {
  id: 'req-1',
  from_user_id: 'tech-9',
  title: 'Add a customer phone number for HCP 846 - David and Diana Uhl',
}

describe('requestClosureNotification', () => {
  it('addresses the requester and carries the office note in the fn payload', () => {
    const n = requestClosureNotification(request, '  Added — it is 555-0100  ', 'closed')
    expect(n.recipientUserId).toBe('tech-9')
    expect(n.body).toEqual({ dispatch_request_id: 'req-1', mode: 'closed', note: 'Added — it is 555-0100' })
    expect(n.pushTitle).toBe('Dispatch answered')
    expect(n.pushBody).toBe('Handled: Add a customer phone number for HCP 846 - David and Diana Uhl — Added — it is 555-0100')
  })

  it('reopen mode reads as a reopen', () => {
    const n = requestClosureNotification(request, 'Number bounced, need another', 'reopened')
    expect(n.body.mode).toBe('reopened')
    expect(n.pushTitle).toBe('Dispatch reopened your request')
    expect(n.pushBody.startsWith('Reopened: ')).toBe(true)
  })

  it('a blank note becomes null and the push drops the dash', () => {
    const n = requestClosureNotification(request, '   ', 'closed')
    expect(n.body.note).toBeNull()
    expect(n.pushBody).toBe(`Handled: ${request.title}`)
  })

  it('caps a 2000-char note for the payload and the push body at the fn ceiling', () => {
    const n = requestClosureNotification(request, 'x'.repeat(2000), 'closed')
    expect(n.body.note?.length).toBe(DISPATCH_CLOSURE_NOTE_MAX)
    expect(n.body.note?.endsWith('…')).toBe(true)
    expect(n.pushBody.length).toBeLessThanOrEqual(DISPATCH_PUSH_BODY_MAX)
  })
})

describe('composeDispatchClosurePush', () => {
  it('falls back to "your request" for an empty title', () => {
    expect(composeDispatchClosurePush('  ', null, 'closed').body).toBe('Handled: your request')
  })
})

describe('dispatchRequestClosedTarget', () => {
  it('encodes mode and whether a push landed', () => {
    expect(dispatchRequestClosedTarget('closed', true)).toBe('#closed?notified=1')
    expect(dispatchRequestClosedTarget('reopened', false)).toBe('#reopened?notified=0')
  })
})
