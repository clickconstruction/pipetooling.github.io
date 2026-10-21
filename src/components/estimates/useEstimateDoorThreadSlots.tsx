/**
 * The estimate door on our side of the thread (v2.5698, punch list #139 PR 7): on our estimate email's line, a press
 * that closes the thread and opens the estimate. Where the line's words only repeat the subject (the email's own
 * heading, so the subject read twice), the door draws in their place; otherwise under the line. The rule is
 * `lib/messages/estimateDoor.ts`. One press, no read; drawn through cut 1's slots (`threadSlots.tsx`).
 */
import { useMemo, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ESTIMATE_DOOR_WORDS, estimateDoorFor, estimateDoorHref } from '../../lib/messages/estimateDoor'
import type { ThreadMessage } from '../../lib/messages/thread'
import type { ThreadSlots } from '../gc/messages/threadSlots'
import { useThreadWindow } from '../gc/messages/useThreadWindow'

export type EstimateDoorThreadSlots = Pick<ThreadSlots, 'lineBody' | 'underLine'>

const door: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  marginTop: '0.25rem',
  padding: '0.25rem 0.7rem',
  borderRadius: 999,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-link)',
  fontWeight: 600,
  fontSize: '0.8rem',
  cursor: 'pointer',
}

export function useEstimateDoorThreadSlots(): EstimateDoorThreadSlots {
  const navigate = useNavigate()
  const { closeThread } = useThreadWindow()
  return useMemo<EstimateDoorThreadSlots>(() => {
    const doorFor = (m: ThreadMessage) => estimateDoorFor({ channel: m.channel, direction: m.direction, subject: m.subject ?? null, body: m.body })
    const button = (m: ThreadMessage, d: NonNullable<ReturnType<typeof estimateDoorFor>>) => (
      <button
        key={`estimate-door:${m.id}`}
        type="button"
        style={door}
        title={ESTIMATE_DOOR_WORDS.tip}
        data-testid="estimate-door"
        onClick={(e) => {
          // The line's own press opens the message window; this press leaves the thread for the estimate.
          e.stopPropagation()
          closeThread()
          navigate(estimateDoorHref(d))
        }}
      >
        📄 {ESTIMATE_DOOR_WORDS.open(d)}
      </button>
    )
    return {
      lineBody: (m) => {
        const d = doorFor(m)
        return d?.duplicate ? button(m, d) : null
      },
      underLine: (m) => {
        const d = doorFor(m)
        return d && !d.duplicate ? button(m, d) : null
      },
    }
  }, [navigate, closeThread])
}
