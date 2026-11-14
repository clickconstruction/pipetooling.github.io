import OfflineRetryPanel from '../OfflineRetryPanel'
import { recoveryFailureFromError } from '../../lib/offlineRecoveryState'
import { jobLoadState, loadJob } from '../../lib/materials/onSiteStore'
import { useOnSiteStoreVersion } from '../../hooks/useOnSiteStore'
import { siteJobsNotLoadedWords } from '../../lib/materials/onSiteReadFailed'

/**
 * Over a site's screen (punch list #344, PR 3, v2.7175): the jobs whose read failed. The desk's load reads each job
 * by itself and a job keeps its own error, so a site drawn from the jobs that did load left the others out without a
 * word. This says how many are not on the screen, with the first one's reason behind the panel's class, and Retry
 * reads just those again. Nothing is drawn when every job loaded.
 */
export default function OnSiteJobsNotLoaded({ jobIds, surface }: { jobIds: ReadonlyArray<string>; surface: string }) {
  useOnSiteStoreVersion()
  const failed = jobIds.map((id) => ({ id, state: jobLoadState(id) })).filter((j) => j.state.error)
  const first = failed[0]
  if (!first) return null
  // The panel's own sentence for a lost signal would say only that the app could not be reached; this screen still
  // draws the jobs that did load, so the words name what is missing from it.
  const words = siteJobsNotLoadedWords(failed.length, jobIds.length)
  return (
    <OfflineRetryPanel
      failure={recoveryFailureFromError(first.state.raw, 'The boxes did not load.', words)}
      offlineMessage={words}
      onRetry={() => failed.forEach((j) => void loadJob(j.id, { force: true }))}
      surface={surface}
      idempotent
    />
  )
}
