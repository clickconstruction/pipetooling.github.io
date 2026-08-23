import { describe, expect, it } from 'vitest'
import { GC_STATEMENT_CC_MAX, ccTextIncludes, formatCcSummary, parseCcEmails, toggleCcEmailInText } from './gcStatementCc'

describe('parseCcEmails', () => {
  it('splits on commas/semicolons/whitespace, lower-cases, dedupes, drops the To', () => {
    const r = parseCcEmails(' Malachi@Click.com, robert@click.com; malachi@click.com  ap@rmc.com ', 'AP@rmc.com')
    expect(r.emails).toEqual(['malachi@click.com', 'robert@click.com'])
    expect(r.invalid).toEqual([])
    expect(r.overflow).toBe(false)
  })
  it('reports invalid tokens without dropping the valid ones', () => {
    const r = parseCcEmails('bob, laura@click.com, nope@', null)
    expect(r.emails).toEqual(['laura@click.com'])
    expect(r.invalid).toEqual(['bob', 'nope@'])
  })
  it('caps at the max and flags overflow', () => {
    const many = Array.from({ length: GC_STATEMENT_CC_MAX + 2 }, (_, i) => `u${i}@x.com`).join(',')
    const r = parseCcEmails(many)
    expect(r.emails).toHaveLength(GC_STATEMENT_CC_MAX)
    expect(r.overflow).toBe(true)
  })
  it('empty → empty', () => {
    expect(parseCcEmails('')).toEqual({ emails: [], invalid: [], overflow: false })
  })
})

describe('toggleCcEmailInText / ccTextIncludes', () => {
  it('adds then removes a chip email, preserving typed addresses', () => {
    const t1 = toggleCcEmailInText('ap@rmc.com', 'Malachi@click.com')
    expect(t1).toBe('ap@rmc.com, malachi@click.com')
    expect(ccTextIncludes(t1, 'MALACHI@click.com')).toBe(true)
    expect(toggleCcEmailInText(t1, 'malachi@click.com')).toBe('ap@rmc.com')
  })
  it('formatCcSummary', () => {
    expect(formatCcSummary([])).toBe('')
    expect(formatCcSummary(['a@b.c', 'd@e.f'])).toBe('cc a@b.c, d@e.f')
  })
})
