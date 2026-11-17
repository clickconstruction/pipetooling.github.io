import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { ROUND_MIN, roundConfirmMessage, roundHeldCount, roundHeldWords, roundOutcome, roundPressLabel, roundTaskIds, type RoundTask } from './markRound'

const t = (id: string, over: Partial<RoundTask> = {}): RoundTask => ({ id, open: true, ring: false, hasLines: false, asksForPhoto: false, stuck: false, ...over })

describe('Mark N done', () => {
  const tasks = [t('a'), t('b', { ring: true }), t('c'), t('d', { hasLines: true }), t('e', { asksForPhoto: true }), t('f', { stuck: true }), t('g', { open: false }), t('h')]
  it('takes today\'s open repeating tasks with a plain tick, in the list\'s order', () => {
    expect(roundTaskIds(tasks)).toEqual(['a', 'c', 'h'])
  })
  it('counts the open tasks it leaves for their own press', () => {
    expect(roundHeldCount(tasks)).toBe(4)
    expect(roundHeldCount([t('a'), t('b')])).toBe(0)
  })
  it('the press says what it will do, with its count', () => {
    expect(roundPressLabel(3)).toBe('Mark 3 done')
    expect(ROUND_MIN).toBe(2)
  })
  it('says what is left out, and nothing when nothing is', () => {
    expect(roundHeldWords(0)).toBeNull()
    expect(roundHeldWords(1)).toBe('1 more task has its own steps. Finish it from its card.')
    expect(roundHeldWords(4)).toBe('4 more tasks have their own steps. Finish each from its card.')
  })
  it('the confirm window asks in plain words', () => {
    expect(roundConfirmMessage(3)).toBe('Mark these 3 tasks done? Each finishes as if you had ticked it.')
    for (const s of [roundConfirmMessage(3), roundHeldWords(1)!, roundHeldWords(4)!]) expect(plainWordsFailures(s)).toEqual([])
  })
  it('says what took and what did not', () => {
    expect(roundOutcome(3, 0)).toMatchObject({ line: 'Marked 3 tasks done.', tone: 'success' })
    expect(roundOutcome(2, 1)).toMatchObject({ line: 'Marked 2 tasks done. 1 did not mark.', tone: 'warning' })
    expect(roundOutcome(0, 2).tone).toBe('error')
  })
})
