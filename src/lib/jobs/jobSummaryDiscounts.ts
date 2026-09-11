/**
 * Job Summary → the discount fold (discount tools round two, PR 4): where the
 * discounts on the jobs in view went. One headline an owner can act on —
 * share of revenue for the window — then the same share per reason (from the
 * rows' reason chips) and per giver (from the discount_added trail events,
 * which carry the dollars and the actor). Pure; the fold component fetches
 * the events and the names and hands them in.
 */

export type DiscountLeakageRowInput = {
  job: {
    id: string
    fixtures?: Array<{ name?: string | null; count?: number | null; line_unit_price?: number | string | null; line_kind?: string | null; discount_reason?: string | null }> | null
  }
  /** Revenue the row shows (contract or earned) — the denominator. */
  revenueUsd: number
  discountUsd: number
}

export type DiscountEventInput = {
  job_id: string
  actor_user_id: string | null
  /** ISO — the latest discount_added on a job names its giver. */
  occurred_at?: string | null
  detail?: Record<string, unknown> | null
}

export type DiscountLeakageLine = { key: string; label: string; jobs: number; givenUsd: number; sharePct: number | null }

export type DiscountLeakage = {
  jobs: number
  jobsInView: number
  givenUsd: number
  revenueUsd: number
  /** given ÷ revenue over the jobs in view; null when revenue is 0. */
  sharePct: number | null
  byReason: DiscountLeakageLine[]
  byGiver: DiscountLeakageLine[]
}

const round2 = (n: number) => Math.round(n * 100) / 100
const OTHER = 'No reason given'

function rowDiscountUsd(f: NonNullable<DiscountLeakageRowInput['job']['fixtures']>[number]): number {
  if (!(f.name ?? '').trim()) return 0
  const unit = f.line_unit_price != null && Number.isFinite(Number(f.line_unit_price)) ? Number(f.line_unit_price) : 0
  if (!(unit < 0)) return 0
  const c = Number(f.count)
  const qty = f.line_kind === 'discount' ? 1 : Number.isFinite(c) && c > 0 ? c : 1
  return -unit * qty
}

export function jobSummaryDiscountLeakage(args: {
  rows: readonly DiscountLeakageRowInput[]
  events: readonly DiscountEventInput[]
  actorNames: ReadonlyMap<string, string>
}): DiscountLeakage {
  const { rows, events, actorNames } = args
  const revenueUsd = round2(rows.reduce((s, r) => s + (Number.isFinite(r.revenueUsd) ? r.revenueUsd : 0), 0))
  const discounted = rows.filter((r) => r.discountUsd > 0)
  const givenUsd = round2(discounted.reduce((s, r) => s + r.discountUsd, 0))
  const share = (usd: number, base: number): number | null => (base > 0 ? round2((usd / base) * 100) : null)

  // By reason: the rows' own reason chips (a legacy negative row has none).
  const reason = new Map<string, { jobs: Set<string>; usd: number }>()
  for (const r of rows) {
    for (const f of r.job.fixtures ?? []) {
      const usd = rowDiscountUsd(f)
      if (!(usd > 0)) continue
      const key = (f.discount_reason ?? '').trim() || OTHER
      const cur = reason.get(key) ?? { jobs: new Set<string>(), usd: 0 }
      cur.jobs.add(r.job.id)
      cur.usd += usd
      reason.set(key, cur)
    }
  }
  const byReason: DiscountLeakageLine[] = [...reason.entries()]
    .map(([key, v]) => ({ key, label: key, jobs: v.jobs.size, givenUsd: round2(v.usd), sharePct: share(v.usd, revenueUsd) }))
    .sort((a, b) => b.givenUsd - a.givenUsd || a.label.localeCompare(b.label))

  // By giver: the trail names WHO; the rows say HOW MUCH. A job's current
  // discount dollars go to the actor of its latest discount_added — summing
  // the events themselves would count every discount ever added and since
  // removed or changed (the live check on job 892 showed $26,892 of history
  // against a $3,774.50 discount).
  const inView = new Map(rows.map((r) => [r.job.id, r]))
  const latestByJob = new Map<string, { at: string; actor: string | null }>()
  for (const e of events) {
    if (!inView.has(e.job_id)) continue
    const at = e.occurred_at ?? ''
    const cur = latestByJob.get(e.job_id)
    if (!cur || at > cur.at) latestByJob.set(e.job_id, { at, actor: e.actor_user_id })
  }
  const giver = new Map<string, { jobs: Set<string>; usd: number }>()
  for (const r of discounted) {
    const latest = latestByJob.get(r.job.id)
    if (!latest) continue
    const key = latest.actor ?? 'system'
    const cur = giver.get(key) ?? { jobs: new Set<string>(), usd: 0 }
    cur.jobs.add(r.job.id)
    cur.usd += r.discountUsd
    giver.set(key, cur)
  }
  const byGiver: DiscountLeakageLine[] = [...giver.entries()]
    .map(([key, v]) => {
      const theirRevenue = [...v.jobs].reduce((s, id) => s + (inView.get(id)?.revenueUsd ?? 0), 0)
      return { key, label: key === 'system' ? 'System' : actorNames.get(key) ?? 'Someone', jobs: v.jobs.size, givenUsd: round2(v.usd), sharePct: share(v.usd, theirRevenue) }
    })
    .sort((a, b) => b.givenUsd - a.givenUsd || a.label.localeCompare(b.label))

  return { jobs: discounted.length, jobsInView: rows.length, givenUsd, revenueUsd, sharePct: share(givenUsd, revenueUsd), byReason, byGiver }
}
