import { describe, expect, it } from 'vitest'
import {
  buildGcOnNotice,
  closedWindowsSentence,
  daysUntil,
  gcNoticeBatchReason,
  gcNoticeFooterWords,
  gcNoticeMonthWords,
  type GcNoticeOwnerState,
  type GcUnpaidMonthRow,
} from './gcOnNotice'
import type { LienDeskItemRow } from './lienDesk'

const TODAY = '2026-09-14'

function row(job_id: string, work_month: string, deadline: string, extra: Partial<GcUnpaidMonthRow> = {}): GcUnpaidMonthRow {
  return {
    job_id,
    work_month,
    approved_hours: 8,
    deadline,
    noticed: false,
    open_balance: 12400,
    customer_id: 'c1',
    gc_customer_id: 'harborline',
    property_kind: '',
    has_owner: true,
    desk_item_id: null,
    desk_status: null,
    desk_months: null,
    is_billed: true,
    job_status: 'billed',
    last_work_month: work_month,
    ...extra,
  }
}

function item(id: string, job_id: string, status: LienDeskItemRow['status'], created_at = '2026-09-10T00:00:00Z'): LienDeskItemRow {
  return { id, job_id, kind: 'notice_53_056', status, months: ['2026-07'], fields: {}, cover_note: true, voided_at: null, created_at } as unknown as LienDeskItemRow
}

const owners: Record<string, GcNoticeOwnerState> = { j994: 'on_file', j1016: 'missing', j1002: 'public', j1031: 'on_file', j1040: 'unconfirmed' }
const ownerOf = (id: string) => owners[id] ?? 'missing'

describe('buildGcOnNotice · the claim set by hand (v2.3684)', () => {
  it('claims the corrected figure, sorts and totals on it, and flags over-the-balance jobs', () => {
    const rows = [row('j994', '2026-07', '2026-10-15', { open_balance: 9_800 }), row('j1031', '2026-07', '2026-10-15', { open_balance: 5_000 })]
    const correction = { jobId: 'j994', amountOff: 1_500, perMonth: null, reason: 'GC disputes the 8/14 change order', carry: true, setByName: 'Taunya', setAt: '2026-09-21T15:00:00Z', lookedAt: null, lookedByName: '' }
    const { jobs, summary } = buildGcOnNotice(rows, [], ownerOf, TODAY, (id) => (id === 'j994' ? correction : null))
    expect(jobs.map((j) => [j.jobId, j.claimAmount, j.openBalance, j.claimCorrected, j.claimDelta, j.claimOver])).toEqual([
      ['j994', 8_300, 9_800, true, -1_500, false],
      ['j1031', 5_000, 5_000, false, 0, false],
    ])
    expect(summary.claimTotal).toBe(13_300)
    const over = buildGcOnNotice(rows, [], ownerOf, TODAY, (id) => (id === 'j1031' ? { ...correction, jobId: 'j1031', amountOff: -700 } : null))
    expect(over.jobs.find((j) => j.jobId === 'j1031')).toMatchObject({ claimAmount: 5_700, claimOver: true })
    // No correction: the figures are the app's, untouched.
    expect(buildGcOnNotice(rows, [], ownerOf, TODAY).jobs[0]).toMatchObject({ claimAmount: 9_800, claimCorrected: false, claimDelta: 0 })
  })
})

describe('buildGcOnNotice', () => {
  it('folds months per job oldest first, keeps noticed months aside, names a closed window, dates the affidavit, and reads readiness', () => {
    const rows = [
      row('j994', '2026-05', '2026-07-15', { open_balance: 18750, property_kind: 'residential' }),
      row('j994', '2026-06', '2026-08-17', { open_balance: 18750, property_kind: 'residential' }),
      row('j994', '2026-07', '2026-09-15', { open_balance: 18750, property_kind: 'residential', noticed: true }),
      row('j994', '2026-08', '2026-10-15', { open_balance: 18750, property_kind: 'residential', last_work_month: '2026-08' }),
    ]
    const { jobs } = buildGcOnNotice(rows, [], ownerOf, TODAY)
    expect(jobs).toHaveLength(1)
    const j = jobs[0]!
    expect(j.months.map((m) => m.key)).toEqual(['2026-05', '2026-06', '2026-08'])
    expect(j.months.map((m) => m.closed)).toEqual([true, true, false])
    expect(j.noticedMonths).toEqual(['2026-07'])
    expect(j.claimAmount).toBe(18750)
    expect(j.isBilled).toBe(true)
    // residential: 15th of the 3rd month after August = Nov 15 2026, a Sunday → Nov 16
    expect(j.affidavitBy).toBe('2026-11-16')
    expect(j.readiness).toBe('ready')
  })

  it('an unbilled Working job claims its contract balance; a public owner is excluded; a missing owner waits; an unconfirmed one waits too; an approved item is already in a run', () => {
    const rows = [
      row('j1031', '2026-07', '2026-10-15', { open_balance: 9800, is_billed: false, job_status: 'working' }),
      row('j1002', '2026-07', '2026-10-15', { open_balance: 11300 }),
      row('j1016', '2026-07', '2026-10-15', { open_balance: 12400 }),
      row('j1040', '2026-07', '2026-10-15', { open_balance: 5000 }),
      row('j994', '2026-08', '2026-10-15', { open_balance: 18750 }),
    ]
    const { jobs, summary } = buildGcOnNotice(rows, [item('i1', 'j994', 'approved')], ownerOf, TODAY)
    const by = Object.fromEntries(jobs.map((j) => [j.jobId, j]))
    expect(by.j1031!.isBilled).toBe(false)
    expect(by.j1031!.claimAmount).toBe(9800)
    expect(by.j1031!.readiness).toBe('ready')
    expect(by.j1002!.readiness).toBe('public_owner')
    expect(by.j1016!.readiness).toBe('needs_owner')
    expect(by.j1040!.readiness).toBe('unconfirmed_owner')
    expect(by.j994!.readiness).toBe('already_sent')
    expect(by.j994!.item?.id).toBe('i1')
    // biggest claim first
    expect(jobs.map((j) => j.jobId)).toEqual(['j994', 'j1016', 'j1002', 'j1031', 'j1040'])
    expect(summary).toMatchObject({
      jobs: 5,
      billedJobs: 4,
      unbilledJobs: 1,
      openOnBills: 18750 + 11300 + 12400 + 5000,
      notYetBilled: 9800,
      unpaidMonths: 5,
      ownersOnFile: 2,
      ownersMissing: 1,
      ownersUnconfirmed: 1,
      publicOwners: 1,
      ready: 1,
      waitingOwner: 2,
      excluded: 2,
      claimTotal: 9800,
      envelopes: 2,
      earliestOpenDeadline: '2026-10-15',
    })
  })

  it('a job whose every month is noticed has nothing to name; the newest live item wins', () => {
    const rows = [row('j5', '2026-07', '2026-10-15', { noticed: true })]
    const { jobs } = buildGcOnNotice(rows, [item('old', 'j5', 'drafted', '2026-09-01T00:00:00Z'), item('new', 'j5', 'held', '2026-09-12T00:00:00Z')], ownerOf, TODAY)
    expect(jobs[0]!.readiness).toBe('no_months')
    expect(jobs[0]!.item?.id).toBe('new')
  })
})

describe('the words', () => {
  const monthLabel = (k: string) => ({ '2026-05': 'May', '2026-06': 'Jun', '2026-08': 'Aug' })[k] ?? k
  const dayLabel = (d: string) => ({ '2026-07-15': 'Jul 15', '2026-08-17': 'Aug 17', '2026-10-15': 'Oct 15' })[d] ?? d
  it('month chips and the closed-window sentence', () => {
    expect(gcNoticeMonthWords({ key: '2026-05', hours: 4, deadline: '2026-07-15', closed: true }, monthLabel, dayLabel)).toBe('May · was due Jul 15 · window closed')
    expect(gcNoticeMonthWords({ key: '2026-08', hours: 4, deadline: '2026-10-15', closed: false }, monthLabel, dayLabel)).toBe('Aug · by Oct 15')
    expect(
      closedWindowsSentence(
        [
          { key: '2026-05', hours: 4, deadline: '2026-07-15', closed: true },
          { key: '2026-06', hours: 4, deadline: '2026-08-17', closed: true },
          { key: '2026-08', hours: 4, deadline: '2026-10-15', closed: false },
        ],
        monthLabel,
      ),
    ).toBe('May and Jun are named as information: their lien is gone, the owner still learns the balance.')
    expect(closedWindowsSentence([{ key: '2026-08', hours: 4, deadline: '2026-10-15', closed: false }], monthLabel)).toBe('')
  })
  it('the footer line and the batch reason', () => {
    const s = { ready: 2, waitingOwner: 7, publicOwners: 1 }
    expect(gcNoticeFooterWords({ ...s } as never, { foundOnRoll: 6 })).toBe('2 ready now · 6 more the moment Use all found is pressed · 1 waits on an owner · 1 left out (public owner)')
    expect(gcNoticeBatchReason('not_paying_subs', ' Sarah said the draw was spent ')).toBe('GC is not paying its subs — Sarah said the draw was spent')
    expect(gcNoticeBatchReason('other', '')).toBe('Other')
    expect(daysUntil('2026-09-15', TODAY)).toBe(1)
    expect(daysUntil(null, TODAY)).toBeNull()
  })
})

describe('the cover letter (v2.3482)', () => {
  it('the default names the GC and the claimant, carries the three fills, and fills per notice', async () => {
    const { defaultGcNoticeCoverLetter, fillCoverLetter, coverLetterParagraphs, COVER_LETTER_FILLS } = await import('./gcOnNotice')
    const t = defaultGcNoticeCoverLetter({ gcName: 'Harborline Builders', claimantName: 'Click Plumbing and Electrical' })
    expect(t).toContain(COVER_LETTER_FILLS.property)
    expect(t).toContain(COVER_LETTER_FILLS.months)
    expect(t).toContain('§ 53.081')
    expect(t).toContain('working under Harborline Builders')
    const filled = fillCoverLetter(t, { property: '212 Kettle Dr, Buda', months: 'May, June, July and August 2026', job: '994' })
    expect(filled.startsWith('To the owner of 212 Kettle Dr, Buda,')).toBe(true)
    expect(filled).toContain('completed in May, June, July and August 2026')
    expect(filled).not.toContain('{{')
    expect(coverLetterParagraphs(filled)).toHaveLength(4)
    expect(coverLetterParagraphs('one\n\n\n  \ntwo\nstill two\n')).toEqual(['one', 'two still two'])
    expect(fillCoverLetter('{{property}} {{months}} {{job}}', { property: '', months: '', job: '' })).toBe('your property the months named ')
  })
})

describe('lienDeskBatches (v2.3479)', () => {
  it('groups the awaiting items that carry a batch reason by GC, biggest first; items without one are the desk\'s own', async () => {
    const { lienDeskBatches } = await import('./gcOnNotice')
    const entry = (jobId: string, gc: string | null, openBalance: number, fields: unknown, earliestDeadline: string | null) =>
      ({ jobId, gcCustomerId: gc, openBalance, earliestDeadline, item: { fields, status: 'awaiting_approval' } }) as never
    const notice = { noticeDate: '2026-09-15', projectDescription: '', claimantName: 'C', laborMaterialsType: '', originalContractorName: '', contractedWithIfDifferent: '', claimAmount: '1', contactPerson: '', claimantAddress: '' }
    const piles = {
      awaiting: [
        entry('j1', 'harborline', 18750, { notice, gcEmail: '', batchReason: 'GC is not paying its subs — the draw was spent' }, '2026-10-15'),
        entry('j2', 'harborline', 12400, { notice, gcEmail: '', batchReason: 'GC is not paying its subs — the draw was spent' }, '2026-09-15'),
        entry('j3', 'stillhouse', 30000, { notice, gcEmail: '', batchReason: 'GC insolvency suspected' }, null),
        entry('j4', 'loberg', 33500, { notice, gcEmail: '' }, '2026-09-15'),
        entry('j5', null, 5, { notice, gcEmail: '', batchReason: 'x' }, null),
      ],
    } as never
    expect(lienDeskBatches({ piles }, { harborline: 'Harborline Builders' })).toEqual([
      { gcId: 'harborline', gcName: 'Harborline Builders', jobs: 2, dollars: 31150, reason: 'GC is not paying its subs — the draw was spent', earliestDeadline: '2026-09-15' },
      { gcId: 'stillhouse', gcName: '', jobs: 1, dollars: 30000, reason: 'GC insolvency suspected', earliestDeadline: null },
    ])
  })
})

describe('the header counts the envelopes the run will mail (v2.3720)', () => {
  it('jobs at one property share the owner envelope; the GC gets one; a job with no owner key counts alone; nothing ready is zero', () => {
    const rows = [row('j1016', '2026-07', '2026-10-15', { open_balance: 9_400 }), row('j1031', '2026-07', '2026-10-15', { open_balance: 5_000 }), row('j706', '2026-07', '2026-10-15', { open_balance: 7_000 })]
    const onFile = () => 'on_file' as const
    const key = (id: string) => (id === 'j706' ? '' : 'lenox hill owner lp|9703 lenox hl san antonio tx 78240')
    const { jobs, summary } = buildGcOnNotice(rows, [], onFile, TODAY, () => null, key)
    // biggest claim first: 1016, 706, 1031
    expect(jobs.map((j) => [j.jobId, j.ownerKey])).toEqual([['j1016', 'lenox hill owner lp|9703 lenox hl san antonio tx 78240'], ['j706', ''], ['j1031', 'lenox hill owner lp|9703 lenox hl san antonio tx 78240']])
    expect(summary.ready).toBe(3)
    expect(summary.envelopes).toBe(3) // one shared owner envelope + one owner alone + the GC
    expect(buildGcOnNotice(rows, [], () => 'missing' as const, TODAY).summary.envelopes).toBe(0)
  })
})
