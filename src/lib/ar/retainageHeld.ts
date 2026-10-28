import { cents } from '../aiaPayApplicationLines'
import { formatCurrency } from '../jobs/jobFormatting'
import { daysBetweenYmd } from '../jobs/billedExpectedPay'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

/**
 * Retainage held on our trade jobs is money owed to us (punch list #165, PR 1 — the owner's picks
 * of 2026-10-26). On a job where we are the sub, the GC holds back a share of every pay
 * application. The app knew the number twice (the saved AIA application's `retainage_held`, the
 * lien details' typed `jobs_ledger.lien_retainage_held`) and showed it nowhere as owed. This
 * kernel is the one read the AIA window, AR and the Lien desk share. Pure; the callers fetch.
 *
 * - **Source (C)**: on a job with saved pay applications the held amount is the latest
 *   application's retainage to date, the number the GC signed. On a job with none it is the figure
 *   typed in the lien details. An application beats the typed figure even when they disagree.
 * - **Less what was released (C)**: on a job with applications, the final application releases it —
 *   retainage goes to zero on the last application, and the bill tied to it carries the release. On
 *   a job with none, a release bill drafted at job close carries it. A release counts once the GC
 *   has been asked (the bill is billed or paid); a draft is not a release yet, so nothing is
 *   billed early. A paid release clears the line the way any paid bill does.
 * - **Age (A)**: from the day our contract on the job ended (`lien_contract_ended_on`, the Lien
 *   desk's own clock, typed by the office, never inferred). A job still open is not aging.
 *
 * Out of scope here: partial releases (a step from 10% to 5% partway reads as the latest
 * application's smaller figure, nothing more) and the retainage we hold from our own subs.
 */

/** One live pay application on the job, as the kernel needs it. */
export type RetainageApplication = {
  applicationNumber: number
  /** Retainage to date on the application (G702 line 5), the GC's held figure. */
  retainageHeld: number
  /** When it was last saved (an ISO instant), or null. */
  updatedAt: string | null
  /** The bill it became (`invoice_id`), or null while untied. */
  invoiceId?: string | null
}

/** One bill on the job, as the kernel needs it. */
export type RetainageBill = {
  id: string
  amount: number
  /** `ready_to_bill` | `billed` | `paid`. */
  status: string
}

export type RetainageHeldInput = {
  jobId: string
  /** The job's live applications, in any order. Deleted ones are not passed. */
  applications: ReadonlyArray<RetainageApplication>
  /** The figure typed in the lien details (`lien_retainage_held`), or null. */
  typedHeld: number | null
  /** The day our contract on the job ended, 'YYYY-MM-DD', or null while it is open. */
  finishedOn: string | null
  /** The job's bills: the final application's bill and the release bill are read here. */
  bills: ReadonlyArray<RetainageBill>
  /** The release bill drafted on a job with no applications (PR 3's mark), or null. */
  releaseBillId: string | null
}

export type RetainageSource = 'pay_application' | 'lien_details'

/**
 * none · the GC still holds it, nothing released.
 * unbilled · the final application is saved at zero retainage but has no bill yet.
 * drafted · the release bill is drafted and not yet sent (ready to bill).
 * billed · the release bill is out; the GC has been asked.
 * paid · the release bill is paid; the line is cleared.
 */
export type RetainageReleaseState = 'none' | 'unbilled' | 'drafted' | 'billed' | 'paid'

export type RetainageRelease = {
  state: RetainageReleaseState
  /** The final application, on a job with applications; null on a job without. */
  applicationNumber: number | null
  /** The bill that carries the release, or null while there is none. */
  invoiceId: string | null
}

export type RetainageHeldLine = {
  jobId: string
  source: RetainageSource
  /** The application the figure comes from, or null when the lien details are the source. */
  applicationNumber: number | null
  /** The day that application was last saved ('YYYY-MM-DD' in the app's zone), or null. */
  applicationSavedOn: string | null
  /** The figure the GC holds, or held until the release. */
  held: number
  /** What a billed or paid release has asked the GC for. */
  released: number
  /** held − released: the money no bill asks for yet. The line's figure. */
  owed: number
  release: RetainageRelease
  finishedOn: string | null
  /** Whole days since the job finished; null while it is open; never negative. */
  ageDays: number | null
  /** Released and paid: AR drops the line. */
  cleared: boolean
}

const positive = (n: number | null | undefined): number => {
  const c = cents(Number(n) || 0)
  return c > 0 ? c : 0
}

function releaseState(bill: RetainageBill | null | undefined, whenNoBill: RetainageReleaseState): RetainageReleaseState {
  if (!bill) return whenNoBill
  if (bill.status === 'paid') return 'paid'
  if (bill.status === 'billed') return 'billed'
  return 'drafted'
}

const asksTheGc = (state: RetainageReleaseState): boolean => state === 'billed' || state === 'paid'

/** The application whose figure the rule reads: the highest number among the live ones. */
export function latestRetainageApplication(applications: ReadonlyArray<RetainageApplication>): RetainageApplication | null {
  let latest: RetainageApplication | null = null
  for (const a of applications) if (!latest || a.applicationNumber > latest.applicationNumber) latest = a
  return latest
}

/**
 * The one source's figure, for the screens that show the number rather than the line (the lien
 * details, PR 4): the latest application's retainage to date where an application exists, even
 * zero, else the typed figure; null when the job has neither.
 */
export function retainageSourceFigure(
  applications: ReadonlyArray<RetainageApplication>,
  typedHeld: number | null,
): { source: RetainageSource; amount: number; applicationNumber: number | null } | null {
  const latest = latestRetainageApplication(applications)
  if (latest) return { source: 'pay_application', amount: positive(latest.retainageHeld), applicationNumber: latest.applicationNumber }
  if (typedHeld == null) return null
  return { source: 'lien_details', amount: positive(typedHeld), applicationNumber: null }
}

/**
 * The job's Retainage held line, or null when there is nothing to show: no retainage recorded by
 * the rule, or the job's applications never held any.
 */
export function retainageHeldLine(input: RetainageHeldInput, todayYmd: string): RetainageHeldLine | null {
  const billById = new Map(input.bills.map((b) => [b.id, b] as const))
  const ageDays = input.finishedOn ? Math.max(0, daysBetweenYmd(input.finishedOn, todayYmd) ?? 0) : null
  const base = { jobId: input.jobId, finishedOn: input.finishedOn, ageDays }
  const apps = [...input.applications].sort((a, b) => a.applicationNumber - b.applicationNumber)
  const latest = apps[apps.length - 1]

  if (latest) {
    const savedOn = latest.updatedAt ? calendarYmdInAppTzFromIso(latest.updatedAt) || null : null
    const latestHeld = positive(latest.retainageHeld)
    if (latestHeld > 0) {
      return {
        ...base,
        source: 'pay_application',
        applicationNumber: latest.applicationNumber,
        applicationSavedOn: savedOn,
        held: latestHeld,
        released: 0,
        owed: latestHeld,
        release: { state: 'none', applicationNumber: null, invoiceId: null },
        cleared: false,
      }
    }
    // The latest application is at zero: the final application, releasing what the one before it held.
    let prior: RetainageApplication | null = null
    for (const a of apps) if (a !== latest && positive(a.retainageHeld) > 0) prior = a
    if (!prior) return null
    const bill = latest.invoiceId ? billById.get(latest.invoiceId) ?? null : null
    const state = releaseState(bill, 'unbilled')
    const held = positive(prior.retainageHeld)
    const released = asksTheGc(state) ? held : 0
    return {
      ...base,
      source: 'pay_application',
      applicationNumber: prior.applicationNumber,
      applicationSavedOn: prior.updatedAt ? calendarYmdInAppTzFromIso(prior.updatedAt) || null : null,
      held,
      released,
      owed: cents(held - released),
      release: { state, applicationNumber: latest.applicationNumber, invoiceId: bill?.id ?? null },
      cleared: state === 'paid',
    }
  }

  const bill = input.releaseBillId ? billById.get(input.releaseBillId) ?? null : null
  const typed = positive(input.typedHeld)
  // The typed figure may have been cleared after the release bill was drafted; the bill still records it.
  const held = typed > 0 ? typed : bill ? positive(bill.amount) : 0
  if (held <= 0) return null
  const state = releaseState(bill, 'none')
  const released = bill && asksTheGc(state) ? Math.min(held, positive(bill.amount)) : 0
  return {
    ...base,
    source: 'lien_details',
    applicationNumber: null,
    applicationSavedOn: null,
    held,
    released,
    owed: cents(held - released),
    release: { state, applicationNumber: null, invoiceId: bill?.id ?? null },
    cleared: state === 'paid',
  }
}

export type RetainageHeldSection = {
  /** The lines AR shows: nothing cleared; the oldest finish first, open jobs last, the larger figure first among equals. */
  lines: RetainageHeldLine[]
  /** Σ owed over the lines. */
  total: number
  /** Lines whose release is out and awaiting payment: on a bill, not in the total. */
  releasedCount: number
}

export function buildRetainageHeldSection(inputs: ReadonlyArray<RetainageHeldInput>, todayYmd: string): RetainageHeldSection {
  const lines: RetainageHeldLine[] = []
  for (const input of inputs) {
    const line = retainageHeldLine(input, todayYmd)
    if (line && !line.cleared) lines.push(line)
  }
  lines.sort((a, b) => {
    const aa = a.ageDays ?? -1
    const ba = b.ageDays ?? -1
    if (aa !== ba) return ba - aa
    if (a.owed !== b.owed) return b.owed - a.owed
    return a.jobId < b.jobId ? -1 : a.jobId > b.jobId ? 1 : 0
  })
  return {
    lines,
    total: cents(lines.reduce((sum, l) => sum + l.owed, 0)),
    releasedCount: lines.filter((l) => asksTheGc(l.release.state)).length,
  }
}

/** "from pay application 3, saved Oct 18" / "from pay application 3" / "typed in the job's lien details". */
export function retainageSourceWords(line: Pick<RetainageHeldLine, 'source' | 'applicationNumber' | 'applicationSavedOn'>, formatDay: (ymd: string) => string): string {
  if (line.source === 'lien_details') return "typed in the job's lien details"
  const saved = line.applicationSavedOn ? `, saved ${formatDay(line.applicationSavedOn)}` : ''
  return `from pay application ${line.applicationNumber}${saved}`
}

/** "job still open · not aging yet" / "finished today" / "26d since the job finished · Sep 30". */
export function retainageAgeWords(line: Pick<RetainageHeldLine, 'finishedOn' | 'ageDays'>, formatDay: (ymd: string) => string): string {
  if (!line.finishedOn || line.ageDays == null) return 'job still open · not aging yet'
  if (line.ageDays === 0) return 'finished today'
  return `${line.ageDays}d since the job finished · ${formatDay(line.finishedOn)}`
}

/** The release's words on the line, or '' while nothing is released. */
export function retainageReleaseWords(release: RetainageRelease): string {
  switch (release.state) {
    case 'none':
      return ''
    case 'unbilled':
      return `released on application ${release.applicationNumber} · no bill yet`
    case 'drafted':
      return 'release drafted · not sent yet'
    case 'billed':
      return 'release billed · awaiting payment'
    case 'paid':
      return 'release paid'
    default:
      return ''
  }
}

/** "$8,960.00 on 2 jobs" / "$3,120.00 on 1 job" / "nothing held" — the closed band's words on AR. */
export function retainageBandSummary(section: Pick<RetainageHeldSection, 'lines' | 'total'> | null): string {
  if (!section || section.lines.length === 0) return 'nothing held'
  const n = section.lines.length
  return `$${formatCurrency(section.total)} on ${n} job${n === 1 ? '' : 's'}`
}

/** The memo the release bill carries, and the words the readers match it by. */
export const RETAINAGE_RELEASE_MEMO = 'Retainage release'

export type RetainageReleaseDraft = { amount: number; memo: string }

/**
 * The release bill the line offers to draft (release C, a job with no pay application): the
 * whole figure still owed, once, while nothing is released. A job with applications releases
 * through its final application instead, so its line offers no bill.
 */
export function retainageReleaseDraft(line: Pick<RetainageHeldLine, 'source' | 'owed' | 'release'>): RetainageReleaseDraft | null {
  if (line.source !== 'lien_details' || line.owed <= 0 || line.release.state !== 'none') return null
  return { amount: line.owed, memo: RETAINAGE_RELEASE_MEMO }
}

/**
 * What the lien details' box mirrors on a job with pay applications (PR 4): the figure the
 * kernel holds — the latest application's retainage, or the figure the final application
 * released while its bill is unpaid — and 0 once the release is paid or the applications never
 * held any. Null on a job with no applications: the typed figure is the source there, and the
 * box stays the office's to type.
 */
export function lienRetainageMirror(input: RetainageHeldInput, todayYmd: string): number | null {
  if (input.applications.length === 0) return null
  const line = retainageHeldLine(input, todayYmd)
  return line && !line.cleared ? line.held : 0
}
