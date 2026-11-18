import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { Container } from './onSite'
import {
  BLANK_STICKER_PUBLIC_WORDS,
  BLANK_STICKER_TITLE,
  codeLookup,
  LOST_STICKER_TITLE,
  lostStickerDetail,
  onBoxesWords,
  OUT_OF_REACH_STICKER_TITLE,
  placingVerdict,
  retiredBoxStickerTitle,
  retiredLabelDetail,
  retiredLabelTitle,
  stickerAgoWords,
  stickerFactsOf,
  stickerNameIs,
  stickerRunCounts,
  stickerSayName,
  unusedStickersWords,
  type StickerCountRow,
  type StickerFacts,
} from './stickers'

/** A made-up site: Juniper Ridge, with Marcus and Priya on it. */
const blank: StickerFacts = {
  id: '4f2a9c18-0000-4000-8000-000000000147',
  number: 147,
  code: '4F2A9C18',
  state: 'blank',
  containerId: null,
  containerLabel: null,
  containerKind: null,
  containerRetiredAt: null,
  jobId: null,
  placedByName: null,
  placedAt: null,
  lostAt: null,
  runId: 'run-1',
  runJobId: 'job-juniper',
}
const onR76: StickerFacts = { ...blank, state: 'on_box', containerId: 'box-r76', containerLabel: 'R76', containerKind: 'cage', jobId: 'job-juniper', placedByName: 'Marcus', placedAt: '2026-11-14T15:00:00Z' }
const NOW = '2026-11-14T15:01:10Z'

describe('what a sticker is called (v2.7438: no running number in any words)', () => {
  it('reads its printed name when it has one, its code with the dash when it does not', () => {
    expect(stickerSayName({ ...blank, boxName: 'G78' })).toBe('G78')
    expect(stickerSayName(blank)).toBe('4F2A-9C18')
    expect(stickerSayName({ code: '4f2a9c18', boxName: null })).toBe('4F2A-9C18')
  })

  it('knows when the name on the tape is the box’s own', () => {
    expect(stickerNameIs('G78', ' g78')).toBe(true)
    expect(stickerNameIs('G78', 'G78B')).toBe(false)
    expect(stickerNameIs(null, 'G78')).toBe(false)
  })
})

describe('the function’s answer', () => {
  it('reads a blank sticker', () => {
    const got = stickerFactsOf({ id: blank.id, number: 147, code: '4F2A9C18', state: 'blank', container_id: null, container_label: null, container_kind: null, container_retired_at: null, job_id: null, placed_by_name: null, placed_at: null, lost_at: null, run_id: 'run-1', run_job_id: 'job-juniper' })
    // the name on the tape rides along, null on a sticker that carries its number only (section 10)
    expect(got).toEqual({ ...blank, boxName: null })
  })

  it('reads a sticker on a box with who put it there', () => {
    const got = stickerFactsOf({ id: blank.id, number: 147, code: '4F2A9C18', state: 'on_box', container_id: 'box-r76', container_label: 'R76', container_kind: 'cage', job_id: 'job-juniper', placed_by_name: 'Marcus', placed_at: '2026-11-14T15:00:00Z', run_id: 'run-1', run_job_id: 'job-juniper' })
    expect(got).toEqual({ ...onR76, boxName: null })
  })

  it('is null for anything that is not a sticker', () => {
    expect(stickerFactsOf(null)).toBeNull()
    expect(stickerFactsOf('0147')).toBeNull()
    expect(stickerFactsOf({ id: 'x', number: 147, code: '4F2A9C18', state: 'burned' })).toBeNull()
    expect(stickerFactsOf({ id: 'x', number: 0, code: '4F2A9C18', state: 'blank' })).toBeNull()
    expect(stickerFactsOf({ id: 'x', number: '147', code: '4F2A9C18', state: 'blank' })).toBeNull()
    expect(stickerFactsOf({ number: 147, code: '4F2A9C18', state: 'blank' })).toBeNull()
  })
})

describe('a run’s counts', () => {
  /** A run of 200, 0101 to 0300: the first 104 on boxes, the rest blank. */
  const run = (rows: (n: number) => Partial<StickerCountRow>): StickerCountRow[] =>
    Array.from({ length: 200 }, (_, i) => ({ number: 101 + i, containerId: null, lostAt: null, ...rows(101 + i) }))

  it('counts what is on boxes and what is not used, with the unused range', () => {
    const c = stickerRunCounts(run((n) => (n <= 204 ? { containerId: `box-${n}` } : {})))
    expect(c).toEqual({ total: 200, onBoxes: 104, notUsed: 96, lost: 0, unused: [{ first: 205, last: 300 }] })
    // how many, and never which by number: a named run's row adds the names
    expect(unusedStickersWords(c)).toBe('96 reserved and not on a box yet')
    expect(onBoxesWords(c)).toBe('104 of 200 stickers are on boxes')
  })

  it('counts a sticker skipped on the walk with the rest', () => {
    const c = stickerRunCounts(run((n) => (n <= 204 && n !== 163 ? { containerId: `box-${n}` } : {})))
    expect(c.unused).toEqual([{ first: 163, last: 163 }, { first: 205, last: 300 }])
    expect(unusedStickersWords(c)).toBe('97 reserved and not on a box yet')
  })

  it('keeps a lost sticker out of both counts', () => {
    const c = stickerRunCounts([
      { number: 1, containerId: 'box-a', lostAt: null },
      { number: 2, containerId: 'box-b', lostAt: '2026-11-14T15:00:00Z' },
      { number: 3, containerId: null, lostAt: null },
    ])
    expect(c).toEqual({ total: 3, onBoxes: 1, notUsed: 1, lost: 1, unused: [{ first: 3, last: 3 }] })
    expect(unusedStickersWords(c)).toBe('1 reserved and not on a box yet')
  })

  it('reads rows in any order, and says nothing when every sticker is used', () => {
    const c = stickerRunCounts([
      { number: 7, containerId: null, lostAt: null },
      { number: 5, containerId: null, lostAt: null },
      { number: 6, containerId: null, lostAt: null },
    ])
    expect(c.unused).toEqual([{ first: 5, last: 7 }])
    const used = stickerRunCounts([{ number: 5, containerId: 'box-a', lostAt: null }])
    expect(unusedStickersWords(used)).toBe('')
    expect(onBoxesWords(used)).toBe('1 of 1 sticker is on a box')
    expect(stickerRunCounts([])).toEqual({ total: 0, onBoxes: 0, notUsed: 0, lost: 0, unused: [] })
  })
})

describe('how long ago', () => {
  it('reads as a person says it', () => {
    expect(stickerAgoWords('2026-11-14T15:00:40Z', NOW)).toBe('just now')
    expect(stickerAgoWords('2026-11-14T15:00:00Z', NOW)).toBe('a minute ago')
    expect(stickerAgoWords('2026-11-14T14:49:00Z', NOW)).toBe('12 minutes ago')
    expect(stickerAgoWords('2026-11-14T13:45:00Z', NOW)).toBe('an hour ago')
    expect(stickerAgoWords('2026-11-14T10:00:00Z', NOW)).toBe('5 hours ago')
    expect(stickerAgoWords('2026-11-13T12:00:00Z', NOW)).toBe('yesterday')
    expect(stickerAgoWords('2026-11-09T18:00:00Z', NOW)).toBe('on Nov 9')
  })

  it('is empty when a time does not read, and never negative', () => {
    expect(stickerAgoWords(null, NOW)).toBe('')
    expect(stickerAgoWords('soon', NOW)).toBe('')
    expect(stickerAgoWords('2026-11-14T15:05:00Z', NOW)).toBe('just now')
  })
})

describe('the placing verdicts', () => {
  it('a blank sticker takes a box', () => {
    expect(placingVerdict({ sticker: blank, hereJobId: 'job-juniper', now: NOW })).toEqual({ kind: 'blank' })
    expect(placingVerdict({ sticker: blank, now: NOW })).toEqual({ kind: 'blank' })
  })

  it('one already on a box says who and when', () => {
    expect(placingVerdict({ sticker: onR76, hereJobId: 'job-juniper', now: NOW })).toEqual({ kind: 'on_box', words: 'Marcus put this sticker on R76 a minute ago.', containerId: 'box-r76', jobId: 'job-juniper' })
  })

  it('still reads with no name, no box name or no time', () => {
    expect(placingVerdict({ sticker: { ...onR76, placedByName: null }, now: NOW })).toMatchObject({ words: 'This sticker was put on R76 a minute ago.' })
    expect(placingVerdict({ sticker: { ...onR76, containerLabel: null }, now: NOW })).toMatchObject({ words: 'Marcus put this sticker on a box a minute ago.' })
    expect(placingVerdict({ sticker: { ...onR76, placedAt: null }, now: NOW })).toMatchObject({ words: 'Marcus put this sticker on R76.' })
  })

  it('a lost one says where it was', () => {
    expect(placingVerdict({ sticker: { ...onR76, state: 'lost', lostAt: NOW }, now: NOW })).toEqual({ kind: 'lost', words: 'This sticker was on R76 and was marked lost.' })
    expect(placingVerdict({ sticker: { ...blank, state: 'lost', lostAt: NOW }, now: NOW })).toEqual({ kind: 'lost', words: 'This sticker was marked lost.' })
  })

  it('a blank one printed for another job asks once', () => {
    expect(placingVerdict({ sticker: blank, hereJobId: 'job-cedar', runJobName: 'Juniper Ridge', now: NOW })).toEqual({ kind: 'other_job', words: 'This sticker was printed for Juniper Ridge. Use it here?' })
    expect(placingVerdict({ sticker: blank, hereJobId: 'job-cedar', now: NOW })).toEqual({ kind: 'other_job', words: 'This sticker was printed for another job. Use it here?' })
    // A run whose job was deleted asks nothing.
    expect(placingVerdict({ sticker: { ...blank, runJobId: null }, hereJobId: 'job-cedar', now: NOW })).toEqual({ kind: 'blank' })
  })

  it('a used sticker says so wherever its run was printed for', () => {
    expect(placingVerdict({ sticker: onR76, hereJobId: 'job-cedar', now: NOW }).kind).toBe('on_box')
  })
})

describe('one resolver: what a code names', () => {
  const r76: Container = { id: 'box-r76', jobId: 'job-juniper', label: 'R76', kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z' }
  const a1: Container = { ...r76, id: 'box-a1', label: 'A1' }

  it('a label printed before stickers opens its box', () => {
    expect(codeLookup({ sticker: null, stickerBox: null, ownBox: a1 })).toEqual({ kind: 'box', container: a1, sticker: null })
  })

  it('a sticker on a box opens that box', () => {
    expect(codeLookup({ sticker: onR76, stickerBox: r76, ownBox: null })).toEqual({ kind: 'box', container: r76, sticker: onR76 })
  })

  it('the sticker is read first, so a code names one thing', () => {
    expect(codeLookup({ sticker: onR76, stickerBox: r76, ownBox: a1 })).toMatchObject({ kind: 'box', container: r76 })
    expect(codeLookup({ sticker: blank, stickerBox: null, ownBox: a1 })).toEqual({ kind: 'blank', sticker: blank })
  })

  it('a blank one, a lost one and one on a retired box are not boxes to open', () => {
    expect(codeLookup({ sticker: blank, stickerBox: null, ownBox: null })).toEqual({ kind: 'blank', sticker: blank })
    const lost: StickerFacts = { ...onR76, state: 'lost', lostAt: NOW }
    expect(codeLookup({ sticker: lost, stickerBox: r76, ownBox: null })).toEqual({ kind: 'lost', sticker: lost })
    const onRetired: StickerFacts = { ...onR76, containerRetiredAt: '2026-11-10T00:00:00Z' }
    expect(codeLookup({ sticker: onRetired, stickerBox: { ...r76, retiredAt: '2026-11-10T00:00:00Z' }, ownBox: null })).toEqual({ kind: 'retired', sticker: onRetired })
    expect(codeLookup({ sticker: onR76, stickerBox: { ...r76, retiredAt: '2026-11-10T00:00:00Z' }, ownBox: null }).kind).toBe('retired')
  })

  it('a sticker on a box the reader cannot see is out of reach', () => {
    expect(codeLookup({ sticker: onR76, stickerBox: null, ownBox: null })).toEqual({ kind: 'out_of_reach', sticker: onR76 })
  })

  it('no sticker and no box is nothing', () => {
    expect(codeLookup({ sticker: null, stickerBox: null, ownBox: null })).toEqual({ kind: 'none' })
  })

  it('a box’s own label on a retired box the reader may see says which box (v2.7630)', () => {
    // It read as nothing, so the page said the code did not open a box while the page with no sign-in named it.
    const gone = { ...a1, retiredAt: '2026-11-10T00:00:00Z' }
    expect(codeLookup({ sticker: null, stickerBox: null, ownBox: gone })).toEqual({ kind: 'retired_label', container: gone })
    // A sticker still wins: a code means one thing.
    expect(codeLookup({ sticker: blank, stickerBox: null, ownBox: gone })).toEqual({ kind: 'blank', sticker: blank })
  })
})

describe('the pages a scan opens', () => {
  it('a blank sticker says only that, signed out', () => {
    expect(BLANK_STICKER_TITLE).toBe('This sticker is reserved for a box')
    expect(BLANK_STICKER_PUBLIC_WORDS).toBe('This sticker is reserved for a box. It is not on a box yet. Sign in to say which box it is on.')
  })

  it('a lost one and one out of reach say so', () => {
    expect(LOST_STICKER_TITLE).toBe('This sticker was marked lost')
    expect(lostStickerDetail(onR76)).toBe('It was on R76. It no longer opens that box.')
    expect(lostStickerDetail(blank)).toBe('It no longer opens a box.')
    expect(OUT_OF_REACH_STICKER_TITLE).toBe('This sticker is on a box of a job you are not on')
    expect(retiredBoxStickerTitle(onR76)).toBe('This sticker is on R76, which was retired')
    expect(retiredBoxStickerTitle(blank)).toBe('This sticker is on a box that was retired')
  })

  it('a retired box’s own label names the box and the day it left, as the page with no sign-in does (v2.7630)', () => {
    expect(retiredLabelTitle({ kind: 'cage', label: 'A1' })).toBe('Cage A1 was retired')
    expect(retiredLabelTitle({ kind: 'loose', label: 'ZZ3' })).toBe('Pile ZZ3 was retired')
    // 21:44 UTC on the 14th is still the 14th in Chicago, and 03:00 UTC on the 15th is too.
    expect(retiredLabelDetail({ retiredAt: '2026-11-14T21:44:15.831Z' })).toBe('It left the job on Saturday, Nov 14. The office brings a retired box back from the Retired fold on its Materials page.')
    expect(retiredLabelDetail({ retiredAt: '2026-11-15T03:00:00Z' })).toContain('Saturday, Nov 14.')
    expect(retiredLabelDetail({ retiredAt: null })).toBe('The office brings a retired box back from the Retired fold on its Materials page.')
  })

  it('every sentence a person reads follows the plain-words rules, and none says a number', () => {
    const words = [
      BLANK_STICKER_PUBLIC_WORDS,
      `${LOST_STICKER_TITLE}.`,
      lostStickerDetail(onR76),
      lostStickerDetail(blank),
      `${OUT_OF_REACH_STICKER_TITLE}.`,
      `${retiredBoxStickerTitle(onR76)}.`,
      `${retiredLabelTitle({ kind: 'cage', label: 'A1' })}.`,
      retiredLabelDetail({ retiredAt: '2026-11-14T21:44:15.831Z' }),
      'Nobody has said which box it is on.',
      'Open On site and bring the box back to use it.',
      'Ask the office to add you to that job.',
      `${unusedStickersWords({ notUsed: 97 })}.`,
      'Marcus put this sticker on R76 a minute ago.',
      'This sticker was on R76 and was marked lost.',
      'This sticker was printed for Juniper Ridge. Use it here?',
    ]
    for (const w of words) {
      expect(plainWordsFailures(w), w).toEqual([])
      expect(w, w).not.toMatch(/\b0\d{3}\b/)
    }
  })
})
