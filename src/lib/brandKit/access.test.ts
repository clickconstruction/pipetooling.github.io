import { describe, expect, it } from 'vitest'
import { ROLES } from '../userRoles'
import { approvesCardLooks, makesOwnCard } from './access'

describe('who sees the two card-and-footer cards (punch list #313)', () => {
  it('the owner and a dev approve looks and sizes, and nobody else', () => {
    expect(ROLES.filter(approvesCardLooks).sort()).toEqual(['dev', 'master_technician'])
    expect(approvesCardLooks(null)).toBe(false)
    expect(approvesCardLooks(undefined)).toBe(false)
  })

  it('every role but a subcontractor makes a card of their own', () => {
    expect(ROLES.filter((r) => !makesOwnCard(r))).toEqual(['subcontractor'])
    expect(makesOwnCard(null)).toBe(false)
    expect(makesOwnCard(undefined)).toBe(false)
  })
})
