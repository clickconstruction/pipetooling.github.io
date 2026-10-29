import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { defaultQuickfillSectionBanner, isRetiredQuickfillSectionBanner, QUICKFILL_DEFAULT_SECTION_BANNERS, RETIRED_QUICKFILL_SECTION_BANNERS } from './sectionBanners'

describe('Quickfill section banners', () => {
  it('Messages asks what its lanes answer (v2.6098; Texts asked what its rows answered, v2.5816), and the old questions are retired, so an org that saved one reads the new one', () => {
    expect(defaultQuickfillSectionBanner('messages')).toBe('Is everyone who wrote to us answered?')
    expect(defaultQuickfillSectionBanner('texts')).toBeNull()
    expect(isRetiredQuickfillSectionBanner('texts', 'Is anything on texts still waiting on us?')).toBe(true)
    expect(isRetiredQuickfillSectionBanner('messages', 'Is anything on texts still waiting on us?')).toBe(true)
    expect(isRetiredQuickfillSectionBanner('texts', 'Did anything fall through the cracks from today or yesterday?')).toBe(true)
    expect(isRetiredQuickfillSectionBanner('texts', '  Did anything fall through the cracks from today or yesterday?  ')).toBe(true)
    expect(isRetiredQuickfillSectionBanner('texts', 'Who still owes a text?')).toBe(false)
    expect(isRetiredQuickfillSectionBanner('email-inbox', 'Did anything fall through the cracks from today or yesterday?')).toBe(false)
  })
  it('no retired banner is still a default, and the Messages question reads plain', () => {
    for (const [id, olds] of Object.entries(RETIRED_QUICKFILL_SECTION_BANNERS)) for (const old of olds) expect(QUICKFILL_DEFAULT_SECTION_BANNERS[id]).not.toBe(old)
    expect(plainWordsFailures(defaultQuickfillSectionBanner('messages')!)).toEqual([])
  })
})

describe('sectionBanners · every station asks a question (punch list #176, change 2)', () => {
  it('the six stations that asked none now do, in plain words', () => {
    for (const id of ['lost-bid-reasons', 'gc-weekly-review', 'job-followups', 'undated-bills', 'field-photos', 'needs-you']) {
      const q = defaultQuickfillSectionBanner(id)
      expect(q, id).toBeTruthy()
      expect(plainWordsFailures(q!), id).toEqual([])
    }
  })

  it('the three rewritten questions read plain, and their old words are retired so a saved copy reads the new one', () => {
    expect(defaultQuickfillSectionBanner('warnings')).toBe("Are any team purchases over a week old still on nobody's job?")
    expect(defaultQuickfillSectionBanner('jobs-cleanup')).toBe('Is every sub labor sheet on a job?')
    expect(defaultQuickfillSectionBanner('billed-awaiting')).toBe('Who is longest past due, and have we leaned on them this week?')
    expect(isRetiredQuickfillSectionBanner('warnings', 'Is anything flashing that nobody owns?')).toBe(true)
    expect(isRetiredQuickfillSectionBanner('billed-awaiting', 'Who owes us, and who do we lean on first?')).toBe(true)
    for (const id of ['warnings', 'jobs-cleanup', 'billed-awaiting']) expect(plainWordsFailures(defaultQuickfillSectionBanner(id)!), id).toEqual([])
  })
})
