import { describe, expect, it } from 'vitest'
import { parseMyLogbook, shareStripWords } from './logbookShare'

describe('shareStripWords', () => {
  it('names the press when the logbook is not shown', () => {
    expect(shareStripWords('Dario', null, null)).toEqual({
      shown: false,
      text: 'Dario cannot see this logbook. Show it, and Dario finds My logbook in the app’s menu.',
      button: 'Show Dario this logbook',
    })
  })

  it('names the day and who pressed once shown', () => {
    const s = shareStripWords('Dario', { userId: 'u1', shownBy: 'u2', shownAt: '2026-11-04T15:00:00Z' }, 'Lou Lead')
    expect(s).toEqual({ shown: true, text: 'Dario sees this logbook in the app’s menu. Shown Nov 4 by Lou Lead.', button: 'Stop showing' })
  })

  it('reads the day on the company calendar, not UTC', () => {
    // 03:00 UTC on Nov 5 is still Nov 4 in Chicago.
    expect(shareStripWords('Dario', { userId: 'u1', shownBy: null, shownAt: '2026-11-05T03:00:00Z' }, null).text).toBe(
      'Dario sees this logbook in the app’s menu. Shown Nov 4.',
    )
  })

  it('falls back when the name is blank', () => {
    expect(shareStripWords(' ', null, null).button).toBe('Show This teammate this logbook')
  })
})

describe('parseMyLogbook', () => {
  it('keeps null as not shown', () => {
    expect(parseMyLogbook(null)).toBeNull()
    expect(parseMyLogbook([])).toBeNull()
  })

  it('types the answer and turns hours into numbers', () => {
    const got = parseMyLogbook({
      name: 'Dario Pruitt',
      hours: [
        {
          session_id: 's1',
          work_date: '2026-11-02',
          clocked_in_at: '2026-11-02T13:00:00Z',
          clocked_out_at: '2026-11-02T21:30:00Z',
          hours: '8.5',
          job_ledger_id: 'j1',
          job_number: '1182',
          job_name: 'Oak Hollow remodel',
          job_address: '1 Oak',
          service_type_name: 'Plumbing',
          bid_id: null,
          notes: null,
        },
        'junk',
      ],
      licenses: [{ id: 'l1', license_type: 'Plumber Apprentice #191774', date_of_expiry: '2027-08-31' }],
      signers: [{ person_name: 'Hal Moreno', license_type: 'Master Plumber #4411', date_of_expiry: null }],
      office_job_id: 'office-1',
    })
    expect(got?.name).toBe('Dario Pruitt')
    expect(got?.hours).toHaveLength(1)
    expect(got?.hours[0]?.hours).toBe(8.5)
    expect(got?.hours[0]?.notes).toBe('')
    expect(got?.hours[0]?.bid_id).toBeNull()
    expect(got?.licenses[0]).toEqual({ id: 'l1', license_type: 'Plumber Apprentice #191774', date_of_expiry: '2027-08-31' })
    expect(got?.signers[0]?.date_of_expiry).toBeNull()
    expect(got?.officeJobId).toBe('office-1')
  })

  it('reads missing lists as empty', () => {
    expect(parseMyLogbook({ name: 'X' })).toEqual({ name: 'X', hours: [], licenses: [], signers: [], targets: [], officeJobId: null })
  })
})
