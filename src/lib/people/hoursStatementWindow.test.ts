import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { canMakeHoursStatement, hoursStatementPayAllowed } from './hoursStatementAccess'
import {
  HOURS_STATEMENT_PAY_FIXED_OFF,
  HOURS_STATEMENT_SIGNING_HELD,
  hoursStatementEmptyWords,
  hoursStatementPressWords,
  hoursStatementRowWords,
  hoursStatementSavedWords,
  hoursStatementSpanWords,
} from './hoursStatementWindow'

// Every name and number here is made up.
describe('what the app has in the span (punch list #212, PR 2)', () => {
  it('names the approved sessions, the typed days and the quick adds left off', () => {
    expect(hoursStatementSpanWords({ approved: 23, pending: 0, typedDays: 2, quickAddsLeftOff: 1 })).toEqual({
      has: 'The app has 23 approved sessions on this job in this span. 2 days were typed by hand. 1 quick add is left off until approved.',
      held: null,
    })
    expect(hoursStatementSpanWords({ approved: 1, pending: 0, typedDays: 1, quickAddsLeftOff: 0 }).has).toBe('The app has 1 approved session on this job in this span. 1 day was typed by hand.')
    expect(hoursStatementSpanWords({ approved: 4, pending: 0, typedDays: 0, quickAddsLeftOff: 0 }, { isOfficeJob: true }).has).toBe('The app has 4 approved sessions on the Office job in this span.')
  })

  it('holds a line for a session still waiting for approval', () => {
    expect(hoursStatementSpanWords({ approved: 5, pending: 1, typedDays: 0, quickAddsLeftOff: 0 }).held).toBe('1 session is still waiting for approval. The paper names it under its day and does not count it.')
    expect(hoursStatementSpanWords({ approved: 5, pending: 3, typedDays: 0, quickAddsLeftOff: 0 }).held).toBe('3 sessions are still waiting for approval. The paper names them under their days and does not count them.')
  })

  it('says plainly when the span has nothing', () => {
    expect(hoursStatementSpanWords({ approved: 0, pending: 0, typedDays: 0, quickAddsLeftOff: 0 })).toEqual({ has: 'The app has nothing recorded on this job in this span.', held: null })
  })

  it('every line keeps to plain words', () => {
    const lines = [
      hoursStatementSpanWords({ approved: 23, pending: 3, typedDays: 2, quickAddsLeftOff: 2 }),
      hoursStatementSpanWords({ approved: 0, pending: 1, typedDays: 0, quickAddsLeftOff: 0 }),
    ].flatMap((w) => [w.has, w.held ?? ''])
    for (const line of [...lines, HOURS_STATEMENT_PAY_FIXED_OFF, HOURS_STATEMENT_SIGNING_HELD]) expect(plainWordsFailures(line)).toEqual([])
  })
})

describe('the press and the empty section', () => {
  it('the press carries its count and is dead at zero or before the read', () => {
    expect(hoursStatementPressWords(3, 'job')).toEqual({ label: 'Hours statement… · 3 people clocked here', dead: false })
    expect(hoursStatementPressWords(1, 'job')).toEqual({ label: 'Hours statement… · 1 person clocked here', dead: false })
    expect(hoursStatementPressWords(4, 'person')).toEqual({ label: 'Hours statement… · 4 jobs clocked', dead: false })
    expect(hoursStatementPressWords(0, 'job')).toEqual({ label: 'Hours statement…', dead: true })
    expect(hoursStatementPressWords(null, 'person')).toEqual({ label: 'Hours statement…', dead: true })
  })

  it('an empty section names the press, or says why there is no one to make a statement for', () => {
    expect(hoursStatementEmptyWords(3, { kind: 'job' })).toEqual({ main: 'No hours statements are saved on this job yet.', withPress: true, tail: 'makes one from the clock and the pay reports.' })
    expect(hoursStatementEmptyWords(2, { kind: 'person', name: 'Marcus Reyes' })).toEqual({ main: 'No hours statements are saved for Marcus Reyes yet.', withPress: true, tail: 'makes one from the clock and the pay reports.' })
    expect(hoursStatementEmptyWords(0, { kind: 'job' })).toEqual({ main: 'Nothing is clocked on this job yet, so there is no one to make a statement for.', withPress: false, tail: '' })
    expect(hoursStatementEmptyWords(0, { kind: 'person', name: 'Marcus Reyes' }).main).toBe('Marcus Reyes has no counted session on a job yet, so there is nothing to make a statement from.')
    // Before the count is read, the sentence stands and the press waits.
    expect(hoursStatementEmptyWords(null, { kind: 'job' }).withPress).toBe(false)
  })

  it('a saved row reads its record, its period, its state, its kind and who saved it', () => {
    const words = hoursStatementRowWords({ recordId: 'HS-1042-0007', workerName: 'Marcus Reyes', jobLabel: '1042 · Ridgeway Lofts', periodStart: '2026-06-01', periodEnd: '2026-06-13', withPay: true, state: 'printed', preparedAtYmd: '2026-10-29', preparedByName: 'Dana Office' })
    expect(words).toEqual({ record: 'HS-1042-0007', period: 'June 1 – June 13, 2026', state: { label: 'Printed', tone: 'blue' }, kind: 'hours and pay', saved: 'October 29, 2026 by Dana Office' })
    expect(hoursStatementRowWords({ recordId: 'HS-1042-0008', workerName: 'M', jobLabel: 'j', periodStart: '2026-06-01', periodEnd: '2026-06-13', withPay: false, state: 'odd', preparedAtYmd: '2026-10-29', preparedByName: null })).toMatchObject({ state: { label: 'Draft' }, kind: 'hours only', saved: 'October 29, 2026' })
    expect(hoursStatementSavedWords('HS-1042-0007', 'draft')).toBe('Saved as HS-1042-0007 · Draft')
  })
})

describe('who may make one (the owner’s call 6)', () => {
  it('the payroll roles and assistants open the section; only the payroll roles turn the pay on', () => {
    expect(canMakeHoursStatement({ role: 'dev', canAccessPay: true })).toBe(true)
    expect(canMakeHoursStatement({ role: 'controller', canAccessPay: true })).toBe(true)
    expect(canMakeHoursStatement({ role: 'assistant', canAccessPay: false })).toBe(true)
    expect(canMakeHoursStatement({ role: 'master_technician', canAccessPay: true })).toBe(true)
    expect(canMakeHoursStatement({ role: 'master_technician', canAccessPay: false })).toBe(false)
    expect(canMakeHoursStatement({ role: 'helpers', canAccessPay: false })).toBe(false)
    expect(canMakeHoursStatement({ role: null, canAccessPay: false })).toBe(false)
    expect(hoursStatementPayAllowed({ role: 'assistant', canAccessPay: false })).toBe(false)
    expect(hoursStatementPayAllowed({ role: 'controller', canAccessPay: true })).toBe(true)
    expect(hoursStatementPayAllowed({ role: 'master_technician', canAccessPay: true })).toBe(true)
    expect(hoursStatementPayAllowed({ role: 'master_technician', canAccessPay: false })).toBe(false)
  })
})
