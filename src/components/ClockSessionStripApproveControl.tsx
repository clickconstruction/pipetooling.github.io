import { useCallback, useRef, type CSSProperties, type PointerEvent } from 'react'

const actionsSrOnly: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

/** Font Awesome Free v7.2.0 — https://fontawesome.com License — https://fontawesome.com/license/free */
const FA_ATTR = { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 640 640' as const }

const iconWrap: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: '1.1rem',
  height: '1.1rem',
}

const pathD = {
  check:
    'M480 96C515.3 96 544 124.7 544 160L544 480C544 515.3 515.3 544 480 544L160 544C124.7 544 96 515.3 96 480L96 160C96 124.7 124.7 96 160 96L480 96zM438 209.7C427.3 201.9 412.3 204.3 404.5 215L285.1 379.2L233 327.1C223.6 317.7 208.4 317.7 199.1 327.1C189.8 336.5 189.7 351.7 199.1 361L271.1 433C276.1 438 283 440.5 289.9 440C296.8 439.5 303.3 435.9 307.4 430.2L443.3 243.2C451.1 232.5 448.7 217.5 438 209.7z',
  square:
    'M480 144C488.8 144 496 151.2 496 160L496 480C496 488.8 488.8 496 480 496L160 496C151.2 496 144 488.8 144 480L144 160C144 151.2 151.2 144 160 144L480 144zM160 96C124.7 96 96 124.7 96 160L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 160C544 124.7 515.3 96 480 96L160 96z',
}

/** Short release approves (pending). Long hold opens session actions when `actionsEligible`. */
const APPROVE_MAX_MS = 420
const REJECT_MIN_MS = 560

export type ClockSessionStripApproveStatus = 'open' | 'approved' | 'pending'

export function deriveClockSessionStripApproveStatus(
  clockedOutAt: string | null,
  approvedAt: string | null,
): ClockSessionStripApproveStatus {
  if (clockedOutAt == null) return 'open'
  if (approvedAt != null) return 'approved'
  return 'pending'
}

function StripIcon({
  status,
}: {
  status: ClockSessionStripApproveStatus
}) {
  if (status === 'approved') {
    return (
      <svg {...FA_ATTR} width={16} height={16} aria-hidden style={iconWrap}>
        <path fill="#16a34a" d={pathD.check} />
      </svg>
    )
  }
  if (status === 'open') {
    return (
      <svg {...FA_ATTR} width={16} height={16} aria-hidden style={iconWrap}>
        <path fill="#9ca3af" d={pathD.square} />
      </svg>
    )
  }
  return (
    <svg {...FA_ATTR} width={16} height={16} aria-hidden style={iconWrap}>
      <path fill="#6b7280" d={pathD.square} />
    </svg>
  )
}

export function ClockSessionStripApproveControl({
  sessionId,
  status,
  interactive,
  busy,
  actionsEligible,
  onOpenActions,
  onApprove,
  onReject,
}: {
  sessionId: string
  status: ClockSessionStripApproveStatus
  interactive: boolean
  busy: boolean
  /** Long-press / Shift+click open session actions (Approve / Reject / Edit / Revoke). */
  actionsEligible: boolean
  onOpenActions: () => void | Promise<void>
  onApprove: () => Promise<void>
  /** Used only when `actionsEligible` is false (legacy long-press reject path). */
  onReject: () => Promise<void>
}) {
  const downAtRef = useRef<number | null>(null)
  const pointerIdRef = useRef<number | null>(null)

  const resetPointerState = useCallback((target: Element | null) => {
    const pid = pointerIdRef.current
    pointerIdRef.current = null
    downAtRef.current = null
    if (pid != null && target) {
      try {
        target.releasePointerCapture(pid)
      } catch {
        /* ignore */
      }
    }
  }, [])

  const endPressPending = useCallback(
    async (e: PointerEvent<Element>, target: Element | null) => {
      const t0 = downAtRef.current
      resetPointerState(target)
      if (t0 == null || busy) return
      if (!interactive) return
      const dt = performance.now() - t0
      if (actionsEligible) {
        if (e.shiftKey) {
          await onOpenActions()
          return
        }
        if (dt < APPROVE_MAX_MS) {
          await onApprove()
          return
        }
        if (dt >= REJECT_MIN_MS) {
          await onOpenActions()
          return
        }
        return
      }
      if (e.shiftKey) {
        await onReject()
        return
      }
      if (dt < APPROVE_MAX_MS) {
        await onApprove()
        return
      }
      if (dt >= REJECT_MIN_MS) {
        await onReject()
      }
    },
    [interactive, busy, actionsEligible, onApprove, onReject, onOpenActions, resetPointerState],
  )

  const endPressApproved = useCallback(
    async (e: PointerEvent<Element>, target: Element | null) => {
      const t0 = downAtRef.current
      resetPointerState(target)
      if (t0 == null || busy || !actionsEligible) return
      const dt = performance.now() - t0
      if (e.shiftKey || dt >= REJECT_MIN_MS) {
        await onOpenActions()
      }
    },
    [busy, actionsEligible, onOpenActions, resetPointerState],
  )

  const titlePending = actionsEligible
    ? 'Click to approve. Long-press or Shift+click for Approve, Reject, or Edit.'
    : interactive
      ? 'Click to approve. Hold 0.6s or Shift+click to reject.'
      : 'Pending approval (view only)'

  const titleApproved = actionsEligible
    ? 'Approved — long-press or Shift+click for Revoke or Edit.'
    : 'Approved'

  const title =
    status === 'open'
      ? 'Still clocked in — approve/reject when clocked out'
      : status === 'approved'
        ? titleApproved
        : titlePending

  if (status === 'open' || (!interactive && !(actionsEligible && status === 'approved'))) {
    return (
      <span
        style={{ display: 'inline-flex', alignItems: 'center' }}
        title={title}
        aria-label={
          status === 'open'
            ? 'Open session'
            : status === 'approved'
              ? 'Approved session'
              : 'Pending approval'
        }
      >
        <StripIcon status={status} />
      </span>
    )
  }

  if (actionsEligible && status === 'approved') {
    return (
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
        <button
          type="button"
          title={title}
          aria-label="Approved clock session: long-press or Shift+click for session actions"
          disabled={busy}
          onPointerDown={(e) => {
            if (e.button !== 0 || busy) return
            downAtRef.current = performance.now()
            pointerIdRef.current = e.pointerId
            try {
              e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
              /* ignore */
            }
          }}
          onPointerUp={(e) => {
            const el = e.currentTarget
            void endPressApproved(e, el)
          }}
          onPointerCancel={(e) => {
            const el = e.currentTarget
            void endPressApproved(e, el)
          }}
          onPointerLeave={(e) => {
            resetPointerState(e.currentTarget)
          }}
          onKeyDown={(e) => {
            if (busy) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              void onOpenActions()
            }
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.1rem',
            margin: 0,
            border: 'none',
            background: 'transparent',
            cursor: busy ? 'wait' : 'pointer',
            borderRadius: 4,
            touchAction: 'manipulation',
            opacity: busy ? 0.55 : 1,
          }}
        >
          <StripIcon status={status} />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onOpenActions()}
          style={actionsSrOnly}
          aria-label={`Session actions for approved clock session ${sessionId.slice(0, 8)}…`}
        >
          Session actions
        </button>
      </span>
    )
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
      <button
        type="button"
        title={title}
        aria-label={
          actionsEligible
            ? 'Clock session: click to approve, long-press or Shift+click for more actions'
            : 'Clock session: click to approve, hold to reject, or Shift+click to reject'
        }
        disabled={busy}
        onPointerDown={(e) => {
          if (e.button !== 0 || busy) return
          downAtRef.current = performance.now()
          pointerIdRef.current = e.pointerId
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            /* ignore */
          }
        }}
        onPointerUp={(e) => {
          const el = e.currentTarget
          void endPressPending(e, el)
        }}
        onPointerCancel={(e) => {
          const el = e.currentTarget
          void endPressPending(e, el)
        }}
        onPointerLeave={(e) => {
          resetPointerState(e.currentTarget)
        }}
        onKeyDown={(e) => {
          if (busy) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (actionsEligible && e.shiftKey) void onOpenActions()
            else void onApprove()
          }
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.1rem',
          margin: 0,
          border: 'none',
          background: 'transparent',
          cursor: busy ? 'wait' : 'pointer',
          borderRadius: 4,
          touchAction: 'manipulation',
          opacity: busy ? 0.55 : 1,
        }}
      >
        <StripIcon status={status} />
      </button>
      {actionsEligible ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onOpenActions()}
          style={actionsSrOnly}
          aria-label={`Session actions for clock session ${sessionId.slice(0, 8)}…`}
        >
          Session actions
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onReject()}
          style={actionsSrOnly}
          aria-label={`Reject clock session ${sessionId.slice(0, 8)}…`}
        >
          Reject session
        </button>
      )}
    </span>
  )
}
