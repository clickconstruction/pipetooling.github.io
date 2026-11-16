import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { Container, ContainerLine } from './onSite'
import type { OnSiteFindJob } from './onSiteFind'
import {
  blankCountOf,
  boxWithStickersWords,
  defaultBranch,
  GOES_ON_WORDS,
  jobBlankWords,
  matchBoxes,
  matchList,
  matchStickerWords,
  nameIsHereWords,
  newBoxPressLabel,
  NO_SIGNAL_WORDS,
  noStickerByNumberWords,
  noStickerCountWords,
  notYetOnBoxLine,
  notYetOnBoxWords,
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
  stickerNumbersWords,
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
const reach = { jobIds: ['job-a', 'job-b'], boxLabel: 'R76', number: 147, now: NOW }

describe('the sheet’s words', () => {
  it('names the sticker and the two branches', () => {
    expect(stickerNewTitle(147)).toBe('Sticker 0147 is new')
    expect(STICKER_NEW_ASK).toBe('What is it on?')
    expect(STICKER_BRANCH_WORDS.known).toBe('It is on a box I know')
    expect(STICKER_BRANCH_WORDS.new).toBe('It is a new box')
    expect(placePressLabel(147, 'R76')).toBe('Put 0147 on R76')
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

describe('the number on a box', () => {
  it('reads the stickers beside the name, lowest first', () => {
    expect(stickerNumbersWords([152, 147])).toBe('0147, 0152')
    expect(stickerNumbersWords([])).toBe('')
    expect(boxWithStickersWords('G12', [147])).toBe('G12 · 0147')
    expect(boxWithStickersWords('G12', [])).toBe('G12')
  })

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
    expect(notYetOnBoxWords(2)).toBe('2 stickers not yet on a box')
    expect(notYetOnBoxWords(1)).toBe('1 sticker not yet on a box')
    expect(notYetOnBoxWords(0)).toBe('')
    expect(jobBlankWords(12)).toBe('This job has 12 stickers not yet on a box.')
    expect(jobBlankWords(0)).toBe('')
    expect(notYetOnBoxLine(12)).toBe('12 stickers not yet on a box. Scan one to say which box it is on.')
    expect(notYetOnBoxLine(0)).toBe('')
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
    expect(placeOutcome({ ok: true, already: false, created: false, containerId: 'r76', sticker: onR76 }, reach)).toEqual({ kind: 'placed', words: '0147 is on R76.', containerId: 'r76', jobId: 'job-a' })
    expect(placeOutcome({ ok: true, already: true, created: false, containerId: 'r76', sticker: onR76 }, reach)).toMatchObject({ kind: 'already', words: '0147 was already on R76.' })
    expect(placeOutcome({ ok: true, already: false, created: true, containerId: 'new-1', sticker: { ...onR76, containerId: 'new-1', containerLabel: 'R97' } }, reach)).toMatchObject({ kind: 'created', words: 'R97 is made, with sticker 0147 on it.', containerId: 'new-1' })
    // The answer with no sticker in it still names the box the press named.
    expect(placeOutcome({ ok: true, already: false, created: false, containerId: 'r76', sticker: null }, reach)).toMatchObject({ kind: 'placed', words: '0147 is on R76.', containerId: 'r76' })
  })

  it('someone else took it first: who and when, with the box to open when the person may reach it', () => {
    expect(placeOutcome({ ok: false, sticker: onR76 }, reach)).toEqual({ kind: 'taken', words: 'Marcus put 0147 on R76 a minute ago.', containerId: 'r76', jobId: 'job-a' })
    expect(placeOutcome({ ok: false, sticker: { ...onR76, jobId: 'job-z' } }, reach)).toEqual({ kind: 'out_of_reach', words: '0147 is on a box of a job you are not on. Ask the office to add you to that job.', containerId: null, jobId: 'job-z' })
    expect(placeOutcome({ ok: false, sticker: { ...onR76, state: 'lost', lostAt: '2026-11-14T00:00:00Z' } }, reach)).toMatchObject({ kind: 'lost', words: '0147 was on R76 and was marked lost.' })
    expect(placeOutcome({ ok: false, sticker: null }, reach)).toMatchObject({ kind: 'taken', words: PLACE_UNREAD_WORDS })
  })
})

describe('what a typed scan means', () => {
  it('digits alone are a sticker’s number, eight characters a code, the rest short', () => {
    expect(readScanTyped('0147')).toEqual({ kind: 'number', number: 147 })
    expect(readScanTyped('147')).toEqual({ kind: 'number', number: 147 })
    expect(readScanTyped('10432')).toEqual({ kind: 'number', number: 10432 })
    expect(readScanTyped('4f2a-9c18')).toEqual({ kind: 'code', code: '4F2A9C18' })
    expect(readScanTyped('12345678')).toEqual({ kind: 'code', code: '12345678' })
    expect(readScanTyped('0000')).toEqual({ kind: 'short' })
    expect(readScanTyped('4f2a9')).toEqual({ kind: 'short' })
    expect(readScanTyped('  ')).toEqual({ kind: 'empty' })
  })

  it('draws digits as typed and a code with its dash', () => {
    expect(scanTypedWords('0147')).toBe('0147')
    expect(scanTypedWords('01475')).toBe('01475')
    expect(scanTypedWords('4f2a9c18')).toBe('4F2A-9C18')
    expect(scanTypedWords('4f2a9')).toBe('4F2A-9')
    expect(scanTypedWords('123456')).toBe('1234-56')
    expect(noStickerByNumberWords(147)).toBe('No sticker 0147 is on a job you are on.')
  })
})

describe('plain words', () => {
  it('every sentence a person reads follows the rules', () => {
    const words = [
      `${stickerNewTitle(147)}.`,
      STICKER_NEW_ASK,
      `${STICKER_BRANCH_WORDS.known}.`,
      `${STICKER_BRANCH_WORDS.new}.`,
      NO_SIGNAL_WORDS,
      noStickerCountWords(boxes),
      notYetOnBoxLine(12),
      placeOutcome({ ok: true, already: false, created: true, containerId: 'new-1', sticker: { ...onR76, containerLabel: 'R97' } }, reach).words,
      placeOutcome({ ok: false, sticker: { ...onR76, jobId: 'job-z' } }, reach).words,
      PLACE_UNREAD_WORDS,
      noStickerByNumberWords(147),
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
    expect(stickerSayName(blank)).toBe('0147')
    expect(stickerNameIs('G78', ' g78')).toBe(true)
    expect(stickerNameIs('G78', 'G78B')).toBe(false)
    expect(stickerNameIs(null, 'G78')).toBe(false)
  })

  it('the sheet is titled by the name on the tape', () => {
    expect(stickerNewTitle(g78)).toBe('Sticker G78 is new')
    expect(stickerNewTitle(blank)).toBe('Sticker 0147 is new')
    expect(stickerNewTitle(147)).toBe('Sticker 0147 is new')
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
    expect(stickerMarksWords('R12', [{ number: 152 }, { number: 147, boxName: null }])).toBe('0147, 0152')
    expect(stickerMarksWords('G78', [{ number: 160, boxName: 'G78' }, { number: 152 }, { number: 159, boxName: 'G77' }])).toBe('0152, sticker reads G77')
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

  it('a match row reads its marks when it has them, its numbers when it does not', () => {
    const named = matchBoxes({ hereJobId: 'job-a', jobs: [jobA], stickersByBox: new Map([['r12', [152]], ['r76', [159]]]), marksByBox: new Map([['r12', [{ number: 152 }]], ['r76', [{ number: 159, boxName: 'R76' }]]]) })
    expect(matchStickerWords(named.find((b) => b.container.id === 'r12')!)).toBe('0152')
    expect(matchStickerWords(named.find((b) => b.container.id === 'r76')!)).toBe('')
    // a box with no marks handed keeps none, and reads by number
    expect(named.find((b) => b.container.id === 'r7')!.marks).toBeUndefined()
    expect(matchStickerWords(boxes.find((b) => b.container.id === 'r12')!)).toBe('0147, 0152')
  })

  it('says what became of the press without saying the name twice', () => {
    const on = (label: string): StickerFacts => ({ ...g78, state: 'on_box', containerId: 'c', containerLabel: label, containerKind: 'cage', jobId: 'job-a', placedByName: 'Marcus', placedAt: '2026-11-14T15:00:00Z' })
    const r = { ...reach, number: 159, boxLabel: 'G78', boxName: 'G78' }
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
