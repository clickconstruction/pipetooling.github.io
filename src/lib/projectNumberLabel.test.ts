import { describe, expect, it } from 'vitest'
import {
  formatProjectNumberBadge,
  formatProjectNumberLabel,
} from './projectNumberLabel'

describe('formatProjectNumberLabel', () => {
  it('returns null for null', () => {
    expect(formatProjectNumberLabel(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(formatProjectNumberLabel(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(formatProjectNumberLabel('')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(formatProjectNumberLabel('   ')).toBeNull()
    expect(formatProjectNumberLabel('\t\n')).toBeNull()
  })

  it('formats a numeric string as "Project #N"', () => {
    expect(formatProjectNumberLabel('42')).toBe('Project #42')
    expect(formatProjectNumberLabel('1')).toBe('Project #1')
  })

  it('trims surrounding whitespace before formatting', () => {
    expect(formatProjectNumberLabel(' 42 ')).toBe('Project #42')
    expect(formatProjectNumberLabel('\n42\t')).toBe('Project #42')
  })
})

describe('formatProjectNumberBadge', () => {
  it('returns null for null', () => {
    expect(formatProjectNumberBadge(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(formatProjectNumberBadge(undefined)).toBeNull()
  })

  it('returns null for empty / whitespace-only string', () => {
    expect(formatProjectNumberBadge('')).toBeNull()
    expect(formatProjectNumberBadge('   ')).toBeNull()
  })

  it('formats as "#N"', () => {
    expect(formatProjectNumberBadge('42')).toBe('#42')
    expect(formatProjectNumberBadge('1')).toBe('#1')
  })

  it('trims surrounding whitespace before formatting', () => {
    expect(formatProjectNumberBadge(' 42 ')).toBe('#42')
  })
})
