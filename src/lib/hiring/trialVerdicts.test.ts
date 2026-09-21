import { describe, expect, it } from 'vitest'
import {
  TRIAL_NOTE_MAX,
  TRIAL_VERDICT_DEEP_LINK,
  buildTrialVerdictCards,
  dashboardTrialCards,
  pendingTrialCards,
  trialAnswerLine,
  trialVerdictPush,
  trialVerdictRow,
  type TrialVerdictFeedRow,
} from './trialVerdicts'

const row = (over: Partial<TrialVerdictFeedRow> = {}): TrialVerdictFeedRow => ({
  prospect_id: 'p1',
  helper_user_id: 'u1',
  helper_name: 'Bryan Ortiz',
  work_date: '2026-09-21',
  job_id: 'j1',
  hcp_number: '258',
  click_number: null,
  job_name: 'Oak St',
  customer_name: 'Acme',
  trial_day: 4,
  verdict: null,
  note: null,
  ...over,
})

describe('trialVerdicts — the cards', () => {
  it('says who, where and which day, by name', () => {
    const [card] = buildTrialVerdictCards([row()], { todayYmd: '2026-09-21' })
    expect(card?.eyebrow).toBe('Trial helper · day 4 · with you')
    expect(card?.contextLine).toMatch(/^worked with you today at .*Oak St/)
    expect(card?.question).toBe('Take Bryan again?')
    expect(card?.answered).toBe(false)
  })

  it('reads yesterday as yesterday, survives a day with no job, and a nameless card', () => {
    const [card] = buildTrialVerdictCards([row({ work_date: '2026-09-20', job_id: null, helper_name: '  ', trial_day: 0 })], { todayYmd: '2026-09-21' })
    expect(card?.contextLine).toBe('worked with you yesterday')
    expect(card?.eyebrow).toBe('Trial helper · with you')
    expect(card?.helperName).toBe('Your helper')
    expect(card?.question).toBe('Take them again?')
    expect(card?.jobLabel).toBeNull()
  })

  it('orders today first, then by name, and drops rows it cannot key', () => {
    const cards = buildTrialVerdictCards(
      [row({ prospect_id: 'p2', helper_name: 'Zed', work_date: '2026-09-20' }), row({ prospect_id: 'p3', helper_name: 'Devon' }), row(), row({ prospect_id: '' })],
      { todayYmd: '2026-09-21' },
    )
    expect(cards.map((c) => c.helperName)).toEqual(['Bryan Ortiz', 'Devon', 'Zed'])
    expect(new Set(cards.map((c) => c.key)).size).toBe(3)
  })

  it('takes a payload that is not a list as no cards', () => {
    expect(buildTrialVerdictCards(null, { todayYmd: '2026-09-21' })).toEqual([])
    expect(buildTrialVerdictCards({} as never, { todayYmd: '2026-09-21' })).toEqual([])
  })
})

describe('trialVerdicts — what is dealt', () => {
  const cards = buildTrialVerdictCards(
    [
      row({ prospect_id: 'pending' }),
      row({ prospect_id: 'skipped', verdict: 'skipped' }),
      row({ prospect_id: 'answered-today', verdict: 'yes', note: 'careful, a bit slow' }),
      row({ prospect_id: 'pending-yesterday', work_date: '2026-09-20' }),
    ],
    { todayYmd: '2026-09-21' },
  )

  it('deals only cards with no row at the clock-out — a skip is not asked twice', () => {
    expect(pendingTrialCards(cards).map((c) => c.prospectId).sort()).toEqual(['pending', 'pending-yesterday'])
  })

  it('keeps today’s answer on the Dashboard so it can be changed, and never resurrects a skip', () => {
    expect(dashboardTrialCards(cards).map((c) => c.prospectId).sort()).toEqual(['answered-today', 'pending', 'pending-yesterday'])
  })

  it('reads an answer back in one line', () => {
    expect(trialAnswerLine({ verdict: 'yes', note: ' careful, a bit slow ' })).toBe('You said yes · “careful, a bit slow”')
    expect(trialAnswerLine({ verdict: 'unsure', note: '' })).toBe('You said not sure')
    expect(trialAnswerLine({ verdict: 'skipped', note: '' })).toBeNull()
    expect(trialAnswerLine({ verdict: null, note: '' })).toBeNull()
  })
})

describe('trialVerdicts — the row and the push', () => {
  const card = { prospectId: 'p1', jobId: 'j1', workDate: '2026-09-21' }

  it('writes the leader’s own row, trims and caps the note, and a skip carries no word', () => {
    expect(trialVerdictRow(card, 'me', 'no', '  late twice  ')).toEqual({ prospect_id: 'p1', leader_user_id: 'me', job_ledger_id: 'j1', work_date: '2026-09-21', verdict: 'no', note: 'late twice' })
    expect(trialVerdictRow(card, 'me', 'yes', '   ').note).toBeNull()
    expect(trialVerdictRow(card, 'me', 'yes', 'x'.repeat(999)).note).toHaveLength(TRIAL_NOTE_MAX)
    expect(trialVerdictRow(card, 'me', 'skipped', 'typed then skipped').note).toBeNull()
  })

  it('pushes the mock-up’s words, by name, and opens the Dashboard card', () => {
    expect(trialVerdictPush('Bryan Ortiz', 'Oak St')).toEqual({ title: 'Trial helper', body: 'Bryan clocked out of Oak St — take Bryan again?', url: TRIAL_VERDICT_DEEP_LINK })
    expect(trialVerdictPush(null, null).body).toBe('Your trial helper clocked out — take them again?')
  })
})
