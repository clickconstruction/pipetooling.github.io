import { describe, expect, it } from 'vitest'
import { lienAffidavitNoticeTag, lienDayLeftWords, lienHeadDay, lienRowLine, lienDeskDeadlineWords } from './lienRowWords'

describe('lienRowLine', () => {
  it('the Board’s bin first, then the one thing to know; a stage that says it all stands alone', () => {
    expect(lienRowLine({ kind: 'notice', sub: 'Notice to send', detail: 'September 2026' }, { stage: 'To send for Master approval' })).toEqual({ stage: 'To send for Master approval', detail: 'September 2026', tags: [] })
    expect(lienRowLine({ kind: 'affidavit', sub: 'Affidavit approved · ready to file', detail: '' }, { stage: 'Ready to file' })).toEqual({ stage: 'Ready to file', detail: '', tags: [] })
    // The detail never repeats the stage.
    expect(lienRowLine({ kind: 'notice', sub: 'Held', detail: 'held' }, { stage: 'Held' }).detail).toBe('')
  })

  it('with no detail of its own a row under a bin keeps its words after it', () => {
    expect(lienRowLine({ kind: 'notice', sub: 'Approved · to print · offer 2%' }, { stage: 'Approved · to print' })).toEqual({ stage: 'Approved · to print', detail: 'Approved · to print · offer 2%', tags: [] })
  })

  it('a row with no bin keeps its words as they were', () => {
    expect(lienRowLine({ kind: 'retainage', sub: 'Retainage notice to send', detail: 'ignored' }, { stage: null })).toEqual({ stage: null, detail: 'Retainage notice to send', tags: [] })
  })

  it('an affidavit row carries where its notice stands; a notice row never does', () => {
    const notice = { tone: 'ok' as const, words: 'Notice sent Oct 14' }
    expect(lienRowLine({ kind: 'affidavit', sub: 'x', detail: '' }, { stage: 'Ready to file', notice }).tags).toEqual([notice])
    expect(lienRowLine({ kind: 'notice', sub: 'x', detail: '' }, { stage: 'To send for Master approval', notice }).tags).toEqual([])
    expect(lienRowLine({ kind: 'affidavit', sub: 'Lien filed · not yet served' }, { stage: null, notice }).tags).toEqual([notice])
  })
})

describe('lienAffidavitNoticeTag', () => {
  it('a job contracted with the owner needs no notice, and says so', () => {
    expect(lienAffidavitNoticeTag({ isSub: false, noticed: false, sentOn: [] })).toEqual({ tone: 'none', words: 'No notice needed · contracted with the owner' })
  })

  it('a notice on record says the day it went: one, two, three, then the count and the last', () => {
    expect(lienAffidavitNoticeTag({ isSub: true, noticed: true, sentOn: ['2026-10-14'] }).words).toBe('Notice sent Oct 14')
    expect(lienAffidavitNoticeTag({ isSub: true, noticed: true, sentOn: ['2026-10-14', '2026-09-22', '2026-10-14T12:00:00Z'] })).toEqual({ tone: 'ok', words: 'Notice sent Sep 22 and Oct 14' })
    expect(lienAffidavitNoticeTag({ isSub: true, noticed: true, sentOn: ['2026-08-14', '2026-09-22', '2026-10-14'] }).words).toBe('Notice sent Aug 14, Sep 22 and Oct 14')
    expect(lienAffidavitNoticeTag({ isSub: true, noticed: true, sentOn: ['2026-07-14', '2026-08-14', '2026-09-22', '2026-10-14'] }).words).toBe('4 notices sent · the last Oct 14')
    // Recorded with no day the desk can read.
    expect(lienAffidavitNoticeTag({ isSub: true, noticed: true, sentOn: [] }).words).toBe('Notice on record')
  })

  it('none on record on a job that needs one is the warning', () => {
    expect(lienAffidavitNoticeTag({ isSub: true, noticed: false, sentOn: ['2026-10-14'] })).toEqual({ tone: 'warn', words: 'No notice on record' })
  })

  it('with the notice’s standing the warning says where it stands; the late notice and a missing standing keep *No notice on record*', () => {
    const tag = (standing: Parameters<typeof lienAffidavitNoticeTag>[0]['standing']) => lienAffidavitNoticeTag({ isSub: true, noticed: false, sentOn: [], standing })
    expect(tag('approved')).toEqual({ tone: 'warn', words: 'Notice approved · not mailed yet' })
    expect(tag('printed').words).toBe('Notice printed · not mailed yet')
    expect(tag('awaiting').words).toBe('Notice awaiting approval')
    expect(tag('to_send').words).toBe('Notice not sent for approval yet')
    expect(tag('held').words).toBe('Notice held')
    expect(tag('needs_owner').words).toBe('Notice needs the owner')
    expect(tag('unrecorded').words).toBe('Notice sent · no mailing on record')
    expect(tag('late').words).toBe('No notice on record')
    expect(tag(null).words).toBe('No notice on record')
    // A standing that says the gate is open never overrules the gate itself.
    expect(tag('on_record').words).toBe('No notice on record')
    // On record, the days still lead whatever the newest notice is doing.
    expect(lienAffidavitNoticeTag({ isSub: true, noticed: true, sentOn: ['2026-10-14'], standing: 'on_record' }).words).toBe('Notice sent Oct 14')
  })
})

describe('lienHeadDay', () => {
  const r = (dueOn: string | null, daysLeft: number | null = null) => ({ dueOn, daysLeft })

  it('is the one day every dated row shares, with how long is left', () => {
    expect(lienHeadDay([r('2026-11-16', 1), r('2026-11-16', 1), r(null)])).toEqual({ dueOn: '2026-11-16', daysLeft: 1, words: 'due Mon Nov 16 · 1 day left' })
    expect(lienHeadDay([r('2026-11-15', 0)])!.words).toBe('due Sun Nov 15 · today')
    expect(lienHeadDay([r('2026-11-10', -5)])!.words).toBe('due Tue Nov 10 · 5 days late')
  })

  it('is none when the rows have two days, or none of them is dated', () => {
    expect(lienHeadDay([r('2026-11-16', 1), r('2026-12-15', 30)])).toBeNull()
    expect(lienHeadDay([r(null), r(null)])).toBeNull()
    expect(lienHeadDay([])).toBeNull()
  })

  it('the words for how far a day is', () => {
    expect([lienDayLeftWords(3), lienDayLeftWords(1), lienDayLeftWords(0), lienDayLeftWords(-1), lienDayLeftWords(-4)]).toEqual(['3 days left', '1 day left', 'today', '1 day late', '4 days late'])
  })
})

describe('lienDeskDeadlineWords (out of LienDesk.tsx, v2.7608)', () => {
  const row = (daysLeft: number | null, earliestDeadline: string | null = '2026-12-15', missedMonths: string[] = []) => ({ daysLeft, earliestDeadline, missedMonths })
  it('counts down inside two weeks', () => {
    expect(lienDeskDeadlineWords(row(0))).toBe('due today')
    expect(lienDeskDeadlineWords(row(1))).toBe('due tomorrow')
    expect(lienDeskDeadlineWords(row(2))).toBe('due in 2d')
    expect(lienDeskDeadlineWords(row(14))).toBe('due in 14d')
  })
  it('past two weeks names the day', () => {
    expect(lienDeskDeadlineWords(row(15))).toMatch(/^by /)
    expect(lienDeskDeadlineWords(row(15))).not.toContain('due')
  })
  it('a day already past is a closed window', () => {
    expect(lienDeskDeadlineWords(row(-1))).toBe('window closed')
  })
  it('with no day left, months already missed read as a closed window and nothing else says nothing', () => {
    expect(lienDeskDeadlineWords(row(null, null, ['2026-08']))).toBe('window closed')
    expect(lienDeskDeadlineWords(row(null, null))).toBe('')
    expect(lienDeskDeadlineWords(row(5, null))).toBe('')
  })
})
