import OfflineRetryPanel from '../OfflineRetryPanel'
import {
  headerSearchFailedLines,
  headerSearchNothingMatchedWords,
  type HeaderSearchFailedRead,
  type HeaderSearchMode,
} from '../../lib/search/headerSearchFailedReads'

/**
 * The lines under the header box's rows when a server read failed (`headerSearchFailedReads.ts`): one per
 * distinct failure, naming the kinds it kept from being searched, then the reason through `OfflineRetryPanel`,
 * with Retry for a lost signal and none for a refusal. With no row to show, a last line says what was searched
 * and found nothing, in place of *No matches*.
 */
export function HeaderSearchFailedReads({
  failed,
  mode,
  onRetry,
  busy,
  nothingShown,
}: {
  failed: readonly HeaderSearchFailedRead[]
  mode: HeaderSearchMode
  onRetry: () => void
  busy: boolean
  /** The box has no row at all, so the panel also says what was searched and found nothing. */
  nothingShown: boolean
}) {
  const lines = headerSearchFailedLines(failed, mode)
  if (lines.length === 0) return null
  return (
    <div
      data-testid="header-search-failed-reads"
      style={{ display: 'grid', gap: '0.45rem', padding: '0.5rem 0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}
    >
      {lines.map((line) => (
        <div key={line.kinds.join('+')} style={{ display: 'grid', gap: '0.2rem' }}>
          <span>{line.words}</span>
          <OfflineRetryPanel
            failure={line.failure}
            onRetry={onRetry}
            surface="header-search"
            idempotent
            busy={busy}
            offlineMessage={line.offlineMessage}
          />
        </div>
      ))}
      {nothingShown ? <span>{headerSearchNothingMatchedWords(failed, mode)}</span> : null}
    </div>
  )
}
