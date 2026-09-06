/**
 * The "N open" figure in a Quickfill station header (v2.2896, journey-map
 * J19-F4). Three states, three words: still loading → "…"; a reported count →
 * "N open" (zero included — "0 open" is an answer); nothing reported → "—".
 *
 * "—" means *no reporter mounted*, not "no requests". A station whose
 * `QuickfillMetricReporter` sits inside the section wrapper never reports while
 * the desktop strip is collapsed (the wrapper returns before its children), so
 * the reporter must live beside the wrapper — see the Dispatch inbox case in
 * `Quickfill.tsx`.
 */
export function quickfillOutstandingLabel(metric: { count: number | null; loading: boolean }): string {
  if (metric.loading) return '…'
  return metric.count !== null ? `${metric.count} open` : '—'
}
