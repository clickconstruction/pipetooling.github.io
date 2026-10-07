/**
 * Which of the payer's contact log entries go to the collections law firm
 * (punch list #85, item 24). `customer_contacts` is the customer's general
 * contact log: calls and emails about any job, any bid, or the account. It has
 * no job column. `legal-portal` sent every entry for the payer, filtered only
 * by date, so the firm read calls about jobs that were never referred.
 *
 * The rule: an entry that names one of the matter's jobs goes. An entry that
 * names only the payer's other jobs stays home. An entry that names no job is
 * about the account, and goes. "Names a job" means the entry's text carries
 * the job's number (its HCP number, else its Click number) as a standalone
 * token: `1042`, `#1042`, `J1042`, `job 1042`, `job#1042`, and a bill of it,
 * `1042-1` / `#1042-2` / `Invoice 1042-1` (a dash and one or two digits). The
 * same digits inside money, a decimal, a date, a phone number or a longer
 * number do not name the job. Known false positives: a year or a phone's last
 * four that happen to equal a job number written on their own (`in 2026`,
 * `ext 1042`) read as naming that job; they send an entry to the firm, never
 * hold one back.
 *
 * An explicit share wins: an entry the office shared by hand
 * (`held_overrides[key] === false`) goes whatever job it names
 * (`contactGoesWithShare`).
 *
 * Lives in `_shared` so the function and its test read one rule;
 * `src/lib/legal/legalContactScope.ts` is the client's door.
 */

type JobLike = { id?: unknown; hcp_number?: unknown; click_number?: unknown }

/** A job's number as the office writes it: HCP first, else Click (`effectiveJobLedgerNumber`). Lower-cased, trimmed. */
export function jobNumberOf(job: JobLike): string {
  const hcp = typeof job.hcp_number === 'string' ? job.hcp_number.trim() : ''
  const click = typeof job.click_number === 'string' ? job.click_number.trim() : ''
  return (hcp || click).toLowerCase()
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * True when the text names job number `n` on its own: optionally after `#`,
 * `J` or `job#`, never touching a letter, digit, `$`, a separator or a dash
 * before it; optionally followed by a bill suffix (`-1`, `-12`); and never
 * followed by a letter, a digit, or a separator and another digit.
 */
export function textNamesJob(text: string | null | undefined, n: string): boolean {
  const num = n.trim().toLowerCase()
  if (num.length < 3) return false
  const re = new RegExp(`(?<![\\w$.,/\\-#])(?:job#|#|j)?${escapeRegExp(num)}(?:-\\d{1,2}(?![\\w]))?(?![\\w]|[.,/\\-]\\d)`)
  return re.test((text ?? '').toLowerCase())
}

/**
 * The two number sets for one matter: its jobs' numbers, and the numbers of
 * the payer's other jobs (a number shared with a matter job counts as the
 * matter's). Numbers shorter than three characters are left out; they are too
 * common in plain text to mean a job.
 */
export function contactScopeNumbers(matterJobs: ReadonlyArray<JobLike>, payerJobs: ReadonlyArray<JobLike>): { matter: Set<string>; other: Set<string> } {
  const matterIds = new Set(matterJobs.map((j) => j.id))
  const matter = new Set(matterJobs.map(jobNumberOf).filter((n) => n.length >= 3))
  const other = new Set(payerJobs.filter((j) => !matterIds.has(j.id)).map(jobNumberOf).filter((n) => n.length >= 3 && !matter.has(n)))
  return { matter, other }
}

export type ContactScope = 'matter' | 'other_job' | 'account'

/** Where one entry belongs: about the matter's jobs, about another job only, or about the account. */
export function contactScopeOf(text: string | null | undefined, numbers: { matter: ReadonlySet<string>; other: ReadonlySet<string> }): ContactScope {
  for (const n of numbers.matter) if (textNamesJob(text, n)) return 'matter'
  for (const n of numbers.other) if (textNamesJob(text, n)) return 'other_job'
  return 'account'
}

/** True when the entry goes to the firm: it names a matter job, or no job at all. */
export function contactGoesToCounsel(text: string | null | undefined, numbers: { matter: ReadonlySet<string>; other: ReadonlySet<string> }): boolean {
  return contactScopeOf(text, numbers) !== 'other_job'
}

/** The scope rule with the office's own say: an entry it shared by hand (`held_overrides[key] === false`) always goes. */
export function contactGoesWithShare(text: string | null | undefined, numbers: { matter: ReadonlySet<string>; other: ReadonlySet<string> }, override: unknown): boolean {
  return override === false || contactGoesToCounsel(text, numbers)
}
