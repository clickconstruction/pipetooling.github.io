import { describe, expect, it } from 'vitest'
import { lensForcesNoLoginOpen, parseUsersTabLens, resolveUsersTabLens, usersTabLensesFor } from './usersTabLens'

describe('Users tab lenses', () => {
  it('parses the URL param and falls back to contact for anything else', () => {
    expect(parseUsersTabLens('pay')).toBe('pay')
    expect(parseUsersTabLens('account')).toBe('account')
    expect(parseUsersTabLens('wages')).toBe('contact')
    expect(parseUsersTabLens(null)).toBe('contact')
  })

  it('the pay lens is for pay viewers; a phone shows contact only', () => {
    expect(usersTabLensesFor({ canAccessPay: true, narrowViewport: false })).toEqual(['contact', 'account', 'pay'])
    expect(usersTabLensesFor({ canAccessPay: false, narrowViewport: false })).toEqual(['contact', 'account'])
    expect(usersTabLensesFor({ canAccessPay: true, narrowViewport: true })).toEqual(['contact'])
  })

  it('a lens the viewer may not use resolves to contact, never a blank roster', () => {
    expect(resolveUsersTabLens('pay', { canAccessPay: false, narrowViewport: false })).toBe('contact')
    expect(resolveUsersTabLens('pay', { canAccessPay: true, narrowViewport: false })).toBe('pay')
    expect(resolveUsersTabLens('account', { canAccessPay: false, narrowViewport: true })).toBe('contact')
  })

  it('the pay lens keeps the no-login fold open so every pay-config person shows', () => {
    expect(lensForcesNoLoginOpen('pay')).toBe(true)
    expect(lensForcesNoLoginOpen('contact')).toBe(false)
  })
})
