import { useIntervalNowMs } from '../../hooks/useIntervalNowMs'
import { stageCheckWaiting } from '../../lib/jobs/stageCheckDispatch'

/**
 * The red line over a stage check that leads the Dispatch inbox (punch list #245, v2.6462): the reason and the wait,
 * *Can't do it · waiting 4 min*, ticking every 30 seconds as the Customer waiting card's header does. It stands where
 * that card would: the row keeps its *Stage check* tag, its built title and its two doors.
 */
export function StageCheckWaitingLine({ requestId, reason, createdAt }: { requestId: string; reason: unknown; createdAt: string | null | undefined }) {
  const nowMs = useIntervalNowMs(30_000)
  const { words, red } = stageCheckWaiting(reason, createdAt, nowMs)
  return (
    <div
      data-dispatch-stage-check-waiting={requestId}
      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: 4, fontSize: '0.8125rem', fontWeight: 700, color: red ? 'var(--text-red-700)' : 'var(--text-red-600)' }}
    >
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block', flexShrink: 0 }} />
      {words}
    </div>
  )
}
