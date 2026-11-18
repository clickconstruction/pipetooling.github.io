/**
 * Share this map, the sheet's rules (punch list #394): which presses are drawn for whom, which one
 * leads, the link's line, the address that opens the phone's Messages, and a count that holds the
 * sheet's standing words down. Every state the card's mock-up draws is a case here.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  PAINTED_MAP_SHARE_SHEET_WORDS,
  PAINTED_MAP_SHARE_WORDS_MAX,
  paintedMapEndWords,
  paintedMapLinksOutWords,
  paintedMapOwnTextHref,
  paintedMapShareStandingWords,
  paintedMapShareTileName,
  paintedMapShareWays,
  paintedMapShareWordCount,
  type PaintedMapShareInput,
} from './paintedMapShare'

const tech: PaintedMapShareInput = { office: false, jobId: 'job-1', phone: true, canShare: true, copies: true }
const office: PaintedMapShareInput = { ...tech, office: true }

describe('paintedMapShareWays', () => {
  it('leads with the person’s own text on a phone, then four tiles and the fold', () => {
    expect(paintedMapShareWays(tech)).toEqual({ lead: 'own-text', ownText: true, customer: { kind: 'hidden' }, tiles: ['code', 'copy', 'picture', 'another'], fold: true })
  })

  it('keeps the person’s own text first for the office on a job too, with the customer’s text under it', () => {
    const ways = paintedMapShareWays(office)
    expect(ways.lead).toBe('own-text')
    expect(ways.customer).toEqual({ kind: 'offered', jobId: 'job-1' })
    expect(ways.tiles).toEqual(['code', 'copy', 'picture', 'another'])
  })

  it('keeps the customer’s text in place on a map with no job, with why', () => {
    const ways = paintedMapShareWays({ ...office, jobId: null })
    expect(ways.lead).toBe('own-text')
    expect(ways.customer.kind).toBe('no-job')
  })

  it('draws no text from a phone at a desk: the office’s text leads on a job', () => {
    const ways = paintedMapShareWays({ ...office, phone: false, canShare: false })
    expect(ways).toEqual({ lead: 'customer-text', ownText: false, customer: { kind: 'offered', jobId: 'job-1' }, tiles: ['code', 'copy', 'picture'], fold: true })
  })

  it('leads with Copy the link at a desk for everyone else, and does not draw it twice', () => {
    for (const input of [{ ...tech, phone: false, canShare: false }, { ...office, jobId: null, phone: false, canShare: false }]) {
      const ways = paintedMapShareWays(input)
      expect(ways.lead).toBe('copy')
      expect(ways.ownText).toBe(false)
      expect(ways.tiles).toEqual(['code', 'picture'])
    }
  })

  it('offers Send it another way… only where the browser has a share sheet', () => {
    expect(paintedMapShareWays({ ...tech, canShare: false }).tiles).toEqual(['code', 'copy', 'picture'])
    expect(paintedMapShareWays({ ...tech, phone: false, canShare: true }).tiles).toEqual(['code', 'picture', 'another'])
  })

  it('offers no copy where the sheet was not handed the map: a Documents row shares the link alone', () => {
    const ways = paintedMapShareWays({ ...tech, copies: false })
    expect(ways.tiles).toEqual(['code', 'copy', 'another'])
    expect(ways.fold).toBe(false)
  })

  it('draws exactly one leading press in every state', () => {
    for (const officeOn of [true, false]) for (const jobId of ['job-1', null]) for (const phone of [true, false]) for (const canShare of [true, false]) for (const copies of [true, false]) {
      const ways = paintedMapShareWays({ office: officeOn, jobId, phone, canShare, copies })
      const drawn = [ways.ownText ? 'own-text' : null, ways.customer.kind === 'offered' ? 'customer-text' : null, ways.lead === 'copy' || ways.tiles.includes('copy') ? 'copy' : null]
      expect(drawn).toContain(ways.lead)
      expect(ways.tiles.filter((t) => t === 'copy').length + (ways.lead === 'copy' ? 1 : 0)).toBe(1)
      expect(ways.tiles[0]).toBe('code')
    }
  })
})

describe('the sheet’s words', () => {
  it('names each tile as the press reads', () => {
    expect((['code', 'copy', 'picture', 'another'] as const).map(paintedMapShareTileName)).toEqual(['Show a code to scan', 'Copy the link', 'Make a picture', 'Send it another way…'])
  })

  it('keeps every sentence to the plain-words rules', () => {
    for (const words of Object.values(PAINTED_MAP_SHARE_SHEET_WORDS)) expect(plainWordsFailures(words)).toEqual([])
  })

  it('stands with a fraction of the 163 words the sheet had, in every state', () => {
    const count = (input: PaintedMapShareInput) => paintedMapShareWordCount(paintedMapShareStandingWords(paintedMapShareWays(input)))
    // The mock-up's own counts: a tech on a phone, the office on a job, the office on no job, and a desk.
    expect(count(tech)).toBe(43)
    expect(count(office)).toBe(50)
    expect(count({ ...office, jobId: null })).toBe(52)
    expect(count({ ...tech, phone: false, canShare: false })).toBe(34)
    for (const officeOn of [true, false]) for (const jobId of ['job-1', null]) for (const phone of [true, false]) for (const canShare of [true, false]) for (const copies of [true, false]) {
      expect(count({ office: officeOn, jobId, phone, canShare, copies })).toBeLessThanOrEqual(PAINTED_MAP_SHARE_WORDS_MAX)
    }
  })

  it('counts a word as a reader would: a mark alone is not one', () => {
    expect(paintedMapShareWordCount(['iPhone · Safari', 'No sign-in.', '‹ Back'])).toBe(5)
  })
})

describe('the link’s line', () => {
  it('says how many are out, since when, and whether anyone opened one', () => {
    expect(paintedMapLinksOutWords({ open: 1, since: 'Nov 13', opened: 0 })).toBe('One link is out, since Nov 13. Not opened yet.')
    expect(paintedMapLinksOutWords({ open: 2, since: 'Nov 10', opened: 3 })).toBe('2 links are out, since Nov 10. Opened 3 times.')
    expect(paintedMapLinksOutWords({ open: 1, since: null, opened: 1 })).toBe('One link is out. Opened once.')
  })

  it('names the press that ends them by how many it ends', () => {
    expect(paintedMapEndWords(1)).toBe('End this link now')
    expect(paintedMapEndWords(3)).toBe('End all 3 links now')
  })
})

describe('paintedMapOwnTextHref', () => {
  it('opens Messages with the office’s words written and nobody picked', () => {
    const href = paintedMapOwnTextHref('The way in', 'https://example.test/way/q7m2kd4x9p')
    expect(href.startsWith('sms:?&body=')).toBe(true)
    expect(decodeURIComponent(href.slice('sms:?&body='.length))).toBe('Here is a map for you, The way in. Open it here: https://example.test/way/q7m2kd4x9p')
  })

  it('stands without a name', () => {
    expect(decodeURIComponent(paintedMapOwnTextHref(null, 'https://x.test/way/a'))).toBe('sms:?&body=Here is a map for you. Open it here: https://x.test/way/a')
  })
})
