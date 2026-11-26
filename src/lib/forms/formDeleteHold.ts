/**
 * Why a Form Studio form cannot be deleted (punch list #389, item 6 of its hand-over, read on 2026-11-26). A required
 * paper's row points at its form (`job_required_papers.form_template_id`, `ON DELETE RESTRICT`), and the row is kept
 * when the paper is taken off its job (`removed_at` is set), so a form any job requires or once required stays: the
 * database refuses the delete with a foreign-key violation. The screen said nothing of this: its confirm read as if
 * the delete would go through, and the refusal drew Postgres's own words about a constraint and a table. Pure.
 */

/** The jobs that hold each form: `form_template_id` → how many jobs (a job counted once, however many papers). */
export function formHoldsByForm(rows: ReadonlyArray<{ form_template_id: string | null; job_id: string }>): Map<string, number> {
  const jobs = new Map<string, Set<string>>()
  for (const r of rows) {
    if (!r.form_template_id) continue
    const set = jobs.get(r.form_template_id) ?? new Set<string>()
    set.add(r.job_id)
    jobs.set(r.form_template_id, set)
  }
  return new Map([...jobs].map(([id, set]) => [id, set.size]))
}

/** The words beside a held form's dead Delete press. */
export function formDeleteHoldWords(jobs: number): string {
  if (jobs === 1) return '1 job requires this form or once required it. Its record keeps it, so it stays.'
  return `${jobs} jobs require this form or once required it. Their records keep it, so it stays.`
}

/** The words when the database refused the delete after all: a job required the form between the read and the press. */
export const FORM_DELETE_REFUSED_WORDS = 'The form stays. A job requires it or once required it, and that record keeps it.'

/** A foreign-key refusal from `job_required_papers`, however it was thrown: a result's error object or an Error. */
export function isFormHeldByJobs(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  const message = (error as { message?: unknown }).message
  return code === '23503' && typeof message === 'string' && message.includes('job_required_papers')
}
