import { describe, expect, it, vi } from 'vitest'
import { estimateTextLink, pickEstimateTextLink } from './estimateTextLink'

const LONG = `https://clicktooling.com/estimate/accept?t=${'a'.repeat(64)}`
/** The share link since v2.6677 (#281 PR 2): a ten-letter code from the alphabet with no look-alikes. */
const SHORT = 'https://clicktooling.com/estimate/accept?t=k7mnp2qrst'

describe('the link the estimate text carries (#281 PR 1)', () => {
  it('takes the share link when one came back, and the email’s own when none did', () => {
    expect(pickEstimateTextLink(LONG, SHORT)).toEqual({ link: SHORT, short: true })
    expect(pickEstimateTextLink(LONG, null)).toEqual({ link: LONG, short: false })
    expect(pickEstimateTextLink(LONG, undefined)).toEqual({ link: LONG, short: false })
    expect(pickEstimateTextLink(LONG, '   ')).toEqual({ link: LONG, short: false })
  })

  it('the share link is 54 characters shorter than the email’s: 53 against 107, with a ten-letter code', () => {
    expect(LONG.length).toBe(107)
    expect(SHORT.length).toBe(53)
    expect(SHORT.slice(-10)).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]{10}$/)
    expect(pickEstimateTextLink(LONG, SHORT).link.length).toBe(53)
  })

  it('asks the mint once and carries its link', async () => {
    const share = vi.fn(async () => SHORT)
    expect(await estimateTextLink(LONG, share)).toEqual({ link: SHORT, short: true })
    expect(share).toHaveBeenCalledTimes(1)
  })

  it('a mint that is refused or answers nothing falls back to the email’s own link, so no text is lost', async () => {
    expect(await estimateTextLink(LONG, async () => { throw new Error('Only a sent estimate can be shared.') })).toEqual({ link: LONG, short: false })
    expect(await estimateTextLink(LONG, async () => '')).toEqual({ link: LONG, short: false })
  })
})
