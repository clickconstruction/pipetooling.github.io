import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { defaultQuickfillSectionBanner, isRetiredQuickfillSectionBanner, QUICKFILL_DEFAULT_SECTION_BANNERS, RETIRED_QUICKFILL_SECTION_BANNERS } from './sectionBanners'

describe('the Physical inbox banner (v2.5818)', () => {
  it('asks the deck question, and the old pile question is retired, so an org that saved it reads the new one', () => {
    expect(defaultQuickfillSectionBanner('physical-inbox')).toBe('Has every paper in the tray been decided?')
    expect(isRetiredQuickfillSectionBanner('physical-inbox', 'Can I get to the bottom of the pile?')).toBe(true)
    expect(isRetiredQuickfillSectionBanner('physical-inbox', '  Can I get to the bottom of the pile?  ')).toBe(true)
    expect(isRetiredQuickfillSectionBanner('physical-inbox', 'Is the tray empty?')).toBe(false)
    expect(isRetiredQuickfillSectionBanner('texts', 'Can I get to the bottom of the pile?')).toBe(false)
  })
  it('no retired banner is still a default, and the question reads plain', () => {
    for (const [id, olds] of Object.entries(RETIRED_QUICKFILL_SECTION_BANNERS)) for (const old of olds) expect(QUICKFILL_DEFAULT_SECTION_BANNERS[id]).not.toBe(old)
    expect(plainWordsFailures(defaultQuickfillSectionBanner('physical-inbox')!)).toEqual([])
  })
})
