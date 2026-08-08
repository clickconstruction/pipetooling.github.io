import { describe, expect, it } from 'vitest'

import { buildAccountManDisplay, parseAccountManRelationship } from './accountMan'

describe('parseAccountManRelationship', () => {
  it('accepts the three levels and rejects everything else', () => {
    expect(parseAccountManRelationship('primary')).toBe('primary')
    expect(parseAccountManRelationship('preferred')).toBe('preferred')
    expect(parseAccountManRelationship('only')).toBe('only')
    expect(parseAccountManRelationship('boss')).toBe(null)
    expect(parseAccountManRelationship(null)).toBe(null)
    expect(parseAccountManRelationship(undefined)).toBe(null)
  })
})

describe('buildAccountManDisplay', () => {
  const base = {
    account_manager_user_id: 'u1',
    account_manager_relationship: 'only',
    account_manager: { name: 'Malachi' },
  }

  it('maps relationships to display variants', () => {
    expect(buildAccountManDisplay(base)).toEqual({ name: 'Malachi', relationship: 'only', variant: 'only' })
    expect(buildAccountManDisplay({ ...base, account_manager_relationship: 'preferred' })?.variant).toBe('preferred')
    expect(buildAccountManDisplay({ ...base, account_manager_relationship: 'primary' })?.variant).toBe('quiet')
  })

  it('treats an unknown or missing relationship as primary', () => {
    expect(buildAccountManDisplay({ ...base, account_manager_relationship: null })?.relationship).toBe('primary')
    expect(buildAccountManDisplay({ ...base, account_manager_relationship: 'x' })?.variant).toBe('quiet')
  })

  it('returns null without a manager id or resolvable name', () => {
    expect(buildAccountManDisplay({ ...base, account_manager_user_id: null })).toBe(null)
    expect(buildAccountManDisplay({ ...base, account_manager: null })).toBe(null)
    expect(buildAccountManDisplay({ ...base, account_manager: { name: '  ' } })).toBe(null)
  })
})
