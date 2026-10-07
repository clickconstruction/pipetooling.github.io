import { describe, expect, it } from 'vitest'
import { buildLienPayRunway, daysBetweenYmd, lienByForJob, lienRunwayWantsTheChip, type LienRunwayInput } from './lienPayRunway'

// Today is Monday 2026-09-28 throughout.
function input(over: Partial<LienRunwayInput> = {}): LienRunwayInput {
  return {
    todayYmd: '2026-09-28',
    openBalance: 8200,
    lastWorkYmd: '2026-07-20',
    propertyKind: 'residential',
    expectedPayYmd: null,
    filedYmd: null,
    releasedYmd: null,
    ...over,
  }
}

describe('lienByForJob', () => {
  it('residential: the 15th of the 3rd month after the last work month', () => {
    expect(lienByForJob('2026-07-20', 'residential')).toEqual({ ymd: '2026-10-15', kindAssumed: false })
  })
  it('commercial: the 4th month, weekend-rolled (Nov 15 2026 is a Sunday)', () => {
    expect(lienByForJob('2026-07-20', 'non_residential')).toEqual({ ymd: '2026-11-16', kindAssumed: false })
  })
  it('unknown kind shows the residential (earlier) date and says it assumed', () => {
    expect(lienByForJob('2026-07-20', '')).toEqual({ ymd: '2026-10-15', kindAssumed: true })
  })
  it('no last work → no date, nothing assumed', () => {
    expect(lienByForJob(null, '')).toEqual({ ymd: '', kindAssumed: false })
  })
})

describe('daysBetweenYmd', () => {
  it('counts calendar days, negative backwards, null on junk', () => {
    expect(daysBetweenYmd('2026-09-28', '2026-10-15')).toBe(17)
    expect(daysBetweenYmd('2026-09-28', '2026-09-15')).toBe(-13)
    expect(daysBetweenYmd('2026-09-28', '')).toBeNull()
  })
})

describe('buildLienPayRunway', () => {
  it('draws nothing when nothing is open, or the lien was released', () => {
    expect(buildLienPayRunway(input({ openBalance: 0 })).state).toBe('none')
    expect(buildLienPayRunway(input({ openBalance: 0 })).lines).toEqual([])
    expect(buildLienPayRunway(input({ filedYmd: '2026-09-20', releasedYmd: '2026-09-27' })).state).toBe('none')
    expect(buildLienPayRunway(input({ lastWorkYmd: null })).state).toBe('none')
    expect(buildLienPayRunway(input({ lastWorkYmd: null, createdAt: '' })).state).toBe('none')
  })

  it('no clock hours: the creation month stands in, as on the Lien desk, and the hover says so', () => {
    const r = buildLienPayRunway(input({ lastWorkYmd: null, createdAt: '2026-07-03T15:20:00Z' }))
    expect(r.state).toBe('no_pay')
    expect(r.datedFromCreation).toBe(true)
    expect(r.lienByYmd).toBe('2026-10-15')
    expect(r.title).toContain('dated from the job’s creation · no clock hours')
    const worked = buildLienPayRunway(input({ lastWorkYmd: '2026-07-20', createdAt: '2026-03-01T00:00:00Z' }))
    expect(worked.datedFromCreation).toBe(false)
    expect(worked.title).toContain('approved hours')
  })

  it('room: the pay dot lands before the flag, the run between them is green', () => {
    const r = buildLienPayRunway(input({ expectedPayYmd: '2026-10-03' }))
    expect(r.state).toBe('room')
    expect(r.tone).toBe('green')
    expect(r.words).toBe('pay Oct 3 → file lien by Oct 15 · 12 d of room')
    expect(r.lines).toEqual(['pay Oct 3 → file lien by Oct 15', '12 d of room'])
    expect(r.marks!.notice).toBeNull()
    expect(r.chipLabel).toBe('12 d of room')
    expect(r.lienByYmd).toBe('2026-10-15')
    expect(r.daysToLien).toBe(17)
    expect(r.marks).not.toBeNull()
    const m = r.marks!
    expect(m.pay).toEqual({ days: 5, pct: expect.any(Number) })
    expect(m.lien.days).toBe(17)
    expect(m.pay!.pct).toBeLessThan(m.lien.pct)
    expect(m.lien.pct).toBeLessThan(100)
    expect(m.gap).toEqual({ fromPct: m.pay!.pct, toPct: m.lien.pct, kind: 'room' })
    expect(r.title).toContain('July 2026')
    expect(r.title).toContain('§ 53.052')
  })

  it('room inside the red week turns amber — the flag is close even though the money is closer', () => {
    const r = buildLienPayRunway(input({ todayYmd: '2026-10-10', expectedPayYmd: '2026-10-12' }))
    expect(r.state).toBe('room')
    expect(r.tone).toBe('amber')
    expect(r.words).toBe('pay Oct 12 → file lien by Oct 15 · 3 d of room')
  })

  it('file first: the pay date is past the flag, the run between them is short (red)', () => {
    const r = buildLienPayRunway(input({ lastWorkYmd: '2026-08-12', propertyKind: '', expectedPayYmd: '2026-11-20' }))
    expect(r.state).toBe('file_first')
    expect(r.tone).toBe('red')
    expect(r.kindAssumed).toBe(true)
    expect(r.lienByYmd).toBe('2026-11-16') // Nov 15 is a Sunday
    expect(r.words).toBe('file lien by Nov 16 → pay Nov 20 · file first')
    expect(r.lines).toEqual(['file lien by Nov 16 → pay Nov 20', 'file first'])
    expect(r.chipLabel).toBe('file first')
    expect(r.marks!.gap).toEqual({ fromPct: r.marks!.lien.pct, toPct: r.marks!.pay!.pct, kind: 'short' })
    expect(r.title).toContain('4 days before the money is expected')
    expect(r.title).toContain('residential assumed')
    expect(r.title).toContain('Property kind is not set')
  })

  it('no pay date: the flag stands alone, amber inside 21 days, red inside 7, grey beyond', () => {
    const amber = buildLienPayRunway(input())
    expect(amber.state).toBe('no_pay')
    expect(amber.tone).toBe('amber')
    expect(amber.words).toBe('no pay date · file lien by Oct 15 · 17 d to the flag')
    expect(amber.lines).toEqual(['no pay date · file lien by Oct 15', '17 d to the flag'])
    expect(amber.chipLabel).toBe('lien in 17 d')
    expect(amber.marks!.pay).toBeNull()
    expect(amber.marks!.gap).toBeNull()
    expect(buildLienPayRunway(input({ todayYmd: '2026-10-10' })).tone).toBe('red')
    expect(buildLienPayRunway(input({ lastWorkYmd: '2026-09-02' })).tone).toBe('grey')
  })

  it('an expected pay date already past reads as no live date, and says so', () => {
    const r = buildLienPayRunway(input({ expectedPayYmd: '2026-09-20' }))
    expect(r.state).toBe('no_pay')
    expect(r.words).toBe('pay was due Sep 20 · file lien by Oct 15 · 17 d to the flag')
    expect(r.lines).toEqual(['pay was due Sep 20 · file lien by Oct 15', '17 d to the flag'])
    expect(r.title).toContain('has passed')
  })

  it('closed: the window passed with nothing filed — lien gone, money still owed', () => {
    const r = buildLienPayRunway(input({ lastWorkYmd: '2026-05-20', propertyKind: 'non_residential', expectedPayYmd: '2026-10-01' }))
    expect(r.state).toBe('closed')
    expect(r.tone).toBe('red')
    expect(r.words).toBe('lien gone · window closed Sep 15')
    expect(r.lines).toEqual(['lien gone', 'window closed Sep 15'])
    expect(r.chipLabel).toBe('lien gone')
    expect(r.marks).toBeNull()
    expect(r.daysToLien).toBe(-13)
  })

  it('filed: the affidavit is on file — no track, a green line', () => {
    const r = buildLienPayRunway(input({ filedYmd: '2026-09-20T15:00:00Z' }))
    expect(r.state).toBe('filed')
    expect(r.tone).toBe('green')
    expect(r.words).toBe('lien filed Sep 20')
    expect(r.lines).toEqual(['lien filed Sep 20'])
    expect(r.marks).toBeNull()
  })

  it('the right edge sits past the farthest mark and is labelled with its date', () => {
    const r = buildLienPayRunway(input({ expectedPayYmd: '2026-10-03' }))
    expect(r.marks!.endDays).toBeGreaterThan(17)
    expect(r.marks!.endDays).toBeGreaterThanOrEqual(20)
    expect(r.endLabel).toMatch(/^Oct \d+$/)
  })

  it('sort key: file-first first, then a flag alone, then room, then closed, then filed', () => {
    const fileFirst = buildLienPayRunway(input({ lastWorkYmd: '2026-08-12', propertyKind: 'residential', expectedPayYmd: '2026-11-20' }))
    const alone = buildLienPayRunway(input())
    const room = buildLienPayRunway(input({ expectedPayYmd: '2026-10-03' }))
    const closed = buildLienPayRunway(input({ lastWorkYmd: '2026-05-20', propertyKind: 'non_residential' }))
    const filed = buildLienPayRunway(input({ filedYmd: '2026-09-20' }))
    const none = buildLienPayRunway(input({ openBalance: 0 }))
    const keys = [fileFirst, alone, room, closed, filed, none].map((r) => r.sortKey)
    expect([...keys].sort((a, b) => a - b)).toEqual(keys)
  })

  it('within a state the nearer flag sorts first', () => {
    const near = buildLienPayRunway(input())
    const far = buildLienPayRunway(input({ lastWorkYmd: '2026-08-20' }))
    expect(near.sortKey).toBeLessThan(far.sortKey)
  })
})

describe('a sub job: the § 53.056 notice comes first (v2.4096)', () => {
  // Last work August, residential: notice by Oct 15 (2nd month after), lien by Nov 16 (3rd month, Nov 15 is a Sunday).
  const sub = (over: Partial<LienRunwayInput> = {}) => input({ lastWorkYmd: '2026-08-12', isSub: true, ...over })

  it('notice owed: a hollow flag ahead of the lien flag, the sentence names the two dates and the one move', () => {
    const r = buildLienPayRunway(sub())
    expect(r.state).toBe('notice_due')
    expect(r.tone).toBe('amber')
    expect(r.lines).toEqual(['notice by Oct 15 · lien by Nov 16', 'send the notice · 17 d'])
    expect(r.words).toBe('notice by Oct 15 · lien by Nov 16 · send the notice · 17 d')
    expect(r.chipLabel).toBe('notice in 17 d')
    expect(r.noticeByYmd).toBe('2026-10-15')
    expect(r.daysToNotice).toBe(17)
    expect(r.lienByYmd).toBe('2026-11-16')
    expect(r.marks!.notice).toEqual({ days: 17, pct: expect.any(Number), done: false })
    expect(r.marks!.notice!.pct).toBeLessThan(r.marks!.lien.pct)
    expect(r.marks!.gap).toBeNull()
    expect(r.title).toContain('§ 53.056 notice')
    expect(r.title).toContain('Lien desk')
  })

  it('notice owed inside the red week turns red; the pay dot still rides the track', () => {
    const r = buildLienPayRunway(sub({ todayYmd: '2026-10-10', expectedPayYmd: '2026-10-20' }))
    expect(r.state).toBe('notice_due')
    expect(r.tone).toBe('red')
    expect(r.lines[1]).toBe('send the notice · 5 d')
    expect(r.marks!.pay).toEqual({ days: 10, pct: expect.any(Number) })
  })

  it('notice recorded for the work month: the ordinary reading, with a check where the hollow flag was', () => {
    const r = buildLienPayRunway(sub({ noticedMonths: ['2026-08'], expectedPayYmd: '2026-10-03' }))
    expect(r.state).toBe('room')
    expect(r.lines).toEqual(['pay Oct 3 → file lien by Nov 16', '44 d of room'])
    expect(r.marks!.notice).toEqual({ days: 17, pct: expect.any(Number), done: true })
    expect(r.title).toContain('notice for this month is recorded')
  })

  it('a live notice that lists no months counts as the month’s notice', () => {
    const r = buildLienPayRunway(sub({ anyNoticeOnFile: true }))
    expect(r.state).toBe('no_pay')
    expect(r.marks!.notice!.done).toBe(true)
  })

  it('a notice for another month does not count', () => {
    expect(buildLienPayRunway(sub({ noticedMonths: ['2026-07'] })).state).toBe('notice_due')
  })

  it('notice window closed unsent: the lien for that month is gone', () => {
    const r = buildLienPayRunway(sub({ lastWorkYmd: '2026-07-20' })) // notice was due Sep 15
    expect(r.state).toBe('closed')
    expect(r.lines).toEqual(['lien gone', 'notice window closed Sep 15'])
    expect(r.chipLabel).toBe('lien gone')
    expect(r.title).toContain('§ 53.056 notice')
  })

  it('once the notice date is behind us on a noticed job, no check is drawn', () => {
    const r = buildLienPayRunway(sub({ lastWorkYmd: '2026-07-20', noticedMonths: ['2026-07'] }))
    expect(r.state).toBe('no_pay')
    expect(r.marks!.notice).toBeNull()
  })

  it('a direct job never has a notice mark or a notice state', () => {
    const r = buildLienPayRunway(input({ lastWorkYmd: '2026-08-12', isSub: false }))
    expect(r.state).toBe('no_pay')
    expect(r.noticeByYmd).toBe('')
    expect(r.marks!.notice).toBeNull()
  })

  it('a notice owed sorts with the file-first rows and takes the phone chip inside 21 days', () => {
    const r = buildLienPayRunway(sub())
    expect(r.sortKey).toBe(17)
    expect(lienRunwayWantsTheChip(r)).toBe(true)
    expect(lienRunwayWantsTheChip(buildLienPayRunway(sub({ lastWorkYmd: '2026-09-02' })))).toBe(false) // notice by Nov 16, 49 d out
  })
})

describe('every work month: the notice that counts is the earliest one still owed (v2.4308)', () => {
  // Job 878, Take 5 – Seguin, read live on 2026-10-01: a commercial sub job worked June through
  // September with no notice recorded. June's window closed Sep 15; July's notice is due Oct 15,
  // August's Nov 16 (Nov 15 is a Sunday), September's Dec 15. The lien still counts from September.
  const seguin = (over: Partial<LienRunwayInput> = {}) =>
    input({ todayYmd: '2026-10-01', openBalance: 38625, lastWorkYmd: '2026-09-21', propertyKind: 'non_residential', isSub: true, workMonths: ['2026-06', '2026-07', '2026-08', '2026-09'], ...over })

  it('878: the notice date is July’s, not September’s; the lien date still follows the last month', () => {
    const r = buildLienPayRunway(seguin())
    expect(r.state).toBe('notice_due')
    expect(r.noticeByYmd).toBe('2026-10-15')
    expect(r.daysToNotice).toBe(14)
    expect(r.lienByYmd).toBe('2027-01-15')
    expect(r.lines).toEqual(['notice by Oct 15 · lien by Jan 15', 'send the notice · 14 d'])
    expect(r.chipLabel).toBe('notice in 14 d')
    expect(r.tone).toBe('amber')
    expect(r.sortKey).toBe(14)
    expect(r.marks!.notice).toEqual({ days: 14, pct: expect.any(Number), done: false })
    expect(r.noticeMonths).toEqual([
      { key: '2026-06', ymd: '2026-09-15', state: 'closed' },
      { key: '2026-07', ymd: '2026-10-15', state: 'owed' },
      { key: '2026-08', ymd: '2026-11-16', state: 'owed' },
      { key: '2026-09', ymd: '2026-12-15', state: 'owed' },
    ])
    expect(r.title).toContain('§ 53.056 notices for July, August and September 2026 are owed')
    expect(r.title).toContain('the first by Oct 15')
    expect(lienRunwayWantsTheChip(r)).toBe(true)
  })

  it('without the work months the last month stands alone, as before they load', () => {
    const r = buildLienPayRunway(seguin({ workMonths: null }))
    expect(r.noticeByYmd).toBe('2026-12-15')
    expect(r.daysToNotice).toBe(75)
    expect(r.noticeMonths).toEqual([{ key: '2026-09', ymd: '2026-12-15', state: 'owed' }])
    expect(r.title).toContain('A § 53.056 notice for this work month is owed')
  })

  it('a recorded month drops out; the next month still owed sets the date', () => {
    const r = buildLienPayRunway(seguin({ noticedMonths: ['2026-07'] }))
    expect(r.noticeByYmd).toBe('2026-11-16')
    expect(r.daysToNotice).toBe(46)
    expect(r.noticeMonths.find((m) => m.key === '2026-07')?.state).toBe('sent')
  })

  it('the last month on file and an earlier month still open: a notice is still owed', () => {
    const r = buildLienPayRunway(seguin({ workMonths: ['2026-08', '2026-09'], noticedMonths: ['2026-09'] }))
    expect(r.state).toBe('notice_due')
    expect(r.noticeByYmd).toBe('2026-11-16')
    expect(r.title).toContain('A § 53.056 notice for the August 2026 work is owed')
    expect(r.noticeSent).toBe(true) // the last month's notice is the one on file
  })

  it('every month on file: the ordinary reading, with the last month’s check', () => {
    const r = buildLienPayRunway(seguin({ noticedMonths: ['2026-07', '2026-08', '2026-09'], expectedPayYmd: '2026-10-20' }))
    expect(r.state).toBe('room')
    expect(r.noticeByYmd).toBe('2026-12-15')
    expect(r.marks!.notice).toEqual({ days: 75, pct: expect.any(Number), done: true })
    expect(r.noticeMonths.map((m) => m.state)).toEqual(['closed', 'sent', 'sent', 'sent'])
  })

  it('a month after the last work month is not counted, nor a key that is not a month', () => {
    const r = buildLienPayRunway(seguin({ workMonths: ['2026-07-14', '2026-10', 'junk'] }))
    expect(r.noticeMonths.map((m) => m.key)).toEqual(['2026-07', '2026-09'])
  })

  it('no property kind: every month on the residential clock, the earlier one (927)', () => {
    // Job 927, Mike Holub – Candelaria: worked July through September, no kind on the property record.
    const r = buildLienPayRunway(seguin({ propertyKind: '', lastWorkYmd: '2026-09-09', workMonths: ['2026-07', '2026-08', '2026-09'] }))
    expect(r.kindAssumed).toBe(true)
    expect(r.noticeMonths).toEqual([
      { key: '2026-07', ymd: '2026-09-15', state: 'closed' },
      { key: '2026-08', ymd: '2026-10-15', state: 'owed' },
      { key: '2026-09', ymd: '2026-11-16', state: 'owed' },
    ])
    expect(r.noticeByYmd).toBe('2026-10-15')
  })

  it('the last month closed unsent: the lien is gone, whatever came before it', () => {
    const r = buildLienPayRunway(seguin({ lastWorkYmd: '2026-06-20', workMonths: ['2026-05', '2026-06'] }))
    expect(r.state).toBe('closed')
    expect(r.closedBy).toBe('notice')
    expect(r.noticeByYmd).toBe('2026-09-15')
  })

  it('a direct job has no notice months', () => {
    const r = buildLienPayRunway(seguin({ isSub: false }))
    expect(r.noticeByYmd).toBe('')
    expect(r.noticeMonths).toEqual([])
  })
})

describe('lienRunwayWantsTheChip', () => {
  it('file first and lien gone always take the chip; a flag inside 21 days takes it; a far flag does not', () => {
    expect(lienRunwayWantsTheChip(buildLienPayRunway(input({ lastWorkYmd: '2026-08-12', expectedPayYmd: '2026-11-20' })))).toBe(true)
    expect(lienRunwayWantsTheChip(buildLienPayRunway(input({ lastWorkYmd: '2026-05-20', propertyKind: 'non_residential' })))).toBe(true)
    expect(lienRunwayWantsTheChip(buildLienPayRunway(input()))).toBe(true)
    expect(lienRunwayWantsTheChip(buildLienPayRunway(input({ expectedPayYmd: '2026-10-03' })))).toBe(true)
    expect(lienRunwayWantsTheChip(buildLienPayRunway(input({ lastWorkYmd: '2026-09-02' })))).toBe(false)
    expect(lienRunwayWantsTheChip(buildLienPayRunway(input({ filedYmd: '2026-09-20' })))).toBe(false)
    expect(lienRunwayWantsTheChip(null)).toBe(false)
  })
})

describe('the basis and the closed window (v2.4265)', () => {
  const base = { todayYmd: '2026-09-28', openBalance: 1000, propertyKind: 'residential', expectedPayYmd: null, filedYmd: null, releasedYmd: null }
  it('basisYmd is the last work day, or the creation day when there are no hours, or nothing', () => {
    expect(buildLienPayRunway({ ...base, lastWorkYmd: '2026-08-12' }).basisYmd).toBe('2026-08-12')
    const created = buildLienPayRunway({ ...base, lastWorkYmd: null, createdAt: '2026-08-03T15:00:00Z' })
    expect(created.basisYmd).toBe('2026-08-03')
    expect(created.datedFromCreation).toBe(true)
    expect(buildLienPayRunway({ ...base, lastWorkYmd: null, createdAt: null }).basisYmd).toBe('')
    expect(buildLienPayRunway({ ...base, lastWorkYmd: '2026-08-12', filedYmd: '2026-09-20' }).basisYmd).toBe('2026-08-12')
  })
  it('closedBy says which window shut', () => {
    expect(buildLienPayRunway({ ...base, lastWorkYmd: '2026-03-01' }).closedBy).toBe('lien')
    expect(buildLienPayRunway({ ...base, lastWorkYmd: '2026-07-20', isSub: true }).closedBy).toBe('notice')
    expect(buildLienPayRunway({ ...base, lastWorkYmd: '2026-08-12' }).closedBy).toBeNull()
  })
})

describe('a job created in the evening keeps its day (v2.4468)', () => {
  const base = { todayYmd: '2026-09-28', openBalance: 1000, propertyKind: 'residential', expectedPayYmd: null, filedYmd: null, releasedYmd: null, lastWorkYmd: null }
  it('dates the creation basis by the Central day, as the Lien desk’s months do', () => {
    // 00:30 UTC on Aug 1 is 7:30 pm CDT on Jul 31: a July job, so the residential lien is due Oct 15, not Nov 16.
    const evening = buildLienPayRunway({ ...base, createdAt: '2026-08-01T00:30:00Z' })
    expect(evening.basisYmd).toBe('2026-07-31')
    expect(evening.lienByYmd).toBe('2026-10-15')
    // 00:30 UTC on Dec 1 is 6:30 pm CST on Nov 30.
    expect(buildLienPayRunway({ ...base, createdAt: '2026-12-01T00:30:00+00:00' }).basisYmd).toBe('2026-11-30')
    expect(buildLienPayRunway({ ...base, createdAt: '2026-08-01T12:00:00Z' }).basisYmd).toBe('2026-08-01')
  })
})
