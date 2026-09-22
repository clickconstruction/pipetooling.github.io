import { describe, expect, it } from 'vitest'
import { TRIAL_NUDGE_THRESHOLDS, buildTrialTally, trialNudge, trialVerdictMark, type TrialTallyDay, type TrialTallyRow, type TrialTallyVerdictRow } from './trialTally'

const TODAY = '2026-09-22'

const mike = { user_id: 'mike', name: 'Mike Ortiz', role: 'master_technician' }
const jake = { user_id: 'jake', name: 'Jake Sub', role: 'subcontractor' }
const luis = { user_id: 'luis', name: 'Luis Vega', role: 'master_technician' }

const day = (work_date: string, leaders: TrialTallyDay['leaders'], over: Partial<TrialTallyDay> = {}): TrialTallyDay => ({
  work_date,
  clocked: true,
  open: false,
  job_id: 'j1',
  hcp_number: '258',
  click_number: null,
  job_name: 'Oak St',
  customer_name: 'Acme',
  leaders,
  ...over,
})

const verdict = (leader: typeof mike, work_date: string, v: TrialTallyVerdictRow['verdict'], note: string | null = null, updated_at = `${work_date}T22:00:00Z`): TrialTallyVerdictRow => ({
  leader_user_id: leader.user_id,
  leader_name: leader.name,
  leader_role: leader.role,
  work_date,
  verdict: v,
  note,
  updated_at,
})

const row = (over: Partial<TrialTallyRow> = {}): TrialTallyRow => ({
  prospect_id: 'p1',
  helper_user_id: 'u1',
  deferred_at: null,
  deferred_by: null,
  deferred_by_name: null,
  days: [],
  verdicts: [],
  ...over,
})

describe('trialTally — the tally', () => {
  it('counts clocked days, lists each leader once with their latest answer, and nudges to hire at three yes', () => {
    const t = buildTrialTally(
      row({
        days: [day('2026-09-16', [mike]), day('2026-09-17', [mike, jake]), day('2026-09-18', [luis]), day('2026-09-21', [mike])],
        verdicts: [
          verdict(mike, '2026-09-16', 'unsure', 'first day'),
          verdict(mike, '2026-09-21', 'yes', 'careful, a bit slow'),
          verdict(jake, '2026-09-17', 'yes', 'kept up all day'),
          verdict(luis, '2026-09-18', 'yes'),
        ],
      }),
      { todayYmd: TODAY },
    )
    expect(t.daysWorked).toBe(4)
    expect(t.daysLine).toBe('4 days worked · 3 leaders')
    expect(t.leaders.map((l) => `${l.name} ${l.verdict}`)).toEqual(['Mike Ortiz yes', 'Luis Vega yes', 'Jake Sub yes'])
    expect(t.leaders[0]!.note).toBe('careful, a bit slow')
    expect(t.leaders[0]!.daysLed).toBe(3)
    expect(t.leaders[2]!.roleTag).toBe('sub')
    expect(t.counts).toEqual({ yes: 3, no: 0, unsure: 0 })
    expect(t.nudge).toEqual({ tone: 'hire', text: '3 leaders said yes — hire?', asks: true })
    expect(t.deferred).toBeNull()
  })

  it('a skip keeps the leader on the list without an answer, and an older answer still counts', () => {
    const t = buildTrialTally(
      row({
        days: [day('2026-09-18', [mike]), day('2026-09-21', [mike])],
        verdicts: [verdict(mike, '2026-09-18', 'no', 'late twice'), verdict(mike, '2026-09-21', 'skipped')],
      }),
      { todayYmd: TODAY },
    )
    expect(t.leaders).toHaveLength(1)
    expect(t.leaders[0]!.verdict).toBe('no')
    expect(t.leaders[0]!.waiting).toBe(false)
  })

  it('names who is still waiting inside the answer window, and marks a leader who never answered', () => {
    const t = buildTrialTally(
      row({
        days: [day('2026-09-15', [luis]), day('2026-09-21', [mike, jake])],
        verdicts: [verdict(jake, '2026-09-21', 'yes')],
      }),
      { todayYmd: TODAY },
    )
    const byName = Object.fromEntries(t.leaders.map((l) => [l.name, l]))
    expect(byName['Mike Ortiz']!.waiting).toBe(true)
    expect(byName['Luis Vega']!.waiting).toBe(false)
    expect(byName['Luis Vega']!.verdict).toBeNull()
    expect(t.nudge.text).toBe('waiting on Mike')
    expect(t.nudge.asks).toBe(false)
  })

  it('says which closed days had nobody who could run the job, and never today while a session is open', () => {
    const t = buildTrialTally(
      row({
        days: [day('2026-09-16', [], { job_name: 'Oak St' }), day(TODAY, [], { open: true })],
      }),
      { todayYmd: TODAY },
    )
    expect(t.unledDays).toHaveLength(1)
    expect(t.unledDays[0]!.label).toMatch(/^Wed, Sep 16 at .*Oak St — no lead listed; ask Dispatch to put a master on the block$/)
    expect(t.onTheJobNow).toBe(true)
    expect(t.daysLine).toBe('2 days worked · on a job now')
    expect(t.nudge.text).toBe('nobody who could run the job was on the block — ask Dispatch to put a master on it')
  })

  it('counts listed days that were never clocked separately, and days after today not at all', () => {
    const t = buildTrialTally(
      row({ days: [day('2026-09-18', [mike], { clocked: false }), day('2026-09-19', [mike]), day('2026-09-25', [mike])] }),
      { todayYmd: TODAY },
    )
    expect(t.daysWorked).toBe(1)
    expect(t.scheduledNotClocked).toBe(1)
    expect(t.daysLine).toBe('1 day worked · 1 listed day not clocked')
  })

  it('no days at all points at Dispatch', () => {
    const t = buildTrialTally(row(), { todayYmd: TODAY })
    expect(t.daysLine).toBe('0 days worked')
    expect(t.nudge).toEqual({ tone: 'wait', text: 'no days yet — ask Dispatch to put them on a crew', asks: false })
  })

  it('Keep trying quiets a question until an answer newer than the press lands', () => {
    const verdicts = [verdict(mike, '2026-09-18', 'no'), verdict(luis, '2026-09-19', 'no')]
    const days = [day('2026-09-18', [mike]), day('2026-09-19', [luis])]
    const quiet = buildTrialTally(row({ days, verdicts, deferred_at: '2026-09-20T15:00:00Z', deferred_by: 'maria', deferred_by_name: 'Maria Lopez' }), { todayYmd: TODAY })
    expect(quiet.nudge.tone).toBe('pass')
    expect(quiet.deferred).toEqual({ at: '2026-09-20T15:00:00Z', byName: 'Maria Lopez', label: 'Keep trying — Maria Sep 20' })

    const newer = buildTrialTally(
      row({ days: [...days, day('2026-09-21', [jake])], verdicts: [...verdicts, verdict(jake, '2026-09-21', 'no')], deferred_at: '2026-09-20T15:00:00Z', deferred_by_name: 'Maria Lopez' }),
      { todayYmd: TODAY },
    )
    expect(newer.deferred).toBeNull()
    expect(newer.nudge.text).toBe('3 said no — pass?')
  })

  it('a deferral on a line that does not ask is ignored', () => {
    const t = buildTrialTally(row({ days: [day('2026-09-21', [mike])], deferred_at: '2026-09-22T01:00:00Z', deferred_by_name: 'Maria' }), { todayYmd: TODAY })
    expect(t.nudge.asks).toBe(false)
    expect(t.deferred).toBeNull()
  })
})

describe('trialTally — the nudge', () => {
  const base = { daysWorked: 3, scheduledNotClocked: 0, leaders: [], unledDays: 0 }
  it('hire at three yes and no no; pass at two no; split when both', () => {
    expect(TRIAL_NUDGE_THRESHOLDS).toEqual({ hireYes: 3, passNo: 2 })
    expect(trialNudge({ ...base, counts: { yes: 3, no: 0, unsure: 1 } }).tone).toBe('hire')
    expect(trialNudge({ ...base, counts: { yes: 3, no: 1, unsure: 0 } })).toEqual({ tone: 'wait', text: '3 yes, 1 no — needs another leader', asks: false })
    expect(trialNudge({ ...base, counts: { yes: 1, no: 2, unsure: 0 } })).toEqual({ tone: 'pass', text: '2 said no, 1 yes — pass?', asks: true })
    expect(trialNudge({ ...base, counts: { yes: 0, no: 2, unsure: 0 } }).text).toBe('2 said no — pass?')
    expect(trialNudge({ ...base, counts: { yes: 3, no: 2, unsure: 0 } })).toEqual({ tone: 'split', text: '3 said yes, 2 said no — talk to them before you decide', asks: true })
  })

  it('joins the names it is waiting on', () => {
    const leaders = [
      { name: 'Mike Ortiz', verdict: null, waiting: true },
      { name: 'Luis Vega', verdict: null, waiting: true },
      { name: 'Jake Sub', verdict: 'yes' as const, waiting: false },
    ]
    expect(trialNudge({ ...base, counts: { yes: 1, no: 0, unsure: 0 }, leaders }).text).toBe('waiting on Mike and Luis')
    expect(trialNudge({ ...base, counts: { yes: 1, no: 0, unsure: 0 }, leaders: [...leaders, { name: 'Ana', verdict: null, waiting: true }] }).text).toBe('waiting on Mike, Luis and Ana')
  })

  it('marks', () => {
    expect(['yes', 'no', 'unsure', null].map((v) => trialVerdictMark(v as never)).join('')).toBe('✓✗?–')
  })
})
