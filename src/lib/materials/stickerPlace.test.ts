import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { Container, ContainerLine } from './onSite'
import type { OnSiteFindJob } from './onSiteFind'
import {
  blankCountOf,
  defaultBranch,
  GOES_ON_WORDS,
  jobBlankWords,
  matchBoxes,
  matchList,
  matchStickerWords,
  nameIsHereWords,
  newBoxPressLabel,
  NO_SIGNAL_WORDS,
  noStickerCountWords,
  notYetOnBoxLine,
  NO_RESERVED,
  notYetOnBoxWords,
  reservedByWords,
  reservedLineWords,
  reservedMarkWords,
  reservedShortWords,
  reservedOfJob,
  openBoxLabel,
  PLACE_UNREAD_WORDS,
  placeAnswerOf,
  placeOutcome,
  placePressLabel,
  placeStickerArgs,
  readScanTyped,
  SCAN_TYPED_SLIP,
  scanTypedWords,
  STICKER_BRANCH_WORDS,
  STICKER_DIFFERENT_BOX_LABEL,
  STICKER_NEW_ASK,
  stickerMarksByBoxOf,
  stickerMarksWords,
  stickerNewTitle,
  stickerOpening,
  stickerReadsOtherWords,
  stickersByBoxOf,
  twinNoteWords,
} from './stickerPlace'
import { placingVerdict, stickerFactsOf, stickerNameIs, stickerSayName, type StickerFacts } from './stickers'

/** A made-up site: Juniper Ridge, two jobs, Marcus on it. */
const box = (over: Partial<Container> & { id: string; label: string }): Container => ({ jobId: 'job-a', kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T00:00:00Z', ...over })
const line = (containerId: string, partName: string, onHand = 3): ContainerLine => ({ containerId, partKey: `text:${partName}`, partId: null, partName, manufacturer: null, onHand, lastTouchedAt: null, lastTouchedBy: null, lastCountAt: null, lastCountBy: null, lastCountDiff: null, cannotFindSinceCount: 0 })

const jobA: OnSiteFindJob = {
  jobId: 'job-a',
  label: 'JP1204 · Juniper Ridge, phase 2',
  containers: [
    box({ id: 'r76', label: 'R76', locationId: 'barn' }),
    box({ id: 'r7', label: 'R7', where: 'by the north stair' }),
    box({ id: 'r12', label: 'R12' }),
    box({ id: 'uns', label: 'Unsorted', kind: 'unsorted' }),
    box({ id: 'old', label: 'R3', retiredAt: '2026-10-20T00:00:00Z' }),
  ],
  lines: [line('r76', 'Gas valves'), line('r7', '2 inch couplings'), line('r12', 'Toilets', 0)],
  places: [{ id: 'barn', jobId: 'job-a', name: 'Barn', createdAt: '2026-10-01T00:00:00Z' }],
}
const jobB: OnSiteFindJob = {
  jobId: 'job-b',
  label: 'JP1205 · Juniper Ridge, phase 1',
  containers: [box({ id: 'b1', jobId: 'job-b', label: 'R1' })],
  lines: [],
  places: [],
}
const stickers = new Map<string, number[]>([['r12', [152, 147]]])
const boxes = matchBoxes({ hereJobId: 'job-a', jobs: [jobA, jobB], stickersByBox: stickers })

const blank: StickerFacts = { id: 's-147', number: 147, code: '4F2A9C18', state: 'blank', containerId: null, containerLabel: null, containerKind: null, containerRetiredAt: null, jobId: null, placedByName: null, placedAt: null, lostAt: null, runId: 'run-1', runJobId: 'job-a' }
const onR76: StickerFacts = { ...blank, state: 'on_box', containerId: 'r76', containerLabel: 'R76', containerKind: 'cage', jobId: 'job-a', placedByName: 'Marcus', placedAt: '2026-11-14T15:00:00Z' }
const NOW = '2026-11-14T15:01:10Z'
const reach = { jobIds: ['job-a', 'job-b'], boxLabel: 'R76', now: NOW }

describe('the sheet’s words', () => {
  it('names the sticker and the two branches', () => {
    // a sticker with no name is *this sticker*: no number anywhere (Taunya's call of 2026-11-16)
    expect(stickerNewTitle(blank)).toBe('This sticker is new')
    expect(STICKER_NEW_ASK).toBe('What is it on?')
    expect(STICKER_BRANCH_WORDS.known).toBe('It is on a box I know')
    expect(STICKER_BRANCH_WORDS.new).toBe('It is a new box')
    expect(placePressLabel('R76')).toBe('Put this sticker on R76')
    expect(placePressLabel(null)).toBe('Put this sticker on a box')
    expect(newBoxPressLabel('R97')).toBe('Save box R97')
    expect(newBoxPressLabel(null)).toBe('Save the box')
    expect(GOES_ON_WORDS).toBe('Goes on')
    expect(openBoxLabel('R76')).toBe('Open R76')
    expect(openBoxLabel(null)).toBe('Open the box')
  })
})

describe('the match list', () => {
  it('lists every live cage, box and pile of the site, never Unsorted or a retired box', () => {
    expect(boxes.map((b) => b.container.id).sort()).toEqual(['b1', 'r12', 'r7', 'r76'])
    const r76 = boxes.find((b) => b.container.id === 'r76')!
    expect(r76).toMatchObject({ here: true, jobLabel: '', place: 'Barn', partNames: ['Gas valves'], stickerNumbers: [] })
    expect(boxes.find((b) => b.container.id === 'r12')!.stickerNumbers).toEqual([147, 152])
    expect(boxes.find((b) => b.container.id === 'b1')).toMatchObject({ here: false, jobLabel: 'JP1205 · Juniper Ridge, phase 1' })
  })

  it('with nothing typed: no sticker first, this job before the others, then the stencils as read', () => {
    expect(matchList(boxes, '').map((b) => b.container.id)).toEqual(['r7', 'r76', 'b1', 'r12'])
  })

  it('searches the start of the stencil, the place, the where line, a part and the other job', () => {
    expect(matchList(boxes, '76').map((b) => b.container.id)).toEqual(['r76'])
    expect(matchList(boxes, 'r7').map((b) => b.container.id)).toEqual(['r7', 'r76'])
    expect(matchList(boxes, 'barn').map((b) => b.container.id)).toEqual(['r76'])
    expect(matchList(boxes, 'north stair').map((b) => b.container.id)).toEqual(['r7'])
    expect(matchList(boxes, 'gas').map((b) => b.container.id)).toEqual(['r76'])
    expect(matchList(boxes, 'phase 1').map((b) => b.container.id)).toEqual(['b1'])
    // A part with none left is not in the box any more.
    expect(matchList(boxes, 'toilets')).toEqual([])
    expect(matchList(boxes, 'zzz')).toEqual([])
  })

  it('opens on the known boxes while some have no sticker, on a new box once every box has one', () => {
    expect(defaultBranch(boxes)).toBe('known')
    expect(defaultBranch(boxes.filter((b) => b.container.id === 'r12'))).toBe('new')
    expect(defaultBranch([])).toBe('new')
  })

  it('counts the boxes with no sticker yet', () => {
    expect(noStickerCountWords(boxes)).toBe('3 boxes on this site have no sticker yet.')
    expect(noStickerCountWords(boxes.filter((b) => b.container.id === 'r7'))).toBe('1 box on this site has no sticker yet.')
    expect(noStickerCountWords(boxes.filter((b) => b.container.id === 'r12'))).toBe('')
  })
})

describe('the stickers on a box', () => {
  it('folds the rows read by box, a lost sticker left off', () => {
    const by = stickersByBoxOf([
      { number: 152, containerId: 'r12', lostAt: null },
      { number: 147, containerId: 'r12', lostAt: null },
      { number: 160, containerId: 'r7', lostAt: '2026-11-13T00:00:00Z' },
      { number: 161, containerId: null, lostAt: null },
    ])
    expect(by.get('r12')).toEqual([147, 152])
    expect(by.has('r7')).toBe(false)
    expect(by.size).toBe(1)
  })
})

describe('stickers not yet on a box', () => {
  it('counts the blank ones across the job’s runs and says it', () => {
    const runs = [
      { stickers: [{ number: 101, containerId: 'r76', lostAt: null }, { number: 102, containerId: null, lostAt: null }, { number: 103, containerId: null, lostAt: '2026-11-13T00:00:00Z' }] },
      { stickers: [{ number: 201, containerId: null, lostAt: null }] },
    ]
    expect(blankCountOf(runs)).toBe(2)
    expect(notYetOnBoxWords(2)).toBe('2 stickers reserved and not on a box yet')
    expect(notYetOnBoxWords(1)).toBe('1 sticker reserved and not on a box yet')
    expect(notYetOnBoxWords(0)).toBe('')
    expect(jobBlankWords(12)).toBe('This job has 12 stickers reserved and not on a box yet.')
    expect(jobBlankWords(0)).toBe('')
    expect(notYetOnBoxLine(12)).toBe('12 stickers reserved and not on a box yet. Scan one to say which box it is on.')
    expect(notYetOnBoxLine(0)).toBe('')
  })

  it('one run holding them is said by its names, with who printed it and when (v2.7487)', () => {
    const names = Array.from({ length: 109 }, (_, i) => `G${92 + i}`)
    const run = { names, printedByName: ' Dana ', printedAt: '2026-11-16T15:00:00Z' }
    const stickers = names.map((boxName, i) => ({ number: 300 + i, containerId: null, lostAt: null, boxName }))
    const whole = reservedOfJob([{ run, stickers }])
    expect(whole).toEqual({ count: 109, runs: 1, span: 'G92 to G200', names, anyNamed: true, printedByName: 'Dana', printedAt: '2026-11-16T15:00:00Z', mark: { printed: 0, waiting: 0, unknown: 109 } })
    expect(notYetOnBoxWords(whole.count, whole)).toBe('109 stickers reserved and not on a box yet, G92 to G200')
    expect(notYetOnBoxLine(whole.count, whole)).toBe('109 stickers reserved and not on a box yet, G92 to G200. Scan one to say which box it is on.')
    expect(reservedByWords(whole, 'Nov 16')).toBe('Reserved Nov 16 by Dana.')
    expect(reservedByWords({ runs: 1, printedByName: '' }, 'Nov 16')).toBe('Reserved Nov 16.')
    expect(reservedByWords(whole, '')).toBe('')
    // two of them on boxes and one lost: what is left is said as it stands, a broken stretch by its first names
    const some = stickers.map((s, i) => (i === 0 ? { ...s, containerId: 'g92' } : i === 2 ? { ...s, lostAt: '2026-11-16T16:00:00Z' } : s))
    const left = reservedOfJob([{ run, stickers: some }])
    expect(left.count).toBe(107)
    expect(left.span).toBe('G93, G95 and 105 more')
    expect(left.names.slice(0, 2)).toEqual(['G93', 'G95'])
  })

  it('a run with no names says how many, more than one run says how many runs, and none says nothing (v2.7487)', () => {
    const bare = reservedOfJob([{ run: { names: null, printedByName: 'Dana', printedAt: '2026-11-16T15:00:00Z' }, stickers: [{ number: 1, containerId: null, lostAt: null }, { number: 2, containerId: null, lostAt: null }] }])
    expect(bare).toEqual({ count: 2, runs: 1, span: '', names: [], anyNamed: false, printedByName: 'Dana', printedAt: '2026-11-16T15:00:00Z', mark: { printed: 0, waiting: 0, unknown: 2 } })
    expect(notYetOnBoxWords(bare.count, bare)).toBe('2 stickers reserved and not on a box yet')
    const two = reservedOfJob([
      { run: { names: ['G1', 'G2'], printedByName: 'Dana', printedAt: '2026-11-15T15:00:00Z' }, stickers: [{ number: 1, containerId: null, lostAt: null, boxName: 'G1' }, { number: 2, containerId: 'g2', lostAt: null, boxName: 'G2' }] },
      { run: { names: null, printedByName: 'Marcus', printedAt: '2026-11-16T15:00:00Z' }, stickers: [{ number: 3, containerId: null, lostAt: null }] },
      { run: { names: ['G9'], printedByName: 'Priya', printedAt: '2026-11-16T16:00:00Z' }, stickers: [{ number: 4, containerId: 'g9', lostAt: null, boxName: 'G9' }] },
    ])
    // the third run has none left, so it is not counted among the runs that hold them
    expect(two).toEqual({ ...NO_RESERVED, count: 2, runs: 2, anyNamed: true, mark: { printed: 0, waiting: 0, unknown: 2 } })
    expect(notYetOnBoxWords(two.count, two)).toBe('2 stickers reserved and not on a box yet, in 2 runs')
    expect(reservedByWords(two, 'Nov 16')).toBe('')
    expect(reservedOfJob([])).toBe(NO_RESERVED)
    expect(reservedOfJob([{ run: { names: ['G9'] }, stickers: [{ number: 4, containerId: 'g9', lostAt: null, boxName: 'G9' }] }])).toBe(NO_RESERVED)
    for (const w of [notYetOnBoxLine(109, { span: 'G92 to G200', runs: 1 }), notYetOnBoxLine(2, two), reservedByWords({ runs: 1, printedByName: 'Dana' }, 'Nov 16'), jobBlankWords(12)]) expect(plainWordsFailures(w), w).toEqual([])
  })
})

describe('what printed of the reserved stickers (punch list #373)', () => {
  /** A run of G1 to G58 made after the mark began, the first `printed` of them seen to print. */
  const newRun = (printed: number) => {
    const names = Array.from({ length: 58 }, (_, i) => `G${1 + i}`)
    return { run: { names, printedByName: 'Dana', printedAt: '2026-11-17T15:00:00Z' }, stickers: names.map((boxName, i) => ({ number: 1 + i, containerId: null, lostAt: null, boxName, printedAt: i < printed ? '2026-11-17T15:05:00Z' : null })) }
  }

  it('the line says the count, then what printed, then who reserved them and when', () => {
    const none = reservedOfJob([newRun(0)])
    expect(none.mark).toEqual({ printed: 0, waiting: 58, unknown: 0 })
    expect(reservedMarkWords(none)).toBe('None printed yet.')
    expect(reservedLineWords(none, 'Nov 17')).toBe('58 stickers reserved and not on a box yet, G1 to G58. None printed yet. Reserved Nov 17 by Dana.')
    expect(reservedLineWords(reservedOfJob([newRun(40)]), 'Nov 17')).toBe('58 stickers reserved and not on a box yet, G1 to G58. 40 printed, 18 not printed yet. Reserved Nov 17 by Dana.')
    expect(reservedLineWords(reservedOfJob([newRun(58)]), 'Nov 17')).toBe('58 stickers reserved and not on a box yet, G1 to G58. All printed. Reserved Nov 17 by Dana.')
  })

  it('a run made before the mark began says nothing of what printed, and its day is the day it was reserved', () => {
    const old = { ...newRun(0), run: { ...newRun(0).run, printedAt: '2026-11-16T22:00:00Z' } }
    const of = reservedOfJob([old])
    expect(of.mark).toEqual({ printed: 0, waiting: 0, unknown: 58 })
    expect(reservedLineWords(of, 'Nov 16')).toBe('58 stickers reserved and not on a box yet, G1 to G58. Reserved Nov 16 by Dana.')
  })

  it('more than one run adds the counts up, and no day is said', () => {
    const second = { run: { names: null, printedByName: 'Marcus', printedAt: '2026-11-17T16:00:00Z' }, stickers: [{ number: 90, containerId: null, lostAt: null, printedAt: null }, { number: 91, containerId: null, lostAt: null, printedAt: null }] }
    const of = reservedOfJob([newRun(40), second])
    expect(of.mark).toEqual({ printed: 40, waiting: 20, unknown: 0 })
    expect(reservedLineWords(of, 'Nov 17')).toBe('60 stickers reserved and not on a box yet, in 2 runs. 40 printed, 20 not printed yet.')
  })

  it('the window’s ask says the same counts before a new run, and nothing at none', () => {
    expect(jobBlankWords(58, { printed: 40, waiting: 18, unknown: 0 })).toBe('This job has 58 stickers reserved and not on a box yet. 40 printed, 18 not printed yet.')
    expect(jobBlankWords(58, { printed: 0, waiting: 58, unknown: 0 })).toBe('This job has 58 stickers reserved and not on a box yet. None printed yet.')
    expect(jobBlankWords(0, { printed: 0, waiting: 0, unknown: 0 })).toBe('')
    expect(reservedLineWords(NO_RESERVED, 'Nov 17')).toBe('')
  })

  it('the phone’s one line is the count and which, and nothing at none (v2.8282)', () => {
    expect(reservedShortWords(reservedOfJob([newRun(0)]))).toBe('58 stickers reserved, G1 to G58')
    expect(reservedShortWords({ count: 1, span: 'G93', runs: 1 })).toBe('1 sticker reserved, G93')
    expect(reservedShortWords({ count: 40, span: '', runs: 2 })).toBe('40 stickers reserved, in 2 runs')
    expect(reservedShortWords({ count: 12, span: '', runs: 1 })).toBe('12 stickers reserved')
    expect(reservedShortWords(NO_RESERVED)).toBe('')
  })
})

describe('the placing', () => {
  it('asks for a known box with two arguments, and a new box with the job and its parts', () => {
    expect(placeStickerArgs({ kind: 'known', stickerId: 's-147', containerId: 'r76' })).toEqual({ p_sticker_id: 's-147', p_container_id: 'r76' })
    expect(placeStickerArgs({ kind: 'new', stickerId: 's-147', containerId: 'new-1', jobId: 'job-a', label: 'R97', boxKind: 'box', where: 'by the door', placeId: 'barn' })).toEqual({
      p_sticker_id: 's-147',
      p_container_id: 'new-1',
      p_job_id: 'job-a',
      p_label: 'R97',
      p_kind: 'box',
      p_where_note: 'by the door',
      p_place_id: 'barn',
    })
  })

  it('reads the answer back, and nothing from a shape that is not one', () => {
    expect(placeAnswerOf({ ok: true, already: false, created: true, container_id: 'new-1', sticker: { id: 's-147', number: 147, code: '4F2A9C18', state: 'on_box', container_id: 'new-1', container_label: 'R97' } })).toMatchObject({ ok: true, created: true, containerId: 'new-1', sticker: { containerLabel: 'R97' } })
    expect(placeAnswerOf({ ok: false, sticker: { id: 's-147', number: 147, code: '4F2A9C18', state: 'on_box' } })).toMatchObject({ ok: false, sticker: { state: 'on_box' } })
    expect(placeAnswerOf({ ok: 'yes' })).toBeNull()
    expect(placeAnswerOf(null)).toBeNull()
  })

  it('says what became of the press', () => {
    expect(placeOutcome({ ok: true, already: false, created: false, containerId: 'r76', sticker: onR76 }, reach)).toEqual({ kind: 'placed', words: 'The sticker is on R76.', containerId: 'r76', jobId: 'job-a' })
    expect(placeOutcome({ ok: true, already: true, created: false, containerId: 'r76', sticker: onR76 }, reach)).toMatchObject({ kind: 'already', words: 'The sticker was already on R76.' })
    expect(placeOutcome({ ok: true, already: false, created: true, containerId: 'new-1', sticker: { ...onR76, containerId: 'new-1', containerLabel: 'R97' } }, reach)).toMatchObject({ kind: 'created', words: 'R97 is made, with its sticker on it.', containerId: 'new-1' })
    // The answer with no sticker in it still names the box the press named.
    expect(placeOutcome({ ok: true, already: false, created: false, containerId: 'r76', sticker: null }, reach)).toMatchObject({ kind: 'placed', words: 'The sticker is on R76.', containerId: 'r76' })
  })

  it('someone else took it first: who and when, with the box to open when the person may reach it', () => {
    expect(placeOutcome({ ok: false, sticker: onR76 }, reach)).toEqual({ kind: 'taken', words: 'Marcus put this sticker on R76 a minute ago.', containerId: 'r76', jobId: 'job-a' })
    expect(placeOutcome({ ok: false, sticker: { ...onR76, jobId: 'job-z' } }, reach)).toEqual({ kind: 'out_of_reach', words: 'This sticker is on a box of a job you are not on. Ask the office to add you to that job.', containerId: null, jobId: 'job-z' })
    expect(placeOutcome({ ok: false, sticker: { ...onR76, state: 'lost', lostAt: '2026-11-14T00:00:00Z' } }, reach)).toMatchObject({ kind: 'lost', words: 'This sticker was on R76 and was marked lost.' })
    expect(placeOutcome({ ok: false, sticker: null }, reach)).toMatchObject({ kind: 'taken', words: PLACE_UNREAD_WORDS })
  })
})

describe('what a typed scan means', () => {
  it('eight characters are a code, with or without the dash; a number is not looked up any more', () => {
    expect(readScanTyped('4f2a-9c18')).toEqual({ kind: 'code', code: '4F2A9C18' })
    expect(readScanTyped('12345678')).toEqual({ kind: 'code', code: '12345678' })
    expect(readScanTyped('0147')).toEqual({ kind: 'short' })
    expect(readScanTyped('10432')).toEqual({ kind: 'short' })
    expect(readScanTyped('4f2a9')).toEqual({ kind: 'short' })
    expect(readScanTyped('  ')).toEqual({ kind: 'empty' })
  })

  it('draws the field with the code’s dash after four', () => {
    expect(scanTypedWords('4f2a9c18')).toBe('4F2A-9C18')
    expect(scanTypedWords('4f2a9')).toBe('4F2A-9')
    expect(scanTypedWords('0147')).toBe('0147')
    expect(scanTypedWords('123456')).toBe('1234-56')
    expect(SCAN_TYPED_SLIP).toBe('Type all eight characters under the QR code.')
  })
})

describe('plain words', () => {
  it('every sentence a person reads follows the rules', () => {
    const words = [
      `${stickerNewTitle(blank)}.`,
      STICKER_NEW_ASK,
      `${STICKER_BRANCH_WORDS.known}.`,
      `${STICKER_BRANCH_WORDS.new}.`,
      NO_SIGNAL_WORDS,
      noStickerCountWords(boxes),
      notYetOnBoxLine(12),
      placeOutcome({ ok: true, already: false, created: true, containerId: 'new-1', sticker: { ...onR76, containerLabel: 'R97' } }, reach).words,
      placeOutcome({ ok: false, sticker: { ...onR76, jobId: 'job-z' } }, reach).words,
      PLACE_UNREAD_WORDS,
      SCAN_TYPED_SLIP,
    ]
    for (const w of words) expect(plainWordsFailures(w), w).toEqual([])
  })
})

describe('a sticker that names its box (design section 10, PR 9, v2.7396)', () => {
  const g78: StickerFacts = { ...blank, id: 's-159', number: 159, boxName: 'G78' }
  const site = (labels: string[], retired: string[] = []) => [...labels.map((label) => ({ id: label.toLowerCase(), label, kind: 'cage', retiredAt: null })), ...retired.map((label) => ({ id: `old-${label.toLowerCase()}`, label, kind: 'cage', retiredAt: '2026-11-01T00:00:00Z' }))]

  it('the function’s answer carries the name on the tape, in capitals, and a numbered sticker has none', () => {
    const raw = { id: 's-159', number: 159, code: '4F2A9C18', state: 'blank', box_name: 'g78' }
    expect(stickerFactsOf(raw)?.boxName).toBe('G78')
    expect(stickerFactsOf({ ...raw, box_name: null })?.boxName).toBeNull()
    expect(stickerFactsOf({ id: 's', number: 1, code: 'A', state: 'blank' })?.boxName).toBeNull()
    expect(stickerSayName(g78)).toBe('G78')
    expect(stickerSayName(blank)).toBe('4F2A-9C18')
    expect(stickerNameIs('G78', ' g78')).toBe(true)
    expect(stickerNameIs('G78', 'G78B')).toBe(false)
    expect(stickerNameIs(null, 'G78')).toBe(false)
  })

  it('the sheet is titled by the name on the tape', () => {
    expect(stickerNewTitle(g78)).toBe('Sticker G78 is new')
    expect(stickerNewTitle(blank)).toBe('This sticker is new')
  })

  it('opens on a new box of that name when the site has none, the retired one aside', () => {
    expect(stickerOpening(g78, site(['G1', 'G2']))).toEqual({ branch: 'new', pickId: null, offerName: 'G78', twinName: null })
    expect(stickerOpening(g78, site(['G1'], ['G78']))).toEqual({ branch: 'new', pickId: null, offerName: 'G78', twinName: null })
    expect(stickerOpening(g78, [])).toMatchObject({ branch: 'new', offerName: 'G78' })
  })

  it('opens on the site’s box of that name, and a different box is offered the next letter', () => {
    expect(stickerOpening(g78, site(['G77', 'G78']))).toEqual({ branch: 'known', pickId: 'g78', offerName: null, twinName: 'G78B' })
    // G78B stands, so the next is G78C; a name saved in small letters is still the name
    expect(stickerOpening(g78, site(['g78', 'G78B']))).toMatchObject({ branch: 'known', pickId: 'g78', twinName: 'G78C' })
  })

  it('a numbered sticker opens as before: the boxes decide', () => {
    expect(stickerOpening(blank, site(['G78']))).toEqual({ branch: null, pickId: null, offerName: null, twinName: null })
    expect(stickerOpening({ boxName: null }, [])).toMatchObject({ branch: null })
  })

  it('a row says of its stickers only what carries news', () => {
    // the sticker printed with the box's own name says nothing
    expect(stickerMarksWords('G78', [{ number: 159, boxName: 'G78' }])).toBe('')
    expect(stickerMarksWords('g78', [{ number: 159, boxName: 'G78' }])).toBe('')
    // one printed with another name says so
    expect(stickerMarksWords('G78B', [{ number: 159, boxName: 'G78' }])).toBe('sticker reads G78')
    // a numbered one reads its number, as before, lowest first
    // a sticker with no name says nothing either (v2.7438: no running number on a screen)
    expect(stickerMarksWords('R12', [{ number: 152 }, { number: 147, boxName: null }])).toBe('')
    expect(stickerMarksWords('G78', [{ number: 160, boxName: 'G78' }, { number: 152 }, { number: 159, boxName: 'G77' }])).toBe('sticker reads G77')
    expect(stickerMarksWords('G78', [])).toBe('')
  })

  it('folds the rows read by box with their names, a lost sticker left off', () => {
    const m = stickerMarksByBoxOf([
      { number: 160, containerId: 'a', lostAt: null, boxName: 'G78' },
      { number: 152, containerId: 'a', lostAt: null },
      { number: 153, containerId: 'a', lostAt: '2026-11-14T00:00:00Z', boxName: 'G79' },
      { number: 154, containerId: null, lostAt: null, boxName: 'G80' },
    ])
    expect([...m.keys()]).toEqual(['a'])
    expect(m.get('a')).toEqual([{ number: 152, boxName: null }, { number: 160, boxName: 'G78' }])
  })

  it('a match row says what its marks carry, and nothing without them', () => {
    const named = matchBoxes({ hereJobId: 'job-a', jobs: [jobA], stickersByBox: new Map([['r12', [152]], ['r76', [159]]]), marksByBox: new Map([['r12', [{ number: 152, boxName: 'G9' }]], ['r76', [{ number: 159, boxName: 'R76' }]]]) })
    expect(matchStickerWords(named.find((b) => b.container.id === 'r12')!)).toBe('sticker reads G9')
    expect(matchStickerWords(named.find((b) => b.container.id === 'r76')!)).toBe('')
    // a box with no marks handed keeps none, and says nothing
    expect(named.find((b) => b.container.id === 'r7')!.marks).toBeUndefined()
    expect(matchStickerWords(boxes.find((b) => b.container.id === 'r12')!)).toBe('')
  })

  it('says what became of the press without saying the name twice', () => {
    const on = (label: string): StickerFacts => ({ ...g78, state: 'on_box', containerId: 'c', containerLabel: label, containerKind: 'cage', jobId: 'job-a', placedByName: 'Marcus', placedAt: '2026-11-14T15:00:00Z' })
    const r = { ...reach, boxLabel: 'G78', boxName: 'G78' }
    expect(placeOutcome({ ok: true, already: false, created: true, containerId: 'c', sticker: on('G78') }, r).words).toBe('G78 is made, with its sticker on it.')
    expect(placeOutcome({ ok: true, already: false, created: false, containerId: 'c', sticker: on('G78') }, r).words).toBe('The sticker is on G78.')
    expect(placeOutcome({ ok: true, already: true, created: false, containerId: 'c', sticker: on('G78') }, r).words).toBe('The sticker was already on G78.')
    // on a box of another name both are said
    expect(placeOutcome({ ok: true, already: false, created: true, containerId: 'c', sticker: on('G78B') }, r).words).toBe('G78B is made, with sticker G78 on it.')
    expect(placeOutcome({ ok: true, already: false, created: false, containerId: 'c', sticker: on('G12') }, r).words).toBe('Sticker G78 is on G12.')
    expect(placeOutcome({ ok: true, already: true, created: false, containerId: 'c', sticker: on('G12') }, r).words).toBe('Sticker G78 was already on G12.')
    // the answer with no sticker in it reads the name the sheet handed
    expect(placeOutcome({ ok: true, already: false, created: false, containerId: 'c', sticker: null }, r).words).toBe('The sticker is on G78.')
    // taken, out of reach and lost say this sticker, not its number
    expect(placeOutcome({ ok: false, sticker: on('G78') }, r).words).toBe('Marcus put this sticker on G78 a minute ago.')
    expect(placeOutcome({ ok: false, sticker: { ...on('G78'), jobId: 'job-z' } }, r).words).toBe('This sticker is on a box of a job you are not on. Ask the office to add you to that job.')
    expect(placeOutcome({ ok: false, sticker: { ...on('G78'), state: 'lost', lostAt: '2026-11-14T00:00:00Z' } }, r).words).toBe('This sticker was on G78 and was marked lost.')
    expect(placingVerdict({ sticker: { ...on('G78'), placedByName: null }, now: NOW })).toMatchObject({ kind: 'on_box', words: 'This sticker was put on G78 a minute ago.' })
  })

  it('a scan of a sticker whose tape reads another name than its box says so', () => {
    expect(stickerReadsOtherWords(g78, 'G78B')).toBe('This sticker reads G78. The box is G78B.')
    expect(stickerReadsOtherWords(g78, 'g78')).toBe('')
    expect(stickerReadsOtherWords(blank, 'R76')).toBe('')
  })

  it('every new sentence follows the rules', () => {
    const words = [nameIsHereWords('G12'), `${STICKER_DIFFERENT_BOX_LABEL}.`, twinNoteWords('G78', 'G78B'), stickerReadsOtherWords(g78, 'G78B'), 'G78 is made, with its sticker on it.', 'The sticker is on G78.', 'Marcus put this sticker on G78 a minute ago.']
    for (const w of words) expect(plainWordsFailures(w), w).toEqual([])
  })
})
