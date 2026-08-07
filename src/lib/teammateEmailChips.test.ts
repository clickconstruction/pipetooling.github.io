import { describe, expect, it } from 'vitest'

import { buildTeammateEmailChips, chipMatchesValue } from './teammateEmailChips'

const u = (id: string, name: string, email: string | null, role: string) => ({ id, name, email, role })

describe('buildTeammateEmailChips', () => {
  it('keeps only office-capable roles with a real email, sorted by name', () => {
    const chips = buildTeammateEmailChips([
      u('1', 'Wendi Ward', 'wendi@x.com', 'estimator'),
      u('2', 'Malachi Cole', 'malachi@x.com', 'assistant'),
      u('3', 'Grace Hill', 'grace@x.com', 'controller'),
      u('4', 'No Email', null, 'dev'),
      u('5', 'Bad Email', 'not-an-email', 'dev'),
      u('6', 'Sub Sam', 'sam@x.com', 'subcontractor'),
    ])
    expect(chips.map((c) => c.label)).toEqual(['Grace', 'Malachi'])
  })

  it('normalizes emails to trimmed lowercase', () => {
    const chips = buildTeammateEmailChips([u('1', 'Grace Hill', '  Grace@X.com ', 'controller')])
    expect(chips[0]?.email).toBe('grace@x.com')
  })

  it('disambiguates colliding first names with a last initial', () => {
    const chips = buildTeammateEmailChips([
      u('1', 'Chris Aldana', 'ca@x.com', 'dev'),
      u('2', 'Chris Boone', 'cb@x.com', 'assistant'),
      u('3', 'Grace Hill', 'grace@x.com', 'controller'),
    ])
    expect(chips.map((c) => c.label)).toEqual(['Chris A.', 'Chris B.', 'Grace'])
  })

  it('falls back to the email prefix when the name is blank', () => {
    const chips = buildTeammateEmailChips([u('1', '  ', 'frontdesk@x.com', 'assistant')])
    expect(chips[0]?.label).toBe('frontdesk')
    expect(chips[0]?.title).toBe('frontdesk@x.com · frontdesk@x.com · assistant')
  })

  it('builds the tooltip as name · email · humanized role', () => {
    const chips = buildTeammateEmailChips([u('1', 'Chris Boone', 'cb@x.com', 'master_technician')])
    expect(chips[0]?.title).toBe('Chris Boone · cb@x.com · master technician')
  })
})

describe('chipMatchesValue', () => {
  it('matches case- and whitespace-insensitively', () => {
    expect(chipMatchesValue('grace@x.com', '  Grace@X.com ')).toBe(true)
    expect(chipMatchesValue('grace@x.com', 'malachi@x.com')).toBe(false)
  })
})
