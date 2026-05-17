import { describe, expect, it } from 'vitest'
import type { OverheadClockSessionRow } from './overheadDailyLabor'
import {
  buildApprovedClosedHoursByPersonByDate,
  buildOverheadHoursByPersonByDate,
  buildWorkDateListInclusive,
  computeUnallocatedFieldRows,
  groupUnallocatedFieldRowsByDate,
  summarizeUnallocatedFieldRows,
  type PeopleHoursUnallocatedCrewInput,
  type PeopleHoursUnallocatedPayConfigInput,
} from './peopleHoursUnallocatedRows'

const ALEX_ID = '00000000-0000-0000-0000-00000000aaaa'
const BLAKE_ID = '00000000-0000-0000-0000-00000000bbbb'
const SALLY_ID = '00000000-0000-0000-0000-00000000cccc'
const HIDDEN_ID = '00000000-0000-0000-0000-00000000dddd'

const OFFICE_JOB_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_JOB_ID = '22222222-2222-2222-2222-222222222222'

function session(overrides: Partial<OverheadClockSessionRow> & {
  id: string
  user_id: string
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  userName: string
}): OverheadClockSessionRow {
  const { userName, ...rest } = overrides
  return {
    job_ledger_id: null,
    bid_id: null,
    approved_at: '2026-05-12T20:00:00Z',
    rejected_at: null,
    revoked_at: null,
    users: { name: userName },
    ...rest,
  } as OverheadClockSessionRow
}

/**
 * Approved, closed clock session with no job/bid link — registers "the person
 * worked X hours that day" without contributing to overhead or seeding any
 * crew rows. Used to replace the legacy `peopleHours` test fixture.
 */
function fieldSession(args: {
  id: string
  userId: string
  userName: string
  workDate: string
  hours: number
}): OverheadClockSessionRow {
  const start = new Date(`${args.workDate}T13:00:00Z`)
  const end = new Date(start.getTime() + args.hours * 3600 * 1000)
  return session({
    id: args.id,
    user_id: args.userId,
    userName: args.userName,
    work_date: args.workDate,
    clocked_in_at: start.toISOString(),
    clocked_out_at: end.toISOString(),
  })
}

const PAY_CONFIG: PeopleHoursUnallocatedPayConfigInput[] = [
  { person_name: 'Alex', is_salary: true, show_in_hours: true },
  { person_name: 'Blake', is_salary: false, show_in_hours: true },
  { person_name: 'Sally', is_salary: true, show_in_hours: true },
  { person_name: 'HiddenHal', is_salary: true, show_in_hours: false },
]

const WORK_DATES = ['2026-05-11', '2026-05-12', '2026-05-13'] // Mon, Tue, Wed

describe('buildOverheadHoursByPersonByDate', () => {
  it('sums approved-closed office+bid sessions by (person, date)', () => {
    const sessions: OverheadClockSessionRow[] = [
      session({
        id: 's1',
        user_id: ALEX_ID,
        userName: 'Alex',
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T15:00:00Z',
        job_ledger_id: OFFICE_JOB_ID,
      }),
      session({
        id: 's2',
        user_id: ALEX_ID,
        userName: 'Alex',
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T16:00:00Z',
        clocked_out_at: '2026-05-12T17:30:00Z',
        bid_id: 'bid-1',
      }),
      session({
        id: 's3',
        user_id: BLAKE_ID,
        userName: 'Blake',
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T17:00:00Z',
        job_ledger_id: OTHER_JOB_ID,
      }),
    ]
    const map = buildOverheadHoursByPersonByDate({ sessions, officeJobLedgerId: OFFICE_JOB_ID })
    expect(map.get('Alex|2026-05-12')).toBeCloseTo(3.5, 5)
    expect(map.get('Blake|2026-05-12')).toBeUndefined()
  })

  it('skips rejected, revoked, unapproved, and open sessions', () => {
    const sessions: OverheadClockSessionRow[] = [
      session({
        id: 'r',
        user_id: ALEX_ID,
        userName: 'Alex',
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T15:00:00Z',
        bid_id: 'bid-1',
        rejected_at: '2026-05-12T20:00:00Z',
      }),
      session({
        id: 'v',
        user_id: ALEX_ID,
        userName: 'Alex',
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T15:00:00Z',
        bid_id: 'bid-1',
        revoked_at: '2026-05-12T20:00:00Z',
      }),
      session({
        id: 'u',
        user_id: ALEX_ID,
        userName: 'Alex',
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T15:00:00Z',
        bid_id: 'bid-1',
        approved_at: null,
      }),
      session({
        id: 'o',
        user_id: ALEX_ID,
        userName: 'Alex',
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: null,
        bid_id: 'bid-1',
      }),
    ]
    const map = buildOverheadHoursByPersonByDate({ sessions, officeJobLedgerId: OFFICE_JOB_ID })
    expect(map.size).toBe(0)
  })
})

describe('buildApprovedClosedHoursByPersonByDate', () => {
  it('sums approved-closed sessions across every bucket (office, bid, field, unassigned)', () => {
    const sessions: OverheadClockSessionRow[] = [
      session({
        id: 's-office',
        user_id: ALEX_ID,
        userName: 'Alex',
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T15:00:00Z',
        job_ledger_id: OFFICE_JOB_ID,
      }),
      session({
        id: 's-bid',
        user_id: ALEX_ID,
        userName: 'Alex',
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T16:00:00Z',
        clocked_out_at: '2026-05-12T17:30:00Z',
        bid_id: 'bid-1',
      }),
      session({
        id: 's-field',
        user_id: ALEX_ID,
        userName: 'Alex',
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T18:00:00Z',
        clocked_out_at: '2026-05-12T19:00:00Z',
        job_ledger_id: OTHER_JOB_ID,
      }),
      session({
        id: 's-unassigned',
        user_id: BLAKE_ID,
        userName: 'Blake',
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T14:00:00Z',
      }),
    ]
    const map = buildApprovedClosedHoursByPersonByDate({ sessions })
    expect(map.get('Alex|2026-05-12')).toBeCloseTo(4.5, 5)
    expect(map.get('Blake|2026-05-12')).toBeCloseTo(1, 5)
  })

  it('ignores pending (unapproved), rejected, revoked, and still-open sessions', () => {
    const sessions: OverheadClockSessionRow[] = [
      session({
        id: 'pending',
        user_id: ALEX_ID,
        userName: 'Alex',
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T15:00:00Z',
        approved_at: null,
      }),
      session({
        id: 'rejected',
        user_id: ALEX_ID,
        userName: 'Alex',
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T15:00:00Z',
        rejected_at: '2026-05-12T20:00:00Z',
      }),
      session({
        id: 'revoked',
        user_id: ALEX_ID,
        userName: 'Alex',
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T15:00:00Z',
        revoked_at: '2026-05-12T20:00:00Z',
      }),
      session({
        id: 'open',
        user_id: ALEX_ID,
        userName: 'Alex',
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: null,
      }),
    ]
    const map = buildApprovedClosedHoursByPersonByDate({ sessions })
    expect(map.size).toBe(0)
  })
})

describe('computeUnallocatedFieldRows', () => {
  it('emits a salary-day row when there IS approved clock activity but no crew sync (8h unallocated)', () => {
    // Alex (salary) shows up on Tue, clocks 6h to a non-overhead job that
    // somehow didn't create a crew row. dayHoursRaw stays at 8 (salary
    // template), overhead is 0, no crew attribution → 8h unallocated.
    const sessions: OverheadClockSessionRow[] = [
      fieldSession({ id: 'alex-field', userId: ALEX_ID, userName: 'Alex', workDate: '2026-05-12', hours: 6 }),
    ]
    const rows = computeUnallocatedFieldRows({
      payConfig: PAY_CONFIG,
      crewRows: [],
      overheadSessions: sessions,
      officeJobLedgerId: OFFICE_JOB_ID,
      workDates: WORK_DATES,
      thresholdHours: 0.5,
    })
    const alexTue = rows.find((r) => r.personName === 'Alex' && r.workDate === '2026-05-12')
    expect(alexTue).toBeDefined()
    expect(alexTue?.dayHoursRaw).toBe(8)
    expect(alexTue?.fieldHours).toBe(8)
    expect(alexTue?.unallocatedHrs).toBe(8)
    expect(alexTue?.isSalary).toBe(true)
  })

  it('skips salary weekdays with NO approved clock activity (was a phantom row pre-v2.546)', () => {
    const rows = computeUnallocatedFieldRows({
      payConfig: PAY_CONFIG,
      crewRows: [],
      overheadSessions: [],
      officeJobLedgerId: OFFICE_JOB_ID,
      workDates: WORK_DATES,
      thresholdHours: 0,
    })
    expect(rows.length).toBe(0)
  })

  it('skips when a closed session is still pending approval', () => {
    const sessions: OverheadClockSessionRow[] = [
      session({
        id: 'pending',
        user_id: BLAKE_ID,
        userName: 'Blake',
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T19:00:00Z',
        approved_at: null,
      }),
    ]
    const rows = computeUnallocatedFieldRows({
      payConfig: PAY_CONFIG,
      crewRows: [],
      overheadSessions: sessions,
      officeJobLedgerId: OFFICE_JOB_ID,
      workDates: WORK_DATES,
      thresholdHours: 0,
    })
    expect(rows.find((r) => r.personName === 'Blake')).toBeUndefined()
  })

  it('does not emit weekend rows for salaried people even with approved weekend clock', () => {
    const sessions: OverheadClockSessionRow[] = [
      fieldSession({ id: 'alex-sat', userId: ALEX_ID, userName: 'Alex', workDate: '2026-05-09', hours: 4 }),
    ]
    const rows = computeUnallocatedFieldRows({
      payConfig: PAY_CONFIG,
      crewRows: [],
      overheadSessions: sessions,
      officeJobLedgerId: OFFICE_JOB_ID,
      workDates: ['2026-05-09', '2026-05-10'], // Sat, Sun
      thresholdHours: 0.5,
    })
    expect(rows.length).toBe(0)
  })

  it('subtracts overhead-on-day from dayHoursRaw before computing fieldHours', () => {
    const sessions: OverheadClockSessionRow[] = [
      session({
        id: 's1',
        user_id: ALEX_ID,
        userName: 'Alex',
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T19:00:00Z',
        job_ledger_id: OFFICE_JOB_ID,
      }),
    ]
    const rows = computeUnallocatedFieldRows({
      payConfig: PAY_CONFIG,
      crewRows: [],
      overheadSessions: sessions,
      officeJobLedgerId: OFFICE_JOB_ID,
      workDates: WORK_DATES,
      thresholdHours: 0.5,
    })
    const alexTue = rows.find((r) => r.personName === 'Alex' && r.workDate === '2026-05-12')
    expect(alexTue).toBeDefined()
    expect(alexTue?.overheadOnDay).toBeCloseTo(6, 5)
    expect(alexTue?.fieldHours).toBeCloseTo(2, 5)
    expect(alexTue?.unallocatedHrs).toBeCloseTo(2, 5)
  })

  it('subtracts crew attribution and excludes the configured office job', () => {
    const sessions: OverheadClockSessionRow[] = [
      // Approved clock activity for Alex so the salary 8h template applies.
      fieldSession({ id: 'alex-field', userId: ALEX_ID, userName: 'Alex', workDate: '2026-05-12', hours: 6 }),
    ]
    const crewRows: PeopleHoursUnallocatedCrewInput[] = [
      {
        work_date: '2026-05-12',
        person_name: 'Alex',
        job_assignments: [
          { job_id: OFFICE_JOB_ID, pct: 25 }, // ignored (overhead)
          { job_id: OTHER_JOB_ID, pct: 50 },
        ],
        bid_assignments: [],
      },
    ]
    const rows = computeUnallocatedFieldRows({
      payConfig: PAY_CONFIG,
      crewRows,
      overheadSessions: sessions,
      officeJobLedgerId: OFFICE_JOB_ID,
      workDates: WORK_DATES,
      thresholdHours: 0.5,
    })
    const alexTue = rows.find((r) => r.personName === 'Alex' && r.workDate === '2026-05-12')
    expect(alexTue).toBeDefined()
    expect(alexTue?.crewAttributedHrs).toBeCloseTo(4, 5)
    expect(alexTue?.unallocatedHrs).toBeCloseTo(4, 5)
  })

  it('uses approved-clock hours (not people_hours) for hourly people', () => {
    // Blake (hourly) clocked 6.5h approved on Tue with a 50% crew assignment.
    // dayHoursRaw = 6.5, fieldHours = 6.5, crewAttributedHrs = 3.25, leftover 3.25.
    const sessions: OverheadClockSessionRow[] = [
      fieldSession({ id: 'blake-field', userId: BLAKE_ID, userName: 'Blake', workDate: '2026-05-12', hours: 6.5 }),
    ]
    const rows = computeUnallocatedFieldRows({
      payConfig: PAY_CONFIG,
      // peopleHours is deliberately wrong here — the helper must ignore it
      // and trust approved clock only.
      peopleHours: [{ person_name: 'Blake', work_date: '2026-05-12', hours: 99 }],
      crewRows: [
        {
          work_date: '2026-05-12',
          person_name: 'Blake',
          job_assignments: [{ job_id: OTHER_JOB_ID, pct: 50 }],
          bid_assignments: [],
        },
      ],
      overheadSessions: sessions,
      officeJobLedgerId: OFFICE_JOB_ID,
      workDates: WORK_DATES,
      thresholdHours: 1,
    })
    const blakeTue = rows.find((r) => r.personName === 'Blake' && r.workDate === '2026-05-12')
    expect(blakeTue).toBeDefined()
    expect(blakeTue?.dayHoursRaw).toBeCloseTo(6.5, 5)
    expect(blakeTue?.fieldHours).toBeCloseTo(6.5, 5)
    expect(blakeTue?.crewAttributedHrs).toBeCloseTo(3.25, 5)
    expect(blakeTue?.unallocatedHrs).toBeCloseTo(3.25, 5)
  })

  it('skips emit when unallocated <= threshold', () => {
    const sessions: OverheadClockSessionRow[] = [
      fieldSession({ id: 'blake-field', userId: BLAKE_ID, userName: 'Blake', workDate: '2026-05-12', hours: 0.4 }),
    ]
    const rows = computeUnallocatedFieldRows({
      payConfig: PAY_CONFIG,
      crewRows: [],
      overheadSessions: sessions,
      officeJobLedgerId: OFFICE_JOB_ID,
      workDates: WORK_DATES,
      thresholdHours: 0.5,
    })
    expect(rows.find((r) => r.personName === 'Blake')).toBeUndefined()
  })

  it('skips people whose show_in_hours is false', () => {
    const sessions: OverheadClockSessionRow[] = [
      fieldSession({ id: 'hh-field', userId: HIDDEN_ID, userName: 'HiddenHal', workDate: '2026-05-12', hours: 8 }),
    ]
    const rows = computeUnallocatedFieldRows({
      payConfig: PAY_CONFIG,
      crewRows: [],
      overheadSessions: sessions,
      officeJobLedgerId: OFFICE_JOB_ID,
      workDates: WORK_DATES,
      thresholdHours: 0.5,
    })
    expect(rows.find((r) => r.personName === 'HiddenHal')).toBeUndefined()
  })

  it('counts sub-labor hours as allocated and reduces unallocated', () => {
    const sessions: OverheadClockSessionRow[] = [
      fieldSession({ id: 'alex-field', userId: ALEX_ID, userName: 'Alex', workDate: '2026-05-12', hours: 6 }),
    ]
    const rows = computeUnallocatedFieldRows({
      payConfig: PAY_CONFIG,
      crewRows: [],
      overheadSessions: sessions,
      officeJobLedgerId: OFFICE_JOB_ID,
      subLaborRows: [{ person_name: 'Alex', work_date: '2026-05-12', hours: 5 }],
      workDates: WORK_DATES,
      thresholdHours: 0.5,
    })
    const alexTue = rows.find((r) => r.personName === 'Alex' && r.workDate === '2026-05-12')
    expect(alexTue).toBeDefined()
    expect(alexTue?.subLaborHrs).toBeCloseTo(5, 5)
    expect(alexTue?.unallocatedHrs).toBeCloseTo(3, 5)
  })

  it('clamps crew pct sum at 100% so over-assignment cannot produce negative unallocated', () => {
    const sessions: OverheadClockSessionRow[] = [
      fieldSession({ id: 'alex-field', userId: ALEX_ID, userName: 'Alex', workDate: '2026-05-12', hours: 6 }),
    ]
    const rows = computeUnallocatedFieldRows({
      payConfig: PAY_CONFIG,
      crewRows: [
        {
          work_date: '2026-05-12',
          person_name: 'Alex',
          job_assignments: [{ job_id: OTHER_JOB_ID, pct: 150 }],
          bid_assignments: [],
        },
      ],
      overheadSessions: sessions,
      officeJobLedgerId: OFFICE_JOB_ID,
      workDates: WORK_DATES,
      thresholdHours: 0,
    })
    const alexTue = rows.find((r) => r.personName === 'Alex' && r.workDate === '2026-05-12')
    expect(alexTue).toBeUndefined() // 100% allocated = 0 unallocated, threshold 0 means strictly > 0
  })

  it('emits zero unallocated when approved sessions cover the day across Office + field crew (Option E regression)', () => {
    // Paige-shaped case from RECENT_FEATURES v2.539: a 9.19h hourly day with
    // a 2.72h Office overhead clock and three field crew assignments whose
    // pct (32 + 23 + 15.4 = 70.4) sums with Office (29.6) to 100. Approved
    // field clock 6.47h + office clock 2.72h ≈ 9.19h total clock = dayHoursRaw.
    const sessions: OverheadClockSessionRow[] = [
      session({
        id: 'office',
        user_id: BLAKE_ID,
        userName: 'Blake',
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T15:43:12Z', // 2h 43m 12s = 2.72h
        job_ledger_id: OFFICE_JOB_ID,
      }),
      fieldSession({ id: 'blake-field', userId: BLAKE_ID, userName: 'Blake', workDate: '2026-05-12', hours: 6.47 }),
    ]
    const crewRows: PeopleHoursUnallocatedCrewInput[] = [
      {
        work_date: '2026-05-12',
        person_name: 'Blake',
        job_assignments: [
          { job_id: OFFICE_JOB_ID, pct: 29.6 }, // filtered (overhead)
          { job_id: OTHER_JOB_ID, pct: 32 }, // Holly stand-in
          { job_id: 'job-mike-1111', pct: 23 },
          { job_id: 'job-done-1111', pct: 15.4 },
        ],
        bid_assignments: [],
      },
    ]
    const rows = computeUnallocatedFieldRows({
      payConfig: PAY_CONFIG,
      crewRows,
      overheadSessions: sessions,
      officeJobLedgerId: OFFICE_JOB_ID,
      workDates: WORK_DATES,
      thresholdHours: 0.5,
    })
    const blakeTue = rows.find((r) => r.personName === 'Blake' && r.workDate === '2026-05-12')
    expect(blakeTue).toBeUndefined() // collapsed below threshold under Convention 1
  })

  it('sorts by date desc then unallocated desc then name asc', () => {
    // Give Alex + Sally a tiny approved session each weekday so both salary
    // candidates emit; with no overhead and no crew, each is 8h unallocated.
    const sessions: OverheadClockSessionRow[] = []
    for (const ymd of WORK_DATES) {
      sessions.push(
        fieldSession({ id: `alex-${ymd}`, userId: ALEX_ID, userName: 'Alex', workDate: ymd, hours: 1 }),
        fieldSession({ id: `sally-${ymd}`, userId: SALLY_ID, userName: 'Sally', workDate: ymd, hours: 1 }),
      )
    }
    const rows = computeUnallocatedFieldRows({
      payConfig: PAY_CONFIG,
      crewRows: [],
      overheadSessions: sessions,
      officeJobLedgerId: OFFICE_JOB_ID,
      workDates: WORK_DATES,
      thresholdHours: 0,
    })
    // Alex + Sally are salaried, both 8h, three weekdays = 6 rows
    // First three should all be Wed (latest); within each date Alex before Sally (alpha)
    expect(rows[0]?.workDate).toBe('2026-05-13')
    expect(rows[0]?.personName).toBe('Alex')
    expect(rows[1]?.workDate).toBe('2026-05-13')
    expect(rows[1]?.personName).toBe('Sally')
    expect(rows[2]?.workDate).toBe('2026-05-12')
  })
})

describe('summarizeUnallocatedFieldRows', () => {
  it('sums hours, distinct people, distinct days, and row count', () => {
    const sessions: OverheadClockSessionRow[] = []
    for (const ymd of WORK_DATES) {
      sessions.push(
        fieldSession({ id: `alex-${ymd}`, userId: ALEX_ID, userName: 'Alex', workDate: ymd, hours: 1 }),
        fieldSession({ id: `sally-${ymd}`, userId: SALLY_ID, userName: 'Sally', workDate: ymd, hours: 1 }),
      )
    }
    const rows = computeUnallocatedFieldRows({
      payConfig: PAY_CONFIG,
      crewRows: [],
      overheadSessions: sessions,
      officeJobLedgerId: OFFICE_JOB_ID,
      workDates: WORK_DATES,
      thresholdHours: 0,
    })
    const summary = summarizeUnallocatedFieldRows(rows)
    expect(summary.rowCount).toBe(6) // 2 salaried people × 3 weekdays
    expect(summary.peopleCount).toBe(2)
    expect(summary.workDates).toEqual(WORK_DATES)
    expect(summary.totalUnallocatedHrs).toBeCloseTo(48, 5)
  })
})

describe('groupUnallocatedFieldRowsByDate', () => {
  it('groups by date and sorts dates descending', () => {
    const sessions: OverheadClockSessionRow[] = []
    for (const ymd of WORK_DATES) {
      sessions.push(
        fieldSession({ id: `alex-${ymd}`, userId: ALEX_ID, userName: 'Alex', workDate: ymd, hours: 1 }),
        fieldSession({ id: `sally-${ymd}`, userId: SALLY_ID, userName: 'Sally', workDate: ymd, hours: 1 }),
      )
    }
    const rows = computeUnallocatedFieldRows({
      payConfig: PAY_CONFIG,
      crewRows: [],
      overheadSessions: sessions,
      officeJobLedgerId: OFFICE_JOB_ID,
      workDates: WORK_DATES,
      thresholdHours: 0,
    })
    const grouped = groupUnallocatedFieldRowsByDate(rows)
    expect(grouped.length).toBe(3)
    expect(grouped[0]?.workDate).toBe('2026-05-13')
    expect(grouped[0]?.totalUnallocatedHrs).toBeCloseTo(16, 5)
    expect(grouped[0]?.rows.length).toBe(2)
  })
})

describe('buildWorkDateListInclusive', () => {
  it('builds an inclusive YYYY-MM-DD list', () => {
    expect(buildWorkDateListInclusive('2026-05-11', '2026-05-13')).toEqual([
      '2026-05-11',
      '2026-05-12',
      '2026-05-13',
    ])
  })

  it('returns [] when start > end', () => {
    expect(buildWorkDateListInclusive('2026-05-13', '2026-05-11')).toEqual([])
  })
})
