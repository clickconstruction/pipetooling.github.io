import { describe, expect, it } from 'vitest'
import {
  impersonationExitDisplayLabel,
  impersonationExitTitle,
  impersonationSignedInAsDescription,
} from './impersonationUiLabels'

describe('impersonationExitDisplayLabel', () => {
  it('names the action, with the person in parentheses (J26-F6: never the bare name)', () => {
    expect(impersonationExitDisplayLabel('Bryan', 'bryan@example.com')).toBe('Exit impersonation (Bryan)')
    expect(impersonationExitDisplayLabel('  Bryan  ', null)).toBe('Exit impersonation (Bryan)')
  })

  it('falls back to the email local-part, then to the bare action', () => {
    expect(impersonationExitDisplayLabel(null, 'bryan@example.com')).toBe('Exit impersonation (bryan)')
    expect(impersonationExitDisplayLabel('', '   ')).toBe('Exit impersonation')
    expect(impersonationExitDisplayLabel(undefined, undefined)).toBe('Exit impersonation')
  })

  it('compact form keeps the verb for narrow headers', () => {
    expect(impersonationExitDisplayLabel('Bryan', null, { compact: true })).toBe('Exit (Bryan)')
    expect(impersonationExitDisplayLabel(null, null, { compact: true })).toBe('Exit')
  })
})

describe('impersonationExitTitle', () => {
  it('says what the control does, with the full identity', () => {
    expect(impersonationExitTitle('Bryan Smith', 'bryan@example.com')).toBe(
      'Stop viewing as Bryan Smith and go back to your own account',
    )
    expect(impersonationExitTitle(null, 'bryan@example.com')).toBe(
      'Stop viewing as bryan@example.com and go back to your own account',
    )
    expect(impersonationExitTitle(null, null)).toBe('Back to your own account')
  })
})

describe('impersonationSignedInAsDescription', () => {
  it('prefers name, then email, then a generic phrase', () => {
    expect(impersonationSignedInAsDescription('Bryan', 'b@x.com')).toBe('Bryan')
    expect(impersonationSignedInAsDescription(null, 'b@x.com')).toBe('b@x.com')
    expect(impersonationSignedInAsDescription(null, null)).toBe('another user')
  })
})
