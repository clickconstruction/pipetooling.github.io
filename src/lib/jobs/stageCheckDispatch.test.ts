/** Send a stage check to Dispatch (punch list #245, PR 1): the title, the reason rules, the row, the dedupe and the words. */
import { describe, expect, it } from 'vitest'
import {
  STAGE_CHECK_ACTION,
  STAGE_CHECK_REASONS,
  STAGE_CHECK_TITLE_MAX,
  STAGE_CHECK_WORDS_MAX,
  alreadyWithDispatchWords,
  contextMetaWords,
  openStageCheckFor,
  reasonTailFromTitle,
  stageCheckJobLabel,
  stageCheckPayloadFrom,
  stageCheckPriority,
  stageCheckProblem,
  stageCheckReferenceSummary,
  stageCheckRefusalWords,
  stageCheckRow,
  stageCheckSentWords,
  stageCheckTitle,
  stageCheckWaiting,
  withDispatchAgeWords,
  withDispatchWords,
  type OpenStageCheck,
} from './stageCheckDispatch'
import { CUSTOMER_WAITING_RED_MINUTES } from '../requestPriority'

const JOB = { id: 'job-1', hcpNumber: '1088', name: 'ZZ TEST Riders Walk', address: '12925 FM 20, Kingsbury' }

describe('the reasons', () => {
  it('ship as the card recommends: five chips, words required only under Something else, a stopped crew high', () => {
    expect(STAGE_CHECK_REASONS.map((r) => r.label)).toEqual(["Can't do it", 'Not on this job', 'Need a part', 'Need a decision', 'Something else'])
    expect(STAGE_CHECK_REASONS.filter((r) => r.wordsRequired).map((r) => r.key)).toEqual(['other'])
    expect(stageCheckPriority('cant_do')).toBe('high')
    expect(stageCheckPriority('need_part')).toBe('normal')
  })

  it('refuse a draft with no chip, and Something else with no words', () => {
    expect(stageCheckProblem(null, 'the caps')).toBe('Pick why you are sending it.')
    expect(stageCheckProblem('other', '   ')).toBe('Say what Dispatch should know.')
    expect(stageCheckProblem('need_part', '')).toBeNull()
    expect(stageCheckProblem('need_part', 'x'.repeat(STAGE_CHECK_WORDS_MAX + 1))).toBe(`Keep it under ${STAGE_CHECK_WORDS_MAX} characters.`)
  })
})

describe('the title', () => {
  it('reads the stage, the check, the reason with the words, and the job', () => {
    expect(stageCheckTitle({ stageName: 'Trim Set', question: 'Is the pan drain run to the hub?', reason: 'need_part', words: 'The caps are not on the truck.', job: JOB })).toBe(
      'Trim Set · “Is the pan drain run to the hub?” · need a part: The caps are not on the truck. · JP1088 ZZ TEST Riders Walk',
    )
  })

  it('leaves the colon off with no words, and the job off when the read gave none', () => {
    expect(stageCheckTitle({ stageName: 'Rough In', question: 'Did the water test hold?', reason: 'cant_do', words: '  ', job: {} })).toBe("Rough In · “Did the water test hold?” · can't do it")
  })

  it('holds under the column by cutting the words, never the question or the job', () => {
    const t = stageCheckTitle({ stageName: 'Trim Set', question: 'Is the pan drain run to the hub?', reason: 'other', words: 'word '.repeat(600), job: JOB })
    expect(t.length).toBeLessThanOrEqual(STAGE_CHECK_TITLE_MAX)
    expect(t.startsWith('Trim Set · “Is the pan drain run to the hub?” · something else: word')).toBe(true)
    expect(t.endsWith('… · JP1088 ZZ TEST Riders Walk')).toBe(true)
  })

  it('names the job once, JP before the number, and never doubles a JP already typed', () => {
    expect(stageCheckJobLabel({ hcpNumber: 'JP1088', name: 'Riders Walk' })).toBe('JP1088 Riders Walk')
    expect(stageCheckJobLabel({ hcpNumber: null, name: ' Riders Walk ' })).toBe('Riders Walk')
    expect(stageCheckJobLabel({})).toBe('')
    expect(stageCheckReferenceSummary(JOB)).toBe('JP1088 · ZZ TEST Riders Walk · 12925 FM 20, Kingsbury')
    expect(stageCheckReferenceSummary({ id: 'j' })).toBe('')
  })
})

describe('the row', () => {
  it('is the dispatch_requests row with the flavour, the job, the stage and the check on it', () => {
    const row = stageCheckRow({ fromUserId: 'u-luis', job: JOB, fixtureId: 'f3', stageName: 'Trim Set', question: { id: 'q1', words: 'Is the pan drain run to the hub?' }, reason: 'cant_do', words: 'The hub is not poured.' })
    expect(row).toEqual({
      from_user_id: 'u-luis',
      title: "Trim Set · “Is the pan drain run to the hub?” · can't do it: The hub is not poured. · JP1088 ZZ TEST Riders Walk",
      links: [],
      job_ledger_id: 'job-1',
      bid_id: null,
      development_id: null,
      reference_summary: 'JP1088 · ZZ TEST Riders Walk · 12925 FM 20, Kingsbury',
      pending_action: STAGE_CHECK_ACTION,
      pending_payload: { stage_check: { fixture_id: 'f3', question_id: 'q1', reason: 'cant_do', stage_name: 'Trim Set' } },
      priority: 'high',
      fixture_id: 'f3',
      checklist_question_id: 'q1',
    })
  })

  it('leaves the reference null when the job read gave nothing', () => {
    expect(stageCheckRow({ fromUserId: 'u', job: { id: 'j' }, fixtureId: 'f', stageName: 'Top Out', question: { id: 'q', words: 'Vents up?' }, reason: 'need_decision', words: '' }).reference_summary).toBeNull()
  })
})

describe('the payload', () => {
  it('reads the stage, the check and the reason back off an inbox row, and nothing off another request', () => {
    expect(stageCheckPayloadFrom({ stage_check: { fixture_id: 'f3', question_id: 'q1', reason: 'need_part', stage_name: 'Trim Set' } })).toEqual({ fixture_id: 'f3', question_id: 'q1', reason: 'need_part', stage_name: 'Trim Set' })
    expect(stageCheckPayloadFrom({ stage_check: { fixture_id: 'f3', question_id: 'q1', reason: 'nonsense' } })).toEqual({ fixture_id: 'f3', question_id: 'q1', reason: 'other', stage_name: '' })
    expect(stageCheckPayloadFrom({ supply_houses: [] })).toBeNull()
    expect(stageCheckPayloadFrom(null)).toBeNull()
    expect(stageCheckPayloadFrom({ stage_check: { fixture_id: '', question_id: 'q1' } })).toBeNull()
  })
})

describe('what is with Dispatch', () => {
  const r1: OpenStageCheck = { id: 'r1', fixtureId: 'f3', questionId: 'q1', title: 'Trim Set · “Is the pan drain run to the hub?” · need a part: caps · JP1088', createdAt: '2026-11-02T15:00:00.000Z', priority: 'normal' }
  const r2: OpenStageCheck = { id: 'r2', fixtureId: 'f3', questionId: 'q2', title: "Trim Set · “Are the cleanouts capped?” · can't do it", createdAt: '2026-11-02T15:00:00.000Z', priority: 'high' }
  const open: OpenStageCheck[] = [r1, r2]
  const now = Date.parse('2026-11-02T15:12:00.000Z')

  it('finds the open request on this stage and check, and nothing on another stage', () => {
    expect(openStageCheckFor(open, 'f3', 'q1')?.id).toBe('r1')
    expect(openStageCheckFor(open, 'f4', 'q1')).toBeNull()
  })

  it('reads the reason back off the title it built, and nothing off a plain one', () => {
    expect(reasonTailFromTitle(r1.title)).toBe('need a part')
    expect(reasonTailFromTitle(r2.title)).toBe("can't do it")
    expect(reasonTailFromTitle('Pick up the permit · before Friday')).toBe('')
  })

  it('draws the chip with the age and the reason', () => {
    expect(withDispatchWords(r1, now)).toBe('With Dispatch · 12 min · need a part')
    expect(withDispatchAgeWords('2026-11-02T15:11:30.000Z', now)).toBe('now')
    expect(withDispatchAgeWords('2026-11-02T12:00:00.000Z', now)).toBe('3 hr')
    expect(withDispatchAgeWords('2026-10-31T15:00:00.000Z', now)).toBe('2 days')
    expect(withDispatchAgeWords('2026-11-01T15:00:00.000Z', now)).toBe('1 day')
    expect(withDispatchAgeWords('not a date', now)).toBe('now')
  })

  it('says a second send is already with Dispatch, from the phone and from the database', () => {
    expect(alreadyWithDispatchWords(r1, now)).toBe('Already with Dispatch since 12 min ago. Dispatch has it.')
    expect(alreadyWithDispatchWords({ ...r1, createdAt: new Date(now).toISOString() }, now)).toBe('Already with Dispatch since a moment ago. Dispatch has it.')
    expect(stageCheckRefusalWords({ code: '23505', message: 'duplicate key' }, 'fallback')).toBe('Already with Dispatch. Dispatch has it.')
    expect(stageCheckRefusalWords(new Error('no signal'), 'fallback')).toBe('fallback')
  })
})

describe('the words', () => {
  it('say where the answer comes back, and that a stopped crew leads the inbox', () => {
    expect(stageCheckSentWords('need_part')).toBe('Sent to Dispatch. The answer comes back on this row.')
    expect(stageCheckSentWords('cant_do')).toBe('Sent to Dispatch as a stopped crew. It leads their inbox, and the answer comes back on this row.')
  })

  it('draw the context card’s second line from what the row knows', () => {
    expect(contextMetaWords({ asksPhoto: true, fixtureId: null }, null, '')).toBe("asks for a photo · the company's question · not answered yet")
    expect(contextMetaWords({ asksPhoto: false, fixtureId: 'f3', addedBy: 'Pat Sample' }, { pick: 'yes' }, 'Luis Ortega · Nov 2 · 9:14 am')).toBe('added by Pat Sample · Yes, Luis Ortega · Nov 2 · 9:14 am')
    expect(contextMetaWords({ asksPhoto: false, fixtureId: 'f3' }, { pick: null }, '')).toBe('added for this job · not answered yet')
  })
})

describe('stageCheckWaiting: the red line over a stage check that leads the inbox (v2.6462)', () => {
  const now = Date.parse('2026-11-03T14:00:00Z')
  const ago = (min: number) => new Date(now - min * 60_000).toISOString()

  it('names the reason and the wait', () => {
    expect(stageCheckWaiting('cant_do', ago(4), now)).toEqual({ words: "Can't do it · waiting 4 min", red: false })
  })

  it("reads the request's own reason, so a check Dispatch raised says why it was sent", () => {
    expect(stageCheckWaiting('need_part', ago(65), now).words).toBe('Need a part · waiting 1 h 5 min')
  })

  it('turns red once the wait passes the Customer waiting threshold', () => {
    expect(stageCheckWaiting('cant_do', ago(CUSTOMER_WAITING_RED_MINUTES - 1), now).red).toBe(false)
    expect(stageCheckWaiting('cant_do', ago(CUSTOMER_WAITING_RED_MINUTES), now).red).toBe(true)
  })

  it('still reads without a known reason or a time', () => {
    expect(stageCheckWaiting(undefined, ago(4), now).words).toBe('Waiting 4 min')
    expect(stageCheckWaiting('not_a_reason', ago(4), now).words).toBe('Waiting 4 min')
    expect(stageCheckWaiting('cant_do', null, now)).toEqual({ words: "Can't do it · waiting", red: false })
  })
})
