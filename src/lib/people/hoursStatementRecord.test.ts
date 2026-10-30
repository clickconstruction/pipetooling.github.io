import { describe, expect, it } from 'vitest'
import {
  HOURS_STATEMENT_STATES,
  hoursStatementIsOpen,
  hoursStatementRecordId,
  hoursStatementStateAfterPrint,
  hoursStatementStateWords,
  isHoursStatementState,
  nextHoursStatementRecordId,
  parseHoursStatementRecordId,
} from './hoursStatementRecord'

// Every job number here is made up.
describe('the record id (punch list #212, PR 2)', () => {
  it('is HS-<job number>-<n> on four digits', () => {
    expect(hoursStatementRecordId('1042', 7)).toBe('HS-1042-0007')
    expect(hoursStatementRecordId('J1042', 1)).toBe('HS-J1042-0001')
    expect(hoursStatementRecordId('1042', 12345)).toBe('HS-1042-12345')
  })

  it('takes the spaces out of a job number and never counts below one', () => {
    expect(hoursStatementRecordId(' 10 42 ', 3)).toBe('HS-1042-0003')
    expect(hoursStatementRecordId('', 0)).toBe('HS-JOB-0001')
    expect(hoursStatementRecordId('77', Number.NaN)).toBe('HS-77-0001')
  })

  it('parses its own ids and refuses anything else', () => {
    expect(parseHoursStatementRecordId('HS-1042-0007')).toEqual({ jobNumber: '1042', n: 7 })
    expect(parseHoursStatementRecordId('HS-J-10-42-0012')).toEqual({ jobNumber: 'J-10-42', n: 12 })
    expect(parseHoursStatementRecordId('HS-1042-7')).toBeNull()
    expect(parseHoursStatementRecordId('PS-1042-0007')).toBeNull()
    expect(parseHoursStatementRecordId('')).toBeNull()
  })

  it('the next id is one past the highest count on the job, whatever number the older ids name', () => {
    expect(nextHoursStatementRecordId('1042', [])).toBe('HS-1042-0001')
    expect(nextHoursStatementRecordId('1042', ['HS-1042-0001', 'HS-1042-0003', 'HS-1042-0002'])).toBe('HS-1042-0004')
    // The job was numbered J1042 before it had an HCP number; the count carries on.
    expect(nextHoursStatementRecordId('1042', ['HS-J1042-0002', 'not an id'])).toBe('HS-1042-0003')
  })
})

describe('the state words', () => {
  it('name the four states with a chip and a sentence', () => {
    expect(HOURS_STATEMENT_STATES).toEqual(['draft', 'printed', 'sent', 'signed'])
    expect(hoursStatementStateWords('draft')).toEqual({ label: 'Draft', tone: 'grey', words: 'Saved. Not printed or sent yet.' })
    expect(hoursStatementStateWords('printed')).toEqual({ label: 'Printed', tone: 'blue', words: 'Printed, to be signed with a pen.' })
    expect(hoursStatementStateWords('sent')).toEqual({ label: 'Waiting for a signature', tone: 'amber', words: 'Sent for a signature. Not signed yet.' })
    expect(hoursStatementStateWords('signed')).toEqual({ label: 'Signed', tone: 'green', words: 'Signed. The copy is filed.' })
  })

  it('a print moves a draft to printed and leaves a sent or signed one where it is', () => {
    expect(hoursStatementStateAfterPrint('draft')).toBe('printed')
    expect(hoursStatementStateAfterPrint('printed')).toBe('printed')
    expect(hoursStatementStateAfterPrint('sent')).toBe('sent')
    expect(hoursStatementStateAfterPrint('signed')).toBe('signed')
  })

  it('a draft or a printed statement is still open; a sent or signed one is a record', () => {
    expect(hoursStatementIsOpen('draft')).toBe(true)
    expect(hoursStatementIsOpen('printed')).toBe(true)
    expect(hoursStatementIsOpen('sent')).toBe(false)
    expect(hoursStatementIsOpen('signed')).toBe(false)
    expect(isHoursStatementState('signed')).toBe(true)
    expect(isHoursStatementState('lost')).toBe(false)
  })
})
