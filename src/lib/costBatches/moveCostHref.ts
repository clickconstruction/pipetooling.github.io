/** The Move cost screen's address for a job: Banking → Cost batches with the job as the source. */
export function moveCostHref(jobId: string): string {
  return `/banking?product=mercury&tab=cost_batches&job=${encodeURIComponent(jobId)}`
}
