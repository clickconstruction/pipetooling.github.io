import { describe, expect, it } from 'vitest'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import type { LienCalendarJob } from './lienCalendar'
import { buildLienDeskQueue, summarizeLienDeskForNeedsYou, type LienDeskItemRow, type LienNoticeMonthRow } from './lienDesk'
import { buildLienAffidavitQueue, type LienAffidavitRow } from './lienDeskAffidavits'
import { EMPTY_LIEN_RETAINAGE_QUEUE } from './lienDeskRetainage'
import { buildLienStatusPayload, lienShareHouseJobs, lienShareJobName, lienShareScopeFacts, lienShareScopeOptions, lienStatusJobFor } from './lienDeskShare'
import { buildLienSupplierJobs } from './lienJobSuppliers'
import { lienStatusText } from '../../../supabase/functions/_shared/lienDeskStatus'

const TODAY = '2026-10-01'
const NOW = '2026-10-01T19:14:00.000Z'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const GC = { SP: 'gc-sp', RMC: 'gc-rmc', LOB: 'gc-lob', HOL: 'gc-hol' }

function row(job: number, month: string, deadline: string, gc: string, owed: number, hasOwner = true): LienNoticeMonthRow {
  return { job_id: id(job), work_month: month, approved_hours: 8, deadline, noticed: false, open_balance: owed, customer_id: gc, gc_customer_id: gc, property_kind: 'non_residential', has_owner: hasOwner, desk_item_id: null, desk_status: null, desk_months: null }
}

function item(job: number, status: string, months: string[], extra: Partial<LienDeskItemRow> = {}): LienDeskItemRow {
  return {
    id: `item-${job}`,
    job_id: id(job),
    kind: 'notice_53_056',
    status,
    months,
    created_at: '2026-09-20T15:00:00Z',
    updated_at: '2026-09-20T15:00:00Z',
    drafted_at: '2026-09-20T15:00:00Z',
    voided_at: null,
    sent_at: null,
    submitted_at: null,
    printed_at: null,
    ...extra,
  } as unknown as LienDeskItemRow
}

const rows: LienNoticeMonthRow[] = [
  // 878 · awaiting approval, Jul + Aug on the paper
  row(878, '2026-07', '2026-10-15', GC.SP, 38625),
  row(878, '2026-08', '2026-11-16', GC.SP, 38625),
  // 273 · awaiting, the paper names a closed June as well
  row(273, '2026-06', '2026-09-15', GC.RMC, 17585),
  row(273, '2026-07', '2026-10-15', GC.RMC, 17585),
  // 650 · a stale June draft; July is what is open now
  row(650, '2026-07', '2026-10-15', GC.LOB, 15722),
  // 927 · no owner of record
  row(927, '2026-08', '2026-10-15', GC.HOL, 7429, false),
  // 801 · printed, tracking owed · 802 · approved for the run · 803 · only a closed month
  row(801, '2026-08', '2026-10-15', GC.RMC, 1000),
  row(802, '2026-08', '2026-10-15', GC.RMC, 2000),
  row(803, '2026-06', '2026-09-15', GC.RMC, 300),
]
const items: LienDeskItemRow[] = [
  item(878, 'awaiting_approval', ['2026-07', '2026-08'], { submitted_at: '2026-09-24T15:00:00Z' }),
  item(273, 'awaiting_approval', ['2026-06', '2026-07'], { submitted_at: '2026-09-22T15:00:00Z' }),
  item(650, 'drafted', ['2026-06']),
  item(801, 'approved', ['2026-08'], { printed_at: '2026-09-29T15:00:00Z' }),
  item(802, 'approved', ['2026-08']),
]
const affidavitRows: LienAffidavitRow[] = [
  { job_id: id(838), last_month: '2026-06', deadline: '2026-10-15', is_sub: false, noticed: false, filed: false, open_balance: 350, customer_id: 'c-838', gc_customer_id: null, property_kind: 'residential', has_owner: false, has_legal: false, homestead: false, desk_item_id: null, desk_status: null },
  { job_id: id(881), last_month: '2026-07', deadline: '2026-10-15', is_sub: true, noticed: false, filed: false, open_balance: 1050, customer_id: GC.RMC, gc_customer_id: GC.RMC, property_kind: 'residential', has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null },
  { job_id: id(700), last_month: '2026-05', deadline: '2026-09-15', is_sub: false, noticed: false, filed: true, open_balance: 900, customer_id: 'c-700', gc_customer_id: null, property_kind: 'residential', has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null },
]

function job(n: number, name: string) {
  return { id: id(n), hcp_number: String(n), click_number: null, job_name: name }
}
const queue = buildLienDeskQueue(rows, items, {}, TODAY)
const data = {
  queue,
  summary: summarizeLienDeskForNeedsYou(queue),
  affidavits: buildLienAffidavitQueue(affidavitRows, [], TODAY),
  retainage: EMPTY_LIEN_RETAINAGE_QUEUE(),
  jobsById: Object.fromEntries([job(878, 'Take 5- Seguin'), job(273, 'Dudley (Lennox)'), job(650, 'ATI Schertz'), job(927, 'Mike Holub- Candelria'), job(801, 'Mailed one'), job(802, 'Approved one'), job(803, 'Gone one'), job(838, 'Bruce Hall'), job(881, 'Dudley Mason')].map((j) => [j.id, j])),
  gcsById: {
    [GC.SP]: { id: GC.SP, name: 'Southern Post Construction' },
    [GC.RMC]: { id: GC.RMC, name: 'RMC- Dudley Mason' },
    [GC.LOB]: { id: GC.LOB, name: 'Loberg Contracting' },
    [GC.HOL]: { id: GC.HOL, name: 'Michael Holub' },
  },
} as unknown as LienDeskData

function cal(n: number, gcId: string | null, owed: number, state: string, kindAssumed = false): LienCalendarJob {
  return { jobId: id(n), number: String(n), name: '', customer: '', gcId, gcName: null, address: '', openBalance: owed, isSub: gcId != null, runway: { state, kindAssumed } } as unknown as LienCalendarJob
}
const calendarRows = [cal(927, GC.HOL, 7429, 'notice_due', true), cal(977, GC.RMC, 15406, 'notice_due', true), cal(186, GC.RMC, 6200, 'closed'), cal(102, null, 5355, 'closed'), cal(560, null, 400, 'filed', true)]

describe('buildLienStatusPayload — the desk folded into the message (v2.4311)', () => {
  const p = buildLienStatusPayload({ data, calendarRows, todayYmd: TODAY, nowIso: NOW, scope: 'all' })
  const byNumber = Object.fromEntries(p.jobs.map((j) => [j.number, j]))

  it('takes every notice not yet mailed, and only those', () => {
    expect(Object.keys(byNumber).sort()).toEqual(['273', '650', '802', '878', '927'])
    expect(byNumber['878']!.where).toBe('approval')
    expect(byNumber['927']!.where).toBe('owner')
    expect(byNumber['650']!.where).toBe('draft')
    expect(byNumber['802']!.where).toBe('ready')
    expect(p.trackingOwed).toBe(1)
  })

  it('names the paper’s months past the draft, and a draft’s open months', () => {
    expect(byNumber['878']!.months).toEqual(['2026-07', '2026-08'])
    expect(byNumber['273']!.months).toEqual(['2026-06', '2026-07'])
    expect(byNumber['650']!.months).toEqual(['2026-07'])
  })

  it('dates each job by its earliest open month, whatever an old draft names', () => {
    expect(byNumber['273']!.byYmd).toBe('2026-10-15')
    expect(byNumber['650']!.byYmd).toBe('2026-10-15')
    expect(byNumber['878']!.sinceYmd).toBe('2026-09-24')
    expect(byNumber['650']!.sinceYmd).toBe('')
  })

  it('carries the affidavits still to file and what each needs', () => {
    // The Affidavits tab's own order: soonest first, then the most money.
    expect(p.liens).toEqual([
      { number: '881', name: 'Dudley Mason', gc: 'RMC- Dudley Mason', owed: 1050, byYmd: '2026-10-15', needs: ['notice'] },
      { number: '838', name: 'Bruce Hall', gc: '', owed: 350, byYmd: '2026-10-15', needs: ['owner', 'legal'] },
    ])
  })

  it('reads kinds not set and windows already gone from the Calendar rows', () => {
    expect(p.kindsUnset).toBe(2)
    expect(p.pastWindow).toEqual({ jobs: 2, owed: 11555 })
  })

  it('says the Dashboard’s number when nothing is approved or held', () => {
    const plain = { ...data, queue: buildLienDeskQueue(rows.filter((r) => r.job_id !== id(802)), items.filter((i) => i.job_id !== id(802)), {}, TODAY) } as LienDeskData
    const summary = summarizeLienDeskForNeedsYou(plain.queue)
    const q = buildLienStatusPayload({ data: plain, calendarRows, todayYmd: TODAY, nowIso: NOW, scope: 'all' })
    expect(q.jobs.reduce((s, j) => s + j.owed, 0)).toBe(summary.office.dollars + summary.leader.dollars)
    expect(q.jobs).toHaveLength(summary.office.jobs + summary.leader.jobs)
  })

  it('renders through the shared text without a gap', () => {
    const text = lienStatusText(p)
    expect(text).toContain('We are about to send lien notices on 5 jobs.')
    expect(text).toContain('• Take 5- Seguin, Southern Post Construction, $38,625')
    expect(text).toContain('Approved for the next run: 1 notice, $2,000.')
    expect(text).toContain('Type the tracking number on 1 mailed notice.')
  })
})

describe('one GC', () => {
  const p = buildLienStatusPayload({ data, calendarRows, todayYmd: TODAY, nowIso: NOW, scope: GC.RMC })

  it('keeps only that GC’s notices, liens and Calendar rows', () => {
    expect(p.gc).toBe('RMC- Dudley Mason')
    expect(p.jobs.map((j) => j.number).sort()).toEqual(['273', '802'])
    expect(p.trackingOwed).toBe(1)
    expect(p.liens.map((l) => l.number)).toEqual(['881'])
    expect(p.kindsUnset).toBe(1)
    expect(p.pastWindow).toEqual({ jobs: 1, owed: 6200 })
  })
})

describe('lienShareScopeOptions — the Which liens menu', () => {
  it('the whole desk first, then each GC with a notice, most money first', () => {
    const opts = lienShareScopeOptions(data)
    expect(opts.map((o) => o.name)).toEqual(['Everything on the desk', 'Southern Post Construction', 'RMC- Dudley Mason', 'Loberg Contracting', 'Michael Holub'])
    expect(opts[0]).toMatchObject({ key: 'all', jobs: 5, owed: 38625 + 17585 + 15722 + 7429 + 2000, firstYmd: '2026-10-15', waiting: 2, needOwner: 1 })
    expect(opts[2]).toMatchObject({ key: GC.RMC, jobs: 2, owed: 19585, waiting: 1 })
  })

  it('offers only the whole desk before the desk loads', () => {
    expect(lienShareScopeOptions(null)).toEqual([{ key: 'all', name: 'Everything on the desk', jobs: 0, owed: 0, firstYmd: '', waiting: 0, needOwner: 0 }])
  })
})

describe('lienShareJobName', () => {
  it('drops a trailing (HCP n) that repeats the number the line leads with, and nothing else', () => {
    expect(lienShareJobName('858', 'Service Visit — 9703 Lenox Hl (HCP 858)')).toBe('Service Visit — 9703 Lenox Hl')
    expect(lienShareJobName('858', 'Service Visit (HCP 859)')).toBe('Service Visit (HCP 859)')
    expect(lienShareJobName('922', 'Michael Palmer (Ivan Kopecky)')).toBe('Michael Palmer (Ivan Kopecky)')
    expect(lienShareJobName('1046 PLUM', 'Pretest (#1046 PLUM)')).toBe('Pretest')
    expect(lienShareJobName('', ' Dudley Mason ')).toBe('Dudley Mason')
  })
})

describe('the houses choice — lien jobs where a supply house is also owed (v2.4407)', () => {
  // 650: Reece owed on July (open, Oct 15) and Winn on June (closed). 878: paid up. 977 is on the Calendar only.
  const suppliers = buildLienSupplierJobs({
    invoices: [
      { id: 'a', supply_house_id: 'reece', amount: 9000, is_paid: false, invoice_date: '2026-07-10', paidYmd: null, on_job_account: false },
      { id: 'b', supply_house_id: 'winn', amount: 1500, is_paid: false, invoice_date: '2026-06-10', paidYmd: null, on_job_account: false },
      { id: 'c', supply_house_id: 'reece', amount: 400, is_paid: true, invoice_date: '2026-06-10', paidYmd: '2026-07-01', on_job_account: false },
      { id: 'd', supply_house_id: 'winn', amount: 700, is_paid: false, invoice_date: '2026-08-10', paidYmd: null, on_job_account: true },
    ],
    allocations: [
      { invoice_id: 'a', job_id: id(650), pct: 100 },
      { invoice_id: 'b', job_id: id(650), pct: 100 },
      { invoice_id: 'c', job_id: id(878), pct: 100 },
      { invoice_id: 'd', job_id: id(977), pct: 100 },
    ],
    houses: [
      { id: 'reece', name: 'Reece' },
      { id: 'winn', name: 'Winn Supply' },
    ],
  })
  const houses = lienShareHouseJobs({ data, calendarRows, suppliers, todayYmd: TODAY })

  it('lists every desk job with a house still owed, and no paid-up one', () => {
    expect(houses.map((h) => h.number).sort()).toEqual(['650', '977'])
    const j650 = houses.find((h) => h.number === '650')!
    // Two houses owed; Reece's July window is the one still open.
    expect(j650).toMatchObject({ name: 'ATI Schertz', gc: 'Loberg Contracting', owed: 15722, housesOwed: 10500, houses: 2, house: 'Reece', byYmd: '2026-10-15', jobAccount: false })
    // A Calendar-only job takes its words from its row.
    expect(houses.find((h) => h.number === '977')).toMatchObject({ owed: 15406, housesOwed: 700, houses: 1, house: 'Winn Supply', byYmd: '2026-11-16', jobAccount: true })
  })

  it('is the second thing to send, and only when there is one', () => {
    const options = lienShareScopeOptions(data, houses)
    expect(options.map((o) => o.key).slice(0, 2)).toEqual(['all', 'houses'])
    expect(options[1]).toMatchObject({ name: 'Jobs where a supply house is also owed', jobs: 2, owed: 11200, firstYmd: '2026-10-15', toHouses: true })
    expect(lienShareScopeFacts(options[1]!)).toBe('2 jobs · $11,200 to houses')
    expect(lienShareScopeOptions(data).some((o) => o.key === 'houses')).toBe(false)
  })

  it('sends its own list and nothing of the notices', () => {
    const p = buildLienStatusPayload({ data, calendarRows, todayYmd: TODAY, nowIso: NOW, scope: 'houses', houses })
    expect(p.jobs).toEqual([])
    expect(p.liens).toEqual([])
    expect(p.houses).toHaveLength(2)
    expect(lienStatusText(p)).toContain('2 lien jobs still owe a supply house.')
    // Every other choice leaves the list out.
    expect(buildLienStatusPayload({ data, calendarRows, todayYmd: TODAY, nowIso: NOW, scope: 'all', houses })).not.toHaveProperty('houses')
  })
})

describe('a notice sent for approval in the evening keeps its day (v2.4468)', () => {
  it('dates Waiting since by the Central day', () => {
    // 00:30 UTC on Sep 25 is 7:30 pm CDT on Sep 24; 00:30 UTC on Dec 2 is 6:30 pm CST on Dec 1.
    const since = (submitted_at: string) => {
      const q = buildLienDeskQueue([row(878, '2026-07', '2026-10-15', GC.SP, 38625)], [item(878, 'awaiting_approval', ['2026-07'], { submitted_at })], {}, TODAY)
      return lienStatusJobFor({ ...data, queue: q } as LienDeskData, q.entries[0]!)?.sinceYmd
    }
    expect(since('2026-09-25T00:30:00Z')).toBe('2026-09-24')
    expect(since('2026-12-02T00:30:00Z')).toBe('2026-12-01')
    expect(since('2026-09-25T12:00:00Z')).toBe('2026-09-25')
  })
})
