import { describe, expect, it } from 'vitest'
import { YOUR_PEOPLE_ACTS, YOUR_PEOPLE_NAME, YOUR_PEOPLE_NAME_ROOM, YOUR_PEOPLE_ROW } from './dashboardYourPeopleRow'

describe('dashboardYourPeopleRow', () => {
  it('lets the row wrap, so the chip and Remind drop to their own line when they do not fit beside the name', () => {
    expect(YOUR_PEOPLE_ROW.display).toBe('flex')
    expect(YOUR_PEOPLE_ROW.flexWrap).toBe('wrap')
  })

  it('keeps the name its room before it gives any up, and lets it shrink so a long card title is cut with dots', () => {
    expect(YOUR_PEOPLE_NAME_ROOM).toBe('9rem')
    expect(YOUR_PEOPLE_NAME.flex).toBe('1 1 9rem')
    expect(YOUR_PEOPLE_NAME.minWidth).toBe(0)
  })

  it('never lets the chip and Remind stand wider than the row: the group shrinks and its press goes under the chip', () => {
    // It was `flexShrink: 0`, which is what pushed Remind out of the card on a phone.
    expect(YOUR_PEOPLE_ACTS.flex).toBe('0 1 auto')
    expect(YOUR_PEOPLE_ACTS.flexShrink).toBeUndefined()
    expect([YOUR_PEOPLE_ACTS.minWidth, YOUR_PEOPLE_ACTS.maxWidth, YOUR_PEOPLE_ACTS.flexWrap]).toEqual([0, '100%', 'wrap'])
    // On its own line it keeps to the right, under the name's right edge.
    expect([YOUR_PEOPLE_ACTS.marginLeft, YOUR_PEOPLE_ACTS.justifyContent]).toEqual(['auto', 'flex-end'])
  })
})
