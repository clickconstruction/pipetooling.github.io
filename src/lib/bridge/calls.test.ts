import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { buildScorecard, callChip, callForWeek, callVerdict, deskStatus, fridayAsks, heldStageFor, lastCallBefore, measureText, moveDone, scoreCall, streakFor, type BridgeCall } from './calls'
import { LINK_DESK } from './linkDesk'

const call = (p: Partial<BridgeCall> & { weekStart: string; link: BridgeCall['link'] }): BridgeCall => ({
  id: p.id ?? `${p.weekStart}-${p.link}`,
  weekStart: p.weekStart,
  calledOn: p.calledOn ?? p.weekStart,
  calledByName: p.calledByName ?? 'Todd',
  link: p.link,
  moves: p.moves ?? [],
  measures: p.measures ?? { linkWeeks: null, stageWeeks: {}, keys: {} },
  note: p.note ?? null,
  outcome: p.outcome ?? null,
  outcomeAt: p.outcomeAt ?? null,
  outcomeNote: p.outcomeNote ?? null,
})

const dayLabel = (ymd: string) => ymd

describe('bridge calls', () => {
  const calls = [
    call({ weekStart: '2026-09-27', link: 'decision' }),
    call({ weekStart: '2026-10-04', link: 'decision', calledOn: '2026-10-04' }),
    call({ weekStart: '2026-10-04', link: 'bill', calledOn: '2026-10-06', id: 'later' }),
    call({ weekStart: '2026-09-20', link: 'bill' }),
  ]

  it('the newest row stands for a week, and the week before it is last week', () => {
    expect(callForWeek(calls, '2026-10-04')!.id).toBe('later')
    expect(lastCallBefore(calls, '2026-10-11')!.id).toBe('later')
    expect(scoreCall(calls, '2026-10-11')!.id).toBe('later')
    expect(scoreCall(calls, '2026-10-04')!.id).toBe('later')
    expect(callForWeek(calls, '2026-10-11')).toBeNull()
  })

  it('counts the streak by distinct weeks on the same link', () => {
    const two = [call({ weekStart: '2026-09-27', link: 'decision' }), call({ weekStart: '2026-10-04', link: 'decision' })]
    expect(streakFor(two, two[1]!)).toBe(2)
    const broken = [call({ weekStart: '2026-09-20', link: 'bill' }), call({ weekStart: '2026-09-27', link: 'decision' }), call({ weekStart: '2026-10-04', link: 'decision' })]
    expect(streakFor(broken, broken[2]!)).toBe(2)
    expect(streakFor(calls, calls[0]!)).toBe(1)
  })

  it('reads done, part and no from the number then and now', () => {
    expect(moveDone(585, 585)).toBe('no')
    expect(moveDone(585, 400)).toBe('part')
    expect(moveDone(585, 200)).toBe('yes')
    expect(moveDone(0, 0)).toBe('yes')
    expect(moveDone(null, 3)).toBe('unknown')
    expect(measureText('bill', 233_000)).toBe('$233k')
    expect(measureText('approve', 585)).toBe('585h')
    expect(measureText('price', 1)).toBe('1 job')
    expect(measureText('pct', 36)).toBe('36 jobs')
  })

  it('the link moved when its weeks fell by a tenth; a recorded answer wins', () => {
    const c = call({ weekStart: '2026-10-04', link: 'bill', measures: { linkWeeks: 10.6, stageWeeks: { bill: 10.6 }, keys: {} } })
    expect(callVerdict(c, { stageWeeks: { bill: 10.0 }, keys: {} })).toBe('did_not_move')
    expect(callVerdict(c, { stageWeeks: { bill: 9.4 }, keys: {} })).toBe('moved')
    expect(callVerdict({ ...c, outcome: 'moved' }, { stageWeeks: { bill: 10.6 }, keys: {} })).toBe('moved')
    expect(callVerdict(call({ weekStart: '2026-10-04', link: 'decision' }), { stageWeeks: {}, keys: {} })).toBe('open')
  })

  it('with the pile on both readings, moved needs the pile to fall too', () => {
    const c = call({ weekStart: '2026-10-04', link: 'bill', measures: { linkWeeks: 10.6, linkPileUsd: 233_000, stageWeeks: { bill: 10.6 }, keys: {} } })
    // Weeks fell by a tenth but the pile grew: the window rolled a strong week in, nothing moved.
    expect(callVerdict(c, { stageWeeks: { bill: 9.4 }, stagePilesUsd: { bill: 240_000 }, keys: {} })).toBe('did_not_move')
    expect(callVerdict(c, { stageWeeks: { bill: 9.4 }, stagePilesUsd: { bill: 233_000 }, keys: {} })).toBe('did_not_move')
    expect(callVerdict(c, { stageWeeks: { bill: 9.4 }, stagePilesUsd: { bill: 210_000 }, keys: {} })).toBe('moved')
    // A call recorded before the pile was kept, or a reading without it, falls back to the weeks alone.
    expect(callVerdict(c, { stageWeeks: { bill: 9.4 }, keys: {} })).toBe('moved')
    const old = call({ weekStart: '2026-10-04', link: 'bill', measures: { linkWeeks: 10.6, stageWeeks: { bill: 10.6 }, keys: {} } })
    expect(callVerdict(old, { stageWeeks: { bill: 9.4 }, stagePilesUsd: { bill: 240_000 }, keys: {} })).toBe('moved')
  })

  it('a resource call holds the stage it throttled at call time; a stage call holds itself', () => {
    expect(heldStageFor(call({ weekStart: '2026-10-04', link: 'bill' }))).toBe('bill')
    expect(heldStageFor(call({ weekStart: '2026-10-04', link: 'decision', measures: { linkWeeks: null, throttles: 'collect', stageWeeks: {}, keys: {} } }))).toBe('collect')
    // A resource call recorded before the stage was kept holds nothing.
    expect(heldStageFor(call({ weekStart: '2026-10-04', link: 'decision' }))).toBeNull()
  })

  it('Friday asks from the fifth day until someone answers', () => {
    const c = call({ weekStart: '2026-10-04', link: 'bill' })
    expect(fridayAsks(c, '2026-10-08')).toBe(false)
    expect(fridayAsks(c, '2026-10-09')).toBe(true)
    expect(fridayAsks(c, '2026-10-13')).toBe(true)
    expect(fridayAsks({ ...c, outcome: 'did_not_move' }, '2026-10-13')).toBe(false)
  })

  it('builds the scorecard: moves then → now, the measure, the consequence by streak', () => {
    const prior = call({ weekStart: '2026-09-27', link: 'decision' })
    const c = call({
      weekStart: '2026-10-04',
      calledOn: '2026-10-03',
      link: 'decision',
      moves: [
        { key: 'approve', title: 'Approve the hours waiting on the schedule.', who: 'Todd', then: 585 },
        { key: 'price', title: 'Price the unpriced jobs this week.', who: 'Todd', then: 2 },
      ],
      measures: { linkWeeks: null, stageWeeks: {}, keys: { approve: 585, price: 2 } },
      outcome: 'did_not_move',
    })
    const card = buildScorecard({ call: c, calls: [prior, c], now: { stageWeeks: {}, keys: { approve: 585, price: 2 } }, todayYmd: '2026-10-11', dayLabel })
    expect(card.linkName).toBe('Decision')
    expect(card.calledLabel).toBe('called 2026-10-03 by Todd')
    expect(card.streakText).toBe('2nd week running')
    expect(card.verdictText).toBe('did not move')
    expect(card.moves[0]).toEqual({ title: 'Approve the hours waiting on the schedule.', who: 'Todd', thenText: '585h', nowText: '585h', done: 'no' })
    expect(card.measure).toBeNull()
    expect(card.consequence).toBe('Second week on Decision with nothing moved. The moves sat with one person. This week either the moves get other owners, or the call changes.')
    expect(callChip(card)).toEqual({ text: 'last call: Decision · did not move', tone: 'red' })

    const three = buildScorecard({ call: c, calls: [call({ weekStart: '2026-09-20', link: 'decision' }), prior, c], now: { stageWeeks: {}, keys: {} }, todayYmd: '2026-10-11', dayLabel })
    expect(three.consequence).toContain('3 weeks on Decision with nothing moved. Exploiting has not worked.')

    const bill = call({ weekStart: '2026-10-11', calledOn: '2026-10-11', link: 'bill', moves: [{ key: 'bill', title: 'Bill the finished work.', who: 'Taunya', then: 233_000 }], measures: { linkWeeks: 10.6, stageWeeks: { bill: 10.6 }, keys: { bill: 233_000 } } })
    const open = buildScorecard({ call: bill, calls: [bill], now: { stageWeeks: { bill: 10.4 }, keys: { bill: 180_000 } }, todayYmd: '2026-10-13', dayLabel })
    expect(open.verdict).toBe('did_not_move')
    expect(open.measure).toEqual({ then: '10.6 weeks', now: '10.4 weeks' })
    expect(open.moves[0]!.done).toBe('part')
    expect(open.fridayAsks).toBe(false)
    const friday = buildScorecard({ call: bill, calls: [bill], now: { stageWeeks: { bill: 9.0 }, keys: { bill: 90_000 } }, todayYmd: '2026-10-16', dayLabel })
    expect(friday.verdict).toBe('moved')
    expect(friday.fridayAsks).toBe(true)
    expect(callChip(friday)).toEqual({ text: 'Friday: did Bill move?', tone: 'amber' })
  })

  it('words the desk status', () => {
    expect(deskStatus({ link: 'bill', nominatedId: 'bill', linkId: 'bill', heldStands: false, recorded: false })).toBe('nominated by the page: the most weeks to clear what is already waiting')
    expect(deskStatus({ link: 'bill', nominatedId: 'build', linkId: 'bill', heldStands: true, recorded: false })).toBe('the call holds it this week')
    expect(deskStatus({ link: 'bill', nominatedId: 'bill', linkId: 'bill', heldStands: false, recorded: true })).toBe('recorded as the link this week')
    expect(deskStatus({ link: 'decision', nominatedId: 'bill', linkId: 'bill', heldStands: false, recorded: false })).toBe('a resource; it throttles a link or shows its symptom')
  })

  it('keeps the desk and the consequences in plain words', () => {
    for (const [link, d] of Object.entries(LINK_DESK)) {
      for (const text of [d.what, d.why, d.how, ...d.moves.map((m) => m.title)]) expect(plainWordsFailures(text), `${link}: ${text}`).toEqual([])
    }
  })
})
