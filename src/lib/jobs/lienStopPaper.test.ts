import { describe, expect, it } from 'vitest'
import { lienClosedNoticeStopNote, lienStopPaperKind, lienStopRuleCite, lienStopWindowWords } from './lienStopPaper'
import { buildLienTimeline, type LienTimelineInput, type LienTimelineStep } from './lienTimeline'

const step = (partial: Partial<LienTimelineStep> & Pick<LienTimelineStep, 'kind'>): LienTimelineStep => ({
  key: partial.kind,
  cite: '',
  label: partial.kind,
  date: '',
  dateWords: '',
  state: 'due',
  words: '',
  daysLeft: null,
  door: null,
  ...partial,
})

describe('lienStopPaper', () => {
  it('says which paper each stop sends, and which stops send none', () => {
    expect(lienStopPaperKind(step({ kind: 'notice' }))).toBe('notice')
    expect(lienStopPaperKind(step({ kind: 'retainage' }))).toBe('retainage')
    expect(lienStopPaperKind(step({ kind: 'affidavit' }))).toBe('affidavit')
    expect(lienStopPaperKind(step({ kind: 'serve' }))).toBe('serve')
    expect(lienStopPaperKind(step({ kind: 'release' }))).toBe('release')
    expect(lienStopPaperKind(step({ kind: 'demand' }))).toBe('demand')
    for (const kind of ['last_work', 'hold', 'suit'] as const) expect(lienStopPaperKind(step({ kind }))).toBe('none')
  })

  it('points each stop at the rule the guide has a row for', () => {
    expect(lienStopRuleCite(step({ kind: 'last_work' }))).toBe('§ 53.003')
    expect(lienStopRuleCite(step({ kind: 'notice' }))).toBe('§ 53.056')
    expect(lienStopRuleCite(step({ kind: 'affidavit' }))).toBe('§ 53.052')
    expect(lienStopRuleCite(step({ kind: 'serve' }))).toBe('§ 53.052')
    expect(lienStopRuleCite(step({ kind: 'release' }))).toBe('§ 53.152')
    expect(lienStopRuleCite(step({ kind: 'demand' }))).toBe('§ 38.001')
    for (const kind of ['retainage', 'hold', 'suit'] as const) expect(lienStopRuleCite(step({ kind }))).toBeNull()
  })

  it('names a notice by its month, or by every month the draft carries, and says they share one notice', () => {
    const jul = step({ kind: 'notice', label: '§ 53.056 · Jul', monthKey: '2026-07', dateWords: 'Oct 15', words: '8 days · to draft', opensWords: 'open since Aug 1' })
    expect(lienStopWindowWords({ step: jul })).toEqual({ eyebrow: '§ 53.056 · Jul', title: 'The Jul notice', line: 'open since Aug 1 · Oct 15 · 8 days · to draft', noPaper: null })
    const both = lienStopWindowWords({ step: jul, noticeMonths: ['2026-08', '2026-07'] })
    expect(both.title).toBe('The July and August 2026 notice')
    expect(both.line).toBe('July and August 2026 go on one notice. Its day is Jul’s: open since Aug 1 · Oct 15 · 8 days · to draft.')
    // A month the draft does not carry keeps its own name.
    expect(lienStopWindowWords({ step: jul, noticeMonths: ['2026-09'] }).title).toBe('The Jul notice')
  })

  it('a stop with no paper of ours gets the words that stand in for the page', () => {
    const suit = lienStopWindowWords({ step: step({ kind: 'suit', label: '§ 53.158 suit', dateWords: 'Dec 15, 2027', words: 'or a release when paid' }) })
    expect(suit.title).toBe('Counsel’s filing, not our paper')
    expect(suit.line).toBe('Dec 15, 2027 · or a release when paid')
    expect(suit.noPaper?.who).toContain('Counsel')
    const last = lienStopWindowWords({ step: step({ kind: 'last_work', label: 'Last work', dateWords: 'Aug 2026', words: 'clock hours' }) })
    expect(last.title).toBe('The last day of work')
    expect(last.noPaper?.after).toBe('Change it and every stop after it moves.')
    expect(lienStopWindowWords({ step: step({ kind: 'hold', dateWords: '—' }) }).line).toBe('')
    expect(lienStopWindowWords({ step: step({ kind: 'affidavit' }) }).noPaper).toBeNull()
    expect(lienStopWindowWords({ step: step({ kind: 'serve', dateWords: '+5 days', words: 'after filing' }) }).line).toBe('A copy of the filed affidavit to the owner and the GC within five days of filing. +5 days · after filing')
  })

  // v2.4708's rule, read off the clock itself: a sub job whose July window closed Sep 15 with nothing sent, the affidavit's day Oct 15.
  const closedJob = (todayYmd: string): LienTimelineInput => ({
    todayYmd,
    isSub: true,
    propertyKind: 'residential',
    lastMonth: '2026-07',
    lastMonthFromCreation: false,
    months: [{ key: '2026-07', deadline: '2026-09-15', fromCreation: false, outcome: 'missed', at: '' }],
    noticeState: '',
    retainage: null,
    affidavit: null,
    originalContractCompletedOn: null,
    releasedAt: null,
    paid: false,
  })

  it('a closed notice stop says a late notice can still go while the affidavit’s window is open, and that the right is gone only after it (v2.8170)', () => {
    const late = buildLienTimeline(closedJob('2026-10-06'))
    expect(late.next.kind).toBe('late_notice')
    expect(late.lienGone).toBe(false)
    expect(lienClosedNoticeStopNote(late.next)).toBe('The window closed with nothing sent. A late notice can still go, and the affidavit can follow it.')
    expect(lienClosedNoticeStopNote(late.next)).not.toContain('gone')
    // The affidavit's last day itself is still inside the window.
    expect(lienClosedNoticeStopNote(buildLienTimeline(closedJob('2026-10-15')).next)).toContain('A late notice can still go')
    const gone = buildLienTimeline(closedJob('2026-10-20'))
    expect(gone.next.kind).toBe('lien_gone')
    expect(lienClosedNoticeStopNote(gone.next)).toBe('The window closed with nothing sent. The lien right on that work is gone; the money is still owed.')
    // A job with a month still open, and a window with no timeline, keep the old sentence for a month that closed.
    expect(lienClosedNoticeStopNote({ kind: 'notice' })).toContain('The lien right on that work is gone')
    expect(lienClosedNoticeStopNote(null)).toContain('The lien right on that work is gone')
  })
})
