import { describe, expect, it } from 'vitest'
import { parseStagesMoneyMoveKey, stagesMoneyMoveHref, stagesMoneyMoveKeyForPipelineMove, STAGES_MONEY_MOVE_KEYS } from './stagesMoneyMoveLink'

describe('stagesMoneyMoveLink', () => {
  it('parses only known keys', () => {
    for (const k of STAGES_MONEY_MOVE_KEYS) expect(parseStagesMoneyMoveKey(` ${k} `)).toBe(k)
    expect(parseStagesMoneyMoveKey('nope')).toBeNull()
    expect(parseStagesMoneyMoveKey(null)).toBeNull()
  })
  it('builds the Pipeline href', () => {
    expect(stagesMoneyMoveHref('chase90')).toBe('/jobs?tab=stages&stagesMove=chase90')
  })
  it('maps the four system moves', () => {
    expect(stagesMoneyMoveKeyForPipelineMove('bill-capable')).toBe('capable')
    expect(stagesMoneyMoveKeyForPipelineMove('chase-90')).toBe('chase90')
    expect(stagesMoneyMoveKeyForPipelineMove('allocate-deposits')).toBe('ar')
    expect(stagesMoneyMoveKeyForPipelineMove('fix-dates')).toBe('fixDates')
  })
})
