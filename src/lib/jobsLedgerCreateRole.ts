/**
 * Who may create a job (v2.2848). Mirrors the `jobs_ledger` INSERT policy
 * ("Devs, masters, assistants can insert jobs ledger"): `is_dev()` OR role IN
 * ('master_technician', 'assistant') with a master/project/adoption arm. The
 * role arm is a literal array — superintendent, primary, estimator, controller
 * and the sub-like roles are refused at the DB, so any "+ Create Job" door shown
 * to them either no-ops or opens a form that cannot save. Keep this in step with
 * the policy; if the DB widens (e.g. controller), widen here in the same PR.
 */
export function canCreateJobsLedgerRow(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant'
}
