import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { agentState, buildRobotAgentView, nowWords, recentWorkLine, sortRobotAgents, todayLine, type RobotAgentRow, type RobotRecentItem } from './robotAgents'

const NOW = Date.parse('2026-10-21T19:38:00Z')
const DAY = Date.parse('2026-10-21T05:00:00Z')
const ago = (m: number) => new Date(NOW - m * 60_000).toISOString()

function row(over: Partial<RobotAgentRow> = {}): RobotAgentRow {
  return {
    credential_id: 'k1',
    key_label: "Robert's Mac Mini",
    key_created_at: ago(60 * 24),
    twin_user_id: 't1',
    twin_name: 'Twin Estimator 1',
    twin_kind: 'estimator',
    last_seen_at: ago(2),
    stopped_at: null,
    stopped_by_name: null,
    heartbeat_at: ago(2),
    heartbeat_state: 'working',
    heartbeat_stage: 'STG-2',
    heartbeat_progress: { step: 'reading', read: '12 of 31 sheets' },
    heartbeat_is_round: true,
    heartbeat_bid_number: '2041',
    heartbeat_project: 'ZZ Shadow Oak Hollow Dental TI',
    heartbeat_source_bid_number: '511',
    holds_open_shell: true,
    idle_rounds_today: 88,
    recent: [],
    ...over,
  }
}

describe('agentState', () => {
  it('alive within seven minutes, quiet to fifteen, asleep after, never with no call', () => {
    expect(agentState(row({ last_seen_at: ago(2) }), NOW).state).toBe('alive')
    expect(agentState(row({ last_seen_at: ago(7) }), NOW).state).toBe('alive')
    expect(agentState(row({ last_seen_at: ago(8) }), NOW).state).toBe('quiet')
    expect(agentState(row({ last_seen_at: ago(15) }), NOW).state).toBe('quiet')
    expect(agentState(row({ last_seen_at: ago(16) }), NOW).state).toBe('asleep')
    expect(agentState(row({ last_seen_at: null }), NOW)).toEqual({ state: 'never', word: 'Never checked in', tone: 'gray' })
  })
  it('a stopped key is stopping while it holds a shell, stopped once it does not', () => {
    expect(agentState(row({ stopped_at: ago(5) }), NOW)).toEqual({ state: 'stopping', word: 'Stopping after b511', tone: 'blue' })
    expect(agentState(row({ stopped_at: ago(28), stopped_by_name: 'Robert', holds_open_shell: false }), NOW)).toEqual({ state: 'stopped', word: 'Stopped by Robert 28m ago', tone: 'gray' })
  })
})

describe('the words', () => {
  it('Now: the shape on the human bid, or nothing in hand', () => {
    expect(nowWords(row())).toBe('Reading the sheets, 12 of 31 sheets on b511.')
    expect(nowWords(row({ holds_open_shell: false }))).toBe('Nothing in hand.')
  })
  it('Recently: each kind in words with its door', () => {
    const sealed: RobotRecentItem = { kind: 'sealed', at: ago(60), bid_number: '509', project: 'Cedar Park Vet Clinic', shell_number: '2038', count: 2, label: null, delta_pct: null }
    expect(recentWorkLine(sealed)).toEqual({ at: sealed.at, words: 'Sealed b2038 for b509 Cedar Park Vet Clinic. Asked 2 questions.', door: { kind: 'bid', bidId: null, bidNumber: '509' } })
    expect(recentWorkLine({ ...sealed, kind: 'scored', delta_pct: -4.2 }).words).toBe('Sealed b2038 for b509 Cedar Park Vet Clinic. Scored since, 4 percent under ours.')
    expect(recentWorkLine({ ...sealed, kind: 'parked', count: 0 }).words).toBe('Parked b2038 for b509 Cedar Park Vet Clinic. Waiting on the plans.')
    expect(recentWorkLine({ kind: 'matrix', at: ago(90), bid_id: 'bid-503', bid_number: '503', project: 'Bluebonnet Oil Change', shell_number: null, count: 2, label: 'ready', delta_pct: null })).toEqual({ at: expect.any(String), words: 'Matrix ready for b503 Bluebonnet Oil Change, 2 asks.', door: { kind: 'matrix', bidId: 'bid-503', bidNumber: '503' } })
    expect(recentWorkLine({ kind: 'submittal', at: ago(200), bid_number: '498', project: 'Saddle Creek Storage', shell_number: null, count: 6, label: 'file_cut_sheets', delta_pct: null }).words).toBe('Filed 6 cut sheets on b498 Saddle Creek Storage.')
    expect(recentWorkLine({ kind: 'report', at: ago(300), bid_number: null, project: null, shell_number: null, count: null, label: 'SHADOW-b2041', delta_pct: null }).words).toBe('Filed its report SHADOW-b2041.')
  })
  it('Today: the counts of the day, and the idle rounds', () => {
    const items: RobotRecentItem[] = [
      { kind: 'sealed', at: ago(60), bid_number: '509', project: null, shell_number: '2038', count: 0, label: null, delta_pct: null },
      { kind: 'parked', at: ago(120), bid_number: '507', project: null, shell_number: '2035', count: 0, label: null, delta_pct: null },
      { kind: 'sealed', at: new Date(DAY - 60_000).toISOString(), bid_number: '501', project: null, shell_number: '2029', count: 0, label: null, delta_pct: null },
    ]
    expect(todayLine(items, 88, DAY)).toBe('1 bid sealed, 1 parked. 88 rounds found nothing to do.')
    expect(todayLine([], 0, DAY)).toBeNull()
    expect(todayLine([], 3, DAY)).toBe('3 rounds found nothing to do.')
  })
  it('every sentence passes the plain-words rules', () => {
    const v = buildRobotAgentView(row({ recent: [{ kind: 'sealed', at: ago(60), bid_number: '509', project: 'Cedar Park Vet Clinic', shell_number: '2038', count: 2, label: null, delta_pct: null }] }), NOW, DAY, true)
    for (const s of [v.checkedIn, v.now, v.today ?? '', ...v.recent.map((r) => r.words)]) expect(plainWordsFailures(s)).toEqual([])
  })
})

describe('buildRobotAgentView and the order', () => {
  it('names the robot and the seat, says when it checked in, and sorts the live ones first', () => {
    const alive = buildRobotAgentView(row(), NOW, DAY, true)
    expect(alive.robot).toBe('Twin Estimator 1')
    expect(alive.seat).toBe("on Robert's Mac Mini")
    expect(alive.checkedIn).toBe('Checked in 2m ago.')
    expect(alive.word).toBe('Alive')
    const asleep = buildRobotAgentView(row({ credential_id: 'k2', key_label: "Stephen's MacBook", last_seen_at: ago(60 * 70), holds_open_shell: false }), NOW, DAY, true)
    expect(asleep.checkedIn).toBe('Last check-in 2d ago.')
    expect(asleep.now).toBe('Nothing in hand.')
    expect(sortRobotAgents([asleep, alive]).map((v) => v.credentialId)).toEqual(['k1', 'k2'])
  })
})
