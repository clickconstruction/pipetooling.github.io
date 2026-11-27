import { describe, expect, it } from 'vitest'
import { pairKeys, type PlaceAnswer } from './lookAlikes'
import {
  PAPER_SITE_WORDS,
  SITE_ADDRESS_MAX,
  SITE_KEY_MAX,
  SITE_PRINTED_WORDS,
  SITE_PRINT_BOX_LABEL,
  SITE_PRINT_HINTS,
  sitePrintBox,
  sitePrintsAtSend,
  type SitePrintReady,
  paperSiteColumns,
  paperSiteLabel,
  paperSiteOfEntry,
  paperSiteRowNote,
  paperSiteSentence,
  rowIsForSite,
  rowNamesNoSite,
  paperSiteNote,
  rowsForSite,
  signedForSiteWords,
  siteKeysOfAddress,
  type PaperSite,
  type PaperSiteRow,
} from './paperSite'
import { normalizeAddressKey } from '../developments/notInIt'
import { plainWordsFailures } from '../plainWords'
import { plainSentence, val } from '../valuesInPlace'

// Every address and name here is made up.
const QUARRY = '118 Old Quarry Trl, Sampleton, TX'
const BARN = '118 Old Quarry Trl Barn, Sampleton, TX'
const COVE = '801 Magnolia Cove, Exampleville, TX'
const key = normalizeAddressKey
const site = (address: string): PaperSite => ({ kind: 'address', key: key(address), address })
const ranch: PaperSite = { kind: 'development', developmentId: 'd1', name: 'Old Quarry Ranch' }
const same = (one: string, other: string, yes = true): PlaceAnswer => ({ ...pairKeys(key(one), key(other)), same: yes, byName: 'Cora Sample', at: '2026-11-24T15:00:00Z' })

describe('paperSiteOfEntry', () => {
  it('takes an address on file as a site, under its key and its spelling', () => {
    expect(paperSiteOfEntry({ key: key(QUARRY), address: `  ${QUARRY}  ` })).toEqual({ kind: 'address', key: key(QUARRY), address: QUARRY })
  })

  it('refuses a key the row cannot keep, and cuts an address to what it takes', () => {
    expect(paperSiteOfEntry({ key: 'a'.repeat(SITE_KEY_MAX + 1), address: QUARRY })).toBeNull()
    expect(paperSiteOfEntry({ key: '', address: QUARRY })).toBeNull()
    expect(paperSiteOfEntry({ key: key(QUARRY), address: '   ' })).toBeNull()
    const long = paperSiteOfEntry({ key: key(QUARRY), address: `${QUARRY} ${'x'.repeat(600)}` })
    expect(long?.kind === 'address' && long.address.length).toBe(SITE_ADDRESS_MAX)
  })
})

describe('paperSiteColumns', () => {
  it('writes an address under its key with the spelling, a development alone, and nothing for no site', () => {
    expect(paperSiteColumns(site(QUARRY))).toEqual({ site_development_id: null, site_address_key: key(QUARRY), site_address: QUARRY, site_prints_address: false })
    expect(paperSiteColumns(ranch)).toEqual({ site_development_id: 'd1', site_address_key: null, site_address: null, site_prints_address: false })
    expect(paperSiteColumns(null)).toEqual({ site_development_id: null, site_address_key: null, site_address: null, site_prints_address: false })
  })

  it('never writes both kinds, an address with no key, or the print unasked', () => {
    for (const s of [site(QUARRY), ranch, null]) {
      const c = paperSiteColumns(s)
      expect(c.site_development_id != null && c.site_address_key != null).toBe(false)
      expect(c.site_address != null && c.site_address_key == null).toBe(false)
      expect(c.site_prints_address).toBe(false)
    }
  })

  it('writes the print only when the box is ticked, and only beside an address', () => {
    expect(paperSiteColumns(site(QUARRY), true)).toEqual({ site_development_id: null, site_address_key: key(QUARRY), site_address: QUARRY, site_prints_address: true })
    expect(paperSiteColumns(site(QUARRY), false).site_prints_address).toBe(false)
    // The row refuses a print with no address to print: a development and no site never ask for one.
    expect(paperSiteColumns(ranch, true).site_prints_address).toBe(false)
    expect(paperSiteColumns(null, true).site_prints_address).toBe(false)
  })
})

describe('sitePrintBox', () => {
  it('is no box for a paper with no site, or a site with no address', () => {
    for (const ready of ['checking', 'yes', 'no', 'unread'] as SitePrintReady[]) {
      expect(sitePrintBox(null, true, ready)).toBeNull()
      expect(sitePrintBox(ranch, true, ready)).toBeNull()
    }
  })

  it('starts off, and says the signer reads nothing about the site', () => {
    expect(sitePrintBox(site(QUARRY), false, 'yes')).toEqual({ label: 'Print the site’s address on the paper', checked: false, dead: false, hint: 'The signer reads nothing about the site.' })
  })

  it('ticked, says the very line the signer reads, with the address', () => {
    const box = sitePrintBox(site(QUARRY), true, 'yes')!
    expect(box.checked).toBe(true)
    expect(box.dead).toBe(false)
    expect(plainSentence(box.hint)).toBe(`Above the paper the signer reads Site address: ${QUARRY}.`)
    // The address is a value, drawn apart from the words.
    expect(box.hint).toContain(val('address', QUARRY))
  })

  it('is dead and unticked until the signer’s page can show an address, whatever was ticked', () => {
    expect(sitePrintBox(site(QUARRY), true, 'checking')).toEqual({ label: SITE_PRINT_BOX_LABEL, checked: false, dead: true, hint: 'Checking the signer’s page…' })
    expect(sitePrintBox(site(QUARRY), true, 'no')).toEqual({ label: SITE_PRINT_BOX_LABEL, checked: false, dead: true, hint: 'The signer’s page cannot show an address yet. This stays off until it can.' })
    expect(sitePrintBox(site(QUARRY), true, 'unread')).toEqual({ label: SITE_PRINT_BOX_LABEL, checked: false, dead: true, hint: 'The signer’s page did not answer, so this stays off. Close this window and try again.' })
  })

  it('a send writes the print on only for a live box, ticked, on an address', () => {
    expect(sitePrintsAtSend(site(QUARRY), true, 'yes')).toBe(true)
    expect(sitePrintsAtSend(site(QUARRY), false, 'yes')).toBe(false)
    for (const ready of ['checking', 'no', 'unread'] as SitePrintReady[]) expect(sitePrintsAtSend(site(QUARRY), true, ready)).toBe(false)
    expect(sitePrintsAtSend(ranch, true, 'yes')).toBe(false)
    expect(sitePrintsAtSend(null, true, 'yes')).toBe(false)
  })
})

describe('rowIsForSite', () => {
  const none = {}
  const atQuarry = { site_address_key: key(QUARRY) }
  const atBarn = { site_address_key: key(BARN) }
  const atCove = { site_address_key: key(COVE) }
  const atRanch = { site_development_id: 'd1' }

  it('no site matches only a row that names none', () => {
    expect(rowNamesNoSite(none)).toBe(true)
    expect(rowNamesNoSite({ site_development_id: null, site_address_key: null })).toBe(true)
    expect(rowIsForSite(none, null)).toBe(true)
    expect(rowIsForSite(atQuarry, null)).toBe(false)
    expect(rowIsForSite(atRanch, null)).toBe(false)
    expect(rowIsForSite(none, site(QUARRY))).toBe(false)
    expect(rowIsForSite(none, ranch)).toBe(false)
  })

  it('an address matches its own key and no other', () => {
    expect(rowIsForSite(atQuarry, site(QUARRY))).toBe(true)
    expect(rowIsForSite(atBarn, site(QUARRY))).toBe(false)
    expect(rowIsForSite(atRanch, site(QUARRY))).toBe(false)
  })

  it('an address matches a key the answers make the same place, through a chain, and never one answered Not the same', () => {
    expect(rowIsForSite(atBarn, site(QUARRY), [same(QUARRY, BARN)])).toBe(true)
    expect(rowIsForSite(atCove, site(QUARRY), [same(QUARRY, BARN), same(BARN, COVE)])).toBe(true)
    expect(rowIsForSite(atBarn, site(QUARRY), [same(QUARRY, BARN, false)])).toBe(false)
  })

  it('a development matches a row that names it', () => {
    expect(rowIsForSite(atRanch, ranch)).toBe(true)
    expect(rowIsForSite({ site_development_id: 'd2' }, ranch)).toBe(false)
    expect(rowIsForSite(atQuarry, ranch)).toBe(false)
  })

  it('picks the rows of a list that are for a site', () => {
    const rows: Array<PaperSiteRow & { id: string }> = [
      { id: 'a', ...none },
      { id: 'b', ...atQuarry },
      { id: 'c', ...atBarn },
      { id: 'd', ...atRanch },
    ]
    expect(rowsForSite(rows, null).map((r) => r.id)).toEqual(['a'])
    expect(rowsForSite(rows, site(QUARRY), [same(QUARRY, BARN)]).map((r) => r.id)).toEqual(['b', 'c'])
    expect(rowsForSite(rows, ranch).map((r) => r.id)).toEqual(['d'])
  })
})

describe('siteKeysOfAddress', () => {
  it('answers an address’s own key, the keys answered Same place, and nothing for a blank', () => {
    expect([...siteKeysOfAddress(QUARRY)]).toEqual([key(QUARRY)])
    expect([...siteKeysOfAddress(QUARRY, [same(QUARRY, BARN), same(QUARRY, COVE, false)])].sort()).toEqual([key(BARN), key(QUARRY)].sort())
    expect(siteKeysOfAddress('  ').size).toBe(0)
    expect(siteKeysOfAddress(null).size).toBe(0)
  })
})

describe('the words', () => {
  it('says a paper’s site on its line, and nothing with none', () => {
    expect(plainSentence(paperSiteNote({ site_address: `  ${QUARRY} ` }))).toBe(`for the site at ${QUARRY}`)
    expect(paperSiteNote({ site_address: null })).toBe('')
    expect(paperSiteNote({})).toBe('')
  })

  it('says a paper prints its address only when its box was ticked', () => {
    expect(plainSentence(paperSiteNote({ site_address: QUARRY, site_prints_address: true }))).toBe(`for the site at ${QUARRY}, printed on the paper`)
    // The address stays the one value of the line: the words after it are words.
    expect(paperSiteNote({ site_address: QUARRY, site_prints_address: true })).toBe(`for the site at ${val('address', QUARRY)}, ${SITE_PRINTED_WORDS}`)
    for (const off of [false, null, undefined]) expect(plainSentence(paperSiteNote({ site_address: QUARRY, site_prints_address: off }))).toBe(`for the site at ${QUARRY}`)
    // A row read without the column, as from a view that does not answer it yet, says nothing about a print.
    expect(plainSentence(paperSiteNote({ site_address: QUARRY }))).toBe(`for the site at ${QUARRY}`)
    // No address, no line, whatever the box says.
    expect(paperSiteNote({ site_address: null, site_prints_address: true })).toBe('')
  })

  it('names a site, says its line and its row', () => {
    expect(paperSiteLabel(site(QUARRY))).toBe(QUARRY)
    expect(paperSiteLabel(ranch)).toBe('Old Quarry Ranch')
    expect(plainSentence(paperSiteSentence(site(QUARRY)))).toBe(`For the site at ${QUARRY}.`)
    expect(plainSentence(paperSiteSentence(ranch))).toBe('For the site Old Quarry Ranch.')
    expect(paperSiteRowNote({ jobs: 25, bids: 0, developmentName: 'Old Quarry Ranch' })).toBe('25 jobs · Old Quarry Ranch')
    expect(paperSiteRowNote({ jobs: 1, bids: 2, developmentName: null })).toBe('1 job and 2 bids')
  })

  it('says why a company that signed for a site is not sent the paper again', () => {
    expect(signedForSiteWords('Tallgrass Supply Co.', 'Vendor NDA', 'Nov 12')).toBe('Tallgrass Supply Co. signed Vendor NDA for this site on Nov 12. One signature covers a site.')
    expect(signedForSiteWords('', 'Vendor NDA', '')).toBe('They signed Vendor NDA for this site. One signature covers a site.')
  })

  it('passes the plain-words rules', () => {
    const lines = [
      PAPER_SITE_WORDS.none,
      PAPER_SITE_WORDS.title,
      PAPER_SITE_WORDS.lead,
      PAPER_SITE_WORDS.notForASiteHint,
      PAPER_SITE_WORDS.typeMore,
      PAPER_SITE_WORDS.onFileOnly,
      PAPER_SITE_WORDS.kept,
      plainSentence(paperSiteSentence(site(QUARRY))),
      signedForSiteWords('Tallgrass Supply Co.', 'Vendor NDA', 'Nov 12'),
      SITE_PRINT_BOX_LABEL,
      SITE_PRINT_HINTS.off,
      SITE_PRINT_HINTS.no,
      SITE_PRINT_HINTS.unread,
      plainSentence(sitePrintBox(site(QUARRY), true, 'yes')!.hint),
    ]
    for (const line of lines) expect(plainWordsFailures(line), line).toEqual([])
  })
})
