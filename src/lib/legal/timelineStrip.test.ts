import { describe, expect, it } from 'vitest'
import type { LegalTimelineItem } from './legalTimeline'
import { STRIP_DOTS_PER_DAY, STRIP_MAX_DAYS, stripDotOf, timelineCountChips, timelineStrip } from './timelineStrip'

const TODAY = '2026-10-29'

function item(over: Partial<LegalTimelineItem> & { key: string; ymd: string }): LegalTimelineItem {
  return {
    lane: 'planned', kind: 'plan', entryKind: null, entryId: null, documentId: null, what: over.key, kindWords: '', notes: '', amount: null, byName: '', source: 'office', viaPortal: false,
    state: 'planned', stateWords: '', plannedYmd: null, doneYmd: null, held: false, heldReason: '', voided: false, voidReason: '', isLivePlan: true, documents: [], serves: null, deadlineKey: null, deadlineJobId: null, documentChip: '',
    ...over,
  }
}

describe('timelineStrip — the Timeline as a strip of days (v2.6107)', () => {
  it('each item draws the dot its kind and state call for; an undone one draws nothing', () => {
    expect(stripDotOf(item({ key: 'a', ymd: TODAY, kind: 'plan', state: 'overdue' }))).toBe('late')
    expect(stripDotOf(item({ key: 'a', ymd: TODAY, kind: 'deadline', lane: 'paper' }))).toBe('deadline')
    expect(stripDotOf(item({ key: 'a', ymd: TODAY, kind: 'plan', state: 'done' }))).toBe('done')
    expect(stripDotOf(item({ key: 'a', ymd: TODAY, kind: 'plan', state: 'planned' }))).toBe('planned')
    expect(stripDotOf(item({ key: 'a', ymd: TODAY, kind: 'document', lane: 'paper', state: 'happened' }))).toBe('paper')
    expect(stripDotOf(item({ key: 'a', ymd: TODAY, kind: 'said', lane: 'said', state: 'happened' }))).toBe('said')
    expect(stripDotOf(item({ key: 'a', ymd: TODAY, kind: 'event', lane: 'did', state: 'happened' }))).toBe('did')
    expect(stripDotOf(item({ key: 'a', ymd: TODAY, kind: 'plan', state: 'undone', voided: true }))).toBeNull()
  })

  it('runs from two weeks before today to the last item in reach, one column a day, today marked, Mondays labelled', () => {
    const strip = timelineStrip({ past: [item({ key: 'p', ymd: '2026-10-21', kind: 'plan', state: 'done' })], today: [], upcoming: [item({ key: 'n', ymd: '2026-11-13' }), item({ key: 'd', ymd: '2026-12-15', kind: 'deadline', lane: 'paper' })] }, TODAY)
    expect(strip.startYmd).toBe('2026-10-15')
    expect(strip.endYmd).toBe('2026-12-15')
    expect(strip.days.length).toBe(62)
    expect(strip.days.find((d) => d.today)?.ymd).toBe(TODAY)
    expect(strip.days.find((d) => d.ymd === '2026-10-21')?.dots).toEqual(['done'])
    expect(strip.days.find((d) => d.ymd === '2026-11-13')?.dots).toEqual(['planned'])
    expect(strip.days.find((d) => d.ymd === '2026-12-15')?.dots).toEqual(['deadline'])
    // Nov 1 is a Sunday, a day before a Monday, so it carries no label of its own.
    expect(strip.days.filter((d) => d.label).map((d) => d.label).slice(0, 4)).toEqual(['Oct 19', 'Oct 26', 'Nov 2', 'Nov 9'])
    expect(strip.days.find((d) => d.ymd === '2026-10-31')?.weekend).toBe(true)
    expect(strip.words).toBe('62 days, Oct 15 to Dec 15, one column a day. 1 lien-clock deadline as diamonds. Press a day to jump to it.')
  })

  it('a busy day shows the dots that matter first and says how many more it holds', () => {
    const day = '2026-10-22'
    const many = ['paper', 'paper', 'paper', 'said', 'did'].map((k, i) => item({ key: `${k}${i}`, ymd: day, kind: k === 'paper' ? 'document' : k === 'said' ? 'said' : 'event', lane: k === 'paper' ? 'paper' : k === 'said' ? 'said' : 'did', state: 'happened' }))
    const strip = timelineStrip({ past: [...many, item({ key: 'late', ymd: day, state: 'overdue' })], today: [], upcoming: [] }, TODAY)
    const cell = strip.days.find((d) => d.ymd === day)!
    expect(cell.count).toBe(6)
    expect(cell.dots.length).toBe(STRIP_DOTS_PER_DAY)
    expect(cell.dots).toEqual(['late', 'did', 'paper', 'paper'])
    expect(cell.more).toBe(2)
    expect(strip.words).toContain('1 overdue step as red rings.')
  })

  it('a deadline a year out never stretches the strip, and a long span keeps today in view inside the cap', () => {
    const suit = item({ key: 'suit', ymd: '2027-12-15', kind: 'deadline', lane: 'paper' })
    const near = timelineStrip({ past: [], today: [], upcoming: [suit] }, TODAY)
    expect(near.endYmd).toBe('2026-11-12')
    const long = timelineStrip({ past: [item({ key: 'old', ymd: '2026-03-01', kind: 'plan', state: 'done' })], today: [], upcoming: [item({ key: 'far', ymd: '2027-02-01' })] }, TODAY)
    expect(long.days.length).toBe(STRIP_MAX_DAYS)
    expect(long.days.some((d) => d.today)).toBe(true)
  })

  it('the counts read as chips with numbers, nothing for a zero', () => {
    expect(timelineCountChips({ planned: 7, overdue: 2, dueToday: 0, done: 10, held: 0, deadlines: 3 })).toEqual([
      { key: 'planned', text: 'planned 7', tone: 'neutral' },
      { key: 'overdue', text: 'overdue 2', tone: 'stop' },
      { key: 'done', text: 'done 10', tone: 'ok' },
      { key: 'deadlines', text: '◆ deadlines 3', tone: 'warn' },
    ])
    expect(timelineCountChips({ planned: 0, overdue: 0, dueToday: 1, done: 0, held: 2, deadlines: 0 })).toEqual([{ key: 'dueToday', text: 'due today 1', tone: 'warn' }])
  })
})
