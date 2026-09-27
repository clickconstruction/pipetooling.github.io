import { describe, expect, it } from 'vitest'
import { isPhoneOfficeRole, needsYouInitialMode, needsYouTrailChips, needsYouWalkOrder, pushNeedsYouHandled } from './phoneOffice'

const items = [{ key: 'a', title: 'A' }, { key: 'b', title: 'B' }, { key: 'c', title: 'C' }]

describe('needsYouInitialMode', () => {
  it('an office role on a phone opens on Walk the first time; everyone else on Cards', () => {
    for (const role of ['assistant', 'controller', 'primary', 'estimator']) expect(needsYouInitialMode({ stored: null, isPhone: true, role })).toBe('walk')
    for (const role of ['dev', 'master_technician', 'subcontractor', 'helpers', 'superintendent', null]) expect(needsYouInitialMode({ stored: null, isPhone: true, role })).toBe('cards')
    expect(needsYouInitialMode({ stored: null, isPhone: false, role: 'assistant' })).toBe('cards')
    expect(isPhoneOfficeRole('assistant')).toBe(true)
    expect(isPhoneOfficeRole('dev')).toBe(false)
  })
  it('a saved choice wins on any device and for any role', () => {
    expect(needsYouInitialMode({ stored: 'cards', isPhone: true, role: 'assistant' })).toBe('cards')
    expect(needsYouInitialMode({ stored: 'walk', isPhone: false, role: 'dev' })).toBe('walk')
  })
})

describe('needsYouWalkOrder', () => {
  it('moves skipped items to the back in the order they were skipped', () => {
    expect(needsYouWalkOrder(items, []).map((i) => i.key)).toEqual(['a', 'b', 'c'])
    expect(needsYouWalkOrder(items, ['a']).map((i) => i.key)).toEqual(['b', 'c', 'a'])
    expect(needsYouWalkOrder(items, ['b', 'a']).map((i) => i.key)).toEqual(['c', 'b', 'a'])
    expect(needsYouWalkOrder(items, ['a', 'a']).map((i) => i.key)).toEqual(['b', 'c', 'a'])
  })
  it('ignores a skipped key that left the list, and starts over once everything was skipped', () => {
    expect(needsYouWalkOrder(items, ['gone', 'b']).map((i) => i.key)).toEqual(['a', 'c', 'b'])
    expect(needsYouWalkOrder(items, ['a', 'b', 'c']).map((i) => i.key)).toEqual(['a', 'b', 'c'])
    expect(needsYouWalkOrder([], ['a'])).toEqual([])
  })
})

describe('the handled-this-visit trail', () => {
  it('is newest first with one entry per item, and acting after a skip reads as acted', () => {
    let trail = pushNeedsYouHandled([], items[0]!, 'skipped')
    trail = pushNeedsYouHandled(trail, items[1]!, 'acted')
    expect(trail.map((t) => `${t.key}:${t.how}`)).toEqual(['b:acted', 'a:skipped'])
    trail = pushNeedsYouHandled(trail, items[0]!, 'acted')
    expect(trail.map((t) => `${t.key}:${t.how}`)).toEqual(['a:acted', 'b:acted'])
    trail = pushNeedsYouHandled(trail, items[0]!, 'skipped')
    expect(trail[0]).toEqual({ key: 'a', title: 'A', how: 'acted' })
  })
  it('says which handled items are still on the list', () => {
    const trail = pushNeedsYouHandled(pushNeedsYouHandled([], items[0]!, 'acted'), { key: 'z', title: 'Z' }, 'acted')
    expect(needsYouTrailChips(trail, items).map((c) => `${c.key}:${c.open}`)).toEqual(['z:false', 'a:true'])
  })
})
