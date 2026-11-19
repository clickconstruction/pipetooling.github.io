/**
 * The lien days that passed with nothing filed and no answer (v2.7817).
 *
 * `list_lien_affidavit_windows` stops listing a job seven days after its last day to file, so a lien day nobody
 * answered left the Lien desk by itself a week later and the Board's closed bin, *Lien day passed · not filed*, emptied
 * with no one having said what became of the money. `list_lien_closed_days` lists those jobs from the eighth day on,
 * with the windows reader's own columns, until the job is filed, its last day of work is corrected, it is taken off the
 * lien path, it is marked Uncollectible or it is paid.
 *
 * The desk reads both (`useLienDeskData`, the reader's name written there as a literal so `check:calls-ahead` sees the
 * call) and hands the affidavit queue one list. Until the migration is pushed that read answers no rows. Nothing else
 * changes: `pileFor` already puts a paper not filed past its day in `missed`, the Board draws that pile in the closed
 * bin, and `LienClosedWindow` answers it. The windows reader's other callers (the lien book, Materials, the law firm's
 * portal, the dev seat) keep their seven days. Pure.
 */

/**
 * The windows reader's rows with the closed days after them, one row per job. The two readers never list the same job
 * (one keeps a day down to seven days past, the other starts on the eighth), but they are two reads a moment apart, so
 * a job both name keeps its windows row, and a job the closed days name twice keeps its first.
 */
export function withLienClosedDays<R extends { job_id: string }>(windowRows: ReadonlyArray<R>, closedRows: ReadonlyArray<R> | null | undefined): R[] {
  const out = [...windowRows]
  const seen = new Set(windowRows.map((r) => r.job_id))
  for (const r of closedRows ?? []) {
    if (!r || typeof r.job_id !== 'string' || seen.has(r.job_id)) continue
    seen.add(r.job_id)
    out.push(r)
  }
  return out
}
