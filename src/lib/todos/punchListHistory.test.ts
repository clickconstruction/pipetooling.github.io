/** The punch list's burndown rules (`punchListHistory.ts`) and the git replay behind them (`scripts/todos/readTodoHistory.ts`). */
import { describe, expect, it } from 'vitest'
import {
  axisTicks,
  cardsFromDocs,
  chartPoints,
  heldCount,
  historyFromStates,
  hourlyRows,
  packHistory,
  paceOver,
  pointsForSize,
  rangeLabel,
  rangeWords,
  rowsInRange,
  slowestStageWords,
  stageRows,
  takeawayWords,
  unpackHistory,
  waveBins,
  waveHours,
  type HistoryCard,
  type HistoryState,
} from './punchListHistory'
import { isTodoDocPath, parseBatch, parseRawLog, statesFromCommits } from '../../../scripts/todos/readTodoHistory'

const HOUR = 3600
/** 2026-11-02 06:00 UTC, midnight on the app calendar. */
const T0 = Date.UTC(2026, 10, 2, 6) / 1000
const card = (n: number, g: HistoryCard['g'], p: number): HistoryCard => ({ n, g, p })

/** Four boards over three hours: two cards, a third arrives, one moves on and grows, one closes. */
const states: HistoryState[] = [
  { t: T0 + 600, cards: [card(1, 'ready', 2), card(2, 'gated', 8)] },
  { t: T0 + HOUR + 60, cards: [card(1, 'ready', 2), card(2, 'gated', 8), card(3, 'ready', 4)] },
  { t: T0 + HOUR + 120, cards: [card(1, 'close', 4), card(2, 'gated', 8), card(3, 'ready', 4)] },
  { t: T0 + 2 * HOUR + 60, cards: [card(1, 'close', 4), card(3, 'ready', 4)] },
]
const events = historyFromStates(states)
const NOW = (T0 + 3 * HOUR + 1800) * 1000

describe('pointsForSize', () => {
  it('weighs a card by the letter its size words leave, and a card with no letter as a middling one', () => {
    expect(pointsForSize('XS (two live steps)')).toBe(1)
    expect(pointsForSize('L as a train of six (M · M · S); left: PR 7 (S)')).toBe(2)
    expect(pointsForSize('XL')).toBe(16)
    expect(pointsForSize('a sitting')).toBe(4)
  })

  it('leaves a pointer card out of the open cards', () => {
    const doc = (number: number, pointer: boolean) => ({ meta: { name: 'n', number, group: 'ready' as const, status: 's', summary: 's', next: 'n', size: 'M', blocker: 'b', ver: '', opinion: '', pointer, flagged: false, mockupNotRequired: '' } })
    expect(cardsFromDocs([doc(1, false), doc(2, true)])).toEqual([{ n: 1, g: 'ready', p: 4 }])
  })
})

describe('historyFromStates', () => {
  it('reads each board against the one before it', () => {
    expect(events.map((e) => [e.open, e.pts, e.added, e.closed, e.addedPts, e.burnedPts])).toEqual([
      [2, 10, 0, 0, 0, 0],
      [3, 14, 1, 0, 4, 0],
      [3, 16, 0, 0, 2, 0],
      [2, 8, 0, 1, 0, 8],
    ])
  })

  it('counts a card that moved on, and one that closed, as leaving its stage', () => {
    expect(events[2]!.left).toEqual([1, 0, 0, 0, 0])
    expect(events[3]!.left).toEqual([0, 0, 1, 0, 0])
    expect(events[3]!.byGroup).toEqual([1, 1, 0, 0, 0])
  })

  it('survives the build: packed to rows of numbers and back', () => {
    const history = { shallow: false, events }
    expect(unpackHistory(packHistory(history))).toEqual(history)
    expect(packHistory(history).rows[0]).toHaveLength(22)
    expect(unpackHistory(null).events).toEqual([])
  })
})

describe('hourlyRows', () => {
  const rows = hourlyRows(events, NOW)

  it('reads the board at the end of each hour, and marks the hour in progress', () => {
    expect(rows.map((r) => [r.open, r.added, r.closed, r.partial])).toEqual([
      [2, 0, 0, false],
      [3, 1, 0, false],
      [2, 0, 1, false],
      [2, 0, 0, true],
    ])
    expect(rows[3]!.end).toBe(NOW)
    expect(hourlyRows([], NOW)).toEqual([])
  })

  it('reads a pace over whole hours only, and says when the list clears', () => {
    const pace = paceOver(rows, 'all', 'cards')!
    expect([pace.hours, pace.closed, pace.added, pace.open, pace.change]).toEqual([3, 1, 1, 2, 0])
    expect(pace.closedPerDay).toBe(8)
    expect(pace.daysNoNew).toBe(1)
    expect(pace.daysAtPace).toBeNull()
    const points = paceOver(rows, 'all', 'points')!
    expect([points.closed, points.added, points.open]).toEqual([8, 6, 8])
    expect(points.netPerDay).toBe(-16)
    expect(points.daysAtPace).toBe(1)
    expect(paceOver([], '7d', 'cards')).toBeNull()
  })

  it('draws the hours, then each projection to where it reaches zero or the edge', () => {
    const pace = paceOver(rows, 'all', 'cards')!
    const points = chartPoints(rows, 'all', 'cards', pace)
    expect(points.slice(0, 4).map((p) => p.open)).toEqual([2, 3, 2, 2])
    expect(points[3]).toMatchObject({ noNew: 2, atPace: 2 })
    const last = points[points.length - 1]!
    expect(last.open).toBeNull()
    expect(last.atPace).toBe(2)
    expect(points.some((p) => p.noNew === 0)).toBe(true)
  })

  it('keeps the rows whose end falls inside a stretch', () => {
    const long = hourlyRows(historyFromStates([{ t: T0, cards: [card(1, 'ready', 2)] }]), (T0 + 30 * HOUR) * 1000)
    expect(rowsInRange(long, '24h')).toHaveLength(24)
    expect(rowsInRange(long, 'all')).toHaveLength(long.length)
  })

  it('bins what came in and what closed by the app calendar', () => {
    expect(waveBins(rows, 'all', 'cards', 1).map((b) => [b.added, b.closed])).toEqual([[0, 0], [1, 0], [0, 1], [0, 0]])
    const day = waveBins(rows, 'all', 'points', 24)
    expect(day).toHaveLength(1)
    expect(day[0]).toMatchObject({ added: 6, closed: 8, partial: true })
    expect([waveHours('24h', 0), waveHours('7d', 0), waveHours('14d', 0), waveHours('all', 60), waveHours('all', 900)]).toEqual([1, 3, 6, 1, 24])
  })

  it('drains a stage by every card that left it', () => {
    const now = states[3]!.cards
    const stages = stageRows(rows, now, 'all', 'cards')
    expect(stages.map((s) => [s.group, s.cards, s.left, s.days])).toEqual([
      ['ready', 1, 1, 1],
      ['close', 1, 0, null],
      ['gated', 0, 1, null],
      ['waiting', 0, 0, null],
      ['residual', 0, 0, null],
    ])
    expect(stages[0]!.line).toEqual([1, 1, 1, 1])
    expect(slowestStageWords(stages, 'all', rows[0]!.start, NOW)).toBe(
      'At the rate cards left each stage since Nov 2, the last to clear is Ready to build, in 1 days, about Nov 3. No card left Close out since Nov 2, so that stage has no rate yet.',
    )
    expect(heldCount([card(1, 'gated', 2), card(2, 'waiting', 2), card(3, 'ready', 2)])).toBe(2)
  })

  it('says what the stretch did in plain sentences', () => {
    const words = takeawayWords({ cards: paceOver(rows, 'all', 'cards')!, points: paceOver(rows, 'all', 'points')!, held: 1, firstMs: rows[0]!.start, nowMs: NOW })
    expect(words).toEqual([
      '2 cards are open, 8 points of work.',
      'Since Nov 2 1 card closed and 1 new ones came in, so the list is holding level.',
      'With no new cards it clears by Nov 3.',
      'At this pace it does not clear, because new cards arrive as fast as old ones close.',
      '1 card wait on an owner decision or on time, so building alone cannot clear them.',
    ])
    expect(rangeLabel('7d', null)).toBe('The last 7 days')
    expect(rangeWords('7d', null)).toBe('in the last 7 days')
  })

  it('puts the ticks on the app calendar', () => {
    const ticks = axisTicks(T0 * 1000, (T0 + 24 * HOUR) * 1000)
    expect(ticks).toEqual([0, 6, 12, 18, 24].map((h) => (T0 + h * HOUR) * 1000))
    expect(axisTicks(T0 * 1000 + 1, (T0 + 5 * 24 * HOUR) * 1000)).toHaveLength(5)
  })
})

describe('the git replay', () => {
  const fm = (number: number, group: string, size: string, extra = '') =>
    `---\nname: A card\nnumber: ${number}\ngroup: ${group}\nstatus: open\nsummary: s\nnext: n\nsize: ${size}\nblocker: none\n${extra}---\n\nBody.\n`
  const A = 'a'.repeat(40)
  const B = 'b'.repeat(40)
  const C = 'c'.repeat(40)
  const OLD = 'd'.repeat(40)
  const texts = new Map([
    [A, fm(1, 'ready', 'S')],
    [B, fm(2, 'gated', 'L')],
    [C, fm(1, 'close', 'M')],
    [OLD, '# An old to-do\n\nStatus: built.\n'],
  ])

  it('knows a to-do file from the folder\'s other files', () => {
    expect(isTodoDocPath('to-dos/a.md')).toBe(true)
    expect(isTodoDocPath('to-dos/a/README.md')).toBe(true)
    expect(isTodoDocPath('to-dos/README.md')).toBe(false)
    expect(isTodoDocPath('to-dos/a/mockup.html')).toBe(false)
    expect(isTodoDocPath('to-dos/a/notes/README.md')).toBe(false)
    expect(isTodoDocPath('docs/a.md')).toBe(false)
  })

  it('cuts git log --raw into commits and the to-do files each set or removed', () => {
    const zero = '0'.repeat(40)
    const log = [
      `\0${'1'.repeat(40)} 100\n`,
      `:000000 100644 ${zero} ${OLD} A\tto-dos/a.md`,
      `:000000 100644 ${zero} ${B} A\tto-dos/README.md`,
      `\0${'2'.repeat(40)} 200\n`,
      `:100644 100644 ${OLD} ${A} M\tto-dos/a.md`,
      `:000000 100644 ${zero} ${B} A\tto-dos/b/README.md`,
      `:000000 100644 ${zero} ${B} A\tto-dos/b/mockup.html`,
      `\0${'3'.repeat(40)} 300\n`,
      `:100644 100644 ${A} ${C} M\tto-dos/a.md`,
      `:100644 000000 ${B} ${zero} D\tto-dos/b/README.md`,
    ].join('\n')
    const commits = parseRawLog(log)
    expect(commits.map((c) => [c.t, c.changes.length])).toEqual([[100, 1], [200, 2], [300, 2]])
    expect(commits[2]!.changes).toEqual([['to-dos/a.md', C], ['to-dos/b/README.md', null]])

    const built = statesFromCommits(commits, (blob) => texts.get(blob))
    expect(built).toEqual([
      { t: 200, cards: [{ n: 1, g: 'ready', p: 2 }, { n: 2, g: 'gated', p: 8 }] },
      { t: 300, cards: [{ n: 1, g: 'close', p: 4 }] },
    ])
  })

  it('reads a batch of blobs back by id', () => {
    const one = 'héllo\n'
    const buf = Buffer.concat([Buffer.from(`${A} blob ${Buffer.byteLength(one)}\n${one}\n`), Buffer.from(`${B} missing\n`), Buffer.from(`${C} blob 2\nok\n`)])
    expect(parseBatch(buf)).toEqual(new Map([[A, one], [C, 'ok']]))
  })
})
