import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { BUILDER_SIDES, BUILDER_SIDE_PARAM, BUILDER_SIDE_SWITCH, builderSideFromSearch, builderSideHolds, withBuilderSide } from './builderSide'

describe('the side the address asks for', () => {
  it('is Share only when the address says share, and Edit for everything else', () => {
    expect(builderSideFromSearch('?tab=builder&builder=sub-nda&side=share')).toBe('share')
    expect(builderSideFromSearch('tab=builder&side=share')).toBe('share')
    expect(builderSideFromSearch(new URLSearchParams('side=share'))).toBe('share')
    for (const search of ['', '?tab=builder&builder=sub-nda', '?side=edit', '?side=', '?side=Share', '?side=sharing', '?side=anything']) expect(builderSideFromSearch(search)).toBe('edit')
  })
})

describe('the address with a side on it', () => {
  it('adds the key for Share and keeps every other key', () => {
    expect(withBuilderSide('?tab=builder&builder=sub-nda', 'share').toString()).toBe('tab=builder&builder=sub-nda&side=share')
    expect(withBuilderSide(new URLSearchParams('tab=builder&builder=sub-nda&side=share'), 'share').toString()).toBe('tab=builder&builder=sub-nda&side=share')
  })

  it('drops the key for Edit, so the address a builder opens on has one form', () => {
    expect(withBuilderSide('?tab=builder&builder=sub-nda&side=share', 'edit').toString()).toBe('tab=builder&builder=sub-nda')
    expect(withBuilderSide('?tab=builder&builder=sub-nda', 'edit').toString()).toBe('tab=builder&builder=sub-nda')
  })

  it('never changes what it was handed', () => {
    const was = new URLSearchParams('tab=builder')
    withBuilderSide(was, 'share')
    expect(was.toString()).toBe('tab=builder')
  })

  it('reads back the side it wrote', () => {
    for (const side of ['edit', 'share'] as const) expect(builderSideFromSearch(withBuilderSide('?tab=builder&builder=sub-nda', side))).toBe(side)
  })
})

describe('the switch’s words', () => {
  it('names the two sides in the mock-up’s words, Edit first, each with what it holds', () => {
    expect(BUILDER_SIDES.map((s) => [s.id, s.label])).toEqual([
      ['edit', 'Edit'],
      ['share', 'Share'],
    ])
    expect(builderSideHolds('edit')).toBe('The map and the pages that changed.')
    expect(builderSideHolds('share')).toBe('The link and the send.')
    expect(BUILDER_SIDE_PARAM).toBe('side')
  })

  it('are plain words', () => {
    expect([BUILDER_SIDE_SWITCH, ...BUILDER_SIDES.flatMap((s) => [s.label, s.holds])].flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})
