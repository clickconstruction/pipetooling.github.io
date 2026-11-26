import { describe, expect, it } from 'vitest'
import { clockSessionHoursWords, clockSessionNamed, deleteSessionConfirm, rejectSessionConfirm, type ClockSessionToName } from './clockSessionConfirm'

// A made-up session on 2026-11-25 in the company's zone: in at 8:23 PM (02:23 UTC the next day), out a minute later.
const session = (over: Partial<ClockSessionToName> = {}): ClockSessionToName => ({
  users: { name: 'ZZ Test Learner' },
  work_date: '2026-11-25',
  clocked_in_at: '2026-11-26T02:23:10Z',
  clocked_out_at: '2026-11-26T02:24:40Z',
  ...over,
})

describe('the confirm windows on a clock session (punch list #443)', () => {
  it('names whose session, which day and which hours, in the company’s zone', () => {
    expect(clockSessionNamed(session())).toBe("ZZ Test Learner's clock session of Wed, Nov 25, 8:23 PM to 8:24 PM")
  })

  it('says a session with no clock out is still open, and a quick add by its minutes', () => {
    expect(clockSessionHoursWords(session({ clocked_out_at: null }))).toBe('8:23 PM, still open')
    expect(clockSessionHoursWords(session({ quick_add_minutes: 45 }))).toBe('45 minutes typed in')
    expect(clockSessionHoursWords(session({ quick_add_minutes: 1 }))).toBe('1 minute typed in')
    expect(clockSessionHoursWords(session({ clocked_in_at: 'not a time' }))).toBe('no start time')
  })

  it('does not pretend to a name the row does not carry', () => {
    expect(clockSessionNamed(session({ users: null }))).toBe('the clock session with no name on it of Wed, Nov 25, 8:23 PM to 8:24 PM')
    expect(clockSessionNamed(session({ users: { name: '  ' } }))).toMatch(/^the clock session with no name on it of /)
  })

  it('Reject asks about that session, and its button names the act', () => {
    expect(rejectSessionConfirm(session())).toEqual({
      message: "Reject ZZ Test Learner's clock session of Wed, Nov 25, 8:23 PM to 8:24 PM?",
      confirmLabel: 'Reject the session',
    })
  })

  it('Delete asks about that session and says a dev can bring it back, since the archive keeps a copy', () => {
    expect(deleteSessionConfirm(session())).toEqual({
      message: "Delete ZZ Test Learner's clock session of Wed, Nov 25, 8:23 PM to 8:24 PM? A dev can bring it back from Recently deleted for 90 days.",
      confirmLabel: 'Delete the session',
      danger: true,
    })
  })
})
