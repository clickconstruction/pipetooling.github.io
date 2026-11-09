import { describe, expect, it } from 'vitest'
import { lienWindowHref, parseStagesDeepLinks, stripStagesDeepLink, STAGES_DEEP_LINK_PARAMS } from './stagesDeepLinks'

const sp = (q: string) => new URLSearchParams(q)

describe('parseStagesDeepLinks', () => {
  it('nothing open on a plain board URL', () => {
    expect(parseStagesDeepLinks(sp('tab=stages'))).toEqual({
      followups: false,
      followupsLens: null,
      gcReview: false,
      gcNoticeGcId: null,
      lienWindow: null,
      round: null,
      chase: false,
      forecast: false,
      rtb: false,
    })
  })

  it('the =1 flags open only on exactly "1"', () => {
    expect(parseStagesDeepLinks(sp('followups=1&gcReview=1&chase=1&forecast=1&rtb=1'))).toMatchObject({ followups: true, gcReview: true, chase: true, forecast: true, rtb: true })
    expect(parseStagesDeepLinks(sp('followups=true&chase=0&rtb='))).toMatchObject({ followups: false, chase: false, rtb: false })
  })

  it('the GC-notice door carries the GC id; an empty id is no door', () => {
    expect(parseStagesDeepLinks(sp('gcnotice=cust-9')).gcNoticeGcId).toBe('cust-9')
    expect(parseStagesDeepLinks(sp('gcnotice=')).gcNoticeGcId).toBeNull()
  })

  it('the round door carries the GC when the email named one', () => {
    expect(parseStagesDeepLinks(sp('round=1&gc=cust-2')).round).toEqual({ gcId: 'cust-2' })
    expect(parseStagesDeepLinks(sp('round=1&gc=')).round).toEqual({ gcId: null })
    expect(parseStagesDeepLinks(sp('gc=cust-2')).round).toBeNull()
  })
})

describe('stripStagesDeepLink', () => {
  it('removes one door’s params and keeps every other param', () => {
    const search = sp('tab=stages&lienwindow=j273&lientab=affidavit&round=1&gc=cust-2&scope=all')
    expect(stripStagesDeepLink(search, 'lienWindow')).toBe('tab=stages&round=1&gc=cust-2&scope=all')
    expect(stripStagesDeepLink(search, 'round')).toBe('tab=stages&lienwindow=j273&lientab=affidavit&scope=all')
    expect(stripStagesDeepLink(sp('tab=stages&rtb=1'), 'rtb')).toBe('tab=stages')
  })

  it('does not touch the caller’s params', () => {
    const search = sp('followups=1&tab=stages')
    stripStagesDeepLink(search, 'followups')
    expect(search.get('followups')).toBe('1')
  })

  it('every door names at least its own flag', () => {
    for (const [key, names] of Object.entries(STAGES_DEEP_LINK_PARAMS)) expect(names.length, key).toBeGreaterThan(0)
  })

  it('the Lien window door (v2.4562): a job and a tab, the demand letter unless named; the href builds what the parser reads', () => {
    expect(parseStagesDeepLinks(sp('tab=stages&lienwindow=j273')).lienWindow).toEqual({ jobId: 'j273', tab: 'demand' })
    expect(parseStagesDeepLinks(sp('lienwindow=j273&lientab=affidavit')).lienWindow).toEqual({ jobId: 'j273', tab: 'affidavit' })
    expect(parseStagesDeepLinks(sp('lienwindow=j273&lientab=whatever')).lienWindow?.tab).toBe('demand')
    expect(parseStagesDeepLinks(sp('lientab=affidavit')).lienWindow).toBeNull()
    const href = lienWindowHref('j 273', 'notice')
    expect(href).toBe('/jobs?tab=stages&lienwindow=j%20273&lientab=notice')
    expect(parseStagesDeepLinks(sp(href.split('?')[1]!)).lienWindow).toEqual({ jobId: 'j 273', tab: 'notice' })
    expect(stripStagesDeepLink(sp('tab=stages&lienwindow=j273&lientab=notice&scope=all'), 'lienWindow')).toBe('tab=stages&scope=all')
  })
})

describe('the deck’s Idle lens (v2.5511)', () => {
  it('followups=idle opens the deck on its Idle lens; followups=1 opens the whole queue; the strip takes the whole param', () => {
    const sp = (q: string) => new URLSearchParams(q)
    expect(parseStagesDeepLinks(sp('followups=idle'))).toMatchObject({ followups: true, followupsLens: 'idle' })
    expect(parseStagesDeepLinks(sp('followups=1'))).toMatchObject({ followups: true, followupsLens: null })
    expect(parseStagesDeepLinks(sp('followups=stale'))).toMatchObject({ followups: false, followupsLens: null })
    expect(stripStagesDeepLink(sp('followups=idle&tab=stages'), 'followups')).toBe('tab=stages')
  })
})
