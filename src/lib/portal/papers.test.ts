import { describe, expect, it } from 'vitest'
import { customerPapers, openedAtWords, paperViewLabel, portalWords } from './papers'
import { ELENA_PAPERS, PRIYA_PAPERS } from './portalTestPeople'

describe("the customer's Papers tab", () => {
  it("lists Priya's signed papers, the change order waiting on her, and what comes later", () => {
    expect(customerPapers('en', PRIYA_PAPERS)).toEqual({
      signed: {
        title: 'Signed',
        rows: [
          { title: 'Our contract', detail: null, sub: ['signed Sat Sep 19', 'Dr. Priya Raman'], read: 'Read or save a copy' },
          { title: 'Change order 1', detail: 'exam 2 cabinets', sub: ['signed Mon Sep 28', '+$6,300'], read: 'Read or save a copy' },
        ],
        empty: null,
      },
      waiting: {
        title: 'Waiting on you',
        rows: [
          {
            title: 'Change order 2',
            detail: 'a sink in exam 3',
            sub: ['+$2,150', 'adds no days'],
            changeId: 'co-priya-2',
            buttons: [
              { label: 'Read and sign', primary: true, press: 'signChange' },
              { label: 'Decline', primary: false, press: 'declineChange' },
            ],
          },
        ],
      },
      later: {
        title: 'Comes later',
        rows: [
          { title: 'Pay applications', when: "one a month, with the architect's certificate" },
          { title: 'Lien waivers', when: 'one per payment' },
          { title: 'Closeout binder', when: 'warranties, manuals, as-builts, at the end' },
        ],
      },
      footer: 'Every paper here is also in the email we sent it in.',
    })
  })

  it("lists Elena's master agreement first, and drops from Comes later what has already come", () => {
    const papers = customerPapers('en', ELENA_PAPERS)
    expect(papers.signed.rows.map((r) => [r.title, r.sub])).toEqual([
      ['Master agreement', ['signed Tue Aug 4']],
      ['Our contract', ['signed Wed Sep 2', 'Elena Marchetti']],
      ['Change order 1', ['signed Fri Sep 18', '+$11,200']],
      ['Change order 2', ['signed Thu Sep 24', '+$7,250']],
    ])
    expect(papers.waiting).toBeNull()
    expect(papers.later?.rows.map((r) => r.title)).toEqual(['Closeout binder'])
    expect(customerPapers('en', { ...ELENA_PAPERS, arrived: { payApps: 4, waivers: 13, binder: true } }).later).toBeNull()
  })

  it('reads every name and day in Spanish, the master agreement too', () => {
    const papers = customerPapers('es', ELENA_PAPERS)
    expect(papers.signed.title).toBe('Firmados')
    expect(papers.signed.rows.map((r) => [r.title, r.sub[0]])).toEqual([
      ['Acuerdo marco', 'firmado el mar 4 ago'],
      ['Nuestro contrato', 'firmado el mié 2 sep'],
      ['Orden de cambio 1', 'firmado el vie 18 sep'],
      ['Orden de cambio 2', 'firmado el jue 24 sep'],
    ])
    expect(papers.signed.rows[2]?.detail).toBe('vidrio de fachada')
    expect(papers.later).toEqual({ title: 'Vienen después', rows: [{ title: 'Carpeta de cierre', when: 'garantías, manuales, planos finales, al terminar' }] })
  })

  it('asks them to sign our contract by its day, with no Decline, since main declines only change orders', () => {
    const papers = customerPapers('en', { agreement: null, contract: { state: 'toSign', signBy: '2026-10-09' }, changes: [], arrived: { payApps: 0, waivers: 0, binder: false } })
    expect(papers.waiting).toEqual({
      title: 'Waiting on you',
      rows: [{ title: 'Our contract', detail: null, sub: ['Sign by Fri Oct 9.'], changeId: null, buttons: [{ label: 'Read and sign', primary: true, press: 'sign' }] }],
    })
    expect(papers.signed).toEqual({ title: 'Signed', rows: [], empty: 'Nothing yet.' })
  })
})

describe('what the office reads back about the page', () => {
  it("reads Priya's: when she last opened it, what she read, what she has not opened, a signed change order left out", () => {
    expect(
      portalWords('2026-09-29T14:14:00Z', [
        { id: 'send-1', kind: 'contract', title: 'Our contract', detail: null, sentAt: '2026-09-15T15:00:00Z', answered: true, viewedAt: '2026-09-19T13:02:00Z' },
        { id: 'co-priya-1', kind: 'changeOrder', title: 'Change order 1', detail: 'exam 2 cabinets', sentAt: '2026-09-25T15:00:00Z', answered: true, viewedAt: '2026-09-26T15:00:00Z' },
        { id: 'co-priya-2', kind: 'changeOrder', title: 'Change order 2', detail: 'a sink in exam 3', sentAt: '2026-09-30T15:00:00Z', answered: false, viewedAt: null },
      ]),
    ).toEqual({ words: ['opened Tue Sep 29 9:14 AM', 'read the contract', 'has not opened change order 2'], unopened: 1 })
  })

  it('tells two change orders apart by their own views', () => {
    expect(
      portalWords('2026-10-01T21:40:00Z', [
        { id: 'co-2', kind: 'changeOrder', title: 'Change order 2', detail: null, sentAt: '2026-09-30T15:00:00Z', answered: false, viewedAt: '2026-10-01T21:41:00Z' },
        { id: 'co-3', kind: 'changeOrder', title: 'Change order 3', detail: null, sentAt: '2026-09-30T15:00:00Z', answered: false, viewedAt: null },
        { id: 'pa-4', kind: 'payApp', title: 'Pay application 4', detail: null, sentAt: '2026-09-28T15:00:00Z', answered: false, viewedAt: '2026-09-29T13:05:00Z' },
      ]),
    ).toEqual({ words: ['opened Thu Oct 1 4:40 PM', 'opened change order 2', 'has not opened change order 3', 'read the pay application'], unopened: 1 })
  })

  it('reads nothing when they never opened the page', () => {
    expect(portalWords(null, [{ id: 'x', kind: 'contract', title: 'Our contract', detail: null, sentAt: '2026-09-15T15:00:00Z', answered: false, viewedAt: null }])).toBeNull()
  })

  it("writes the time in the office's zone, the day turning at its midnight", () => {
    expect(openedAtWords('2026-10-02T04:30:00Z')).toBe('Thu Oct 1 11:30 PM')
  })

  it('names each paper inside a sentence', () => {
    const base = { id: 'x', detail: null, sentAt: '2026-09-30T15:00:00Z', answered: false, viewedAt: null }
    expect(paperViewLabel({ ...base, kind: 'contract', title: 'Our contract' })).toBe('the contract')
    expect(paperViewLabel({ ...base, kind: 'payApp', title: 'Pay application 4' })).toBe('the pay application')
    expect(paperViewLabel({ ...base, kind: 'changeOrder', title: 'Change order 2' })).toBe('change order 2')
  })
})
