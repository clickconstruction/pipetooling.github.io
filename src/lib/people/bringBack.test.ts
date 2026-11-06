import { describe, expect, it } from 'vitest'
import { applyChecklistResolutions, checklistSummary } from './lifecycleChecklist'
import {
  RETURNER_TRAINING_MODE_DEFAULT,
  ROADMAP_RETURN_DAYS,
  archivedMatchWords,
  awayLine,
  awayWords,
  bringBackButtonLabel,
  bringBackDateProblem,
  bringBackFooterWords,
  bringBackHrLine,
  buildBringBackChecklist,
  daysBetweenYmd,
  findArchivedMatch,
  kindNeedsTeam,
  longDate,
  mergeArchivedRows,
  planBringBackWrites,
  planUndoEndWrites,
  roadmapBoxDefault,
  roadmapBoxWords,
  undoEndHrLine,
  withWageChange,
  type ArchivedPerson,
  type BringBackFacts,
} from './bringBack'

function facts(p: Partial<BringBackFacts> = {}): BringBackFacts {
  return {
    backYmd: '2029-11-05',
    leftYmd: '2026-11-03',
    hasLogin: true,
    hasRosterRow: true,
    signInEmail: 'corinne.vela@example.com',
    lastSignInYmd: '2026-11-03',
    pay: { hourlyWage: 24, isSalary: false, setYmd: '2026-01-12' },
    needsTeam: true,
    team: null,
    licenses: [{ name: 'Journeyman plumber', date_of_expiry: '2028-06-30' }],
    paperworkSignedEarlier: { count: 5, lastYmd: '2024-03-04' },
    paperworkAssignedSinceBack: false,
    vehiclesHeld: 0,
    housing: 0,
    ...p,
  }
}

const byId = (items: ReturnType<typeof buildBringBackChecklist>, id: string) => {
  const it = items.find((i) => i.id === id)
  if (!it) throw new Error(`no row ${id}`)
  return it
}

describe('dates and away words', () => {
  it('counts whole days across a leap year', () => {
    expect(daysBetweenYmd('2026-11-03', '2029-11-05')).toBe(1098)
    expect(daysBetweenYmd('2026-11-05', '2026-11-03')).toBe(-2)
    expect(daysBetweenYmd('nope', '2026-11-03')).toBeNull()
  })

  it('names the largest whole calendar unit', () => {
    expect(awayWords('2026-11-03', '2029-11-05')).toBe('3 years')
    expect(awayWords('2026-11-03', '2027-11-02')).toBe('11 months')
    expect(awayWords('2026-11-03', '2027-11-03')).toBe('1 year')
    expect(awayWords('2026-11-03', '2027-01-03')).toBe('2 months')
    expect(awayWords('2026-11-03', '2026-11-20')).toBe('2 weeks')
    expect(awayWords('2026-11-03', '2026-11-04')).toBe('1 day')
    expect(awayWords('2026-11-03', '2026-11-03')).toBe('no time')
    expect(awayWords('2026-11-03', '2026-10-01')).toBe('no time')
  })

  it('writes the window line with and without a first start', () => {
    expect(longDate('2024-03-04')).toBe('Mar 4, 2024')
    expect(awayLine({ leftYmd: '2026-11-03', backYmd: '2029-11-05', firstStartYmd: '2024-03-04' })).toBe(
      'Away 3 years · first stint Mar 4, 2024 to Nov 3, 2026',
    )
    expect(awayLine({ leftYmd: '2026-11-03', backYmd: '2029-11-05', firstStartYmd: null })).toBe('Away 3 years · left Nov 3, 2026')
  })
})

describe('the owner calls', () => {
  it('call 2: old roadmap tasks come back by default only within 90 days', () => {
    expect(ROADMAP_RETURN_DAYS).toBe(90)
    expect(roadmapBoxDefault('2026-11-03', '2027-02-01')).toBe(true) // 90 days
    expect(roadmapBoxDefault('2026-11-03', '2027-02-02')).toBe(false) // 91 days
    expect(roadmapBoxDefault('2026-11-03', '2029-11-05')).toBe(false)
    expect(roadmapBoxWords(2, '2026-11-03')).toBe('Give back 2 open roadmap tasks they had in 2026')
    expect(roadmapBoxWords(1, '2026-11-03')).toBe('Give back 1 open roadmap task they had in 2026')
    expect(roadmapBoxWords(0, '2026-11-03')).toBeNull()
  })

  it('call 3: the wage row is always open and cannot be left open', () => {
    const wage = byId(buildBringBackChecklist(facts()), 'wage')
    expect(wage.state).toBe('open')
    expect(wage.canLeaveOpen).toBe(false)
    expect(wage.detail).toBe('$24.00 / h, set Jan 2026')
    expect(wage.action).toEqual({ kind: 'confirm_wage', hourlyWage: 24, isSalary: false })
    expect(byId(buildBringBackChecklist(facts({ pay: null })), 'wage').detail).toBe('No pay setup')
    expect(byId(buildBringBackChecklist(facts({ pay: { hourlyWage: null, isSalary: false, setYmd: null } })), 'wage').detail).toBe('Pay row has no wage')
  })

  it('call 4: training mode starts off for a returner', () => {
    expect(RETURNER_TRAINING_MODE_DEFAULT).toBe(false)
  })
})

describe('buildBringBackChecklist', () => {
  it("draws the mock-up's window for a tech back after three years", () => {
    const items = buildBringBackChecklist(facts())
    expect(items.map((i) => [i.id, i.state])).toEqual([
      ['restore_halves', 'done'],
      ['sign_in', 'open'],
      ['wage', 'open'],
      ['team', 'open'],
      ['licenses', 'open'],
      ['paperwork', 'open'],
      ['hand_off_vehicle', 'skipped'],
      ['assign_housing', 'skipped'],
    ])
    expect(bringBackButtonLabel(items)).toBe('Bring back · 5 open')
    expect(byId(items, 'sign_in').detail).toBe('corinne.vela@example.com, last used Nov 2026')
    expect(byId(items, 'team').detail).toBe('On no team. The Hours tab groups the crew by team.')
    expect(byId(items, 'team').action).toEqual({ kind: 'link', href: '/people?tab=hours&view=teams', label: 'Pick a team…' })
    expect(byId(items, 'licenses')).toMatchObject({ detail: 'Journeyman plumber expired Jun 2028', lapsed: true, canLeaveOpen: true })
    expect(byId(items, 'paperwork').detail).toBe('5 signed in 2024. None signed for this stint.')
  })

  it('sign-in and wage block the finish; team, licenses and paperwork can be left open', () => {
    const items = buildBringBackChecklist(facts())
    const leaveable = items.filter((i) => i.state === 'open' && i.canLeaveOpen).map((i) => i.id)
    expect(leaveable).toEqual(['team', 'licenses', 'paperwork'])
    const resolved = applyChecklistResolutions(items, {
      sign_in: { state: 'done' },
      wage: { state: 'done' },
      team: { state: 'left_open', reason: 'crew not set yet' },
      licenses: { state: 'left_open', reason: 'renewal in the mail' },
      paperwork: { state: 'left_open', reason: 'sending Monday' },
    })
    expect(checklistSummary(resolved).canFinish).toBe(true)
    expect(bringBackButtonLabel(resolved)).toBe('Bring back')
    expect(byId(resolved, 'wage').action).toBeNull()
    expect(byId(resolved, 'licenses').leaveReason).toBe('renewal in the mail')
  })

  it('the team row reads the Hours-tab team they are still on, and the office needs none', () => {
    expect(byId(buildBringBackChecklist(facts({ team: { id: 't-1', name: 'Crew A' } })), 'team')).toMatchObject({ state: 'done', detail: 'On Crew A' })
    expect(byId(buildBringBackChecklist(facts({ needsTeam: false })), 'team').state).toBe('skipped')
    expect(kindNeedsTeam('helper')).toBe(true)
    expect(kindNeedsTeam('sub')).toBe(true)
    expect(kindNeedsTeam('master_technician')).toBe(true)
    expect(kindNeedsTeam('assistant')).toBe(false)
    expect(kindNeedsTeam(null)).toBe(false)
  })

  it('licenses: lapsed before the day back is red; still good is done; none is skipped', () => {
    expect(byId(buildBringBackChecklist(facts({ licenses: [{ name: 'Journeyman plumber', date_of_expiry: '2030-06-30' }] })), 'licenses')).toMatchObject({
      state: 'done',
      detail: '1 license on file, none expired',
    })
    expect(byId(buildBringBackChecklist(facts({ licenses: [] })), 'licenses').state).toBe('skipped')
    const two = byId(
      buildBringBackChecklist(
        facts({
          licenses: [
            { name: 'Backflow tester', date_of_expiry: '2029-01-15' },
            { name: 'Journeyman plumber', date_of_expiry: '2028-06-30' },
            { name: 'Medical gas', date_of_expiry: null },
          ],
        }),
      ),
      'licenses',
    )
    expect(two.detail).toBe('Journeyman plumber expired Jun 2028 · Backflow tester expired Jan 2029')
  })

  it('no login: the sign-in row is skipped and the halves row says what comes back', () => {
    const items = buildBringBackChecklist(facts({ hasLogin: false, signInEmail: null }))
    expect(byId(items, 'sign_in').state).toBe('skipped')
    expect(byId(items, 'restore_halves').detail).toBe('The roster row comes back. There is no login to restore.')
  })

  it('paperwork assigned since the day back is done', () => {
    expect(byId(buildBringBackChecklist(facts({ paperworkAssignedSinceBack: true })), 'paperwork').state).toBe('done')
    expect(byId(buildBringBackChecklist(facts({ paperworkSignedEarlier: { count: 0, lastYmd: null } })), 'paperwork').detail).toBe(
      'Nothing assigned for this stint.',
    )
  })
})

describe('HR lines', () => {
  it('writes the return line with what was left open on purpose', () => {
    const items = applyChecklistResolutions(buildBringBackChecklist(facts()), {
      sign_in: { state: 'done' },
      wage: { state: 'done' },
      team: { state: 'done' },
      licenses: { state: 'left_open', reason: 'renewal in the mail' },
      paperwork: { state: 'done' },
    })
    expect(bringBackHrLine({ displayName: 'Corinne Vela', leftYmd: '2026-11-03', backYmd: '2029-11-05', items })).toBe(
      'Back on 2029-11-05 for Corinne Vela, after 3 years away. Left open on purpose: licenses (renewal in the mail).',
    )
  })

  it('writes the undo line', () => {
    expect(undoEndHrLine({ displayName: 'Corinne Vela', leftYmd: '2026-11-03', todayYmd: '2026-11-05' })).toBe(
      'Employment end of 2026-11-03 undone for Corinne Vela on 2026-11-05: ended by mistake.',
    )
  })
})

describe('findArchivedMatch', () => {
  const corinne: ArchivedPerson = { id: 'p1', name: 'Corinne Vela', email: 'corinne.vela@example.com', leftYmd: '2026-11-03' }
  const other: ArchivedPerson = { id: 'p2', name: 'Corinne Vela', email: 'cv.older@example.com', leftYmd: '2021-05-01' }

  it('matches the name with spaces and case aside', () => {
    expect(findArchivedMatch({ name: '  corinne   VELA ', email: 'new@example.com' }, [corinne])).toEqual({ person: corinne, by: 'name' })
  })

  it('matches the old email under a new name', () => {
    expect(findArchivedMatch({ name: 'Corinne Ramos', email: 'Corinne.Vela@Example.com ' }, [corinne])).toEqual({ person: corinne, by: 'email' })
  })

  it('prefers a match on both, then the latest leaver', () => {
    expect(findArchivedMatch({ name: 'Corinne Vela', email: 'cv.older@example.com' }, [corinne, other])?.person.id).toBe('p2')
    expect(findArchivedMatch({ name: 'Corinne Vela', email: '' }, [other, corinne])?.person.id).toBe('p1')
  })

  it('finds nothing for blanks or strangers', () => {
    expect(findArchivedMatch({ name: '', email: '' }, [corinne])).toBeNull()
    expect(findArchivedMatch({ name: 'Dana Whitfield', email: 'dana@example.com' }, [corinne])).toBeNull()
    expect(findArchivedMatch({ name: 'Corinne Vela', email: '' }, [{ ...corinne, email: null }])).toEqual({ person: { ...corinne, email: null }, by: 'name' })
  })

  it("words the Hire form's amber line", () => {
    expect(archivedMatchWords({ person: corinne, by: 'name' })).toEqual({
      headline: 'Corinne Vela left on Nov 3, 2026.',
      detail: 'Their hours, logbook and HR file are on that account.',
      bringBackLabel: 'Bring back Corinne',
    })
    expect(archivedMatchWords({ person: { ...corinne, leftYmd: null }, by: 'email' }).headline).toBe('Corinne Vela is archived.')
  })
})

describe('roadmapBoxWords with a count the viewer cannot read', () => {
  it('shows the box without a number', () => {
    expect(roadmapBoxWords(null, '2026-11-03')).toBe('Give back the open roadmap tasks they had in 2026')
    expect(roadmapBoxWords(0, '2026-11-03')).toBeNull()
  })
})

describe('planBringBackWrites', () => {
  const base = {
    userId: 'u-1',
    loginArchived: true,
    personId: 'p-1',
    payName: 'Corinne Vela',
    displayName: 'Corinne Vela',
    leftYmd: '2026-11-03',
    backYmd: '2029-11-05',
    restoreRoadmap: false,
    trainingMode: false,
    trainingWas: false,
    wageChange: null,
    hrNote: true,
    items: buildBringBackChecklist(facts()),
  }

  it('restores the login first, then the roster row in one statement, then the HR line', () => {
    const plan = planBringBackWrites(base)
    expect(plan.map((w) => w.kind)).toEqual(['restore_login', 'roster', 'hr_line'])
    expect(plan[0]).toEqual({ kind: 'restore_login', userId: 'u-1', restoreRoadmap: false })
    expect(plan[1]).toEqual({ kind: 'roster', personId: 'p-1', patch: { archived_at: null, start_date: '2029-11-05', end_date: null } })
    expect(plan[2]).toMatchObject({ kind: 'hr_line', personId: 'p-1', entryDate: '2029-11-05' })
    expect((plan[2] as { content: string }).content).toContain('Back on 2029-11-05 for Corinne Vela, after 3 years away.')
  })

  it('writes training mode only when the box differs from the account, and the wage only after Change', () => {
    expect(planBringBackWrites({ ...base, trainingMode: true }).map((w) => w.kind)).toEqual(['restore_login', 'roster', 'training_mode', 'hr_line'])
    expect(planBringBackWrites({ ...base, trainingWas: true }).map((w) => w.kind)).toEqual(['restore_login', 'roster', 'training_mode', 'hr_line'])
    expect(planBringBackWrites({ ...base, wageChange: 26 })).toContainEqual({ kind: 'wage', payName: 'Corinne Vela', personId: 'p-1', hourlyWage: 26 })
    expect(planBringBackWrites({ ...base, wageChange: 0 }).some((w) => w.kind === 'wage')).toBe(false)
  })

  it('skips the login when it is not archived, and everything on the roster row when there is none', () => {
    expect(planBringBackWrites({ ...base, loginArchived: false }).map((w) => w.kind)).toEqual(['roster', 'hr_line'])
    expect(planBringBackWrites({ ...base, personId: null }).map((w) => w.kind)).toEqual(['restore_login'])
    expect(planBringBackWrites({ ...base, hrNote: false }).map((w) => w.kind)).toEqual(['restore_login', 'roster'])
  })

  it('undo keeps the old start so the trigger reopens the old stint', () => {
    const plan = planUndoEndWrites({ userId: 'u-1', loginArchived: true, personId: 'p-1', displayName: 'Corinne Vela', leftYmd: '2026-11-03', todayYmd: '2026-11-06', hrNote: true })
    expect(plan.map((w) => w.kind)).toEqual(['restore_login', 'roster', 'hr_line'])
    expect(plan[0]).toEqual({ kind: 'restore_login', userId: 'u-1', restoreRoadmap: true })
    expect(plan[1]).toEqual({ kind: 'roster', personId: 'p-1', patch: { archived_at: null, end_date: null } })
  })
})

describe('the day back and the footer', () => {
  it('refuses a day before the day they left, and asks for a day when there is none', () => {
    expect(bringBackDateProblem('2026-11-03', '2029-11-05')).toBeNull()
    expect(bringBackDateProblem('2026-11-03', '2026-11-03')).toBeNull()
    expect(bringBackDateProblem('2026-11-03', '2026-11-02')).toBe('The day back is before Nov 3, 2026, the day they left. Ended by mistake? Undo the end instead.')
    expect(bringBackDateProblem('2026-11-03', '')).toBe('Pick the day they are back.')
  })

  it('says what the press will do', () => {
    expect(bringBackFooterWords({ hasLogin: true, hasRosterRow: true, backYmd: '2029-11-05', hrNote: true })).toBe(
      'Restores the login and roster row. Opens a stint from Nov 5, 2029. Adds one line to the HR file.',
    )
    expect(bringBackFooterWords({ hasLogin: false, hasRosterRow: true, backYmd: '2029-11-05', hrNote: false })).toBe('Restores the roster row. Opens a stint from Nov 5, 2029.')
    expect(bringBackFooterWords({ hasLogin: true, hasRosterRow: false, backYmd: '2029-11-05', hrNote: false })).toBe('Restores the login.')
    expect(bringBackFooterWords({ hasLogin: false, accountArchived: true, hasRosterRow: true, backYmd: '2029-11-05', hrNote: false })).toBe('Restores the account and roster row. Opens a stint from Nov 5, 2029.')
  })
})

describe('mergeArchivedRows (+ Hire, v2.6525)', () => {
  it('one entry a person: the account with its row, an account alone, a row alone', () => {
    const merged = mergeArchivedRows(
      [
        { id: 'u-corinne', name: 'Corinne Vela', email: 'corinne.vela@example.com' },
        { id: 'u-sam', name: 'Sam Becker', email: null },
      ],
      [
        { id: 'p-corinne', name: 'Corinne Vela', email: 'c.vela@home.example', end_date: '2026-11-03', account_user_id: 'u-corinne', archived_at: '2026-11-03T18:00:00Z' },
        { id: 'p-edgar', name: 'Edgar', email: null, end_date: null, account_user_id: null, archived_at: '2026-03-31T18:00:00Z' },
        { id: 'p-active', name: 'Still Here', email: null, end_date: '2026-01-01', account_user_id: null, archived_at: null },
      ],
    )
    expect(merged).toEqual([
      { id: 'u-corinne', name: 'Corinne Vela', email: 'corinne.vela@example.com', leftYmd: '2026-11-03', userId: 'u-corinne', personId: 'p-corinne' },
      { id: 'u-sam', name: 'Sam Becker', email: null, leftYmd: null, userId: 'u-sam', personId: null },
      { id: 'p-edgar', name: 'Edgar', email: null, leftYmd: null, userId: null, personId: 'p-edgar' },
    ])
  })

  it('a roster row still active beside an archived account lends its end date (End employment before v2.6523)', () => {
    const merged = mergeArchivedRows([{ id: 'u-1', name: 'Kai Moss', email: 'kai@example.com' }], [{ id: 'p-1', name: 'Kai Moss', email: null, end_date: '2026-10-01', account_user_id: 'u-1', archived_at: null }])
    expect(merged).toEqual([{ id: 'u-1', name: 'Kai Moss', email: 'kai@example.com', leftYmd: '2026-10-01', userId: 'u-1', personId: 'p-1' }])
    expect(findArchivedMatch({ name: 'kai moss', email: '' }, merged)?.person.leftYmd).toBe('2026-10-01')
  })
})

describe('withWageChange (v2.6550)', () => {
  it('folds the typed wage into the pay row, set on the day back, and makes a pay row when there is none', () => {
    const changed = withWageChange(facts(), 26, '2029-11-05')
    expect(changed.pay).toEqual({ hourlyWage: 26, isSalary: false, setYmd: '2029-11-05' })
    expect(byId(buildBringBackChecklist(changed), 'wage').detail).toBe('$26.00 / h, set Nov 2029')
    const fresh = withWageChange(facts({ pay: null }), 20, '2029-11-05')
    expect(fresh.pay).toEqual({ hourlyWage: 20, isSalary: false, setYmd: '2029-11-05' })
    expect(byId(buildBringBackChecklist(fresh), 'wage').detail).toBe('$20.00 / h, set Nov 2029')
  })
  it('keeps the facts as they are after Keep, or with no usable wage', () => {
    const f = facts()
    expect(withWageChange(f, null, '2029-11-05')).toBe(f)
    expect(withWageChange(f, 0, '2029-11-05')).toBe(f)
    const salaried = withWageChange(facts({ pay: { hourlyWage: 30, isSalary: true, setYmd: null } }), 32, '2029-11-05')
    expect(salaried.pay?.isSalary).toBe(true)
  })
})
