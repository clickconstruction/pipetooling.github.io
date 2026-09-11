/**
 * Vectors (v2.3344) — who moved the number this week.
 *
 * The company line on the Bridge is contribution: earned − direct cost. Each
 * person is a vector on it, and this kernel resolves one row per person for
 * one pay week from records the app already keeps:
 *
 *   earned        Σ approved field hours × the job's earned rate per hour
 *                 (the same contract ÷ expected-hours rate `earnedRevenue.ts`
 *                 uses — so a person's earned dollars sum to the Bridge's)
 *   labor cost    Σ hours × the person's wage (people_pay_config, field rate
 *                 on jobs, office rate on the office job / bids)
 *   contribution  earned − field labor cost   (the person's push on the line)
 *   % reports     job % updates they made + field reports they filed
 *   billed        invoices they sent (the activity ledger's actor)
 *   collected     payments they recorded
 *   bids          bids they sent / won as the estimator, by value
 *
 * A person is keyed by user id (sessions and events both carry one). Subs on
 * sheets have no session and no account — their labor is a job cost, not a
 * vector here; the panel says so. Pure: no React, no Supabase.
 */

export type VectorPerson = { userId: string; name: string; role: string | null; archived: boolean }

export type VectorWage = { userId: string; fieldWage: number | null; officeWage: number | null; isSalary: boolean }

export type VectorSession = {
  userId: string
  workDate: string
  hours: number
  /** Null on an office/bid session. */
  jobId: string | null
  /** True on a bid session (no job). */
  onBid: boolean
  officeJob: boolean
  approved: boolean
  /** Closed and neither approved nor rejected nor revoked. */
  pending: boolean
}

export type VectorEvent = { userId: string | null; ymd: string; usd: number }
export type VectorCount = { userId: string | null; ymd: string }
export type VectorBid = { userId: string | null; ymd: string; usd: number; label: string }

export type VectorRow = {
  userId: string
  name: string
  role: string | null
  fieldHours: number
  officeBidHours: number
  pendingHours: number
  earnedUsd: number
  laborUsd: number
  /** earned − labor on field hours; null when the person has no field hours. */
  contributionUsd: number | null
  contributionPerHour: number | null
  pctReports: number
  billedCount: number
  billedUsd: number
  collectedCount: number
  collectedUsd: number
  bidsSentCount: number
  bidsSentUsd: number
  bidsWonCount: number
  bidsWonUsd: number
  /** Field hours on jobs with no earned rate (no contract $, or the job is not in the Bridge window). */
  unratedHours: number
  /** Earned $ on jobs whose expected hours were assumed (no % complete → half done) — a guess, marked ≈ on the panel. */
  guessedEarnedUsd: number
  noWage: boolean
  isSalary: boolean
  /** True when the row has nothing at all in the week (kept out of the table). */
  empty: boolean
}

export type Vectors = {
  weekStart: string
  weekEnd: string
  rows: VectorRow[]
  totals: {
    fieldHours: number
    officeBidHours: number
    pendingHours: number
    earnedUsd: number
    guessedEarnedUsd: number
    laborUsd: number
    contributionUsd: number
    billedUsd: number
    collectedUsd: number
    bidsWonUsd: number
  }
  /** Events whose actor is null or unknown to the roster — system writes, backfills, deleted accounts. */
  unattributed: { billedUsd: number; collectedUsd: number; pctReports: number; bidsWonUsd: number }
}

const num = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const inWeek = (ymd: string, start: string, end: string): boolean => ymd >= start && ymd <= end

export function buildVectors(input: {
  weekStart: string
  weekEnd: string
  people: ReadonlyArray<VectorPerson>
  wages: ReadonlyArray<VectorWage>
  sessions: ReadonlyArray<VectorSession>
  /** Earned $ per approved field hour, per job (contract ÷ expected hours). */
  ratePerHourByJob: ReadonlyMap<string, number>
  /** Jobs whose expected hours are a guess (`earnedRevenue.assumedHalfJobs`). */
  assumedHalfJobs?: ReadonlySet<string>
  invoiceSends: ReadonlyArray<VectorEvent>
  payments: ReadonlyArray<VectorEvent>
  pctUpdates: ReadonlyArray<VectorCount>
  fieldReports: ReadonlyArray<VectorCount>
  bidsSent: ReadonlyArray<VectorBid>
  bidsWon: ReadonlyArray<VectorBid>
}): Vectors {
  const { weekStart, weekEnd } = input
  const wageByUser = new Map(input.wages.map((w) => [w.userId, w]))
  const rows = new Map<string, VectorRow>()
  const rowFor = (p: VectorPerson): VectorRow => {
    let r = rows.get(p.userId)
    if (!r) {
      const w = wageByUser.get(p.userId)
      r = {
        userId: p.userId,
        name: p.name,
        role: p.role,
        fieldHours: 0,
        officeBidHours: 0,
        pendingHours: 0,
        earnedUsd: 0,
        laborUsd: 0,
        contributionUsd: null,
        contributionPerHour: null,
        pctReports: 0,
        billedCount: 0,
        billedUsd: 0,
        collectedCount: 0,
        collectedUsd: 0,
        bidsSentCount: 0,
        bidsSentUsd: 0,
        bidsWonCount: 0,
        bidsWonUsd: 0,
        unratedHours: 0,
        guessedEarnedUsd: 0,
        noWage: !w || (w.fieldWage == null && w.officeWage == null),
        isSalary: w?.isSalary ?? false,
        empty: true,
      }
      rows.set(p.userId, r)
    }
    return r
  }
  const personById = new Map(input.people.map((p) => [p.userId, p]))
  for (const p of input.people) rowFor(p)

  const unattributed = { billedUsd: 0, collectedUsd: 0, pctReports: 0, bidsWonUsd: 0 }
  const rowForUser = (userId: string | null): VectorRow | null => {
    if (!userId) return null
    const p = personById.get(userId)
    return p ? rowFor(p) : null
  }

  for (const s of input.sessions) {
    if (!inWeek(s.workDate, weekStart, weekEnd)) continue
    const r = rowForUser(s.userId)
    if (!r) continue
    const h = num(s.hours)
    if (h <= 0) continue
    if (s.pending) {
      r.pendingHours += h
      r.empty = false
      continue
    }
    if (!s.approved) continue
    const w = wageByUser.get(s.userId)
    r.empty = false
    if (s.onBid || s.officeJob || !s.jobId) {
      r.officeBidHours += h
      r.laborUsd += h * num(w?.officeWage ?? w?.fieldWage)
      continue
    }
    r.fieldHours += h
    r.laborUsd += h * num(w?.fieldWage)
    const rate = input.ratePerHourByJob.get(s.jobId)
    if (rate == null) r.unratedHours += h
    else {
      r.earnedUsd += h * rate
      if (input.assumedHalfJobs?.has(s.jobId)) r.guessedEarnedUsd += h * rate
    }
  }

  const applyUsd = (events: ReadonlyArray<VectorEvent>, apply: (r: VectorRow, usd: number) => void, lost: (usd: number) => void) => {
    for (const e of events) {
      if (!inWeek(e.ymd, weekStart, weekEnd)) continue
      const r = rowForUser(e.userId)
      if (r) {
        apply(r, num(e.usd))
        r.empty = false
      } else lost(num(e.usd))
    }
  }
  applyUsd(
    input.invoiceSends,
    (r, usd) => {
      r.billedCount += 1
      r.billedUsd += usd
    },
    (usd) => {
      unattributed.billedUsd += usd
    },
  )
  applyUsd(
    input.payments,
    (r, usd) => {
      r.collectedCount += 1
      r.collectedUsd += usd
    },
    (usd) => {
      unattributed.collectedUsd += usd
    },
  )
  for (const c of [...input.pctUpdates, ...input.fieldReports]) {
    if (!inWeek(c.ymd, weekStart, weekEnd)) continue
    const r = rowForUser(c.userId)
    if (r) {
      r.pctReports += 1
      r.empty = false
    } else unattributed.pctReports += 1
  }
  for (const b of input.bidsSent) {
    if (!inWeek(b.ymd, weekStart, weekEnd)) continue
    const r = rowForUser(b.userId)
    if (!r) continue
    r.bidsSentCount += 1
    r.bidsSentUsd += num(b.usd)
    r.empty = false
  }
  for (const b of input.bidsWon) {
    if (!inWeek(b.ymd, weekStart, weekEnd)) continue
    const r = rowForUser(b.userId)
    if (r) {
      r.bidsWonCount += 1
      r.bidsWonUsd += num(b.usd)
      r.empty = false
    } else unattributed.bidsWonUsd += num(b.usd)
  }

  const out: VectorRow[] = []
  const totals = { fieldHours: 0, officeBidHours: 0, pendingHours: 0, earnedUsd: 0, guessedEarnedUsd: 0, laborUsd: 0, contributionUsd: 0, billedUsd: 0, collectedUsd: 0, bidsWonUsd: 0 }
  for (const r of rows.values()) {
    if (r.empty) continue
    if (r.fieldHours > 0) {
      const fieldLabor = r.laborUsd - officeLaborOf(r, wageByUser)
      r.contributionUsd = r.earnedUsd - fieldLabor
      r.contributionPerHour = r.contributionUsd / r.fieldHours
    }
    totals.fieldHours += r.fieldHours
    totals.officeBidHours += r.officeBidHours
    totals.pendingHours += r.pendingHours
    totals.earnedUsd += r.earnedUsd
    totals.guessedEarnedUsd += r.guessedEarnedUsd
    totals.laborUsd += r.laborUsd
    totals.contributionUsd += r.contributionUsd ?? 0
    totals.billedUsd += r.billedUsd
    totals.collectedUsd += r.collectedUsd
    totals.bidsWonUsd += r.bidsWonUsd
    out.push(r)
  }
  out.sort(compareVectorRows)
  return { weekStart, weekEnd, rows: out, totals, unattributed }
}

/** Office/bid labor inside a row's laborUsd, so field contribution can exclude it. */
function officeLaborOf(r: VectorRow, wageByUser: ReadonlyMap<string, VectorWage>): number {
  const w = wageByUser.get(r.userId)
  return r.officeBidHours * num(w?.officeWage ?? w?.fieldWage)
}

/** Field contributors first by contribution, then everyone else by what they moved (billed + collected + bids won), then name. */
export function compareVectorRows(a: VectorRow, b: VectorRow): number {
  const ac = a.contributionUsd
  const bc = b.contributionUsd
  if (ac != null && bc != null && ac !== bc) return bc - ac
  if (ac != null && bc == null) return -1
  if (ac == null && bc != null) return 1
  const am = a.billedUsd + a.collectedUsd + a.bidsWonUsd
  const bm = b.billedUsd + b.collectedUsd + b.bidsWonUsd
  if (am !== bm) return bm - am
  return a.name.localeCompare(b.name)
}

/** Earned $ per approved field hour per job, from the Bridge's earned result: contract ÷ expected hours; jobs earning $0 get no rate. */
export function ratePerHourByJob(jobs: ReadonlyArray<{ id: string; revenueUsd: number | null }>, expectedHoursByJob: ReadonlyMap<string, number>): Map<string, number> {
  const out = new Map<string, number>()
  for (const j of jobs) {
    const rev = j.revenueUsd
    const hours = expectedHoursByJob.get(j.id)
    if (rev == null || !Number.isFinite(rev) || rev <= 0 || hours == null || hours <= 0) continue
    out.set(j.id, rev / hours)
  }
  return out
}
