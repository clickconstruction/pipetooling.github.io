/**
 * A Build job waits, with a reason (punch list #192, write A, v2.8723): the six reasons, when the window's press is
 * live, and every word the wait is said in. Every name and number is made up.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import {
  BUILD_WAIT_NOTE_MAX,
  BUILD_WAIT_REASONS,
  BUILD_WAIT_WORDS,
  EMPTY_BUILD_WAIT_DRAFT,
  buildWaitChipWords,
  buildWaitDraftHold,
  buildWaitFactWords,
  buildWaitLiftedWords,
  buildWaitMarkedWords,
  buildWaitReasonOf,
  buildWaitReasonWords,
  buildWaitWhy,
  buildWaitWindowWords,
  type BuildWait,
} from './buildWaits'

const wait = (over: Partial<BuildWait> = {}): BuildWait => ({ jobId: '878', reason: 'gc_not_ready', note: '', sinceYmd: '2026-10-26', markedByName: 'Dana Office', ...over })

describe('the reasons', () => {
  it('are six, each short enough for a phone, with something else last', () => {
    expect(BUILD_WAIT_REASONS.map((r) => r.key)).toEqual(['gc_not_ready', 'materials', 'inspection', 'customer_hold', 'weather', 'other'])
    for (const r of BUILD_WAIT_REASONS) expect(r.label.split(' ').length, r.label).toBeLessThanOrEqual(7)
    expect(BUILD_WAIT_REASONS[5]!.label).toBe('Something else')
  })

  it('read inside a sentence, and another reason is the person’s own words', () => {
    expect(BUILD_WAIT_REASONS.map((r) => buildWaitReasonWords({ reason: r.key, note: 'The permit is with the city.' }))).toEqual(['the GC is not ready for us', 'waiting on materials', 'waiting on an inspection', 'the customer asked us to hold', 'weather', 'The permit is with the city'])
    expect(buildWaitReasonWords({ reason: 'other', note: '  ' })).toBe('a reason of its own')
  })

  it('a reason the database could send and this build does not know is no reason', () => {
    expect(buildWaitReasonOf('weather')).toBe('weather')
    for (const raw of ['holiday', '', null, undefined]) expect(buildWaitReasonOf(raw)).toBeNull()
  })
})

describe('the words on the desk, the card and the job window', () => {
  it('the chip names the reason and the day', () => {
    expect(buildWaitChipWords(wait())).toBe('Waits · the GC is not ready for us · since Oct 26')
    expect(buildWaitChipWords(wait({ reason: 'other', note: 'The permit is with the city.', sinceYmd: '2026-11-03' }))).toBe('Waits · The permit is with the city · since Nov 3')
  })

  it('the fact row names the day, the reason and who, by first name', () => {
    expect(buildWaitFactWords(wait())).toBe('Since Oct 26 · the GC is not ready for us · Dana')
    expect(buildWaitFactWords(wait({ markedByName: '' }))).toBe('Since Oct 26 · the GC is not ready for us')
  })

  it('the why-line says what stops being counted and what still is', () => {
    expect(buildWaitWhy(wait(), 47_120)).toBe('Waits since Oct 26: the GC is not ready for us. Dana marked it. This window does not count the $47.1k against the crew while it waits. The Build card still counts it as sold work.')
    // A line typed beside a picked reason is said once, with one stop.
    expect(buildWaitWhy(wait({ note: 'Slab pour moved a week.' }), 47_120)).toContain('the GC is not ready for us. Slab pour moved a week. Dana marked it.')
    // No price or no percent: there is no money to name.
    expect(buildWaitWhy(wait({ markedByName: '' }), null)).toBe('Waits since Oct 26: the GC is not ready for us. This window does not count the job against the crew while it waits. The Build card still counts it as sold work.')
    expect(buildWaitWhy(wait({ reason: 'other', note: 'The permit is with the city.' }), 0)).toContain('Waits since Oct 26: The permit is with the city. Dana marked it.')
  })

  it('every sentence holds to the plain-words rule', () => {
    const said = [
      buildWaitWhy(wait(), 47_120),
      buildWaitWhy(wait({ note: 'Slab pour moved a week.' }), null),
      buildWaitWindowWords('878 · Tune 5 Seguin', 47_120).lede,
      buildWaitWindowWords('878 · Tune 5 Seguin', null).lede,
      buildWaitWindowWords('878 · Tune 5 Seguin', null).foot,
      // A job's label carries its own dot between the number and the name, so the rule is asked of the name alone.
      buildWaitMarkedWords('Tune 5 Seguin', { reason: 'gc_not_ready', note: '' }),
      buildWaitLiftedWords('Tune 5 Seguin'),
      ...[EMPTY_BUILD_WAIT_DRAFT, { reason: 'other' as const, note: '' }, { reason: 'weather' as const, note: 'x'.repeat(BUILD_WAIT_NOTE_MAX + 1) }].map((d) => buildWaitDraftHold(d) ?? ''),
    ].filter(Boolean)
    for (const s of said) expect(plainWordsFailures(s), s).toEqual([])
  })
})

describe('the small window', () => {
  it('names the job, says what the press does, and its button names the act', () => {
    expect(buildWaitWindowWords('878 · Tune 5 Seguin', 47_120)).toEqual({
      title: '878 · Tune 5 Seguin waits',
      lede: 'Pick the reason. This window stops counting the $47.1k against the crew until someone lifts the wait.',
      noteLabel: 'A line to add, if you like',
      foot: 'Written on the job with your name and today’s date.',
      confirmLabel: 'Mark it waiting',
      busyLabel: 'Marking…',
    })
    expect(buildWaitWindowWords('1017 · Tarrow', null).lede).toBe('Pick the reason. This window stops counting this job against the crew until someone lifts the wait.')
  })

  it('the press is dead until a reason is picked, and something else needs words', () => {
    expect(buildWaitDraftHold(EMPTY_BUILD_WAIT_DRAFT)).toBe('Pick the reason first.')
    expect(buildWaitDraftHold({ reason: 'weather', note: '' })).toBeNull()
    expect(buildWaitDraftHold({ reason: 'other', note: '   ' })).toBe('Say why the job waits.')
    expect(buildWaitDraftHold({ reason: 'other', note: 'The permit is with the city.' })).toBeNull()
    expect(buildWaitDraftHold({ reason: 'weather', note: 'x'.repeat(BUILD_WAIT_NOTE_MAX) })).toBeNull()
    expect(buildWaitDraftHold({ reason: 'weather', note: 'x'.repeat(BUILD_WAIT_NOTE_MAX + 1) })).toBe('Keep the words under 300 characters.')
  })

  it('the presses and the toasts name their acts', () => {
    expect(BUILD_WAIT_WORDS).toMatchObject({ name: 'Name why it waits', lift: 'Lift the wait', factLabel: 'Waits' })
    expect(buildWaitMarkedWords('878 · Tune 5 Seguin', { reason: 'gc_not_ready', note: '' })).toBe('878 · Tune 5 Seguin waits: the GC is not ready for us.')
    expect(buildWaitLiftedWords('878 · Tune 5 Seguin')).toBe('The wait on 878 · Tune 5 Seguin is lifted. It counts on the Build desk again.')
  })
})
