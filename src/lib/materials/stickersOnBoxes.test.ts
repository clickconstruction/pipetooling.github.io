import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  ON_BOXES_EMPTY_WORDS,
  ON_BOXES_FAILED,
  ON_BOXES_LABEL,
  ON_BOXES_READING_WORDS,
  ON_BOXES_SUB,
  ON_BOXES_UNREAD_ANSWER,
  ON_BOXES_UNREAD_WORDS,
  onBoxesAnswerOf,
  onBoxesAsk,
  onBoxesGoesOnWords,
  onBoxesOutcome,
  onBoxesPlan,
  onBoxesPlanLines,
  onBoxesPrefill,
  onBoxesPressLabel,
  onBoxesReady,
  onBoxesRequest,
  onBoxesToast,
  placeStickerRangeArgs,
  type OnBoxesAnswer,
} from './stickersOnBoxes'

/** A made-up site: G12 and G80 stand, G40 is retired, and stickers G78 to G82 are printed and blank. */
const box = (label: string, over: Partial<{ retiredAt: string | null; kind: string }> = {}) => ({ label, kind: over.kind ?? 'cage', retiredAt: over.retiredAt ?? null })
const site = { boxes: [box('G12'), box(' g80'), box('G40', { retiredAt: '2026-11-01T00:00:00Z' }), box('G79', { kind: 'unsorted' })], blankNames: ['G78', 'g79', 'G80', 'G81', 'G82', 'G40'] }
const names = (typed: string) => onBoxesAsk(typed).names ?? []

describe('the Names field', () => {
  it('reads a range by the print window’s own parser, and one name alone is one name', () => {
    expect(onBoxesAsk('g78-150')).toMatchObject({ tone: 'ok', words: 'G78 to G150 · 73 names.' })
    expect(onBoxesAsk('g78-150').names).toHaveLength(73)
    expect(onBoxesAsk('G78')).toMatchObject({ tone: 'ok', names: ['G78'], words: 'G78 · 1 name.' })
    expect(onBoxesAsk('G78 to 80').names).toEqual(['G78', 'G79', 'G80'])
    expect(onBoxesAsk('G78B-D').names).toEqual(['G78B', 'G78C', 'G78D'])
  })

  it('nothing typed says what to type, and a refusal is the parser’s own words', () => {
    expect(onBoxesAsk('  ')).toMatchObject({ tone: 'empty', names: null, words: ON_BOXES_EMPTY_WORDS })
    expect(onBoxesAsk('G150-78')).toMatchObject({ tone: 'refused', names: null, words: 'The range runs upward: G78 to G150.' })
    expect(onBoxesAsk('78-150').tone).toBe('refused')
  })
})

describe('the plan, before the press', () => {
  it('a blank sticker with no live box makes one, with a live box goes on it, and a name with no blank sticker is left', () => {
    const plan = onBoxesPlan(names('G78-83'), site)
    // G79 is only Unsorted's row and G40 only a retired box: neither is a live box of the name
    expect(plan).toEqual({ make: ['G78', 'G79', 'G81', 'G82'], take: ['G80'], none: ['G83'] })
    expect(onBoxesReady(plan)).toBe(5)
    expect(onBoxesPlan(['G40'], site)).toEqual({ make: ['G40'], take: [], none: [] })
    expect(onBoxesPlan(['G12'], site)).toEqual({ make: [], take: [], none: ['G12'] })
    expect(onBoxesReady(onBoxesPlan(['G12', 'G99'], site))).toBe(0)
  })

  it('says the plan a line a kind, with the names', () => {
    const run = names('G78-83')
    expect(onBoxesPlanLines(onBoxesPlan(run, site), run)).toEqual([
      '4 boxes will be made, G78, G79 and 2 more.',
      '1 is a box on this site already, G80. Its sticker goes on it.',
      '1 has no reserved sticker, G83. Nothing is done for it.',
    ])
    const two = names('G81-82')
    expect(onBoxesPlanLines(onBoxesPlan(two, site), two)).toEqual(['2 boxes will be made, G81 to G82.'])
    expect(onBoxesPlanLines(onBoxesPlan(['G78'], site), ['G78'])).toEqual(['1 box will be made, G78.'])
    const none = names('G90-92')
    expect(onBoxesPlanLines(onBoxesPlan(none, site), none)).toEqual(['3 have no reserved sticker, G90 to G92. Nothing is done for them.'])
    const taken = { boxes: [box('G78'), box('G79')], blankNames: ['G78', 'G79'] }
    expect(onBoxesPlanLines(onBoxesPlan(['G78', 'G79'], taken), ['G78', 'G79'])).toEqual(['2 are boxes on this site already, G78 to G79. Their stickers go on them.'])
  })

  it('the press names its count, and is dead at none', () => {
    expect(onBoxesPressLabel(73)).toBe('Put 73 stickers on their boxes')
    expect(onBoxesPressLabel(1)).toBe('Put 1 sticker on its box')
    expect(onBoxesPressLabel(0)).toBe('Put stickers on boxes')
  })

  it('a run’s blank names open the field as one range only when one range says exactly them', () => {
    expect(onBoxesPrefill(['G79', 'G80', 'G81'])).toBe('G79-G81')
    expect(onBoxesAsk(onBoxesPrefill(['G79', 'G80', 'G81'])).names).toEqual(['G79', 'G80', 'G81'])
    expect(onBoxesPrefill(['G79'])).toBe('G79')
    expect(onBoxesPrefill([])).toBe('')
    // a gap, or a grid's leftovers, is not one range: nothing is guessed
    expect(onBoxesPrefill(['G79', 'G81'])).toBe('')
    expect(onBoxesPrefill(['A49', 'A50', 'B1'])).toBe('')
    // twins at one spot are a range of their own
    expect(onBoxesPrefill(['G78B', 'G78C', 'G78D'])).toBe('G78B-G78D')
  })
})

describe('the request', () => {
  it('asks for the job, the names and a where line that fits', () => {
    expect(onBoxesRequest({ jobId: 'job-a', names: ['G78', 'G79'], boxKind: 'cage', placeId: 'arena', where: '  by the north stair ' })).toEqual({ ok: true, request: { jobId: 'job-a', names: ['G78', 'G79'], boxKind: 'cage', placeId: 'arena', where: 'by the north stair' } })
    expect(onBoxesRequest({ jobId: null, names: ['G78'], boxKind: 'cage', placeId: null, where: '' })).toEqual({ ok: false, words: 'Pick the job the new boxes go on.' })
    expect(onBoxesRequest({ jobId: 'job-a', names: null, boxKind: 'cage', placeId: null, where: '' })).toEqual({ ok: false, words: ON_BOXES_EMPTY_WORDS })
    expect(onBoxesRequest({ jobId: 'job-a', names: [], boxKind: 'cage', placeId: null, where: '' }).ok).toBe(false)
    expect(onBoxesRequest({ jobId: 'job-a', names: ['G78'], boxKind: 'cage', placeId: null, where: 'x'.repeat(121) })).toEqual({ ok: false, words: 'The where line holds 120 characters. This one is 121.' })
  })

  it('hands place_sticker_range its five arguments', () => {
    expect(placeStickerRangeArgs({ jobId: 'job-a', names: ['G78', 'G79'], boxKind: 'box', placeId: null, where: '' })).toEqual({ p_job_id: 'job-a', p_names: ['G78', 'G79'], p_kind: 'box', p_place_id: null, p_where_note: '' })
  })
})

describe('the answer', () => {
  const raw = { ok: true, made: ['G78', 'G79', 'G81'], took: ['G80'], already: [], no_sticker: ['G90'], held: [], stickers: 5 }

  it('reads back what the function answers, and nothing from a shape that is not one', () => {
    expect(onBoxesAnswerOf(raw)).toEqual({ made: ['G78', 'G79', 'G81'], took: ['G80'], already: [], noSticker: ['G90'], held: [], stickers: 5 })
    expect(onBoxesAnswerOf({ ok: true, held: [{ name: 'R1', why: 'The bed refuses R1.' }, { why: 'no name' }, null] })).toEqual({ made: [], took: [], already: [], noSticker: [], held: [{ name: 'R1', why: 'The bed refuses R1.' }], stickers: 0 })
    expect(onBoxesAnswerOf({ ok: false })).toBeNull()
    expect(onBoxesAnswerOf(null)).toBeNull()
    expect(onBoxesAnswerOf('ok')).toBeNull()
  })

  const sent = ['G78', 'G79', 'G80', 'G81', 'G90']
  const answer = (over: Partial<OnBoxesAnswer>): OnBoxesAnswer => ({ made: [], took: [], already: [], noSticker: [], held: [], stickers: 0, ...over })

  it('says what was made, what took its sticker, what was left and what had none', () => {
    const out = onBoxesOutcome(onBoxesAnswerOf(raw)!, sent)
    expect(out.lines).toEqual([
      '3 boxes made with their stickers on them, G78, G79 and 1 more.',
      '1 box already on this site took its sticker, G80.',
      '1 has no sticker printed, G90. Nothing was made for it.',
    ])
    expect(out.heldHead).toBeNull()
    expect(out.tone).toBe('success')
    expect(onBoxesToast(out)).toBe('3 boxes made with their stickers on them, G78, G79 and 1 more.')
  })

  it('a second press of the same range says they were left as they are', () => {
    const out = onBoxesOutcome(answer({ already: ['G78', 'G79', 'G80', 'G81'] }), sent)
    expect(out.lines).toEqual(['No sticker was put on a box.', '4 already had their stickers and were left as they are, G78 to G81.'])
    expect(out.tone).toBe('warning')
    expect(onBoxesOutcome(answer({ already: ['G78'] }), sent).lines[1]).toBe('1 already had its sticker and was left as it is, G78.')
  })

  it('one of each reads in the singular', () => {
    const out = onBoxesOutcome(answer({ made: ['G78'], took: ['G80'], noSticker: ['G90', 'G81'], stickers: 2 }), sent)
    expect(out.lines).toEqual([
      '1 box made with its sticker on it, G78.',
      '1 box already on this site took its sticker, G80.',
      '2 have no sticker printed, G90 and G81. Nothing was made for them.',
    ])
  })

  it('a name the database refused is kept apart with its reason, and the rest are said', () => {
    const out = onBoxesOutcome(answer({ made: ['G79'], held: [{ name: 'G78', why: 'The bed refuses G78.' }], stickers: 1 }), sent)
    expect(out.lines).toEqual(['1 box made with its sticker on it, G79.'])
    expect(out.heldHead).toBe('1 name did not go on. It stays here with the reason.')
    expect(out.held).toEqual([{ name: 'G78', why: 'The bed refuses G78.' }])
    expect(out.tone).toBe('warning')
    const all = onBoxesOutcome(answer({ held: [{ name: 'G78', why: 'a' }, { name: 'G79', why: 'b' }] }), sent)
    expect(all.lines).toEqual(['No sticker was put on a box.'])
    expect(all.heldHead).toBe('2 names did not go on. They stay here with the reason.')
    expect(all.tone).toBe('error')
  })
})

describe('plain words', () => {
  it('every sentence a person reads follows the rules', () => {
    const run = names('G78-83')
    const words = [
      `${ON_BOXES_LABEL}.`,
      ON_BOXES_SUB,
      ON_BOXES_EMPTY_WORDS,
      ON_BOXES_READING_WORDS,
      ON_BOXES_UNREAD_WORDS,
      ON_BOXES_UNREAD_ANSWER,
      ON_BOXES_FAILED,
      onBoxesGoesOnWords('Juniper Ridge'),
      ...onBoxesPlanLines(onBoxesPlan(run, site), run),
      ...onBoxesOutcome({ made: ['G78', 'G79'], took: ['G80'], already: ['G81'], noSticker: ['G83'], held: [{ name: 'G82', why: 'x' }], stickers: 3 }, run).lines,
      onBoxesOutcome({ made: [], took: [], already: [], noSticker: [], held: [{ name: 'G82', why: 'x' }], stickers: 0 }, run).heldHead ?? '',
    ]
    for (const w of words) expect(plainWordsFailures(w), w).toEqual([])
  })
})
