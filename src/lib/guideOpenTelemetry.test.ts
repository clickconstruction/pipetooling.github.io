import { describe, expect, it } from 'vitest'
import {
  GUIDE_DOORS,
  guideDoorOf,
  guideOpenEvent,
  guideOpenedTarget,
  isGuideDoor,
  parseGuideOpenedTarget,
  withGuideDoor,
} from './guideOpenTelemetry'

describe('guideOpenTelemetry (punch list #187 PR 1)', () => {
  it('reads a door the app knows and reads anything else as a link', () => {
    for (const d of GUIDE_DOORS) expect(guideDoorOf(d)).toBe(d)
    expect(guideDoorOf(null)).toBe('link')
    expect(guideDoorOf('')).toBe('link')
    expect(guideDoorOf('window')).toBe('link')
    expect(isGuideDoor('legend')).toBe(true)
    expect(isGuideDoor(3)).toBe(false)
  })

  it('puts the door on an address once, keeping the query and the heading', () => {
    expect(withGuideDoor('/help?g=quickfill', 'walk')).toBe('/help?g=quickfill&via=walk')
    expect(withGuideDoor('/help?g=texas-lien-rules#the-s-53-056-notice', 'legend')).toBe('/help?g=texas-lien-rules&via=legend#the-s-53-056-notice')
    expect(withGuideDoor('/help?g=x&via=walk', 'share')).toBe('/help?g=x&via=share')
    expect(withGuideDoor('/help', 'box')).toBe('/help?via=box')
  })

  it('writes one row per open with the door in the hash, and a missing slug as guide_missing', () => {
    expect(guideOpenedTarget('bill a customer', 'list')).toBe('/help?g=bill%20a%20customer#via=list')
    expect(guideOpenEvent('quickfill', true, 'search')).toEqual({ control: 'guide_opened', target: '/help?g=quickfill#via=search' })
    expect(guideOpenEvent('quickfill', true, null)).toEqual({ control: 'guide_opened', target: '/help?g=quickfill#via=link' })
    expect(guideOpenEvent('not-a-guide', false, 'walk')).toEqual({ control: 'guide_missing', target: '/help?g=not-a-guide#via=walk' })
  })

  it('reads a row back to its slug and door, and refuses another shape', () => {
    expect(parseGuideOpenedTarget('/help?g=bill%20a%20customer#via=list')).toEqual({ slug: 'bill a customer', door: 'list' })
    expect(parseGuideOpenedTarget('/help?g=x#via=nowhere')).toEqual({ slug: 'x', door: 'link' })
    expect(parseGuideOpenedTarget('/jobs?tab=stages')).toBeNull()
    expect(parseGuideOpenedTarget('/help?g=x')).toBeNull()
  })
})
