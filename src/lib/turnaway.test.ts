import { describe, expect, it } from 'vitest'
import {
  TURNAWAY_PENDING_ACTION,
  TURNAWAY_REASONS,
  TURNAWAY_TEMPLATE_NAME,
  buildTurnawayDispatchTitle,
  buildTurnawayFieldValues,
  buildTurnawayReferenceSummary,
  findTurnawayTemplateId,
  isTurnawayTemplateName,
  parseTurnawayReason,
  turnawayReasonLabel,
} from './turnaway'

describe('turnawayReasonLabel', () => {
  it('maps every reason to a human label', () => {
    expect(turnawayReasonLabel('client_not_home')).toBe('Client not home')
    expect(turnawayReasonLabel('site_not_ready')).toBe('Site not ready')
    expect(turnawayReasonLabel('other')).toBe('Other')
  })
})

describe('buildTurnawayFieldValues', () => {
  it('uses the seeded template field labels as keys with the human reason label', () => {
    expect(buildTurnawayFieldValues('client_not_home', 'Gate locked')).toEqual({
      Reason: 'Client not home',
      Note: 'Gate locked',
    })
  })

  it('trims the note and keeps the Note key when blank', () => {
    expect(buildTurnawayFieldValues('site_not_ready', '   ')).toEqual({
      Reason: 'Site not ready',
      Note: '',
    })
    expect(buildTurnawayFieldValues('other', '  drywall crew still in  ')).toEqual({
      Reason: 'Other',
      Note: 'drywall crew still in',
    })
  })
})

describe('buildTurnawayDispatchTitle', () => {
  it('composes label, reason, and note', () => {
    expect(
      buildTurnawayDispatchTitle({ jobLabel: 'J500 Smith House', reason: 'client_not_home', note: 'No answer at door' }),
    ).toBe('Turnaway: J500 Smith House — Client not home. No answer at door')
  })

  it('omits the note sentence when the note is blank', () => {
    expect(
      buildTurnawayDispatchTitle({ jobLabel: 'J500 Smith House', reason: 'site_not_ready', note: '  ' }),
    ).toBe('Turnaway: J500 Smith House — Site not ready')
  })

  it('clips to 2000 chars ending with an ellipsis', () => {
    const title = buildTurnawayDispatchTitle({
      jobLabel: 'J500 Smith House',
      reason: 'other',
      note: 'x'.repeat(3000),
    })
    expect(title.length).toBe(2000)
    expect(title.endsWith('…')).toBe(true)
  })
})

describe('buildTurnawayReferenceSummary / parseTurnawayReason', () => {
  it('round-trips every reason', () => {
    for (const reason of TURNAWAY_REASONS) {
      const summary = buildTurnawayReferenceSummary(reason, {
        hcpNumber: 'J500',
        jobName: 'Smith House',
        jobAddress: '123 Main St',
      })
      expect(parseTurnawayReason(summary)).toBe(reason)
    }
  })

  it('joins non-empty job parts and skips placeholder dashes', () => {
    expect(
      buildTurnawayReferenceSummary('client_not_home', {
        hcpNumber: 'J500',
        jobName: '—',
        jobAddress: '123 Main St',
      }),
    ).toBe('Turnaway (Client not home): J500 · 123 Main St')
    expect(
      buildTurnawayReferenceSummary('site_not_ready', { hcpNumber: '—', jobName: '', jobAddress: ' ' }),
    ).toBe('Turnaway (Site not ready)')
  })

  it('parses case-insensitively and tolerates surrounding whitespace', () => {
    expect(parseTurnawayReason('  turnaway (CLIENT NOT HOME): J500  ')).toBe('client_not_home')
  })

  it('returns null for null, unrelated, or unknown-reason summaries', () => {
    expect(parseTurnawayReason(null)).toBeNull()
    expect(parseTurnawayReason(undefined)).toBeNull()
    expect(parseTurnawayReason('')).toBeNull()
    expect(parseTurnawayReason('Job 500 needs billing')).toBeNull()
    expect(parseTurnawayReason('Turnaway (weather delay): J500')).toBeNull()
  })
})

describe('template helpers', () => {
  it('finds the Turnaway template by exact name, ignoring others', () => {
    const templates = [
      { id: 'a', name: 'Status Report' },
      { id: 'b', name: 'Job Complete' },
      { id: 'c', name: 'Turnaway' },
    ]
    expect(findTurnawayTemplateId(templates)).toBe('c')
    expect(findTurnawayTemplateId(templates.slice(0, 2))).toBeUndefined()
    expect(findTurnawayTemplateId([])).toBeUndefined()
  })

  it('matches the template name with trim and case tolerance', () => {
    expect(isTurnawayTemplateName(' Turnaway ')).toBe(true)
    expect(isTurnawayTemplateName('turnaway')).toBe(true)
    expect(isTurnawayTemplateName('Turnaway Report')).toBe(false)
  })
})

describe('constants', () => {
  it('pins the cross-PR contract tokens', () => {
    expect(TURNAWAY_TEMPLATE_NAME).toBe('Turnaway')
    expect(TURNAWAY_PENDING_ACTION).toBe('trip_charge_turnaway')
  })
})
