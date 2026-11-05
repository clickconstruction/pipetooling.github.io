import { describe, expect, it } from 'vitest'
import { attachCreateRefusal, attachDoorFields, attachRequestRefusal, attachRowRefusal, attachUserIdOf, type AttachCandidate } from '../../../supabase/functions/_shared/attachLoginDoor'

const rio: AttachCandidate = { id: 'a1b2c3d4-0000-4000-8000-000000000001', name: 'Rio Vance', role: 'helpers', email: null, login_attached_at: null, is_sample: false, is_digital_twin: false, archived_at: null }

describe('the attach door', () => {
  it('reads the id the body names, trimmed', () => {
    expect(attachUserIdOf({ user_id: ' a1b2c3d4-0000-4000-8000-000000000001 ' })).toBe('a1b2c3d4-0000-4000-8000-000000000001')
    expect(attachUserIdOf({})).toBeNull()
    expect(attachUserIdOf({ user_id: '  ' })).toBeNull()
  })
  it('refuses a malformed id and two doors at once', () => {
    expect(attachRequestRefusal('nope', null)).toEqual({ status: 400, error: 'user_id must be a uuid' })
    expect(attachRequestRefusal(rio.id, 'card-1')).toEqual({ status: 400, error: 'user_id and trial_prospect_id do not go together' })
    expect(attachRequestRefusal(rio.id, null)).toBeNull()
  })
  it('refuses a missing row, a login already there, a fixture, an archived person', () => {
    expect(attachRowRefusal(null)).toEqual({ status: 404, error: 'No person with that id' })
    expect(attachRowRefusal({ ...rio, login_attached_at: '2026-10-01T12:00:00Z' })).toEqual({ status: 400, error: 'Rio Vance already has a login.' })
    expect(attachRowRefusal({ ...rio, is_sample: true })).toEqual({ status: 400, error: 'A sample or a twin gets its login from its own door.' })
    expect(attachRowRefusal({ ...rio, archived_at: '2026-10-01T12:00:00Z' })).toEqual({ status: 400, error: 'Rio Vance is archived. Restore them first.' })
    expect(attachRowRefusal({ ...rio, name: null, login_attached_at: 'x' })?.error).toBe('This person already has a login.')
    expect(attachRowRefusal(rio)).toBeNull()
  })
  it("takes the body's address and password, else the row's address and no password; the row's role and name always", () => {
    expect(attachDoorFields(rio, { email: ' Rio@Example.test ', password: 'pw-1' })).toEqual({ email: 'Rio@Example.test', password: 'pw-1', role: 'helpers', name: 'Rio Vance' })
    expect(attachDoorFields({ ...rio, email: 'rio@example.test' }, {})).toEqual({ email: 'rio@example.test', password: null, role: 'helpers', name: 'Rio Vance' })
    expect(attachDoorFields(rio, {}).email).toBe('')
  })
  it('reads a taken id out of the auth server\'s words', () => {
    expect(attachCreateRefusal('Database error creating new user')).toEqual({ status: 409, error: 'A login already stands behind that id.' })
    expect(attachCreateRefusal('Password should be at least 6 characters')).toBeNull()
  })
})
