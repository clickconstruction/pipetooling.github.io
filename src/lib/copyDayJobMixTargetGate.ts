/**
 * Client-side guard before leader_replace_clock_session_cluster_mixed for copy job mix.
 * Eligible rows should already exclude rejected and revoked sessions.
 */
export function assertTargetSessionsAllowJobMixReplace(
  eligible: ReadonlyArray<{
    origin: string | null
    clocked_out_at: string | null
  }>
): { ok: true } | { ok: false; message: string } {
  if (eligible.length === 0) {
    return { ok: false, message: 'Target has no eligible sessions for this day.' }
  }

  const hasSalarySchedule = eligible.some((s) => s.origin === 'salary_schedule')
  if (hasSalarySchedule) {
    const anyOpen = eligible.some((s) => s.clocked_out_at == null)
    if (anyOpen) {
      return {
        ok: false,
        message:
          'This person has an open salary-scheduled clock session on this day. Close that session (clock out or finish the scheduled block) before applying a job mix here. You can fix it in My Time or People → Hours.',
      }
    }
  }

  return { ok: true }
}
