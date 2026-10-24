import { describe, expect, it } from 'vitest'
import type { Contact } from '../contacts/kernel'
import { plainWordsFailures } from '../plainWords'
import { ANSWER_DONE, ANSWER_GONE, ANSWER_NO_WAY, ANSWER_READING, answerAllAsked, answerAllHref, answerProgress, answerStep, canAnswerAll, countOne, EMPTY_TALLY, reachable, skipAnswer, tallyWords, withoutAnswerAll } from './answerDesk'

describe('the Answer all link (v2.5816, Quickfill’s Texts station)', () => {
  it('opens Messages with the desk, is read from the address, and comes off it with the rest kept', () => {
    expect(answerAllHref()).toBe('/messages?answer=all')
    expect(answerAllAsked(new URLSearchParams('answer=all&kind=customer'))).toBe(true)
    expect(answerAllAsked(new URLSearchParams('answer=1'))).toBe(false)
    expect(answerAllAsked(new URLSearchParams(''))).toBe(false)
    expect(withoutAnswerAll(new URLSearchParams('answer=all&kind=customer')).toString()).toBe('kind=customer')
  })
})

const lane = (...ids: string[]) => ids.map((contactId) => ({ contactId }))
const THREE = lane('greg', 'priya', 'dana')

describe('Answer all (punch list #140 PR 6)', () => {
  it('shows on Needs a reply’s header from one person', () => {
    expect(canAnswerAll(0)).toBe(false)
    expect(canAnswerAll(1)).toBe(true)
  })

  it('starts on the person waiting longest, with how far the desk has come in parts', () => {
    expect(answerStep(THREE, new Set(), null, 3)).toEqual({ current: 'greg', gone: null, progress: ['Needs a reply', '3 to answer', '1 of 3'], more: '2 more after this' })
    expect(answerStep(lane('dana'), new Set(), null, 3)).toEqual({ current: 'dana', gone: null, progress: ['Needs a reply', '1 to answer', '3 of 3'], more: 'The last one' })
    expect(answerStep([], new Set(), null, 3)).toEqual({ current: null, gone: null, progress: [], more: null })
    expect(answerProgress(5, 3)).toEqual(['Needs a reply', '5 to answer', '1 of 5'])
  })

  it('keeps the pinned person’s card up while the lane reorders under it', () => {
    expect(answerStep(lane('dana', 'greg', 'priya'), new Set(), 'greg', 3).current).toBe('greg')
  })

  it('says so when the pinned person left the lane, and Next picks the next unskipped', () => {
    expect(answerStep(lane('priya', 'dana'), new Set(), 'greg', 3)).toEqual({ current: null, gone: 'greg', progress: ['Needs a reply', '2 to answer', '2 of 3'], more: '1 more after this' })
    expect(answerStep(lane('priya', 'dana'), new Set(['priya']), null, 3).current).toBe('dana')
  })

  it('a skip puts the person after the rest, as Sort all has it', () => {
    const skipped = skipAnswer(THREE, new Set(), 'greg')
    expect(answerStep(THREE, skipped, null, 3).current).toBe('priya')
    expect([...skipAnswer(THREE, skipAnswer(THREE, skipped, 'priya'), 'dana')]).toEqual(['dana'])
  })

  it('tallies what went, in words', () => {
    expect(tallyWords(EMPTY_TALLY)).toBe('Nothing went.')
    const t = countOne(countOne(countOne(countOne(EMPTY_TALLY, 'texts'), 'texts'), 'emails'), 'noReply')
    expect(tallyWords(t)).toBe('2 texts, 1 email and 1 no reply needed went.')
    expect(tallyWords(countOne(countOne(EMPTY_TALLY, 'notes'), 'skipped'))).toBe('1 note went. 1 skipped.')
    expect(tallyWords(countOne(countOne(EMPTY_TALLY, 'calls'), 'calls'))).toBe('2 calls went.')
  })

  it('knows whom the box can reach', () => {
    const c = (channels: Contact['channels']): Pick<Contact, 'name' | 'channels'> => ({ name: 'Dana', channels })
    expect(reachable(c([{ id: 'p', kind: 'phone', value: '(830) 555-0121', optedOutAt: null }]))).toBe(true)
    expect(reachable(c([{ id: 'e', kind: 'email', value: 'dana@example.com', optedOutAt: null }]))).toBe(true)
    expect(reachable(c([{ id: 'p', kind: 'phone', value: '(830) 555-0121', optedOutAt: '2026-09-01T00:00:00Z' }]))).toBe(false)
    expect(reachable(c([]))).toBe(false)
  })

  it('reads in plain words', () => {
    const words = [ANSWER_DONE.title, ANSWER_DONE.note, ANSWER_DONE.quiet(1), ANSWER_DONE.quiet(3), ANSWER_GONE('Greg Paulk'), ANSWER_NO_WAY, ANSWER_READING.failed, tallyWords(countOne(EMPTY_TALLY, 'texts'))]
    for (const w of words) expect(plainWordsFailures(w), w).toEqual([])
  })
})
