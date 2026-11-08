/**
 * The job's people on a screen (punch list #129, the leftovers, v2.6694). The database's `is_job_people` names who may
 * write down and read the customer's word on paying: the office, the job's account manager, the bid's estimator or
 * account manager and, since the owner's call of 2026-11-08, the author of the signed estimate the job came from
 * (`20261108100000_job_people_estimate_author.sql`). Wherever a screen lists the job's people by name, that author
 * wears a small red **E** chip beside their name, and the chip's press opens the estimate. Pure: the team's rows and
 * the author in, the rows to draw out; the read is `jobPeopleIo.ts`.
 */

/** The author of the signed estimate a job came from, as the read hands them over. */
export type JobEstimateAuthor = {
  userId: string
  /** The author's name as `users.name` has it; null when the viewer may not read it. */
  name: string | null
  estimateId: string
  /** The estimate's number, the route's own key (`/estimates/<number>`); null on a row with none. */
  estimateNumber: number | null
}

/** One name on a people line or list. */
export type JobPersonRow = {
  userId: string
  name: string
  /** On the job's team (`jobs_ledger_team_members`); false for an author listed on the predicate's word alone. */
  onTeam: boolean
  /** The estimate this person wrote, when they are its author; the chip draws from it. */
  estimate: JobEstimateAuthor | null
}

const cleanName = (name: string | null | undefined): string => (name ?? '').trim()

/**
 * The rows a people list draws: the team in its own order, the author's row flagged with the estimate; an author who is
 * not on the team is added at the end, since the predicate counts them whether or not the office put them on the crew.
 * A nameless author who is not on the team is left out: the chip needs a name to stand beside.
 */
export function jobPeopleRows(team: ReadonlyArray<{ user_id: string; name: string | null }>, author: JobEstimateAuthor | null | undefined): JobPersonRow[] {
  const rows: JobPersonRow[] = team.map((m) => ({
    userId: m.user_id,
    name: cleanName(m.name) || 'Unknown',
    onTeam: true,
    estimate: author && author.userId === m.user_id ? author : null,
  }))
  if (author && !rows.some((r) => r.userId === author.userId)) {
    const name = cleanName(author.name)
    if (name) rows.push({ userId: author.userId, name, onTeam: false, estimate: author })
  }
  return rows
}

/** The chip draws beside a row when the row's person wrote the estimate the job came from. */
export function wearsEstimateChip(row: Pick<JobPersonRow, 'estimate'>): boolean {
  return row.estimate != null
}

/** Where the chip's press goes: the estimate's page by its number, else by its id. */
export function estimateChipHref(estimate: Pick<JobEstimateAuthor, 'estimateId' | 'estimateNumber'>): string {
  return `/estimates/${estimate.estimateNumber != null ? estimate.estimateNumber : estimate.estimateId}`
}

/** The chip's words: the letter on it, and the sentence behind it. */
export function estimateChipWords(estimate: Pick<JobEstimateAuthor, 'estimateNumber'>): { label: string; title: string } {
  const which = estimate.estimateNumber != null ? `estimate #${estimate.estimateNumber}` : 'the estimate'
  return { label: 'E', title: `Wrote ${which}, the one this job came from. Opens it.` }
}

/** The names as one line, "Luis, Marcus, Nia", for a title or a plain-text summary. */
export function jobPeopleLine(rows: ReadonlyArray<Pick<JobPersonRow, 'name'>>): string {
  return rows.map((r) => r.name).join(', ')
}

/**
 * Defensive parse of the `estimates` rows behind the author: the newest signed estimate that points at the job and is
 * not a change order, with its author; null when none. `name` comes from the second read, by the author's id.
 */
export function pickJobEstimateAuthor(
  rows: unknown,
  names: ReadonlyMap<string, string | null> | null | undefined,
): JobEstimateAuthor | null {
  if (!Array.isArray(rows)) return null
  const fit = rows
    .filter((v): v is Record<string, unknown> => v != null && typeof v === 'object')
    .filter((r) => typeof r.id === 'string' && typeof r.created_by === 'string' && r.status === 'customer_accepted' && r.doc_kind !== 'change_order')
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
  const r = fit[0]
  if (!r) return null
  const n = typeof r.estimate_number === 'number' && Number.isFinite(r.estimate_number) ? r.estimate_number : null
  return { userId: r.created_by as string, name: names?.get(r.created_by as string) ?? null, estimateId: r.id as string, estimateNumber: n }
}
