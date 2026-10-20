/**
 * GC mode: one read of a job's schedule rows for both portals (the schedule's PR 15b, call 4; the plan is
 * to-dos/gc-mode/mockups/schedule-pr15b.md on branch spike/gc-mode). It is 14b's read as the Portal's P5d-ii-1 widened
 * it, moved here from `gc-trade-portal`, with each audience's extra rows behind its own option (gc 3's amendment):
 * `trade` for the company's chart and its side of the schedule, `customer` for the customer's picture. The moves and
 * what they pushed are read for either. So the customer's read never fetches a company's tells, answers, notices,
 * counts, marks or parts, and the trade's never fetches the dates to meet, the waits, the change orders or the
 * customer's row. Each portal's never-sees test guards its own side: what is read is not what leaves.
 */
import type { TradeScheduleRows } from './gcTradePortalSchedule.ts'

type R = Record<string, unknown>
// deno-lint-ignore no-explicit-any
type SupabaseClient = any
const rowsOf = (r: { data: unknown }): R[] => (r.data ?? []) as R[]
const ids = (rows: R[], f = 'id'): string[] => [...new Set(rows.map((r) => String(r[f] ?? '')).filter(Boolean))]

/** Whose extra rows a read adds: the company's own (its chart and its side of the schedule), or the customer's picture. */
export interface ScheduleReadFor {
  trade?: { companyId: string }
  customer?: { customerId: string }
}

/**
 * The rows read. The customer's picture adds, beside the jobs, the customer's own row and each job's change orders as
 * the office view reads them, never a cost, price or percent.
 */
export type ScheduleReadRows = TradeScheduleRows & {
  customer?: { id: string; name: string } | null
  changeOrders?: R[]
}

/** A change order's non-money half: the office view's columns, read from the table, so a price is never read. */
const CHANGE_ORDER_COLUMNS = 'id, project_id, number, description, reason, schedule_words, package_id, status, sent_on, answered_on, days, days_on_chart'

// Reads past PostgREST's 1,000 rows (the schedule's PR 14b): ids in chunks, each chunk a page at a time, in a stable order.
const IN_CHUNK = 150
const PAGE = 1000
type Page = PromiseLike<{ data: unknown; error: unknown }>
export async function readAll(ids: string[], read: (chunk: string[], from: number, to: number) => Page): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK)
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await read(chunk, from, from + PAGE - 1)
      if (error) throw error
      const rows = (data ?? []) as R[]
      out.push(...rows)
      if (rows.length < PAGE) break
    }
  }
  return out
}

/**
 * The rows a portal's schedule reads, held to the jobs given, with the service role. For every audience (the schedule's
 * PR 14b, call 4): each job and its trades, only the awarded invites and those companies' names, the awarded trades'
 * statements of work with their draws and reports for each line's percent, and the bars with what they wait on and the
 * baselines. Then each option's own rows; no bid, no contact and no note beyond them is read.
 */
export async function readScheduleRows(admin: SupabaseClient, jobIds: string[], read: ScheduleReadFor = {}): Promise<ScheduleReadRows> {
  const [projects, gcRows, packages, schedules, activities, links, baselines] = await Promise.all([
    admin.from('projects').select('id, name, address, customer_id, plans_link').in('id', jobIds).then(rowsOf),
    admin.from('gc_projects').select('project_id, stage, bid_due, sq_ft, size_note, customer_role, property_owner_customer_id, architect_customer_id, project_manager_user_id, drive_folder_url, lost_on').in('project_id', jobIds).then(rowsOf),
    readAll(jobIds, (c, from, to) => admin.from('gc_trade_packages').select('id, project_id, trade, position, budget, ours, own_bid_id, job_ledger_id, carried_invite_id, carry_budget, awarded_invite_id, awarded_by, awarded_on').in('project_id', c).order('id').range(from, to)),
    admin.from('gc_schedules').select('project_id, version, template_id, template_name, template_used_on').in('project_id', jobIds).then(rowsOf),
    readAll(jobIds, (c, from, to) => admin.from('gc_schedule_activities').select('id, project_id, kind, position, package_id, start, finish, not_before, must_finish_by, actual_start, actual_finish, place, label, passed_on, who, done_on').in('project_id', c).order('id').range(from, to)),
    readAll(jobIds, (c, from, to) => admin.from('gc_schedule_links').select('project_id, from_activity_id, to_activity_id, gap, created_at').in('project_id', c).order('from_activity_id').order('to_activity_id').range(from, to)),
    admin.from('gc_schedule_baselines').select('id, project_id, name, locked_on, locked_by, why, created_at').in('project_id', jobIds).then(rowsOf),
  ])
  const packageIds = ids(packages as R[])
  const awardedIds = ids(packages as R[], 'awarded_invite_id')
  const [scopeItems, invites, sows, baselineDates] = await Promise.all([
    readAll(packageIds, (c, from, to) => admin.from('gc_scope_items').select('id, package_id, position, label, sheets, specs, added_in_set_id').in('package_id', c).order('id').range(from, to)),
    readAll(awardedIds, (c, from, to) => admin.from('gc_invites').select('id, package_id, company_id, status, invited_on').in('id', c).order('id').range(from, to)),
    readAll(packageIds, (c, from, to) => admin.from('gc_sows').select('id, package_id, status, price, retainage_pct, based_on_rev, their_sov, excluded, sent_on, signed_on, accepted_on').in('package_id', c).order('id').range(from, to)),
    readAll(ids(baselines as R[]), (c, from, to) => admin.from('gc_schedule_baseline_dates').select('baseline_id, activity_id, start, finish').in('baseline_id', c).order('baseline_id').order('activity_id').range(from, to)),
  ])
  const sowIds = ids(sows)
  const [companies, sowLines, draws] = await Promise.all([
    readAll(ids(invites, 'company_id'), (c, from, to) => admin.from('gc_companies').select('id, name').in('id', c).order('id').range(from, to)),
    readAll(sowIds, (c, from, to) => admin.from('gc_sow_lines').select('id, sow_id, position, label, amount, scope_item_id, change_order_id').in('sow_id', c).order('id').range(from, to)),
    readAll(sowIds, (c, from, to) => admin.from('gc_draws').select('*').in('sow_id', c).order('id').range(from, to)),
  ])
  const [drawLines, reports] = await Promise.all([
    readAll(ids(draws), (c, from, to) => admin.from('gc_draw_lines').select('*').in('draw_id', c).order('draw_id').order('sow_line_id').range(from, to)),
    readAll(ids(sowLines), (c, from, to) => admin.from('gc_sow_line_reports').select('*').in('sow_line_id', c).order('id').range(from, to)),
  ])

  // Every move on the job with what it pushed: the trade's told dates are rebuilt from them (P5d-ii, call 2), and the
  // customer's What changed this week reads them.
  const companyId = read.trade?.companyId ?? null
  const customerId = read.customer?.customerId ?? null
  const none = async (): Promise<R[]> => []
  const moves = companyId || customerId ? await readAll(jobIds, (c, from, to) => admin.from('gc_schedule_moves').select('*').in('project_id', c).order('id').range(from, to)) : []
  const moveIds = ids(moves)

  // The company's own (P5d-ii, call 2): its own bars' parts and marks, and of the company's own only, its tells,
  // answers, notices and counts.
  const ownPackages = new Set((packages as R[]).filter((k) => invites.some((i) => i.id === k.awarded_invite_id && i.company_id === companyId)).map((k) => k.id))
  const ownBars = companyId ? (activities as R[]).filter((a) => ownPackages.has(a.package_id)).map((a) => String(a.id)) : []
  const [pushes, notices, crewCounts, marks, parts, tells, answers] = await Promise.all([
    moveIds.length ? readAll(moveIds, (c, from, to) => admin.from('gc_schedule_move_pushes').select('move_id, activity_id, from_start, from_finish, to_start, to_finish').in('move_id', c).order('move_id').order('activity_id').range(from, to)) : none(),
    companyId ? readAll(jobIds, (c, from, to) => admin.from('gc_schedule_late_notices').select('*').in('project_id', c).eq('company_id', companyId).order('id').range(from, to)) : none(),
    companyId ? readAll(jobIds, (c, from, to) => admin.from('gc_schedule_crew_counts').select('project_id, package_id, company_id, week_of, count, said_on, created_at').in('project_id', c).eq('company_id', companyId).order('created_at').range(from, to)) : none(),
    readAll(ownBars, (c, from, to) => admin.from('gc_schedule_lookahead_marks').select('activity_id, week_of, done, reason, marked_on, verified_on, verified_done, verified_reason, created_at').in('activity_id', c).order('activity_id').order('week_of').range(from, to)),
    readAll(ownBars, (c, from, to) => admin.from('gc_schedule_activity_parts').select('id, activity_id, position, name, from_day, days, share, pct, actual_start, actual_finish').in('activity_id', c).order('id').range(from, to)),
    companyId ? readAll(moveIds, (c, from, to) => admin.from('gc_schedule_move_tells').select('move_id, company_id, told_on, created_at').in('move_id', c).eq('company_id', companyId).order('move_id').range(from, to)) : none(),
    companyId ? readAll(moveIds, (c, from, to) => admin.from('gc_schedule_move_answers').select('move_id, company_id, answered_on, ok, day, note, created_at').in('move_id', c).eq('company_id', companyId).order('move_id').range(from, to)) : none(),
  ])

  // The customer's own (the schedule's PR 15b): the dates to meet, what the work waits on with the bars it holds, the
  // change orders' non-money half and their own row.
  const [milestones, waits, changeOrders, customer] = customerId
    ? await Promise.all([
        readAll(jobIds, (c, from, to) => admin.from('gc_schedule_milestones').select('id, project_id, label, planned, package_id, met_on, position').in('project_id', c).order('id').range(from, to)),
        readAll(jobIds, (c, from, to) => admin.from('gc_schedule_waits').select('*').in('project_id', c).order('id').range(from, to)),
        readAll(jobIds, (c, from, to) => admin.from('gc_change_orders').select(CHANGE_ORDER_COLUMNS).in('project_id', c).order('id').range(from, to)),
        admin.from('customers').select('id, name').eq('id', customerId).maybeSingle().then((r: { data: unknown }) => (r.data ?? null) as { id: string; name: string } | null),
      ])
    : [[], [], [], null]
  const waitHolds = waits.length ? await readAll(ids(waits), (c, from, to) => admin.from('gc_schedule_wait_holds').select('wait_id, activity_id').in('wait_id', c).order('wait_id').order('activity_id').range(from, to)) : []

  const of = (rows: R[], projectId: string, f = 'project_id') => rows.filter((r) => r[f] === projectId)
  const jobs = (projects as R[]).flatMap((project) => {
    const gc = (gcRows as R[]).find((g) => g.project_id === project.id)
    if (!gc) return []
    const mine = of(packages as R[], String(project.id))
    const mineIds = new Set(mine.map((k) => k.id))
    const bars = of(activities as R[], String(project.id))
    const barIds = new Set(bars.map((a) => a.id))
    const lines = of(baselines as R[], String(project.id))
    const lineIds = new Set(lines.map((b) => b.id))
    const jobMoves = of(moves, String(project.id))
    const jobMoveIds = new Set(jobMoves.map((m) => m.id))
    const onMoves = (rows: R[]) => rows.filter((r) => jobMoveIds.has(r.move_id))
    const onBars = (rows: R[]) => rows.filter((r) => barIds.has(r.activity_id))
    const jobWaits = of(waits as R[], String(project.id))
    const jobWaitIds = new Set(jobWaits.map((w) => w.id))
    return [
      {
        project: { project, gc, packages: mine, scopeItems: scopeItems.filter((i) => mineIds.has(i.package_id)), exclusions: [], sets: [], setItems: [], questions: [] },
        schedule: {
          schedule: gcScheduleOf(schedules as R[], String(project.id)),
          activities: bars,
          links: of(links as R[], String(project.id)),
          baselines: lines,
          baselineDates: baselineDates.filter((d) => lineIds.has(d.baseline_id)),
          moves: jobMoves,
          pushes: onMoves(pushes),
          tells: onMoves(tells),
          answers: onMoves(answers),
          lateNotices: of(notices, String(project.id)),
          crewCounts: of(crewCounts, String(project.id)),
          marks: onBars(marks),
          parts: onBars(parts),
          milestones: of(milestones as R[], String(project.id)),
          waits: jobWaits,
          waitHolds: waitHolds.filter((h) => jobWaitIds.has(h.wait_id)),
        },
      },
    ]
  })
  return {
    jobs,
    invites,
    companies,
    sows,
    sowLines,
    draws: { draws, drawLines, reports },
    ...(customerId ? { customer, changeOrders: changeOrders as R[] } : {}),
  } as unknown as ScheduleReadRows
}

/** A job's own schedule row, or null while nothing is drawn. */
function gcScheduleOf(schedules: R[], projectId: string): R | null {
  return schedules.find((s) => s.project_id === projectId) ?? null
}
