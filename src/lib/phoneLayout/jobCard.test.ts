import { describe, expect, it } from 'vitest'
import {
  JOB_CARD_MIN_PRESS_PX,
  JOB_CARD_MIN_TEXT_PX,
  JOB_CARD_ROW_PX,
  JOB_CARD_ROW_WORDS,
  jobSquaresFolded,
  jobSquaresHiddenWhileReading,
  oneStopLineWords,
  oneStopToday,
  phoneAsWritten,
  phoneJobCardOn,
  rowCountWords,
} from './jobCard'

const ON = { on: true, short: false, dayOnScreen: true, hasJob: true, closedByPapers: false }

describe('phoneJobCardOn', () => {
  it('is on with the switch on, a job on the full card and the day on screen', () => {
    expect(phoneJobCardOn(ON)).toBe(true)
  })

  it('is off with the switch off, whatever the day', () => {
    expect(phoneJobCardOn({ ...ON, on: false })).toBe(false)
  })

  it('leaves the short page, a day still loading, a day with no job and a job closed by its papers as they are', () => {
    expect(phoneJobCardOn({ ...ON, short: true })).toBe(false)
    expect(phoneJobCardOn({ ...ON, dayOnScreen: false })).toBe(false)
    expect(phoneJobCardOn({ ...ON, hasJob: false })).toBe(false)
    expect(phoneJobCardOn({ ...ON, closedByPapers: true })).toBe(false)
  })
})

describe('the squares above the card', () => {
  it('fold only for the job the card holds, with the switch on', () => {
    expect(jobSquaresFolded({ on: true, squaresJobId: 'j1', foldedJobId: 'j1' })).toBe(true)
  })

  it('stay with the switch off', () => {
    expect(jobSquaresFolded({ on: false, squaresJobId: 'j1', foldedJobId: 'j1' })).toBe(false)
  })

  it('stay on a day with no job: This week and Tomorrow are as they were', () => {
    expect(jobSquaresFolded({ on: true, squaresJobId: null, foldedJobId: null })).toBe(false)
    expect(jobSquaresFolded({ on: true, squaresJobId: null, foldedJobId: 'j1' })).toBe(false)
  })

  it('stay when the card holds no job, or another job than the squares’', () => {
    expect(jobSquaresFolded({ on: true, squaresJobId: 'j1', foldedJobId: null })).toBe(false)
    expect(jobSquaresFolded({ on: true, squaresJobId: 'j2', foldedJobId: 'j1' })).toBe(false)
  })

  it('draw nothing while the day is read, once the card holds a job, so two empty squares never flash', () => {
    expect(jobSquaresHiddenWhileReading({ on: true, foldedJobId: 'j1' })).toBe(true)
    expect(jobSquaresHiddenWhileReading({ on: true, foldedJobId: null })).toBe(false)
    expect(jobSquaresHiddenWhileReading({ on: false, foldedJobId: 'j1' })).toBe(false)
  })
})

describe('today’s stops', () => {
  it('are one line only when the day holds one', () => {
    expect(oneStopToday(1)).toBe(true)
    expect(oneStopToday(0)).toBe(false)
    expect(oneStopToday(2)).toBe(false)
    expect(oneStopToday(5)).toBe(false)
  })

  it('the line says the time and where the stop stands in the day, never the job’s name', () => {
    expect(oneStopLineWords('8:00 AM')).toBe('8:00 AM · 1 of 1 today')
    expect(oneStopLineWords(' 12:30 PM ')).toBe('12:30 PM · 1 of 1 today')
    expect(oneStopLineWords('')).toBe('1 of 1 today')
  })
})

describe('phoneAsWritten', () => {
  it('reads ten digits as a phone number', () => {
    expect(phoneAsWritten('6179396295')).toBe('(617) 939-6295')
    expect(phoneAsWritten('617 939 6295')).toBe('(617) 939-6295')
    expect(phoneAsWritten('1-617-939-6295')).toBe('(617) 939-6295')
    expect(phoneAsWritten('+16179396295')).toBe('(617) 939-6295')
  })

  it('keeps what was typed when it is not a number the formatter knows', () => {
    expect(phoneAsWritten('ext 12')).toBe('ext 12')
    expect(phoneAsWritten('+44 20 7946 0958')).toBe('+44 20 7946 0958')
  })

  it('is empty for nothing', () => {
    expect(phoneAsWritten('')).toBe('')
    expect(phoneAsWritten(null)).toBe('')
    expect(phoneAsWritten(undefined)).toBe('')
    expect(phoneAsWritten('   ')).toBe('')
  })
})

describe('the rows', () => {
  it('are named in the order they are drawn', () => {
    expect(Object.values(JOB_CARD_ROW_WORDS)).toEqual(['Materials on site', 'Photos', 'Job updates', 'Job details', 'Job calendar'])
  })

  it('a count is its number, and nothing for none or for one not read', () => {
    expect(rowCountWords(4)).toBe('4')
    expect(rowCountWords(12.9)).toBe('12')
    expect(rowCountWords(0)).toBeNull()
    expect(rowCountWords(null)).toBeNull()
    expect(rowCountWords(undefined)).toBeNull()
    expect(rowCountWords(Number.NaN)).toBeNull()
  })

  it('hold the sizes the card is drawn to', () => {
    expect(JOB_CARD_MIN_TEXT_PX).toBe(12)
    expect(JOB_CARD_MIN_PRESS_PX).toBe(40)
    expect(JOB_CARD_ROW_PX).toBeGreaterThanOrEqual(44)
  })
})
