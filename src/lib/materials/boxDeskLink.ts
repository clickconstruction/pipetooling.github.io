/**
 * The office's Materials page for one job (v2.6804, out of `boxSearch.ts`): alone in a file, so the procurement
 * board's kernel reaches it without the search doors, and the edge copy (`scripts/edge-kernels.mjs`) can hold it.
 */
export function boxDeskLink(jobId: string): string {
  return `/jobs?tab=materials&job=${jobId}`
}
