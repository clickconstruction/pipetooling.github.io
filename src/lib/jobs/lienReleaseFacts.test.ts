import { describe, expect, it } from 'vitest'
import { RELEASE_FACT_KEYS, releaseByNow, releaseByYmd, releaseFacts, releaseFactsPatch } from './lienReleaseFacts'

// Every name here is made up.
const WHO = { by: 'u1', name: 'Alex Rivera', at: '2026-11-27T03:30:00Z' }

describe('releaseFacts', () => {
  it('reads nothing off a release that keeps none, or off broken fields', () => {
    const none = { printed: null, notarizedYmd: '', copies: null, moneyBack: null }
    expect(releaseFacts({ releasesFilingId: 'a1', paymentDate: '2026-11-20' })).toEqual(none)
    expect(releaseFacts(null)).toEqual(none)
    expect(releaseFacts([1, 2])).toEqual(none)
    expect(releaseFacts({ printedForNotary: { name: 'no time' }, notarizedYmd: 'Dec 1', copiesSent: { ...WHO, ymd: 'soon' } })).toEqual(none)
  })

  it('reads the print, the notary’s day and the copies', () => {
    expect(releaseFacts({ printedForNotary: WHO, notarizedYmd: '2026-12-01', copiesSent: { ...WHO, ymd: '2026-12-05' } })).toEqual({ printed: WHO, notarizedYmd: '2026-12-01', copies: { ...WHO, ymd: '2026-12-05' }, moneyBack: null })
  })
})

describe('releaseFactsPatch', () => {
  const paper = { releasesFilingId: 'a1', paymentDate: '2026-11-20', releaseInstrument: '2026-0431955' }

  it('adds a fact and keeps the paper’s own fields', () => {
    expect(releaseFactsPatch(paper, { notarizedYmd: '2026-12-01' })).toEqual({ ...paper, notarizedYmd: '2026-12-01' })
    expect(releaseFactsPatch(paper, { printed: WHO })).toEqual({ ...paper, printedForNotary: WHO })
    expect(releaseFactsPatch(paper, { copies: { ...WHO, ymd: '2026-12-05' } })).toEqual({ ...paper, copiesSent: { ymd: '2026-12-05', by: 'u1', name: 'Alex Rivera', at: WHO.at } })
  })

  it('takes a fact back off, and leaves alone what the change does not name', () => {
    const full = { ...paper, printedForNotary: WHO, notarizedYmd: '2026-12-01', copiesSent: { ...WHO, ymd: '2026-12-05' } }
    expect(releaseFactsPatch(full, { notarizedYmd: '' })).toEqual({ ...paper, printedForNotary: WHO, copiesSent: { ...WHO, ymd: '2026-12-05' } })
    expect(releaseFactsPatch(full, { copies: null, printed: null })).toEqual({ ...paper, notarizedYmd: '2026-12-01' })
    expect(releaseFactsPatch(full, {})).toEqual(full)
  })

  it('never keeps a day that is not a day', () => {
    expect(releaseFactsPatch(paper, { notarizedYmd: 'Dec 1' })).toEqual(paper)
    expect(releaseFactsPatch(paper, { copies: { ...WHO, ymd: '' } })).toEqual(paper)
    expect(Object.keys(RELEASE_FACT_KEYS)).toEqual(['printed', 'notarized', 'copies', 'moneyBack'])
  })
})

describe('the returned check’s mark', () => {
  const MARK = { ymd: '2026-11-27', check: '1184', caseId: 'dep1', by: 'u1', at: '2026-11-28T15:00:00Z' }
  const paper = { releasesFilingId: 'a1', paymentDate: '2026-11-20' }

  it('is kept beside the paper, read back, and taken off', () => {
    const marked = releaseFactsPatch(paper, { moneyBack: MARK })
    expect(marked).toEqual({ ...paper, moneyCameBack: MARK })
    expect(releaseFacts(marked).moneyBack).toEqual(MARK)
    expect(releaseFactsPatch(marked, { moneyBack: null })).toEqual(paper)
  })

  it('reads a mark with no day as no mark, and never keeps one', () => {
    expect(releaseFacts({ moneyCameBack: { check: '1184' } }).moneyBack).toBeNull()
    expect(releaseFactsPatch(paper, { moneyBack: { ...MARK, ymd: '' } })).toEqual(paper)
  })
})

describe('who pressed', () => {
  it('keeps the name trimmed, and reads the day in the company’s calendar', () => {
    expect(releaseByNow({ id: 'u1', name: ' Alex Rivera ' }, WHO.at)).toEqual(WHO)
    // 03:30 UTC on Nov 27 is the evening of Nov 26 in the company's calendar.
    expect(releaseByYmd(WHO)).toBe('2026-11-26')
  })
})
