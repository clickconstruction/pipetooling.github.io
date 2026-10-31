import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { isRobotRow, robotRowPill, robotShareOf, robotSourceIds, SET_ASIDE_WORDS, setAsideFoldWords } from './robotFixtureShade'

const ids = robotSourceIds([{ id: 'ct', source_kind: 'counttooling' }, { id: 'rb', source_kind: 'robot' }, { id: 'old' }])

describe('the shade is the share', () => {
  it('knows the robot’s rows by their share', () => {
    expect([...ids]).toEqual(['rb'])
    expect(isRobotRow({ rb: 5 }, ids)).toBe(true)
    expect(isRobotRow({ ct: 5 }, ids)).toBe(false)
    expect(isRobotRow(null, ids)).toBe(false)
    expect(robotShareOf({ ct: 2, rb: 3 }, ids)).toBe(3)
  })
  it('the pill reads Robot, or both numbers once she changed the count', () => {
    expect(robotRowPill({ rb: 5 }, ids, 5)).toEqual({ words: 'Robot', title: 'The robot counted this row. You took it as it was.', edited: false })
    expect(robotRowPill({ rb: 2 }, ids, 3)).toEqual({ words: 'Robot 2 → yours 3', title: 'The robot counted 2. You made it 3.', edited: true })
    expect(robotRowPill({ rb: 2 }, ids, '2.00')).toMatchObject({ edited: false })
    expect(robotRowPill({ ct: 2 }, ids, 3)).toBeNull()
  })
  it('the fold line names the set-aside rows with their reasons', () => {
    expect(setAsideFoldWords([])).toBeNull()
    expect(setAsideFoldWords([{ tag: 'BFP-1', reason: 'by_others' }, { tag: 'HB-2', reason: null }])).toEqual({ head: 'Robot · 2 set aside', list: 'BFP-1 by others, HB-2', n: 2 })
  })
  it('the words read plain', () => {
    expect(plainWordsFailures(SET_ASIDE_WORDS.why)).toEqual([])
    expect(plainWordsFailures(robotRowPill({ rb: 2 }, ids, 3)!.title)).toEqual([])
  })
})
