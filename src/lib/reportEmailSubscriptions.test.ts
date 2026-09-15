import { describe, expect, it } from 'vitest'
import {
  isValidEmail,
  normalizeEmail,
  recipientDisplayLabel,
  scopeSummary,
  subscriptionMatchesAuthor,
  subscriptionMatchesReport,
  validateSubscriptionDraft,
  type SubscriptionDraft,
} from './reportEmailSubscriptions'

const baseDraft = (over: Partial<SubscriptionDraft> = {}): SubscriptionDraft => ({
  recipientKind: 'user',
  recipientUserId: 'u1',
  recipientEmail: '',
  label: '',
  allAuthors: true,
  authorUserIds: [],
  teamLeadUserIds: [],
  autoSend: true,
  enabled: true,
  ...over,
})

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Owner@Example.COM ')).toBe('owner@example.com')
  })
})

describe('isValidEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('first.last@sub.domain.com')).toBe(true)
  })
  it('rejects malformed / empty / spaced', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('nope')).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('a b@c.com')).toBe(false)
    expect(isValidEmail('a@@b.com')).toBe(false)
  })
})

describe('validateSubscriptionDraft', () => {
  it('requires a user when recipientKind=user', () => {
    expect(validateSubscriptionDraft(baseDraft({ recipientUserId: null }))).toEqual({
      ok: false,
      error: 'Pick a recipient.',
    })
    expect(validateSubscriptionDraft(baseDraft({ recipientUserId: 'u9' })).ok).toBe(true)
  })

  it('requires a valid email when recipientKind=email', () => {
    expect(
      validateSubscriptionDraft(
        baseDraft({ recipientKind: 'email', recipientUserId: null, recipientEmail: 'bad' }),
      ).ok,
    ).toBe(false)
    expect(
      validateSubscriptionDraft(
        baseDraft({ recipientKind: 'email', recipientUserId: null, recipientEmail: 'ok@x.com' }),
      ).ok,
    ).toBe(true)
  })

  it('requires at least one author when not all_authors', () => {
    expect(
      validateSubscriptionDraft(baseDraft({ allAuthors: false, authorUserIds: [] })).ok,
    ).toBe(false)
    expect(
      validateSubscriptionDraft(baseDraft({ allAuthors: false, authorUserIds: ['a1'] })).ok,
    ).toBe(true)
  })

  it('all_authors makes the author list irrelevant', () => {
    expect(validateSubscriptionDraft(baseDraft({ allAuthors: true, authorUserIds: [] })).ok).toBe(true)
  })
  it('a team lead alone satisfies the scope (v2.3480)', () => {
    expect(
      validateSubscriptionDraft(baseDraft({ allAuthors: false, authorUserIds: [], teamLeadUserIds: ['lead1'] })).ok,
    ).toBe(true)
    const r = validateSubscriptionDraft(baseDraft({ allAuthors: false, authorUserIds: [], teamLeadUserIds: [] }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('team lead')
  })
})

describe('subscriptionMatchesReport (v2.3480)', () => {
  const sub = { enabled: true, all_authors: false }
  it('matches a report by someone the team lead leads', () => {
    expect(
      subscriptionMatchesReport(sub, { authorUserIds: [], teamLeadUserIds: ['todd'] }, { authorUserId: 'sam', leaderUserIds: ['todd'] }),
    ).toBe(true)
  })
  it("matches the team lead's own report", () => {
    expect(
      subscriptionMatchesReport(sub, { authorUserIds: [], teamLeadUserIds: ['todd'] }, { authorUserId: 'todd', leaderUserIds: [] }),
    ).toBe(true)
  })
  it('does not match someone outside the team', () => {
    expect(
      subscriptionMatchesReport(sub, { authorUserIds: [], teamLeadUserIds: ['todd'] }, { authorUserId: 'sam', leaderUserIds: ['ana'] }),
    ).toBe(false)
    expect(
      subscriptionMatchesReport(sub, { authorUserIds: [], teamLeadUserIds: ['todd'] }, { authorUserId: 'sam', leaderUserIds: [] }),
    ).toBe(false)
  })
  it('named authors and team leads combine; disabled never matches', () => {
    expect(
      subscriptionMatchesReport(sub, { authorUserIds: ['sam'], teamLeadUserIds: ['todd'] }, { authorUserId: 'sam', leaderUserIds: [] }),
    ).toBe(true)
    expect(
      subscriptionMatchesReport({ enabled: false, all_authors: false }, { authorUserIds: [], teamLeadUserIds: ['todd'] }, { authorUserId: 'todd', leaderUserIds: [] }),
    ).toBe(false)
  })
})

describe('subscriptionMatchesAuthor', () => {
  it('matches everything when all_authors', () => {
    expect(subscriptionMatchesAuthor({ enabled: true, all_authors: true }, [], 'anyone')).toBe(true)
  })
  it('matches only listed authors otherwise', () => {
    expect(subscriptionMatchesAuthor({ enabled: true, all_authors: false }, ['a', 'b'], 'b')).toBe(true)
    expect(subscriptionMatchesAuthor({ enabled: true, all_authors: false }, ['a', 'b'], 'c')).toBe(false)
  })
  it('never matches when disabled', () => {
    expect(subscriptionMatchesAuthor({ enabled: false, all_authors: true }, [], 'x')).toBe(false)
    expect(subscriptionMatchesAuthor({ enabled: false, all_authors: false }, ['x'], 'x')).toBe(false)
  })
})

describe('recipientDisplayLabel', () => {
  const names = new Map([['u1', 'Paige']])
  it('prefers an explicit label', () => {
    expect(
      recipientDisplayLabel({ recipient_user_id: 'u1', recipient_email: null, label: 'Owner' }, names),
    ).toBe('Owner')
  })
  it('falls back to user name', () => {
    expect(
      recipientDisplayLabel({ recipient_user_id: 'u1', recipient_email: null, label: null }, names),
    ).toBe('Paige')
  })
  it('falls back to email for external recipients', () => {
    expect(
      recipientDisplayLabel(
        { recipient_user_id: null, recipient_email: 'gc@build.com', label: '' },
        names,
      ),
    ).toBe('gc@build.com')
  })
})

describe('scopeSummary', () => {
  const names = new Map([
    ['a', 'Ann'],
    ['b', 'Ben'],
    ['c', 'Cara'],
  ])
  it('reports all', () => {
    expect(scopeSummary({ all_authors: true }, [], names)).toBe('All reports')
  })
  it('lists up to two names', () => {
    expect(scopeSummary({ all_authors: false }, ['a', 'b'], names)).toBe('Reports from Ann & Ben')
  })
  it('summarizes more than two', () => {
    expect(scopeSummary({ all_authors: false }, ['a', 'b', 'c'], names)).toBe(
      'Reports from Ann, Ben +1 more',
    )
  })
  it('handles empty author list', () => {
    expect(scopeSummary({ all_authors: false }, [], names)).toBe('No authors selected')
  })
  it('names team leads as teams (v2.3480)', () => {
    expect(scopeSummary({ all_authors: false }, [], names, ['a'])).toBe("Reports from Ann's team")
    expect(scopeSummary({ all_authors: false }, ['b'], names, ['a'])).toBe("Reports from Ben & Ann's team")
    expect(scopeSummary({ all_authors: false }, ['b', 'c'], names, ['a'])).toBe('Reports from Ben, Cara +1 more')
  })
})
