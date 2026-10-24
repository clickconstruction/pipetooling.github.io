import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { defaultQuickfillSectionBanner, isRetiredQuickfillSectionBanner, QUICKFILL_DEFAULT_SECTION_BANNERS, RETIRED_QUICKFILL_SECTION_BANNERS } from './sectionBanners'

describe('Quickfill section banners', () => {
  it('Texts asks what its rows answer (v2.5816), and the old question is retired, so an org that saved it reads the new one', () => {
    expect(defaultQuickfillSectionBanner('texts')).toBe('Is anything on texts still waiting on us?')
    expect(isRetiredQuickfillSectionBanner('texts', 'Did anything fall through the cracks from today or yesterday?')).toBe(true)
    expect(isRetiredQuickfillSectionBanner('texts', '  Did anything fall through the cracks from today or yesterday?  ')).toBe(true)
    expect(isRetiredQuickfillSectionBanner('texts', 'Who still owes a text?')).toBe(false)
    expect(isRetiredQuickfillSectionBanner('email-inbox', 'Did anything fall through the cracks from today or yesterday?')).toBe(false)
  })
  it('no retired banner is still a default, and the Texts question reads plain', () => {
    for (const [id, olds] of Object.entries(RETIRED_QUICKFILL_SECTION_BANNERS)) for (const old of olds) expect(QUICKFILL_DEFAULT_SECTION_BANNERS[id]).not.toBe(old)
    expect(plainWordsFailures(defaultQuickfillSectionBanner('texts')!)).toEqual([])
  })
})
