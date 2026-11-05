import { describe, expect, it } from 'vitest'
import { DETACH_WORDS, detachRowRefusal, detachUserIdOf, type DetachCandidate } from '../../../supabase/functions/_shared/detachLoginDoor'

const rio: DetachCandidate = { id: 'a1b2c3d4-0000-4000-8000-000000000001', name: 'Rio Vance', login_attached_at: '2026-10-01T12:00:00Z', is_sample: false, is_digital_twin: false }

describe('the detach door', () => {
  it('reads the id or refuses', () => {
    expect(detachUserIdOf({ user_id: ` ${rio.id} ` })).toEqual({ userId: rio.id })
    expect(detachUserIdOf({})).toEqual({ status: 400, error: 'Missing required field: user_id' })
    expect(detachUserIdOf({ user_id: 'nope' })).toEqual({ status: 400, error: 'user_id must be a uuid' })
  })
  it('refuses a missing row, the caller, a fixture, a person with no login', () => {
    expect(detachRowRefusal(null, 'me')).toEqual({ status: 404, error: 'No person with that id' })
    expect(detachRowRefusal(rio, rio.id)).toEqual({ status: 400, error: 'You cannot remove your own login.' })
    expect(detachRowRefusal({ ...rio, is_digital_twin: true }, 'me')).toEqual({ status: 400, error: 'A sample or a twin keeps its login; retire it from its own door.' })
    expect(detachRowRefusal({ ...rio, login_attached_at: null }, 'me')).toEqual({ status: 400, error: 'Rio Vance has no login to remove.' })
    expect(detachRowRefusal(rio, 'me')).toBeNull()
  })
  it('names what goes and what stays', () => {
    expect(DETACH_WORDS.goes).toContain('sign-in')
    expect(DETACH_WORDS.stays).toContain('hours')
  })
})
