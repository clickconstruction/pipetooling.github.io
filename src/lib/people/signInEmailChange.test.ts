import { describe, expect, it } from 'vitest'
import { checkSignInEmail, exactIlikePattern, normalizeSignInEmail } from '../../../supabase/functions/_shared/signInEmailChange'

describe('the new sign-in email rule (shared by the desk and change-user-email)', () => {
  it('trims and lowercases, so Kai@X.com and kai@x.com are one address', () => {
    expect(normalizeSignInEmail('  Kai@Example.COM ')).toBe('kai@example.com')
    expect(normalizeSignInEmail(null)).toBe('')
  })

  it('refuses an empty or malformed address', () => {
    expect(checkSignInEmail('a@b.co', '  ')).toEqual({ ok: false, error: 'Type the new email first.' })
    expect(checkSignInEmail('a@b.co', 'not an email')).toEqual({ ok: false, error: 'That email does not look right.' })
    expect(checkSignInEmail('a@b.co', 'kai@nodot')).toEqual({ ok: false, error: 'That email does not look right.' })
  })

  it('says when the address is the one they already have', () => {
    expect(checkSignInEmail('kai@example.com', 'KAI@example.com ')).toEqual({ ok: true, email: 'kai@example.com', unchanged: true })
    expect(checkSignInEmail('kai@example.com', 'kai@clickplumbing.com')).toEqual({ ok: true, email: 'kai@clickplumbing.com', unchanged: false })
    expect(checkSignInEmail(null, 'kai@clickplumbing.com')).toEqual({ ok: true, email: 'kai@clickplumbing.com', unchanged: false })
  })

  it('matches an address exactly, never as a wildcard', () => {
    expect(exactIlikePattern('first_last@x.com')).toBe('first\\_last@x.com')
    expect(exactIlikePattern('100%@x.com')).toBe('100\\%@x.com')
  })
})
