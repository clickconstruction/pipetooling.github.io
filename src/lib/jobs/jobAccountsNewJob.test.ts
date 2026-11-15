import { describe, expect, it } from 'vitest'
import {
  NEW_JOB_NOT_NEEDED_NOTE,
  NEW_JOB_NOT_NEEDED_REASONS,
  buildNewJobAccountsPlan,
  changeNotNeededExisting,
  isNoReasonNewJobNote,
  newJobNotNeededRows,
  notNeededChipTitle,
  notNeededSheetWords,
  notNeededStampWords,
  reuseNote,
  samePropertyOffers,
} from './jobAccountsNewJob'
import type { JobAccountStripEntry } from './jobAccountStrip'

function entry(houseId: string, houseName: string, state: JobAccountStripEntry['state'], extra: Partial<JobAccountStripEntry> = {}): JobAccountStripEntry {
  return {
    houseId,
    houseName,
    policy: 'expects',
    state,
    accountId: null,
    accountRef: '',
    openedVia: null,
    openedAt: null,
    requestedAt: null,
    requestedFromCounter: false,
    note: '',
    rep: null,
    ...extra,
  }
}

const newJobEntries = [entry('ferguson', 'Ferguson', 'none'), entry('reece', 'Reece', 'none'), entry('moore', 'Moore Supply', 'requested')]

describe('samePropertyOffers', () => {
  const j964 = {
    id: 'j964',
    label: '964 · Penmoor demo',
    address: '4114 Pen Moor Rd, Building #2, San Antonio, TX',
    entries: [entry('ferguson', 'Ferguson', 'open', { accountRef: 'JA-4114', openedVia: 'phone', rep: { id: 'c1', name: 'Curly', phone: null } }), entry('reece', 'Reece', 'none')],
  }
  const elsewhere = { id: 'j1', label: '1 · Elsewhere', address: '1 Other St, Austin, TX', entries: [entry('reece', 'Reece', 'open', { accountRef: 'R-1' })] }

  it('offers the open account from a job at the same address, exact or by street line', () => {
    const exact = samePropertyOffers('4114 pen moor rd, building #2, san antonio, tx', newJobEntries, [elsewhere, j964])
    expect(exact).toEqual([{ houseId: 'ferguson', houseName: 'Ferguson', fromJobId: 'j964', fromJobLabel: '964 · Penmoor demo', accountRef: 'JA-4114', openedVia: 'phone', repContactId: 'c1' }])
    const street = samePropertyOffers('4114 Pen Moor Rd, Bldg 3, San Antonio, TX 78231', newJobEntries, [j964])
    expect(street.map((o) => o.houseId)).toEqual(['ferguson'])
  })

  it('offers nothing without an address, for a different street, or for a house the new job already has', () => {
    expect(samePropertyOffers('', newJobEntries, [j964])).toEqual([])
    expect(samePropertyOffers('9 Nowhere Ln, Austin, TX', newJobEntries, [j964])).toEqual([])
    const already = [entry('ferguson', 'Ferguson', 'open'), entry('reece', 'Reece', 'none')]
    expect(samePropertyOffers(j964.address, already, [j964])).toEqual([])
  })
})

describe('buildNewJobAccountsPlan', () => {
  const offers = samePropertyOffers('4114 Pen Moor Rd, Building #2, San Antonio, TX', newJobEntries, [
    { id: 'j964', label: '964', address: '4114 Pen Moor Rd, Building #2, San Antonio, TX', entries: [entry('ferguson', 'Ferguson', 'open', { accountRef: 'JA-4114' })] },
  ])

  it('splits picks into reuse and ask, never both, and ignores non-none houses', () => {
    const plan = buildNewJobAccountsPlan(newJobEntries, offers, new Map([['ferguson', 'reuse'], ['reece', 'ask'], ['moore', 'ask']]))
    expect(plan.reuse.map((o) => o.houseId)).toEqual(['ferguson'])
    expect(plan.ask.map((e) => e.houseId)).toEqual(['reece'])
  })

  it('falls back to asking when reuse is picked for a house with no offer, and skips by default', () => {
    const plan = buildNewJobAccountsPlan(newJobEntries, offers, new Map([['reece', 'reuse']]))
    expect(plan.reuse).toEqual([])
    expect(plan.ask.map((e) => e.houseId)).toEqual(['reece'])
    expect(buildNewJobAccountsPlan(newJobEntries, offers, new Map())).toEqual({ ask: [], reuse: [] })
  })

  it('words the reuse note', () => {
    expect(reuseNote('964 · Penmoor demo')).toBe('Same property as 964 · Penmoor demo')
  })
})

describe('None needed asks why', () => {
  it('writes one not-needed row per unanswered house, each carrying the reason', () => {
    expect(newJobNotNeededRows('j1', newJobEntries, '  Service call ')).toEqual([
      { job_id: 'j1', supply_house_id: 'ferguson', status: 'not_needed', note: 'Service call' },
      { job_id: 'j1', supply_house_id: 'reece', status: 'not_needed', note: 'Service call' },
    ])
  })

  it('writes nothing without a reason, or with no house left to answer for', () => {
    expect(newJobNotNeededRows('j1', newJobEntries, '   ')).toEqual([])
    expect(newJobNotNeededRows('j1', [entry('moore', 'Moore Supply', 'requested')], 'Service call')).toEqual([])
  })

  it('never offers the old stand-in words as a reason', () => {
    expect(NEW_JOB_NOT_NEEDED_REASONS.length).toBeGreaterThan(0)
    expect(NEW_JOB_NOT_NEEDED_REASONS.some((r) => isNoReasonNewJobNote(r))).toBe(false)
  })
})

describe('the not-needed sheet', () => {
  it('says what the old one-press answer was, and reads no reason into it', () => {
    expect(isNoReasonNewJobNote(` ${NEW_JOB_NOT_NEEDED_NOTE} `)).toBe(true)
    expect(notNeededSheetWords('Moore Supply', NEW_JOB_NOT_NEEDED_NOTE)).toBe('Marked not needed when the job was made. No reason was given.')
    expect(notNeededChipTitle(NEW_JOB_NOT_NEEDED_NOTE)).toBe('Not needed: no reason was given')
  })

  it('reads a typed reason as the office decision', () => {
    expect(notNeededSheetWords('Ferguson', 'Service call')).toBe('The office decided this job does not need an account at Ferguson: Service call')
    expect(notNeededChipTitle(' Service call ')).toBe('Not needed: Service call')
  })

  it('says so when a row has no note at all', () => {
    expect(notNeededSheetWords('Reece', '')).toBe('Marked not needed at Reece. No reason was given.')
    expect(notNeededChipTitle(null)).toBe('Not needed: no reason was given')
  })
})

describe('notNeededStampWords', () => {
  it('names who marked it and the day, in the company calendar', () => {
    expect(notNeededStampWords('Tess', '2026-11-13T19:24:44.306Z')).toBe('Marked by Tess on Nov 13, 2026.')
    // 03:30 UTC is still the evening before in the company calendar.
    expect(notNeededStampWords(' Tess ', '2026-11-14T03:30:00Z')).toBe('Marked by Tess on Nov 13, 2026.')
  })

  it('says only the day for a row marked before the stamp, and nothing with neither', () => {
    expect(notNeededStampWords(null, '2026-10-07T22:13:03Z')).toBe('Marked on Oct 7, 2026.')
    expect(notNeededStampWords('Tess', null)).toBe('Marked by Tess.')
    expect(notNeededStampWords(null, null)).toBeNull()
    expect(notNeededStampWords(undefined, 'not a day')).toBeNull()
  })
})

describe('changeNotNeededExisting', () => {
  it('hands the Mark opened window the row, with the old stand-in note left out', () => {
    const row = changeNotNeededExisting('j1', entry('moore', 'Moore Supply', 'not_needed', { accountId: 'a1', note: NEW_JOB_NOT_NEEDED_NOTE }))
    expect(row).toMatchObject({ id: 'a1', job_id: 'j1', supply_house_id: 'moore', status: 'not_needed', note: '' })
  })

  it('keeps a typed reason, and answers null for a house with no row', () => {
    expect(changeNotNeededExisting('j1', entry('moore', 'Moore Supply', 'not_needed', { accountId: 'a1', note: 'Service call' }))?.note).toBe('Service call')
    expect(changeNotNeededExisting('j1', entry('moore', 'Moore Supply', 'not_needed'))).toBeNull()
  })
})
