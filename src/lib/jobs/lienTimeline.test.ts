import { describe, expect, it } from 'vitest'
import { buildLienTimeline, lienDateWords, suitDeadlineFor, type LienTimelineInput } from './lienTimeline'

const TODAY = '2026-09-23'

function base(over: Partial<LienTimelineInput> = {}): LienTimelineInput {
  return {
    todayYmd: TODAY,
    isSub: true,
    propertyKind: 'commercial',
    lastMonth: '2026-08',
    lastMonthFromCreation: false,
    months: [
      { key: '2026-07', deadline: '2026-10-15', fromCreation: false, outcome: 'open', at: '' },
      { key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'open', at: '' },
    ],
    noticeState: 'to_draft',
    retainage: null,
    affidavit: null,
    originalContractCompletedOn: null,
    releasedAt: null,
    paid: false,
    ...over,
  }
}

const kinds = (t: ReturnType<typeof buildLienTimeline>) => t.steps.map((s) => `${s.kind}${s.monthKey ? ':' + s.monthKey : ''}=${s.state}`)

describe('suitDeadlineFor / lienDateWords', () => {
  it('is one year after the filing deadline, weekend-rolled', () => {
    expect(suitDeadlineFor('2026-12-15')).toBe('2027-12-15') // Wednesday
    expect(suitDeadlineFor('2026-11-16')).toBe('2027-11-16') // Tuesday
    expect(suitDeadlineFor('2026-10-15')).toBe('2027-10-15') // Friday
    expect(suitDeadlineFor('2026-01-16')).toBe('2027-01-18') // Sat → Mon
    expect(suitDeadlineFor('')).toBe('')
  })
  it('drops the year inside this year and keeps it otherwise', () => {
    expect(lienDateWords('2026-10-15', TODAY)).toBe('Oct 15')
    expect(lienDateWords('2027-12-15', TODAY)).toBe('Dec 15, 2027')
    expect(lienDateWords('', TODAY)).toBe('')
  })
})

describe('buildLienTimeline — a commercial sub job with two open months (891 Take 5)', () => {
  const t = buildLienTimeline(base())
  it('draws the path in order with the dates the desk computes', () => {
    expect(kinds(t)).toEqual(['last_work=done', 'notice:2026-07=due', 'notice:2026-08=due', 'retainage=undated', 'affidavit=later', 'serve=later', 'suit=later'])
    const by = Object.fromEntries(t.steps.map((s) => [s.key, s]))
    expect(by['notice:2026-07']!.dateWords).toBe('Oct 15')
    expect(by['notice:2026-07']!.words).toBe('22 days · to draft')
    expect(by['notice:2026-08']!.words).toBe('54 days · on the same notice')
    expect(by['affidavit']!.date).toBe('2026-12-15') // 4th month after Aug
    expect(by['affidavit']!.words).toBe('83 days')
    expect(by['serve']!.dateWords).toBe('+5 days')
    expect(by['suit']!.date).toBe('2027-12-15')
    expect(by['suit']!.dateWords).toBe('Dec 15, 2027')
    expect(by['retainage']!.door).toBe('contract_end')
  })
  it('names the next step as the earliest open notice, in the desk’s verb', () => {
    expect(t.next.kind).toBe('notice')
    expect(t.next.words).toBe('Draft the Jul + Aug notice — 22 days.')
    expect(t.next.tone).toBe('quiet')
    expect(t.todayIndex).toBe(1)
    expect(t.kindUnknown).toBe(false)
    expect(t.lienGone).toBe(false)
  })
})

describe('buildLienTimeline — residential, one month missed and unnoted, the next awaiting approval (273 Dudley)', () => {
  const t = buildLienTimeline(
    base({
      propertyKind: 'residential',
      months: [
        { key: '2026-07', deadline: '2026-09-15', fromCreation: false, outcome: 'missed', at: '' },
        { key: '2026-08', deadline: '2026-10-15', fromCreation: false, outcome: 'open', at: '' },
      ],
      noticeState: 'awaiting',
    }),
  )
  it('keeps the missed month where it fell and moves nothing', () => {
    expect(kinds(t)).toEqual(['last_work=done', 'notice:2026-07=missed', 'notice:2026-08=due', 'retainage=undated', 'affidavit=later', 'serve=later', 'suit=later'])
    const by = Object.fromEntries(t.steps.map((s) => [s.key, s]))
    expect(by['notice:2026-07']!.words).toBe('window closed · not noted')
    expect(by['notice:2026-08']!.words).toBe('22 days · awaiting approval')
    expect(by['affidavit']!.date).toBe('2026-11-16') // 3rd month after Aug; Nov 15 is a Sunday
    expect(by['suit']!.date).toBe('2027-11-16')
    expect(t.todayIndex).toBe(2)
  })
  it('says approve, and that Jul’s lien is gone but its dollars ride on the letter', () => {
    expect(t.next.words).toBe('Approve the Aug notice — 22 days.')
    expect(t.next.aside).toBe('Jul’s lien is gone; its dollars ride on this notice’s letter, not its form.')
  })
})

describe('buildLienTimeline — every window closed, nothing sent (650 ATI Schertz)', () => {
  const t = buildLienTimeline(
    base({
      lastMonth: '2026-06',
      months: [{ key: '2026-06', deadline: '2026-09-15', fromCreation: false, outcome: 'missed', at: '' }],
      noticeState: 'to_draft',
    }),
  )
  it('blocks the affidavit and everything after it', () => {
    expect(t.lienGone).toBe(true)
    expect(kinds(t)).toEqual(['last_work=done', 'notice:2026-06=missed', 'retainage=undated', 'affidavit=blocked', 'serve=blocked', 'suit=blocked'])
    expect(t.steps.find((s) => s.kind === 'affidavit')?.words).toBe('blocked · no notice on record')
  })
  it('says the honest thing', () => {
    expect(t.next.kind).toBe('lien_gone')
    expect(t.next.words).toBe('Lien: gone. Money: still owed — chase it in Collections.')
    expect(t.next.aside).toContain('Write the closed window down')
    expect(t.next.tone).toBe('red')
  })
  it('once someone notes the miss, the aside goes quiet', () => {
    const noted = buildLienTimeline(base({ lastMonth: '2026-06', months: [{ key: '2026-06', deadline: '2026-09-15', fromCreation: false, outcome: 'missed', at: '2026-09-21T15:00:00Z' }] }))
    expect(noted.next.aside).toBe('')
    expect(noted.steps.find((s) => s.kind === 'notice')?.words).toBe('window closed · noted')
  })
})

describe('buildLienTimeline — unknown kind, dated from creation, owner missing (864 Michael Palmer)', () => {
  const t = buildLienTimeline(
    base({
      propertyKind: '',
      lastMonth: '2026-07',
      lastMonthFromCreation: true,
      months: [{ key: '2026-07', deadline: '2026-10-15', fromCreation: true, outcome: 'open', at: '' }],
      noticeState: 'needs_owner',
    }),
  )
  it('shows commercial dates and says the kind is unknown', () => {
    expect(t.kindUnknown).toBe(true)
    const by = Object.fromEntries(t.steps.map((s) => [s.key, s]))
    expect(by['last_work']!.words).toBe('dated from the job’s creation · no clock hours')
    expect(by['notice:2026-07']!.words).toBe('22 days · owner of record missing · dated from creation')
    expect(by['affidavit']!.date).toBe('2026-11-16')
    expect(t.next.words).toBe('Find the owner, then send the Jul notice — 22 days.')
  })
})

describe('buildLienTimeline — the tail after filing', () => {
  const filed = base({
    lastMonth: '2026-03',
    months: [
      { key: '2026-02', deadline: '2026-05-15', fromCreation: false, outcome: 'sent', at: '2026-05-12T16:00:00Z' },
      { key: '2026-03', deadline: '2026-06-15', fromCreation: false, outcome: 'sent', at: '2026-06-12T16:00:00Z' },
    ],
    noticeState: '',
    affidavit: { deadline: '2026-07-15', filedAt: '2026-07-14', recordingNumber: '2026-0412', county: 'Comal', servedAt: null, serveDue: '2026-07-20', missingGates: [] },
  })
  it('asks for service first when the copy has not gone', () => {
    const t = buildLienTimeline(filed)
    expect(kinds(t)).toEqual(['last_work=done', 'notice:2026-02=done', 'notice:2026-03=done', 'affidavit=done', 'serve=missed', 'hold=undated', 'suit=later', 'release=later'])
    expect(t.next.kind).toBe('serve')
    expect(t.next.words).toBe('Serve the filed affidavit — overdue.')
    expect(t.next.tone).toBe('red')
  })
  it('once served, the year runs and counsel is named 90 days out', () => {
    const t = buildLienTimeline({ ...filed, affidavit: { ...filed.affidavit!, servedAt: '2026-07-16' } })
    const by = Object.fromEntries(t.steps.map((s) => [s.key, s]))
    expect(by['serve']!.dateWords).toBe('served Jul 16')
    expect(by['serve']!.words).toBe('2 days')
    expect(by['suit']!.date).toBe('2027-07-15')
    expect(by['suit']!.words).toBe('295 days · counsel by Apr 16, 2027')
    expect(by['release']!.state).toBe('later')
    expect(t.next.kind).toBe('suit')
    expect(t.next.words).toBe('Nothing due. Paid → file the release. Unpaid by Apr 16, 2027 → counsel on the suit.')
    expect(t.todayIndex).toBe(5) // last work, two notices, the affidavit, the service
  })
  it('inside 90 days the suit step is due and the tone is amber', () => {
    const t = buildLienTimeline({ ...filed, todayYmd: '2027-05-01', affidavit: { ...filed.affidavit!, servedAt: '2026-07-16' } })
    expect(t.steps.find((s) => s.kind === 'suit')?.state).toBe('due')
    expect(t.next.tone).toBe('amber')
  })
  it('paid and filed asks for the release; released stops the clock', () => {
    const paid = buildLienTimeline({ ...filed, paid: true, affidavit: { ...filed.affidavit!, servedAt: '2026-07-16' } })
    expect(paid.next.kind).toBe('release')
    expect(paid.steps.find((s) => s.kind === 'release')?.state).toBe('due')
    const released = buildLienTimeline({ ...filed, paid: true, releasedAt: '2026-09-01', affidavit: { ...filed.affidavit!, servedAt: '2026-07-16' } })
    expect(released.next.words).toBe('Released Sep 1 — the clock stopped.')
    expect(released.steps.find((s) => s.kind === 'suit')?.state).toBe('done')
  })
  it('the § 53.101 hold dates from the original contract’s completion once known', () => {
    const t = buildLienTimeline({ ...filed, originalContractCompletedOn: '2026-08-31', affidavit: { ...filed.affidavit!, servedAt: '2026-07-16' } })
    const hold = t.steps.find((s) => s.kind === 'hold')!
    expect(hold.date).toBe('2026-09-30')
    expect(hold.state).toBe('later')
  })
})

describe('buildLienTimeline — the retainage clock once the contract-end date exists (#33 §1)', () => {
  it('dates the § 53.057 step and makes it the next step when no notice is open', () => {
    const t = buildLienTimeline(
      base({
        months: [{ key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'sent', at: '2026-09-20T12:00:00Z' }],
        noticeState: '',
        retainage: { contractEndedOn: '2026-09-10', deadline: '2026-10-12', noticed: false },
      }),
    )
    const r = t.steps.find((s) => s.kind === 'retainage')!
    expect(r.state).toBe('due')
    expect(r.words).toBe('19 days · contract ended Sep 10')
    expect(t.next.kind).toBe('retainage')
    expect(t.next.words).toBe('Send the § 53.057 retainage notice — 19 days.')
  })
})

describe('buildLienTimeline — an original contractor and a held notice', () => {
  it('needs no monthly notice and goes straight to the affidavit', () => {
    const t = buildLienTimeline(base({ isSub: false, months: [], noticeState: '' }))
    expect(kinds(t)).toEqual(['last_work=done', 'notice=done', 'retainage=undated', 'affidavit=due', 'serve=later', 'suit=later'])
    expect(t.next.kind).toBe('affidavit')
    expect(t.next.words).toBe('File the affidavit — 83 days.')
  })
  it('a held notice says when it re-asks', () => {
    const t = buildLienTimeline(base({ noticeState: 'held', holdUntil: '2026-10-12' }))
    expect(t.next.words).toBe('Held — the Jul + Aug notice re-asks Oct 12; mail by Oct 15.')
    expect(t.steps.find((s) => s.key === 'notice:2026-07')?.words).toBe('22 days · held · re-asks Oct 12')
  })
})
