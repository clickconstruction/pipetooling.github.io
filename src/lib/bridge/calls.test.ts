import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { CALL_LINK_NAMES, deskStatus, isStageLink, shortUsd, stageKindOf } from './calls'
import { LINK_DESK } from './linkDesk'

describe('the Bridge’s links', () => {
  it('names the five stages and the three resources, and tells a stage from a resource', () => {
    expect(Object.keys(CALL_LINK_NAMES)).toEqual(['market', 'sales', 'build', 'bill', 'collect', 'decision', 'capital', 'talent'])
    expect(isStageLink('bill')).toBe(true)
    expect(isStageLink('capital')).toBe(false)
    expect(stageKindOf('capital')).toBe('not enough money')
    expect(stageKindOf('decision')).toBe('bottlenecks at the leadership level')
  })

  it('says dollars short', () => {
    expect(shortUsd(142_300)).toBe('$142k')
    expect(shortUsd(6_400)).toBe('$6.4k')
    expect(shortUsd(9_000)).toBe('$9k')
    expect(shortUsd(350)).toBe('$350')
  })

  it('words the desk status: the page’s own reading, a resource, or not the link today', () => {
    expect(deskStatus({ link: 'bill', linkId: 'bill' })).toBe('nominated by the page: the most weeks to clear what is already waiting')
    expect(deskStatus({ link: 'decision', linkId: 'bill' })).toBe('a resource; it throttles a link or shows its symptom')
    expect(deskStatus({ link: 'build', linkId: 'bill' })).toBe('not the link today, by the page’s reading')
  })

  it('keeps the desk in plain words', () => {
    for (const [link, d] of Object.entries(LINK_DESK)) {
      for (const text of [d.what, d.why, d.how, ...d.moves.map((m) => m.title)]) expect(plainWordsFailures(text), `${link}: ${text}`).toEqual([])
    }
  })
})
