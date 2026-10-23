import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { LANE_NOTES, NEEDS_YOU_NOTE } from './laneNotes'

describe('the queue lanes’ help sentences (punch list #151 PR 3)', () => {
  it('say what each lane holds in plain words', () => {
    for (const words of [LANE_NOTES.new, LANE_NOTES.needsYou(true), LANE_NOTES.needsReply, LANE_NOTES.weOwe]) {
      expect(plainWordsFailures(words)).toEqual([])
    }
  })

  it('adds the clause sentence to Needs you only where the host draws clause rows', () => {
    expect(LANE_NOTES.needsYou(false)).toBe(`${NEEDS_YOU_NOTE.back} ${NEEDS_YOU_NOTE.portal}`)
    expect(LANE_NOTES.needsYou(true)).toContain(NEEDS_YOU_NOTE.clause)
  })

  it('ends We owe them with the calls’ own sentence', () => {
    expect(LANE_NOTES.weOwe).toMatch(/Quo closes it when the call lands in the thread\.$/)
  })
})
