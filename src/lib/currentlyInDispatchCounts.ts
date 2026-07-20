/**
 * Per-assignee DISTINCT job count from schedule-block rows (one person can have
 * several blocks on the same job in a day — that counts once). Feeds the
 * Currently In dispatch icon badge on the Dashboard clock strip.
 */
export function countDistinctJobsPerAssignee(
  rows: ReadonlyArray<{ assignee_user_id: string; job_id: string }>,
): Map<string, number> {
  const jobsByUser = new Map<string, Set<string>>()
  for (const r of rows) {
    const uid = r.assignee_user_id
    const jid = r.job_id
    if (!uid || !jid) continue
    let set = jobsByUser.get(uid)
    if (!set) {
      set = new Set<string>()
      jobsByUser.set(uid, set)
    }
    set.add(jid)
  }
  const counts = new Map<string, number>()
  for (const [uid, set] of jobsByUser) counts.set(uid, set.size)
  return counts
}
