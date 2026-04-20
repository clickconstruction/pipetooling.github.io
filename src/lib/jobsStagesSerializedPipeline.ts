/**
 * Serial queue for Jobs → Stages mutations (RPC + loadJobs) so rapid clicks cannot overlap.
 * Used only from Jobs.tsx.
 */
let tail: Promise<unknown> = Promise.resolve()

export function runJobsStagesSerializedPipeline<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(() => fn())
  tail = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
