/**
 * The chip a waiting job wears on its Stages card and table row (punch list #192, write A, v2.8723): *Waits · the GC
 * is not ready for us · since Oct 26*. A label, not a press: dispatch reads why the job has no crew before anyone
 * asks. The wait is lifted from the Bridge's Build desk. The words are `buildWaitChipWords`.
 */
import { buildWaitChipWords, type BuildWait } from '../../lib/bridge/build/buildWaits'

export function BuildWaitChip({ wait, compact = false }: { wait: BuildWait | null | undefined; compact?: boolean }) {
  if (!wait) return null
  const who = wait.markedByName.trim().split(/\s+/)[0]
  return (
    <span
      data-testid="build-wait-chip"
      title={`This job is marked as waiting${who ? ` by ${who}` : ''}. The Build desk does not count it against the crew. Lift the wait on the Bridge's Build desk.`}
      style={{
        display: 'inline-block',
        maxWidth: '100%',
        fontSize: compact ? '0.66rem' : '0.68rem',
        fontWeight: 600,
        padding: compact ? '1px 6px' : '1px 7px',
        borderRadius: 999,
        background: 'var(--bg-subtle)',
        color: 'var(--text-muted)',
        border: '1px solid var(--border)',
        overflowWrap: 'anywhere',
      }}
    >
      {buildWaitChipWords(wait)}
    </span>
  )
}
