import { describe, expect, it } from 'vitest'
import { buildLienDeskMoneyCard, lienDeskCount } from './lienDeskMoneyCard'
import type { LienDeskNeedsYou } from './lienDesk'

const TODAY = '2026-09-24'

function summary(over: { office?: Partial<LienDeskNeedsYou['office']>; leader?: Partial<LienDeskNeedsYou['leader']> } = {}): LienDeskNeedsYou {
  return {
    office: {
      jobs: 0,
      months: 0,
      dollars: 0,
      needsOwner: 0,
      earliestDeadline: null,
      ready: 0,
      next: { deadline: null, notices: 0, dollars: 0, gcIds: [], gcNames: [], toDraft: 0, needsOwner: 0, affidavitBy: null },
      ...over.office,
    },
    leader: { jobs: 0, dollars: 0, earliestDeadline: null, affidavitBy: null, ...over.leader },
    held: 0,
    missed: { jobs: 0, months: 0, dollars: 0, lines: [], lateNotice: { jobs: 0, months: 0, dollars: 0, by: null }, gone: { jobs: 0, months: 0, dollars: 0 } },
  }
}

describe('buildLienDeskMoneyCard', () => {
  it('is null with no summary and null when nothing is due — the card stays off the strip', () => {
    expect(buildLienDeskMoneyCard(null, TODAY)).toBeNull()
    expect(buildLienDeskMoneyCard(summary(), TODAY)).toBeNull()
    // Approved-and-waiting alone is the run's business, not a notice due.
    expect(buildLienDeskMoneyCard(summary({ office: { ready: 3 } }), TODAY)).toBeNull()
  })

  it('counts the office piles and the awaiting pile together, dollars summed, the earliest of both dates', () => {
    const card = buildLienDeskMoneyCard(
      summary({
        office: {
          jobs: 3,
          dollars: 20_000,
          needsOwner: 1,
          earliestDeadline: '2026-10-15',
          ready: 4,
          next: { deadline: '2026-10-15', notices: 2, dollars: 12_000, gcIds: ['a', 'b'], gcNames: ['Dunmere Mallin', 'RLC'], toDraft: 1, needsOwner: 1, affidavitBy: null },
        },
        leader: { jobs: 2, dollars: 8_987, earliestDeadline: '2026-10-03' },
      }),
      TODAY,
    )
    expect(card).toMatchObject({
      claim: '5 lien notices due · $28,987 — the earliest by Oct 3',
      why: 'In 9 days: the first window closes · 2 to draft · 1 waiting on the owner of record · 2 awaiting approval · 4 approved for the run',
      count: 5,
      tone: 'amber',
    })
    // The two-line card (v2.3822): the title is the count and the money; the piles are chips in the desk's order; the deadline chip opens the pile the earliest sits in.
    expect(card?.title).toBe('5 lien notices due · $28,987')
    expect(card?.piles).toEqual([
      { key: 'needs_owner', label: '1 needs an owner', count: 1 },
      { key: 'to_draft', label: '2 to draft', count: 2 },
      { key: 'awaiting', label: '2 awaiting approval', count: 2 },
      { key: 'ready', label: '4 approved for the run', count: 4 },
    ])
    expect(card?.deadline).toEqual({ label: 'by Oct 3 · in 9 days', who: null, tone: 'amber', hover: 'In 9 days: the first window closes — mail by Oct 3 or the lien right on that work is gone', pile: 'awaiting' })
  })

  it("names the earliest day's GCs when the office's next deadline is the earliest, and goes red inside a week", () => {
    const card = buildLienDeskMoneyCard(
      summary({
        office: {
          jobs: 1,
          dollars: 13_680,
          needsOwner: 0,
          earliestDeadline: '2026-09-29',
          next: { deadline: '2026-09-29', notices: 1, dollars: 13_680, gcIds: ['a'], gcNames: ['Southern Pine'], toDraft: 1, needsOwner: 0, affidavitBy: null },
        },
      }),
      TODAY,
    )
    expect(card).toMatchObject({
      claim: '1 lien notice due · $13,680 — the earliest by Sep 29',
      why: 'In 5 days: the notice under Southern Pine · 1 to draft — mail by Sep 29 or the lien right on that work is gone',
      count: 1,
      tone: 'red',
    })
    expect(card?.deadline).toEqual({ label: 'by Sep 29 · in 5 days', who: 'Southern Pine', tone: 'red', hover: 'In 5 days: the notice under Southern Pine — mail by Sep 29 or the lien right on that work is gone', pile: 'to_draft' })
  })

  it('reads today / tomorrow, and stays gray past two weeks or with no date at all', () => {
    const today = buildLienDeskMoneyCard(summary({ office: { jobs: 1, dollars: 100, earliestDeadline: TODAY, next: { deadline: TODAY, notices: 1, dollars: 100, gcIds: [], gcNames: [], toDraft: 1, needsOwner: 0, affidavitBy: null } } }), TODAY)
    expect(today?.why.startsWith('Today: the notice ·')).toBe(true)
    expect(today?.tone).toBe('red')
    const tomorrow = buildLienDeskMoneyCard(summary({ leader: { jobs: 1, dollars: 100, earliestDeadline: '2026-09-25' } }), TODAY)
    expect(tomorrow?.why).toBe('Tomorrow: the first window closes · 1 awaiting approval — mail by Sep 25 or the lien right on that work is gone')
    const far = buildLienDeskMoneyCard(summary({ leader: { jobs: 1, dollars: 100, earliestDeadline: '2026-11-30' } }), TODAY)
    expect(far?.tone).toBe('gray')
    const undated = buildLienDeskMoneyCard(summary({ leader: { jobs: 2, dollars: 500 } }), TODAY)
    expect(undated).toEqual({ claim: '2 lien notices due · $500', why: '2 awaiting approval', count: 2, tone: 'gray', title: '2 lien notices due · $500', piles: [{ key: 'awaiting', label: '2 awaiting approval', count: 2 }], deadline: null })
    expect(today?.deadline?.label).toBe('today')
    expect(tomorrow?.deadline).toMatchObject({ label: 'tomorrow', pile: 'awaiting' })
  })

  it('a window already closed reads closed, not "today" — red, and without the mail-by line', () => {
    // Prod, 2026-09-24: the desk's earliest window was Sep 15 and the first cut of the card said "Today".
    const card = buildLienDeskMoneyCard(
      summary({
        office: {
          jobs: 15,
          dollars: 150_000,
          needsOwner: 2,
          earliestDeadline: '2026-09-15',
          next: { deadline: '2026-09-15', notices: 1, dollars: 9_000, gcIds: ['a'], gcNames: ['Lowbeck Contracting'], toDraft: 1, needsOwner: 0, affidavitBy: null },
        },
        leader: { jobs: 1, dollars: 6_423, earliestDeadline: '2026-10-20' },
      }),
      TODAY,
    )
    expect(card).toMatchObject({
      claim: '16 lien notices due · $156,423 — the earliest closed Sep 15',
      why: 'Closed 9 days ago: the notice under Lowbeck Contracting · 13 to draft · 2 waiting on the owner of record · 1 awaiting approval',
      count: 16,
      tone: 'red',
    })
    expect(card?.deadline).toEqual({ label: 'closed Sep 15', who: 'Lowbeck Contracting', tone: 'red', hover: 'Closed 9 days ago: the notice under Lowbeck Contracting — the window closed; a late notice can still carry the affidavit while its own window is open', pile: 'to_draft' })
    expect(buildLienDeskMoneyCard(summary({ leader: { jobs: 1, dollars: 1, earliestDeadline: '2026-09-23' } }), TODAY)?.why).toBe('Closed yesterday: the first window closes · 1 awaiting approval')
  })

  it('a closed window whose affidavit can still be filed says send the late notice by <day>; one whose affidavit day passed too says gone (v2.7273, punch list #335, row 4)', () => {
    const closedOn = (affidavitBy: string | null) =>
      buildLienDeskMoneyCard(
        summary({
          office: { jobs: 1, dollars: 9_000, earliestDeadline: '2026-09-15', next: { deadline: '2026-09-15', notices: 1, dollars: 9_000, gcIds: ['a'], gcNames: ['Lowbeck Contracting'], toDraft: 1, needsOwner: 0, affidavitBy } },
        }),
        TODAY,
      )
    // The affidavit's day, Oct 15, is 21 days ahead: the clock's words, amber (red inside a week), the chip leads with the late notice.
    const late = closedOn('2026-10-15')
    expect(late).toMatchObject({
      claim: '1 lien notice due · $9,000 — the earliest closed Sep 15 · send the late notice by Oct 15',
      why: 'Closed 9 days ago: the notice under Lowbeck Contracting · 1 to draft — the window closed; send the late notice by Oct 15 and the affidavit can still follow',
      tone: 'amber',
    })
    expect(late?.deadline).toEqual({ label: 'late notice by Oct 15 · in 21 days', who: 'Lowbeck Contracting', tone: 'amber', hover: 'Closed 9 days ago: the notice under Lowbeck Contracting — the window closed; send the late notice by Oct 15 and the affidavit can still follow', pile: 'to_draft' })
    expect(closedOn('2026-09-30')?.tone).toBe('red')
    expect(closedOn('2026-09-30')?.deadline?.label).toBe('late notice by Sep 30 · in 6 days')
    // The affidavit's day passed on Sep 15 too: closed for good, red, the gone words.
    const gone = closedOn('2026-09-15')
    expect(gone).toMatchObject({ claim: '1 lien notice due · $9,000 — the earliest closed Sep 15', why: 'Closed 9 days ago: the notice under Lowbeck Contracting · 1 to draft — the window closed and the affidavit’s day has passed too; the lien right on that work is gone', tone: 'red' })
    expect(gone?.deadline).toMatchObject({ label: 'closed Sep 15', tone: 'red', hover: 'Closed 9 days ago: the notice under Lowbeck Contracting — the window closed and the affidavit’s day has passed too; the lien right on that work is gone' })
    // No affidavit day known: the words it had.
    expect(closedOn(null)?.deadline).toMatchObject({ label: 'closed Sep 15', hover: 'Closed 9 days ago: the notice under Lowbeck Contracting — the window closed; a late notice can still carry the affidavit while its own window is open' })
    // The leader's pile first (job 891 on 2026-11-14, awaiting approval a month past its window): its own affidavit day reads the same way.
    const leaderFirst = buildLienDeskMoneyCard(summary({ leader: { jobs: 1, dollars: 2_976, earliestDeadline: '2026-09-15', affidavitBy: '2026-10-15' } }), TODAY)
    expect(leaderFirst).toMatchObject({ claim: '1 lien notice due · $2,976 — the earliest closed Sep 15 · send the late notice by Oct 15', why: 'Closed 9 days ago: the first window closes · 1 awaiting approval — the window closed; send the late notice by Oct 15 and the affidavit can still follow', tone: 'amber' })
    expect(leaderFirst?.deadline).toMatchObject({ label: 'late notice by Oct 15 · in 21 days', tone: 'amber', pile: 'awaiting' })
  })
})

describe('lienDeskCount (v2.3862)', () => {
  it('is the office’s jobs to draft, the leader’s jobs and the approved notices waiting for the run; null before the desk loads', () => {
    expect(lienDeskCount(summary({ office: { jobs: 4, ready: 3 }, leader: { jobs: 2, dollars: 1, earliestDeadline: null } }))).toBe(9)
    expect(lienDeskCount(summary())).toBe(0)
    expect(lienDeskCount(null)).toBeNull()
    expect(lienDeskCount(undefined)).toBeNull()
  })
})
