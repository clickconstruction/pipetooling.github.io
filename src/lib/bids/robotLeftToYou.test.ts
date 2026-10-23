import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { LET_ROBOT_BACK_IN_LABEL, LET_ROBOT_BACK_IN_TOAST, ROBOT_LEFT_MARK_TEXT, ROBOT_LEFT_SHEET_SENTENCES, robotLeftLabel, robotLeftTitle, robotLeftToYou } from './robotLeftToYou'
import type { RobotRowState } from './robotRowState'

describe('robotLeftToYou', () => {
  it('the mark is for the opted-out state alone: a division off, a grade, a live robot all keep their own icon', () => {
    expect(robotLeftToYou({ kind: 'off', reason: 'opt-out', title: '' })).toBe(true)
    const others: RobotRowState[] = [
      { kind: 'off', reason: 'division', title: '' },
      { kind: 'none', title: '' },
      { kind: 'queued', title: '' },
      { kind: 'working', title: '', twinBidNumber: null },
      { kind: 'sealed', title: '', lockedAt: null, twinBidNumber: null },
      { kind: 'scored', title: '', deltaPct: null, twinBidNumber: null },
      { kind: 'needs', badge: '?', title: '', gaps: [], questions: 0 },
      { kind: 'grade', title: '', grade: 'A' },
    ]
    for (const s of others) expect(robotLeftToYou(s)).toBe(false)
  })

  it('the words: the tooltip names the project, the label the bid, the two sentences one state each', () => {
    expect(robotLeftTitle('AutoZone New Braunfels')).toBe('Left to you. Robots leave AutoZone New Braunfels alone. Tap to let the robot back in.')
    expect(robotLeftLabel({ bid_number: '510', project_name: ' AutoZone New Braunfels ' })).toBe('b510 · AutoZone New Braunfels')
    expect(robotLeftLabel({ bid_number: null, project_name: null })).toBe('b? · bid')
    expect(ROBOT_LEFT_SHEET_SENTENCES[0]).toMatch(/^Left to you means /)
    expect(ROBOT_LEFT_SHEET_SENTENCES[1]).toMatch(/^Let the robot back in means /)
    expect(ROBOT_LEFT_MARK_TEXT).toBe('you')
    expect(LET_ROBOT_BACK_IN_LABEL).toBe('Let the robot back in')
  })

  it('every sentence a person reads passes the plain-words rules', () => {
    for (const text of [robotLeftTitle('Oak Hollow Dental TI'), ...ROBOT_LEFT_SHEET_SENTENCES, LET_ROBOT_BACK_IN_TOAST]) {
      expect(plainWordsFailures(text)).toEqual([])
    }
  })
})
