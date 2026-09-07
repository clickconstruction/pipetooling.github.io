import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))
vi.mock('../../utils/errorHandling', () => ({ withSupabaseRetry: vi.fn() }))

import { DEBIT_CARD_ROLE_OPTIONS, debitCardsHref, parseDebitCardRole } from './debitCards'

describe('debit card roles', () => {
  it('only "company" is a company card; everything else is a person card', () => {
    expect(parseDebitCardRole('company')).toBe('company')
    expect(parseDebitCardRole('person')).toBe('person')
    expect(parseDebitCardRole('COMPANY')).toBe('person')
    expect(parseDebitCardRole(null)).toBe('person')
    expect(parseDebitCardRole(undefined)).toBe('person')
  })
  it('offers exactly the two roles, person first', () => {
    expect(DEBIT_CARD_ROLE_OPTIONS.map((o) => o.key)).toEqual(['person', 'company'])
    for (const o of DEBIT_CARD_ROLE_OPTIONS) {
      expect(o.label.length).toBeGreaterThan(0)
      expect(o.hint.length).toBeGreaterThan(0)
    }
  })
})

describe('debitCardsHref', () => {
  it('opens the Sorting tab on one card, URL-encoded, or the modal generally', () => {
    expect(debitCardsHref('card 1/a')).toBe('/banking?tab=sorting&cards=card%201%2Fa')
    expect(debitCardsHref()).toBe('/banking?tab=sorting&cards=1')
    expect(debitCardsHref(null)).toBe('/banking?tab=sorting&cards=1')
    expect(debitCardsHref('')).toBe('/banking?tab=sorting&cards=1')
  })
})
