import { useSyncExternalStore } from 'react'
import { foldedJobId, subscribeFoldedJob } from '../lib/phoneLayout/foldedJob'

/** The job whose squares the Job Mode card holds under the new phone layout (`lib/phoneLayout/foldedJob.ts`), or null. */
export function useFoldedJobId(): string | null {
  return useSyncExternalStore(subscribeFoldedJob, foldedJobId, () => null)
}
