import { describe, expect, it } from 'vitest'
import { HELP_GUIDES } from '../helpGuideRegistry'
import { plainWordsFailures } from '../plainWords'
import { OFFLINE_ERROR_MESSAGE } from '../networkErrorMessage'
import { AUTH_LOCK_ERROR_MESSAGE } from '../../utils/errorHandling'
import { ERROR_DOOR_WORDS, ERROR_FAMILIES, errorDoor, errorFamilyOf, errorGuideHref } from './errorGuides'

const guides = new Map(HELP_GUIDES.map((g) => [g.slug, g.title]))

describe('the guide behind an error line (punch list #187 PR 6)', () => {
  it('names the family from the class the formatters already decide', () => {
    expect(errorFamilyOf({ kind: 'network', message: OFFLINE_ERROR_MESSAGE })).toBe('network')
    expect(errorFamilyOf({ kind: 'server', code: '42501' })).toBe('access')
    expect(errorFamilyOf({ kind: 'server', code: 'PGRST116' })).toBe('broken-link')
    expect(errorFamilyOf({ kind: 'server', code: '22P02' })).toBe('broken-link')
    expect(errorFamilyOf({ kind: 'unknown', message: AUTH_LOCK_ERROR_MESSAGE })).toBe('sign-in')
    expect(errorFamilyOf({ kind: 'unknown', message: 'save payment did not respond within 20s' })).toBe('timeout')
    expect(errorFamilyOf({ kind: 'server', code: '23514', message: 'Failed to save payment: violates check constraint' })).toBe('server-words')
    expect(errorFamilyOf({ kind: 'unknown', message: "You don't have permission to update job." })).toBe('access')
    expect(errorFamilyOf({ kind: 'unknown', message: 'Something else' })).toBe('unknown')
  })

  it('every family has three rows in plain words and a guide on the registry under its title', () => {
    for (const f of ERROR_FAMILIES) {
      const d = errorDoor(f)
      expect(d.rows.map((r) => r.key)).toEqual(['what', 'saved', 'do'])
      for (const r of d.rows) expect(plainWordsFailures(r.note), `${f} · ${r.key}`).toEqual([])
      expect(guides.get(d.guide.slug), `${f}: ${d.guide.slug}`).toBe(d.guide.title)
    }
    expect(plainWordsFailures(ERROR_DOOR_WORDS.tip)).toEqual([])
  })

  it('the door names itself as the error’s, and only the families worth a retry offer one', () => {
    expect(errorGuideHref(errorDoor('network'))).toBe('/help?g=what-no-connection-means&via=error')
    expect(ERROR_FAMILIES.filter((f) => errorDoor(f).retry)).toEqual(['network', 'sign-in', 'timeout', 'page'])
  })
})
