import OfflineRetryPanel from '../OfflineRetryPanel'
import {
  stagesSearchLookupFailedWords,
  stagesSearchLookupOfflineMessage,
  type StagesSearchLookupFailure,
} from '../../lib/jobs/stagesSearchLookupFailed'

/**
 * The line above the board when the search's server lookup failed (`stagesSearchLookupFailed.ts`): what was not
 * searched, then the reason through `OfflineRetryPanel`, with Retry for a lost signal and none for a refusal.
 */
export function StagesSearchLookupFailed({
  failure,
  onRetry,
  busy,
}: {
  failure: StagesSearchLookupFailure | null
  onRetry: () => void
  busy: boolean
}) {
  if (!failure) return null
  return (
    <div
      data-testid="stages-search-lookup-failed"
      style={{ margin: '0.75rem 0 0', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}
    >
      <span>{stagesSearchLookupFailedWords(failure.unloadedMatches)}</span>
      <OfflineRetryPanel
        failure={failure.failure}
        onRetry={onRetry}
        surface="pipeline-search"
        idempotent
        busy={busy}
        offlineMessage={stagesSearchLookupOfflineMessage(failure.unloadedMatches)}
      />
    </div>
  )
}
