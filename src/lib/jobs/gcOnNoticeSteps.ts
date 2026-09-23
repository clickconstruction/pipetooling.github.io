import { daysUntil, type GcNoticeJob, type GcNoticeMonth, type GcNoticeSummary } from './gcOnNotice'

/**
 * Put a GC on notice — the four steps as the window shows them (v2.3665).
 *
 * The modal is one scrolling page, three and a half screens tall on a real
 * GC. These are the facts its pinned step bar, the step headers and the
 * claims table read: what each step's status is and whether it still wants
 * someone, which months still protect a lien, what the table totals to, and
 * what the three ticks of the decision change. Pure, no React.
 */

export type GcNoticeStepKey = 'owners' | 'claims' | 'letter' | 'decision' | 'grid'
/** `done` — nothing left to do here; `attention` — the step wants someone; `open` — a plain step. */
export type GcNoticeStepTone = 'done' | 'attention' | 'open'

export type GcNoticeStep = {
  key: GcNoticeStepKey
  n: 1 | 2 | 3 | 4 | 5
  /** The short name on the step bar. */
  name: string
  /** The live status under the name, and in the step's pill. */
  status: string
  tone: GcNoticeStepTone
}

export type GcNoticeStepsInput = {
  summary: GcNoticeSummary
  /** Jobs the roll found an owner for that Use all found would take. */
  foundOnRoll: number
  /** The roll lookups are still running. */
  lookingUp: boolean
  claimTotalWords: string
  includeLetter: boolean
  letterIsEmpty: boolean
  reasonLabel: string
  /** How many of the three ticks are on and would change something. */
  changes: number
  /** The grid (v2.3767): jobs in the run, and how many owners have answered the three questions. */
  gridJobs?: number
  ownersAnswered?: number
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The owners step is settled when nothing is missing, unconfirmed or left out — then it folds to one line. */
export function gcNoticeOwnersSettled(s: GcNoticeSummary): boolean {
  return s.ownersMissing === 0 && s.ownersUnconfirmed === 0 && s.publicOwners === 0
}

export function buildGcNoticeSteps(input: GcNoticeStepsInput): GcNoticeStep[] {
  const s = input.summary
  const ownerParts: string[] = []
  const toFind = Math.max(0, s.ownersMissing - input.foundOnRoll)
  if (input.lookingUp) ownerParts.push('looking up…')
  if (input.foundOnRoll > 0) ownerParts.push(`${input.foundOnRoll} found · press Use`)
  if (toFind > 0 && !input.lookingUp) ownerParts.push(`${toFind} to find`)
  if (s.ownersUnconfirmed > 0) ownerParts.push(`${s.ownersUnconfirmed} to confirm`)
  if (s.publicOwners > 0) ownerParts.push(`${s.publicOwners} public · left out`)
  const onFile = `${s.ownersOnFile + s.publicOwners} of ${s.jobs} on file`
  const ownersWaiting = s.ownersMissing > 0 || s.ownersUnconfirmed > 0

  return [
    {
      key: 'owners',
      n: 1,
      name: 'Owners',
      status: ownerParts.length ? `${onFile} · ${ownerParts.join(' · ')}` : onFile,
      tone: ownersWaiting ? 'attention' : 'done',
    },
    {
      key: 'claims',
      n: 2,
      name: 'Claims',
      status: s.ready > 0 ? `${plural(s.ready, 'notice')} · ${input.claimTotalWords}` : 'nothing ready yet',
      tone: s.ready > 0 ? 'open' : 'attention',
    },
    {
      key: 'letter',
      n: 3,
      name: 'Cover letter',
      status: !input.includeLetter ? 'left out · standard cover note' : input.letterIsEmpty ? 'empty · standard cover note prints' : 'included',
      tone: input.includeLetter && input.letterIsEmpty ? 'attention' : 'open',
    },
    {
      key: 'decision',
      n: 4,
      name: 'Decision',
      status: `${input.reasonLabel} · ${plural(input.changes, 'change')}`,
      tone: 'open',
    },
    {
      key: 'grid',
      n: 5,
      name: 'The grid',
      status: `${input.ownersAnswered ?? 0} of ${input.gridJobs ?? s.jobs} owners answered`,
      tone: (input.ownersAnswered ?? 0) >= (input.gridJobs ?? s.jobs) && (input.gridJobs ?? s.jobs) > 0 ? 'done' : 'open',
    },
  ]
}

/** A notice's months in the two groups the claims table shows: windows still open (oldest first), and closed ones named as information. */
export function splitNoticeMonths(months: ReadonlyArray<GcNoticeMonth>): { open: GcNoticeMonth[]; closed: GcNoticeMonth[] } {
  return { open: months.filter((m) => !m.closed), closed: months.filter((m) => m.closed) }
}

export type GcNoticeClaimTotals = {
  notices: number
  openWindows: number
  closedWindows: number
  /** Rows whose property kind is not set — commercial dates are shown for them. */
  kindUnknown: number
  total: number
}

/** The claims table's total row, over the rows it lists (public owners are not listed). */
export function gcNoticeClaimTotals(jobs: ReadonlyArray<GcNoticeJob>): GcNoticeClaimTotals {
  const rows = jobs.filter((j) => j.readiness !== 'public_owner')
  let openWindows = 0
  let closedWindows = 0
  for (const j of rows) {
    const split = splitNoticeMonths(j.months)
    openWindows += split.open.length
    closedWindows += split.closed.length
  }
  return {
    notices: rows.length,
    openWindows,
    closedWindows,
    kindUnknown: rows.filter((j) => !j.propertyKind).length,
    total: rows.reduce((t, j) => t + j.claimAmount, 0),
  }
}

/** The earliest open § 53.056 date on the listed rows, how far off it is, and how many jobs share it. */
export function gcNoticeNextWindow(jobs: ReadonlyArray<GcNoticeJob>, todayYmd: string): { deadline: string; days: number; jobs: number } | null {
  let earliest = ''
  for (const j of jobs) {
    if (j.readiness === 'public_owner') continue
    for (const m of j.months) if (!m.closed && m.deadline && (!earliest || m.deadline < earliest)) earliest = m.deadline
  }
  if (!earliest) return null
  const days = daysUntil(earliest, todayYmd)
  if (days == null) return null
  return { deadline: earliest, days, jobs: jobs.filter((j) => j.readiness !== 'public_owner' && j.months.some((m) => !m.closed && m.deadline === earliest)).length }
}

export function daysLeftWords(days: number): string {
  return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `${days} days`
}

export type GcNoticeChangeKey = 'rule' | 'terms' | 'legal'

export type GcNoticeChange = {
  key: GcNoticeChangeKey
  title: string
  why: string
  /** What the record says the value is — `label: from → to`. */
  label: string
  from: string
  to: string
  /** Already at `to`: ticking it changes nothing. */
  alreadySet: boolean
}

const POLICY_WORDS: Record<string, string> = { send: 'send without asking', hold: 'hold', ask: 'ask each time' }

/** The three ticks of the decision, each as a named change with its before and after. */
export function gcNoticeChanges(input: { policy: string | null | undefined; termsKey: string; termsLabel: string; legalMatterExists: boolean; legalMatterJobs: number; jobs: number; publicOwners: number }): GcNoticeChange[] {
  const policy = input.policy && POLICY_WORDS[input.policy] ? input.policy : 'ask'
  return [
    {
      key: 'rule',
      title: 'Send future notices without asking',
      why: "Starts the moment this run is recorded. This run is the first notice, approved by the leader; a rule never sends a GC's first notice.",
      label: 'Standing rule',
      from: POLICY_WORDS[policy]!,
      to: POLICY_WORDS.send!,
      alreadySet: policy === 'send',
    },
    {
      key: 'terms',
      title: 'Wind the account down',
      why: 'Finish open jobs, decline new ones.',
      label: 'Payment terms',
      from: input.termsLabel,
      to: 'Winding down',
      alreadySet: input.termsKey === 'winding_down',
    },
    {
      key: 'legal',
      title: input.legalMatterExists ? `Add all ${plural(input.jobs, 'job')} to the Legal desk matter` : `Open a Legal desk matter with all ${plural(input.jobs, 'job')}`,
      why: `The affidavits and the attorney start from one place${input.publicOwners ? '; the bond claim goes there too' : ''}.`,
      label: 'Legal desk',
      from: input.legalMatterExists ? `a matter · ${plural(input.legalMatterJobs, 'job')}` : 'no matter',
      to: `a matter · ${plural(input.jobs, 'job')}`,
      alreadySet: false,
    },
  ]
}

/** How many ticked changes would actually change something — the Decision step's count. */
export function countGcNoticeChanges(changes: ReadonlyArray<GcNoticeChange>, ticks: Readonly<Record<GcNoticeChangeKey, boolean>>): number {
  return changes.filter((c) => ticks[c.key] && !c.alreadySet).length
}

/** Step 1's rows with the ones that want someone first; on-file rows keep their order after them. */
export function sortOwnerRowsAttentionFirst<T extends Pick<GcNoticeJob, 'ownerState'>>(jobs: ReadonlyArray<T>): T[] {
  const rank = (j: T) => (j.ownerState === 'on_file' ? 1 : 0)
  return jobs
    .map((j, i) => ({ j, i }))
    .sort((a, b) => rank(a.j) - rank(b.j) || a.i - b.i)
    .map((x) => x.j)
}
