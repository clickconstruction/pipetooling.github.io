import { describe, expect, it } from 'vitest'
import { resolveProspectsLanding } from './prospectsLanding'

describe('resolveProspectsLanding (J25-F1)', () => {
  it('lands a hiring-only holder on Hiring, never the calling deck', () => {
    expect(resolveProspectsLanding({ canAccessFollowUp: false, teamProspectsAccess: true })).toBe('team')
    // A remembered deck cannot override a pipeline they cannot work.
    expect(resolveProspectsLanding({ canAccessFollowUp: false, teamProspectsAccess: true, remembered: 'follow-up' })).toBe('team')
  })

  it('lands a caller without a Hiring grant on the calling deck', () => {
    expect(resolveProspectsLanding({ canAccessFollowUp: true, teamProspectsAccess: false })).toBe('follow-up')
    // Stale memory from a grant since revoked does not open a tab they no longer hold.
    expect(resolveProspectsLanding({ canAccessFollowUp: true, teamProspectsAccess: false, remembered: 'team' })).toBe('follow-up')
  })

  it('with both grants, follows the last explicit choice and defaults to the deck', () => {
    expect(resolveProspectsLanding({ canAccessFollowUp: true, teamProspectsAccess: true })).toBe('follow-up')
    expect(resolveProspectsLanding({ canAccessFollowUp: true, teamProspectsAccess: true, remembered: null })).toBe('follow-up')
    expect(resolveProspectsLanding({ canAccessFollowUp: true, teamProspectsAccess: true, remembered: 'team' })).toBe('team')
    expect(resolveProspectsLanding({ canAccessFollowUp: true, teamProspectsAccess: true, remembered: 'follow-up' })).toBe('follow-up')
    expect(resolveProspectsLanding({ canAccessFollowUp: true, teamProspectsAccess: true, remembered: 'garbage' })).toBe('follow-up')
  })

  it('a viewer with neither grant still resolves to the deck, which renders its own no-access state', () => {
    expect(resolveProspectsLanding({ canAccessFollowUp: false, teamProspectsAccess: false })).toBe('follow-up')
  })
})
