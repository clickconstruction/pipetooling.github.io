import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { buildRobotStage, ROBOT_STAGE_STOPS, type RobotStageRow } from './robotStage'

const NOW = Date.parse('2026-10-30T20:00:00Z')
const base: RobotStageRow = {
  bid_id: 'b1',
  shell_bid_id: 's1',
  shell_bid_number: '652',
  run_status: 'open',
  claimed_at: '2026-10-30T18:52:00Z',
  plans_filed: true,
  read_at: null,
  counted_at: null,
  priced_at: null,
  locked_at: null,
  scored_at: null,
  questions_at: null,
  heartbeat_at: '2026-10-30T19:58:00Z',
  heartbeat_state: 'working',
  heartbeat_stage: null,
  heartbeat_progress: null,
  heartbeat_is_round: true,
  key_label: null,
  key_last_seen_at: null,
  median_minutes: null,
}
const fmtWhen = (iso: string) => `at ${iso.slice(11, 16)}`

describe('the seven stops', () => {
  it('lights the first stop not done, in order', () => {
    const s = buildRobotStage({ ...base, plans_filed: false }, { bid_date_sent: null }, NOW)
    expect(s.lit).toBe('plans')
    expect(s.stops.map((x) => x.state)).toEqual(['now', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo'])
    expect(s.sentence).toBe('The robot is waiting for the plans.')
    const r = buildRobotStage(base, { bid_date_sent: null }, NOW)
    expect(r.lit).toBe('read')
    expect(r.sentence).toBe('The robot is reading the set. Last word 2m ago.')
    expect(r.inline).toBe('Robot · reading the set')
  })
  it('keeps fixtures closed until the run is sealed, even with a pull', () => {
    const counting = buildRobotStage({ ...base, read_at: '2026-10-30T19:08:00Z', fixtures_at: '2026-10-30T19:40:00Z', fixtures_found: 23, fixtures_sure: 21 }, { bid_date_sent: null }, NOW)
    expect(counting.lit).toBe('fixtures')
    expect(counting.fixturesOpen).toBe(false)
    expect(counting.sentence).toBe('The robot is counting. Its fixtures open when it seals its number, usually within the hour. Last word 2m ago.')
    expect(counting.inline).toBe('Robot · counting')
  })
  it('opens them once sealed and says what she can do', () => {
    const sealed = buildRobotStage({ ...base, read_at: '2026-10-30T19:08:00Z', fixtures_at: '2026-10-30T19:40:00Z', fixtures_found: 23, fixtures_sure: 21, locked_at: '2026-10-30T19:41:00Z' }, { bid_date_sent: null }, NOW, { fmtWhen })
    expect(sealed.lit).toBe('sent')
    expect(sealed.fixturesOpen).toBe(true)
    expect(sealed.stops.map((x) => x.state)).toEqual(['done', 'done', 'done', 'done', 'done', 'now', 'todo'])
    expect(sealed.stops[2]!.detail).toBe('23 found')
    expect(sealed.stops[3]!.detail).toBe('2 to look at')
    expect(sealed.stops[4]!.detail).toBe('at 19:41')
    expect(sealed.sentence).toBe('The robot’s fixtures are ready. 23 found, 21 sure. You can add the ones you want to your count.')
    expect(sealed.inline).toBe('Robot · fixtures ready · 23')
    expect(sealed.done).toBe(5)
  })
  it('counts what she took and set aside', () => {
    const taken = buildRobotStage({ ...base, read_at: '2026-10-30T19:08:00Z', fixtures_at: '2026-10-30T19:40:00Z', fixtures_found: 23, fixtures_sure: 21, fixtures_taken: 15, fixtures_set_aside: 2, locked_at: '2026-10-30T19:41:00Z', assisted_at: '2026-10-31T14:00:00Z' }, { bid_date_sent: null }, NOW)
    expect(taken.sentence).toBe('You took 15 of the robot’s 23 fixtures. 2 are set aside. Its number shows when you send.')
    expect(taken.inline).toBe('Robot · 15 of 23 fixtures on your count')
    expect(taken.assisted).toBe(true)
  })
  it('says when a sealed run wrote no fixtures down', () => {
    const old = buildRobotStage({ ...base, read_at: '2026-10-30T19:08:00Z', locked_at: '2026-10-30T19:41:00Z' }, { bid_date_sent: null }, NOW)
    expect(old.lit).toBe('fixtures')
    expect(old.stops[4]!.state).toBe('done')
    expect(old.sentence).toBe('The robot sealed its number before it could write its fixtures down. The Plans panel still has its schedules.')
  })
  it('sent, scored, assisted and void', () => {
    const sealedRow: RobotStageRow = { ...base, read_at: '2026-10-30T19:08:00Z', fixtures_at: '2026-10-30T19:40:00Z', fixtures_found: 23, fixtures_sure: 21, locked_at: '2026-10-30T19:41:00Z' }
    const sent = buildRobotStage(sealedRow, { bid_date_sent: '2026-11-04' }, NOW)
    expect(sent.lit).toBe('scored')
    expect(sent.sentence).toBe('Sent. The score lands the moment a bid value is on record.')
    const scored = buildRobotStage({ ...sealedRow, scored_at: '2026-11-04T16:00:00Z', assisted_at: '2026-10-31T14:00:00Z' }, { bid_date_sent: '2026-11-04' }, NOW)
    expect(scored.lit).toBeNull()
    expect(scored.done).toBe(7)
    expect(scored.sentence).toBe('Scored. You took robot fixtures on this bid, so its run sits beside the practice runs.')
    expect(scored.inline).toBe('Robot · scored · assisted')
    const voided = buildRobotStage({ ...base, run_status: 'void' }, { bid_date_sent: null }, NOW)
    expect(voided.void).toBe(true)
    expect(voided.lit).toBeNull()
    expect(voided.sentence).toBe('Set aside. The robot leaves this bid to you.')
  })
  it('takes the need’s words on the lit stop', () => {
    const blocked = buildRobotStage(base, { bid_date_sent: null }, NOW, { blockedWords: 'The robot cannot read this set. The pages are scans with no text.' })
    expect(blocked.sentence).toBe('The robot cannot read this set. The pages are scans with no text.')
  })
  it('every sentence reads plain', () => {
    const rows: RobotStageRow[] = [
      { ...base, plans_filed: false },
      base,
      { ...base, read_at: '2026-10-30T19:08:00Z' },
      { ...base, read_at: '2026-10-30T19:08:00Z', fixtures_at: '2026-10-30T19:40:00Z', fixtures_found: 23, fixtures_sure: 21, locked_at: '2026-10-30T19:41:00Z' },
      { ...base, read_at: '2026-10-30T19:08:00Z', fixtures_at: '2026-10-30T19:40:00Z', fixtures_found: 23, fixtures_sure: 21, fixtures_taken: 1, fixtures_set_aside: 1, locked_at: '2026-10-30T19:41:00Z' },
      { ...base, read_at: '2026-10-30T19:08:00Z', locked_at: '2026-10-30T19:41:00Z' },
      { ...base, read_at: '2026-10-30T19:08:00Z', locked_at: '2026-10-30T19:41:00Z', scored_at: '2026-11-04T16:00:00Z', assisted_at: '2026-10-31T14:00:00Z' },
      { ...base, run_status: 'void' },
    ]
    for (const r of rows) {
      for (const sent of [null, '2026-11-04']) {
        expect(plainWordsFailures(buildRobotStage(r, { bid_date_sent: sent }, NOW).sentence)).toEqual([])
      }
    }
    expect(ROBOT_STAGE_STOPS).toHaveLength(7)
  })
})
