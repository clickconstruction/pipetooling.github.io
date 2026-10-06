import { describe, expect, it } from 'vitest'
import { buildLienTimeline, LIEN_KIND_UNKNOWN_WORDS, lienDateWords, lienFirmMoveWords, lienFirmNext, lienFirmWaitingOn, lienTimelineFoldSummary, lienNoticeOpensOn, lienOpensWords, lienWindowSpan, suitDeadlineFor, type LienTimelineInput } from './lienTimeline'

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
  it('the law firm reads the fact, with no office screen named and no waiting line (punch list #85, item 3)', () => {
    expect(lienFirmNext(t.next)).toEqual({ words: 'The lien window closed with nothing filed. The lien is gone; the money is still owed.', aside: 'The office referred the account to you.' })
    expect(lienFirmWaitingOn(t)).toBeNull()
    expect(t.next.words).toContain('Collections')
    expect(lienFirmMoveWords('ours')).toBe('the office')
    expect(lienFirmMoveWords('counsel')).toBe('you')
    expect(lienFirmMoveWords('gc')).toBe('the GC')
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

describe('first days — Steps · Windows (v2.3815, punch list #42)', () => {
  it('a month’s notice opens the 1st of the next month, December into January', () => {
    expect(lienNoticeOpensOn('2026-07')).toBe('2026-08-01')
    expect(lienNoticeOpensOn('2026-12')).toBe('2027-01-01')
    expect(lienNoticeOpensOn('')).toBe('')
  })
  it('says open since once the day has come, opens before it', () => {
    expect(lienOpensWords('2026-08-01', TODAY)).toBe('open since Aug 1')
    expect(lienOpensWords('2026-09-23', TODAY)).toBe('open since Sep 23')
    expect(lienOpensWords('2026-10-01', TODAY)).toBe('opens Oct 1')
    expect(lienOpensWords('', TODAY)).toBe('')
  })
  it('measures a window and how much of it is gone', () => {
    // J473's July notice on 2026-09-24: Aug 1 → Oct 15, 75 days, 54 gone.
    expect(lienWindowSpan('2026-08-01', '2026-10-15', '2026-09-24')).toEqual({ opensOn: '2026-08-01', closesOn: '2026-10-15', totalDays: 75, usedDays: 54, leftDays: 21 })
    expect(lienWindowSpan('2026-10-01', '2026-12-15', TODAY)?.usedDays).toBe(0)
    expect(lienWindowSpan('2026-04-01', '2026-06-15', TODAY)?.leftDays).toBe(0)
    expect(lienWindowSpan('', '2026-06-15', TODAY)).toBeNull()
    expect(lienWindowSpan('2026-07-01', '2026-06-15', TODAY)).toBeNull()
  })
  it('open notices carry their first day; the lien waits on the notice', () => {
    const t = buildLienTimeline(base())
    const by = Object.fromEntries(t.steps.map((s) => [s.key, s]))
    expect(by['notice:2026-07']!.opensOn).toBe('2026-08-01')
    expect(by['notice:2026-07']!.opensWords).toBe('open since Aug 1')
    expect(by['notice:2026-08']!.opensWords).toBe('open since Sep 1')
    expect(by['affidavit']!.opensOn).toBe('')
    expect(by['affidavit']!.opensWords).toBe('opens when the notice is mailed')
    expect(by['serve']!.opensWords ?? '').toBe('')
    expect(t.windowsAside).toBe('Once it is mailed, the lien can be filed any day until Dec 15. Filing it is the leader’s call.')
    expect(t.todayYmd).toBe(TODAY)
  })
  it('the old words stay as they were — the first day is a field of its own', () => {
    const by = Object.fromEntries(buildLienTimeline(base()).steps.map((s) => [s.key, s]))
    expect(by['notice:2026-07']!.words).toBe('22 days · to draft')
    expect(by['affidavit']!.words).toBe('83 days')
  })
  it('once a notice is sent, the lien is open from its send day', () => {
    const t = buildLienTimeline(base({ months: [
      { key: '2026-07', deadline: '2026-10-15', fromCreation: false, outcome: 'sent', at: '2026-09-10T15:00:00Z' },
      { key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'open', at: '' },
    ] }))
    const by = Object.fromEntries(t.steps.map((s) => [s.key, s]))
    expect(by['notice:2026-07']!.opensWords).toBe('')
    expect(by['affidavit']!.opensOn).toBe('2026-09-10')
    expect(by['affidavit']!.opensWords).toBe('open since Sep 10')
  })
  it('a closed month keeps its first day for the Windows view but no line on Steps', () => {
    const t = buildLienTimeline(base({ months: [
      { key: '2026-03', deadline: '2026-06-15', fromCreation: false, outcome: 'missed', at: '' },
      { key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'open', at: '' },
    ] }))
    const march = t.steps.find((s) => s.key === 'notice:2026-03')!
    expect(march.opensOn).toBe('2026-04-01')
    expect(march.opensWords).toBe('')
  })
  it('an original contractor’s lien opens the month after the last month worked', () => {
    const t = buildLienTimeline(base({ isSub: false, months: [] }))
    const aff = t.steps.find((s) => s.kind === 'affidavit')!
    expect(aff.opensOn).toBe('2026-09-01')
    expect(aff.opensWords).toBe('open since Sep 1')
    expect(t.windowsAside).toBe('')
  })
  it('a dated retainage clock opens the day our contract ended', () => {
    const t = buildLienTimeline(base({ retainage: { contractEndedOn: '2026-09-10', deadline: '2026-10-12', noticed: false } }))
    const r = t.steps.find((s) => s.kind === 'retainage')!
    expect(r.opensOn).toBe('2026-09-10')
    expect(r.opensWords).toBe('open since Sep 10')
  })
})

describe('buildLienTimeline — the demand letter on the strip, whose move it is (v2.3877, punch list #32)', () => {
  const sentBoth = (over: Partial<LienTimelineInput> = {}) =>
    base({
      lastMonth: '2026-07',
      months: [
        { key: '2026-06', deadline: '2026-09-15', fromCreation: false, outcome: 'sent', at: '2026-08-14T15:00:00Z' },
        { key: '2026-07', deadline: '2026-10-15', fromCreation: false, outcome: 'sent', at: '2026-09-12T15:00:00Z' },
      ],
      noticeState: 'sent',
      ...over,
    })
  const letter = (over: Partial<NonNullable<LienTimelineInput['demandLetters']>[number]> = {}) => ({ sentAt: '2026-09-14T16:00:00Z', deadlineDate: '2026-09-28', amount: 8940, openRemaining: 8940, debtorParty: 'gc', ...over })

  it('draws nothing when the caller loaded no letters, and every live step carries a move', () => {
    const t = buildLienTimeline(sentBoth())
    expect(t.steps.some((s) => s.kind === 'demand')).toBe(false)
    expect(t.steps.map((s) => `${s.key}=${s.move ?? '-'}`)).toEqual(['last_work=-', 'notice:2026-06=-', 'notice:2026-07=-', 'retainage=ours', 'affidavit=ours', 'serve=ours', 'suit=counsel'])
    expect(t.waitingOn).toEqual({ who: 'ours', words: 'the affidavit to be filed' })
  })

  it('a sent letter with a reply owed sits by its date between the notice and the affidavit, the GC’s move, and Waiting on names it', () => {
    const t = buildLienTimeline(sentBoth({ demandLetters: [letter()] }))
    const keys = t.steps.map((s) => s.key)
    expect(keys.indexOf('demand')).toBeGreaterThan(keys.indexOf('notice:2026-07'))
    expect(keys.indexOf('demand')).toBeLessThan(keys.indexOf('affidavit'))
    const d = t.steps.find((s) => s.kind === 'demand')!
    expect(d).toMatchObject({ label: 'Demand letter', date: '2026-09-28', dateWords: 'reply by Sep 28', state: 'due', words: '5 days · sent Sep 14 · $8,940', daysLeft: 5, move: 'gc' })
    expect(t.waitingOn).toEqual({ who: 'gc', words: 'a reply to the Sep 14 demand letter by Sep 28 · $8,940' })
    expect(t.next.kind).toBe('affidavit')
    expect(t.todayIndex).toBe(2) // last work and June; July's node is dated on its Oct 15 deadline, as before
  })

  it('past its date with money open it is missed, the move comes back to us, and the fee clock line says so', () => {
    const t = buildLienTimeline(sentBoth({ todayYmd: '2026-10-01', demandLetters: [letter()] }))
    const d = t.steps.find((s) => s.kind === 'demand')!
    expect(d).toMatchObject({ state: 'missed', dateWords: 'Sep 28', words: 'overdue 3 days · the fee clock runs', move: 'ours' })
    expect(t.waitingOn).toEqual({ who: 'ours', words: 'the GC’s reply date passed — the move came back to us' })
    expect(t.todayIndex).toBe(2)
  })

  it('paid closes it like a notice; no reply date leaves it undated and never nags; a voided or unsent letter is not a step; the newest sent letter wins', () => {
    const paid = buildLienTimeline(sentBoth({ demandLetters: [letter({ openRemaining: 0, paidAt: '2026-10-03' })], todayYmd: '2026-10-06', paid: true }))
    expect(paid.steps.find((s) => s.kind === 'demand')).toMatchObject({ state: 'done', dateWords: 'paid Oct 3', words: '$8,940 · in full', move: null })
    const undated = buildLienTimeline(sentBoth({ demandLetters: [letter({ deadlineDate: null })] }))
    expect(undated.steps.find((s) => s.kind === 'demand')).toMatchObject({ state: 'undated', dateWords: 'sent Sep 14', words: 'no reply date · $8,940' })
    expect(undated.waitingOn).toEqual({ who: 'ours', words: 'the affidavit to be filed' })
    const none = buildLienTimeline(sentBoth({ demandLetters: [letter({ sentAt: '' })] }))
    expect(none.steps.some((s) => s.kind === 'demand')).toBe(false)
    const two = buildLienTimeline(sentBoth({ demandLetters: [letter({ sentAt: '2026-08-01T00:00:00Z', deadlineDate: '2026-08-15', amount: 100 }), letter({ debtorParty: 'owner' })] }))
    expect(two.steps.filter((s) => s.kind === 'demand')).toHaveLength(1)
    expect(two.steps.find((s) => s.kind === 'demand')).toMatchObject({ words: '5 days · sent Sep 14 · $8,940', move: 'owner' })
  })

  it('the moves and the Waiting-on line down the path: the open notice, the hold, the suit, the release', () => {
    const open = buildLienTimeline(base({ noticeState: 'needs_owner' }))
    expect(open.steps.find((s) => s.key === 'notice:2026-07')?.move).toBe('ours')
    expect(open.waitingOn).toEqual({ who: 'ours', words: 'the owner’s name for the notice' })
    const filed = base({
      todayYmd: '2026-08-01',
      lastMonth: '2026-03',
      months: [{ key: '2026-03', deadline: '2026-06-15', fromCreation: false, outcome: 'sent', at: '2026-05-20T15:00:00Z' }],
      noticeState: 'sent',
      affidavit: { deadline: '2026-07-15', filedAt: '2026-07-14', recordingNumber: '2026-0412', county: 'Comal', servedAt: '2026-07-16', serveDue: '2026-07-19', missingGates: [] },
    })
    const tail = buildLienTimeline(filed)
    expect(tail.steps.map((s) => `${s.key}=${s.move ?? '-'}`)).toEqual(['last_work=-', 'notice:2026-03=-', 'affidavit=-', 'serve=-', 'hold=owner', 'suit=counsel', 'release=gc'])
    expect(tail.waitingOn).toEqual({ who: 'gc', words: 'payment · counsel on the suit by Apr 16, 2027' })
    const paid = buildLienTimeline({ ...filed, paid: true })
    expect(paid.steps.find((s) => s.kind === 'release')?.move).toBe('ours')
    expect(paid.waitingOn).toEqual({ who: 'ours', words: 'the release of record to be filed' })
    const released = buildLienTimeline({ ...filed, paid: true, releasedAt: '2026-09-01' })
    expect(released.waitingOn).toBeNull()
    const original = buildLienTimeline({ ...filed, isSub: false, months: [], noticeState: '' })
    expect(original.steps.find((s) => s.kind === 'release')?.move).toBe('owner')
  })
})

describe('the strip folds consecutive closed months into one node (v2.4111)', () => {
  const closed = (key: string, deadline: string, at = '2026-09-21T15:00:00Z') => ({ key, deadline, fromCreation: false, outcome: 'missed' as const, at })
  it('four closed months, all noted → one node: the cite, the run, the count, the state; the months ride along', () => {
    const t = buildLienTimeline(base({ lastMonth: '2026-09', months: [closed('2026-05', '2026-08-17'), closed('2026-06', '2026-09-15'), closed('2026-07', '2026-09-15'), closed('2026-08', '2026-09-15'), { key: '2026-09', deadline: '2026-10-15', fromCreation: false, outcome: 'open', at: '' }] }))
    const fold = t.steps.find((s) => s.fold)!
    expect(fold).toMatchObject({ kind: 'notice', key: 'notice-fold:2026-05:2026-08', label: '§ 53.056 · May–Aug', state: 'missed', dateWords: '4 windows closed', words: 'all noted', daysLeft: null, move: null })
    expect(fold.fold).toMatchObject({ count: 4, noted: 4, unnoted: 0, unknown: 0, fromMonthKey: '2026-05', toMonthKey: '2026-08' })
    expect(fold.fold!.steps.map((s) => s.monthKey)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08'])
    expect(kinds(t)).toEqual(['last_work=done', 'notice=missed', 'notice:2026-09=due', 'retainage=undated', 'affidavit=later', 'serve=later', 'suit=later'])
    expect(t.todayIndex).toBe(2) // last work + the fold are past
  })
  it('one month not noted keeps its voice inside the fold', () => {
    const t = buildLienTimeline(base({ lastMonth: '2026-08', months: [closed('2026-05', '2026-08-17'), closed('2026-06', '2026-09-15'), closed('2026-07', '2026-09-15'), closed('2026-08', '2026-09-15', '')] }))
    const fold = t.steps.find((s) => s.fold)!
    expect(fold.words).toBe('3 noted · 1 to note')
    expect(fold.fold).toMatchObject({ noted: 3, unnoted: 1 })
  })
  it('a single closed month, a skipped month or a sent month between closed months do not fold', () => {
    const one = buildLienTimeline(base({ lastMonth: '2026-06', months: [closed('2026-06', '2026-09-15')] }))
    expect(one.steps.some((s) => s.fold)).toBe(false)
    const broken = buildLienTimeline(base({ lastMonth: '2026-08', months: [closed('2026-05', '2026-08-17'), { key: '2026-06', deadline: '2026-09-15', fromCreation: false, outcome: 'sent', at: '2026-09-01T15:00:00Z' }, closed('2026-07', '2026-09-15'), { key: '2026-08', deadline: '2026-09-15', fromCreation: false, outcome: 'skipped', at: '2026-09-20T15:00:00Z' }] }))
    expect(broken.steps.filter((s) => s.kind === 'notice').map((s) => `${s.monthKey}=${s.words}`)).toEqual(['2026-05=window closed · noted', '2026-06=sent Sep 1', '2026-07=window closed · noted', '2026-08=skipped on purpose'])
  })
  it('the Lien window without desk items folds too, and says only that the windows closed', () => {
    const t = buildLienTimeline(base({ lastMonth: '2026-07', months: [{ ...closed('2026-05', '2026-08-17', ''), noteUnknown: true }, { ...closed('2026-06', '2026-09-15', ''), noteUnknown: true }] }))
    const fold = t.steps.find((s) => s.fold)!
    expect(fold.words).toBe('window closed')
    expect(fold.fold).toMatchObject({ count: 2, unknown: 2 })
  })
})

describe('the Lien window’s folded strip on a phone (v2.4398)', () => {
  const closed = (key: string, deadline: string, at = '2026-09-21T15:00:00Z') => ({ key, deadline, fromCreation: false, outcome: 'missed' as const, at })
  const open = (key: string, deadline: string) => ({ key, deadline, fromCreation: false, outcome: 'open' as const, at: '' })
  it('one closed month and an open one: the Next sentence whole, who we wait on, and the closed window', () => {
    const t = buildLienTimeline(base({ lastMonth: '2026-09', months: [closed('2026-06', '2026-09-15'), open('2026-07', '2026-10-15')], noticeState: 'to_draft' }))
    const f = lienTimelineFoldSummary(t)
    expect(f.next).toBe(t.next.words)
    expect(f.tone).toBe(t.next.tone)
    expect(f.waitingOn).toBe('waiting on us')
    expect(f.closed).toBe('1 window closed')
  })
  it('a folded node counts every month it holds', () => {
    const t = buildLienTimeline(base({ lastMonth: '2026-09', months: [closed('2026-05', '2026-08-17'), closed('2026-06', '2026-09-15'), closed('2026-07', '2026-09-15'), open('2026-09', '2026-10-15')] }))
    expect(t.steps.some((s) => s.fold)).toBe(true)
    expect(lienTimelineFoldSummary(t).closed).toBe('3 windows closed')
  })
  it('nothing closed and nobody waited on: both are empty, never a zero', () => {
    const t = buildLienTimeline(base({ lastMonth: '2026-09', months: [open('2026-09', '2026-12-15')] }))
    const f = lienTimelineFoldSummary({ ...t, waitingOn: null })
    expect(f.closed).toBe('')
    expect(f.waitingOn).toBe('')
  })
  it('a month skipped on purpose is not a closed window', () => {
    const t = buildLienTimeline(base({ lastMonth: '2026-09', months: [{ key: '2026-08', deadline: '2026-09-15', fromCreation: false, outcome: 'skipped', at: '2026-09-01T15:00:00Z' }, open('2026-09', '2026-10-15')] }))
    expect(lienTimelineFoldSummary(t).closed).toBe('')
  })
  it('carries the aside and the unknown-kind warning as notes', () => {
    const gone = buildLienTimeline(base({ lastMonth: '2026-06', months: [closed('2026-06', '2026-09-15', '')], noticeState: 'to_draft' }))
    expect(lienTimelineFoldSummary(gone).notes).toEqual([gone.next.aside])
    const unknown = buildLienTimeline(base({ propertyKind: '', lastMonth: '2026-09', months: [open('2026-09', '2026-10-15')] }))
    expect(unknown.kindUnknown).toBe(true)
    expect(lienTimelineFoldSummary(unknown).notes).toContain(LIEN_KIND_UNKNOWN_WORDS)
  })
})
