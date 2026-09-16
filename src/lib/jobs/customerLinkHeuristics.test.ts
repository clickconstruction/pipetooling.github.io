import { describe, expect, it } from 'vitest'
import { customerListImpliesLinkedRow } from './customerLinkHeuristics'

const c = (name: string | null, master_user_id: string) => ({ name, master_user_id })

describe('customerListImpliesLinkedRow', () => {
  it('is false for an empty or blank name', () => {
    expect(customerListImpliesLinkedRow([c('Acme', 'm1')], 'm1', '')).toBe(false)
    expect(customerListImpliesLinkedRow([c('Acme', 'm1')], 'm1', '   ')).toBe(false)
  })

  it('matches exactly one customer under the same master, case- and space-insensitively', () => {
    expect(customerListImpliesLinkedRow([c('  acme ', 'm1'), c('Other', 'm1')], 'm1', 'ACME')).toBe(true)
  })

  it('refuses when the same master has two rows with that name', () => {
    expect(customerListImpliesLinkedRow([c('Acme', 'm1'), c('Acme', 'm1')], 'm1', 'Acme')).toBe(false)
  })

  it('falls back to a single match under another master, but not to several', () => {
    expect(customerListImpliesLinkedRow([c('Acme', 'm2')], 'm1', 'Acme')).toBe(true)
    expect(customerListImpliesLinkedRow([c('Acme', 'm2'), c('Acme', 'm3')], 'm1', 'Acme')).toBe(false)
  })

  it('prefers the same-master row over other masters', () => {
    expect(customerListImpliesLinkedRow([c('Acme', 'm2'), c('Acme', 'm1')], 'm1', 'Acme')).toBe(true)
  })

  it('treats a null name as no match', () => {
    expect(customerListImpliesLinkedRow([c(null, 'm1')], 'm1', 'Acme')).toBe(false)
  })
})
