import { describe, expect, it } from 'vitest'
import {
  HELP_FEEDBACK_BODY_MAX,
  sortHelpFeedbackRows,
  validateHelpFeedbackBody,
} from './helpFeedbackHelpers'

describe('validateHelpFeedbackBody', () => {
  it('trims surrounding whitespace and returns the trimmed body', () => {
    const r = validateHelpFeedbackBody('  needs a search shortcut  ')
    expect(r).toEqual({ ok: true, body: 'needs a search shortcut' })
  })

  it('rejects empty and whitespace-only input', () => {
    expect(validateHelpFeedbackBody('').ok).toBe(false)
    expect(validateHelpFeedbackBody('   \n ').ok).toBe(false)
  })

  it('accepts exactly the max length and rejects one more', () => {
    expect(validateHelpFeedbackBody('x'.repeat(HELP_FEEDBACK_BODY_MAX)).ok).toBe(true)
    expect(validateHelpFeedbackBody('x'.repeat(HELP_FEEDBACK_BODY_MAX + 1)).ok).toBe(false)
  })
})

describe('sortHelpFeedbackRows', () => {
  const row = (
    status: 'open' | 'closed',
    created_at: string | null,
    closed_at: string | null = null,
  ) => ({ status, created_at, closed_at })

  it('puts open rows before closed regardless of dates', () => {
    const sorted = sortHelpFeedbackRows([
      row('closed', '2026-07-09T10:00:00Z', '2026-07-09T11:00:00Z'),
      row('open', '2026-07-01T10:00:00Z'),
    ])
    expect(sorted.map((r) => r.status)).toEqual(['open', 'closed'])
  })

  it('orders open rows by created_at desc and closed rows by closed_at desc', () => {
    const sorted = sortHelpFeedbackRows([
      row('open', '2026-07-01T10:00:00Z'),
      row('open', '2026-07-02T10:00:00Z'),
      row('closed', '2026-07-05T10:00:00Z', '2026-07-06T10:00:00Z'),
      row('closed', '2026-07-03T10:00:00Z', '2026-07-08T10:00:00Z'),
    ])
    expect(sorted.map((r) => r.created_at)).toEqual([
      '2026-07-02T10:00:00Z',
      '2026-07-01T10:00:00Z',
      '2026-07-03T10:00:00Z',
      '2026-07-05T10:00:00Z',
    ])
  })

  it('falls back to created_at for closed rows without closed_at and tolerates nulls', () => {
    const sorted = sortHelpFeedbackRows([
      row('closed', '2026-07-01T10:00:00Z'),
      row('closed', '2026-07-04T10:00:00Z'),
      row('closed', null),
    ])
    expect(sorted[0]!.created_at).toBe('2026-07-04T10:00:00Z')
    expect(sorted[2]!.created_at).toBeNull()
  })

  it('does not mutate the input and is stable on sorted input', () => {
    const input = [row('open', '2026-07-02T10:00:00Z'), row('open', '2026-07-01T10:00:00Z')]
    const once = sortHelpFeedbackRows(input)
    expect(input[0]!.created_at).toBe('2026-07-02T10:00:00Z')
    expect(sortHelpFeedbackRows(once)).toEqual(once)
  })
})
