import { describe, expect, it } from 'vitest'
import { lienWindowHref, ownerRecordsHref, parseStagesDeepLinks, stripStagesDeepLink, STAGES_DEEP_LINK_PARAMS } from './stagesDeepLinks'

const sp = (q: string) => new URLSearchParams(q)

describe('parseStagesDeepLinks', () => {
  it('nothing open on a plain board URL', () => {
    expect(parseStagesDeepLinks(sp('tab=stages'))).toEqual({
      followups: false,
      gcReview: false,
      gcNoticeGcId: null,
      lienDesk: null,
      lienWindow: null,
      ownerRecordsJobId: null,
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

  it('the Lien desk door: the job, the pane (notice unless affidavit or timeline), any pile the desk has (v2.4561)', () => {
    // A bare link lands on Next up (punch list #82); naming a job, a pile or kind=notice lands on Notices.
    expect(parseStagesDeepLinks(sp('liendesk=1')).lienDesk).toEqual({ jobId: null, kind: 'next', pile: null })
    expect(parseStagesDeepLinks(sp('liendesk=1&kind=notice')).lienDesk?.kind).toBe('notice')
    expect(parseStagesDeepLinks(sp('liendesk=1&liendeskJob=j273')).lienDesk?.kind).toBe('notice')
    expect(parseStagesDeepLinks(sp('liendesk=1&liendeskJob=j273&kind=affidavit&liendeskPile=missed')).lienDesk).toEqual({ jobId: 'j273', kind: 'affidavit', pile: 'missed' })
    expect(parseStagesDeepLinks(sp('liendesk=1&kind=timeline&liendeskPile=to_draft')).lienDesk).toEqual({ jobId: null, kind: 'timeline', pile: 'to_draft' })
    // The Dashboard's tracking card and its letter two line send `sent`; before, only `missed` was read and they landed on plain Notices.
    expect(parseStagesDeepLinks(sp('liendesk=1&liendeskPile=sent')).lienDesk).toEqual({ jobId: null, kind: 'notice', pile: 'sent' })
    expect(parseStagesDeepLinks(sp('liendesk=1&liendeskPile=printed')).lienDesk?.pile).toBe('printed')
    expect(parseStagesDeepLinks(sp('liendesk=1&liendeskPile=nonsense')).lienDesk?.pile).toBeNull()
    expect(parseStagesDeepLinks(sp('liendesk=1&kind=whatever')).lienDesk?.kind).toBe('next')
    expect(parseStagesDeepLinks(sp('liendeskJob=j273&kind=affidavit')).lienDesk).toBeNull()
  })

  it('the round door carries the GC when the email named one', () => {
    expect(parseStagesDeepLinks(sp('round=1&gc=cust-2')).round).toEqual({ gcId: 'cust-2' })
    expect(parseStagesDeepLinks(sp('round=1&gc=')).round).toEqual({ gcId: null })
    expect(parseStagesDeepLinks(sp('gc=cust-2')).round).toBeNull()
  })
})

describe('stripStagesDeepLink', () => {
  it('removes one door’s params and keeps every other param', () => {
    const search = sp('tab=stages&liendesk=1&liendeskJob=j273&kind=affidavit&liendeskPile=missed&round=1&gc=cust-2&scope=all')
    expect(stripStagesDeepLink(search, 'lienDesk')).toBe('tab=stages&round=1&gc=cust-2&scope=all')
    expect(stripStagesDeepLink(search, 'round')).toBe('tab=stages&liendesk=1&liendeskJob=j273&kind=affidavit&liendeskPile=missed&scope=all')
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

  it('the Records for an owner door (punch list #86): a job; an empty one is no door; the href builds what the parser reads', () => {
    expect(parseStagesDeepLinks(sp('tab=stages&ownerrecords=j273')).ownerRecordsJobId).toBe('j273')
    expect(parseStagesDeepLinks(sp('tab=stages&ownerrecords=')).ownerRecordsJobId).toBeNull()
    const href = ownerRecordsHref('j 273')
    expect(href).toBe('/jobs?tab=stages&ownerrecords=j%20273')
    expect(parseStagesDeepLinks(sp(href.split('?')[1]!)).ownerRecordsJobId).toBe('j 273')
    expect(stripStagesDeepLink(sp('tab=stages&ownerrecords=j273&scope=all'), 'ownerRecords')).toBe('tab=stages&scope=all')
  })
})
