/**
 * The job window's fact row for a Build job that waits (punch list #192, write A, v2.8726): *Waits · Since Oct 26 ·
 * the GC is not ready for us · Dana*, with **Lift the wait** beside it. The wait is marked on the Bridge's Build
 * desk, which the owner and a dev open. The office opens the job, so the lift sits here too.
 *
 * It draws nothing on a job that does not wait, and nothing when the read is refused. The day, the reason and the
 * name are values the app worked out, so they draw apart from the words (`ValueSentence`). The press shows only to
 * the office, the people `set_job_build_wait` takes. A lift the database refuses says its reason under the row.
 */
import { useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useJobBuildWait } from '../../hooks/useJobBuildWait'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { BUILD_WAIT_WORDS, buildWaitFactNote, buildWaitFactSentence, buildWaitLiftedWords } from '../../lib/bridge/build/buildWaits'
import { buildWaitsIo, type BuildWaitsIo } from '../../lib/bridge/build/buildWaitsIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'

export function JobBuildWaitFactRow({
  jobId,
  jobLabel,
  canLift,
  io = buildWaitsIo,
}: {
  jobId: string | null
  /** The job as the toast names it: *878 · Tune 5 Seguin*. */
  jobLabel: string
  /** The office alone lifts a wait. Everyone else reads the row. */
  canLift: boolean
  io?: Pick<BuildWaitsIo, 'loadOpenForJob' | 'lift'>
}) {
  const wait = useJobBuildWait(jobId, io)
  const { showToast } = useToastContext()
  const phone = useNarrowViewport640()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  if (!wait || !jobId) return null
  const note = buildWaitFactNote(wait)

  const lift = () => {
    if (busy) return
    setBusy(true)
    setFailed(null)
    void (async () => {
      try {
        // The lift tells the page to read again, and the row leaves when that read lands.
        await io.lift(jobId)
        showToast(buildWaitLiftedWords(jobLabel), 'success')
      } catch (e) {
        setFailed(formatErrorMessage(e, BUILD_WAIT_WORDS.liftFailed))
      } finally {
        setBusy(false)
      }
    })()
  }

  return (
    <div data-testid="job-build-wait-fact" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: phone ? '0.4rem 0.75rem' : '0.5rem 0.75rem', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', minHeight: phone ? 44 : undefined }}>
        <span style={{ flex: phone ? '0 0 104px' : '0 0 108px', fontSize: phone ? '0.875rem' : '0.8125rem', color: 'var(--text-muted)' }}>{BUILD_WAIT_WORDS.factLabel}</span>
        <span data-testid="job-build-wait-words" style={{ flex: '1 1 12rem', minWidth: 0, fontSize: phone ? '0.9375rem' : '0.875rem', overflowWrap: 'anywhere' }}>
          <ValueSentence text={buildWaitFactSentence(wait)} />
        </span>
        {canLift ? (
          <button
            type="button"
            onClick={lift}
            disabled={busy}
            data-testid="job-build-wait-lift"
            style={{
              marginLeft: 'auto',
              flexShrink: 0,
              minHeight: phone ? 44 : 32,
              padding: '0 0.75rem',
              borderRadius: 6,
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              color: 'var(--text-strong)',
              fontFamily: 'inherit',
              fontSize: phone ? '0.875rem' : '0.8125rem',
              fontWeight: 600,
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            {busy ? BUILD_WAIT_WORDS.lifting : BUILD_WAIT_WORDS.lift}
          </button>
        ) : null}
      </div>
      {note ? (
        <div data-testid="job-build-wait-note" style={{ marginTop: '0.25rem', fontSize: '0.8125rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
          {note}
        </div>
      ) : null}
      {failed ? (
        <div role="alert" style={{ marginTop: '0.35rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
          {failed}
        </div>
      ) : null}
    </div>
  )
}
