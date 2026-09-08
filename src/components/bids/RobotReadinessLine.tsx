import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import {
  buildReadinessLine,
  isProbeableLink,
  ROBOT_INTAKE_ACCOUNT,
  type PlansProbeState,
} from '../../lib/bids/robotReadinessLine'

/**
 * The robot-readiness line under the bid form's plans link (v2.3142): tells the
 * estimator, while the bid is in front of her, whether the robots will shadow
 * it — green with the facts, amber with the exact fix (and a button for it),
 * or neutral when she has opted the bid out. The plans check is the same
 * plan-fetch probe the dispatcher trusts, run against the typed link before
 * the bid even exists (`probe_url`, staff only). Kernel: robotReadinessLine.ts.
 */
export interface RobotReadinessLineProps {
  plansLink: string
  address: string
  distanceFromOffice: string
  bidDueDate: string
  serviceTypeId: string
  serviceTypeName: string
  robotOptOut: boolean
  onRobotOptOutChange: (v: boolean) => void
  distanceBusy?: boolean
}

const PROBE_DEBOUNCE_MS = 700

export function RobotReadinessLine(props: RobotReadinessLineProps) {
  const { showToast } = useToastContext()
  const [probe, setProbe] = useState<PlansProbeState>({ kind: 'idle' })
  const [probedLink, setProbedLink] = useState('')
  const seq = useRef(0)

  async function runProbe(link: string) {
    const mine = ++seq.current
    setProbe({ kind: 'checking' })
    try {
      const { data, error } = await supabase.functions.invoke<{ readable?: boolean; note?: string | null; error?: string }>('plan-fetch', {
        body: { probe_url: link },
      })
      if (mine !== seq.current) return
      if (error || !data || data.error) {
        setProbe({ kind: 'error', message: data?.error ?? error?.message ?? 'no answer from the plans check' })
      } else {
        setProbe(data.readable ? { kind: 'readable', note: data.note ?? null } : { kind: 'unreadable', note: data.note ?? null })
      }
      setProbedLink(link)
    } catch (e) {
      if (mine !== seq.current) return
      setProbe({ kind: 'error', message: e instanceof Error ? e.message : 'no answer from the plans check' })
    }
  }

  // Probe when the typed link settles; a non-Drive link is reported without a call.
  useEffect(() => {
    const link = props.plansLink.trim()
    if (!link) {
      setProbe({ kind: 'idle' })
      setProbedLink('')
      return
    }
    if (link === probedLink) return
    if (!isProbeableLink(link)) {
      setProbe({ kind: 'unreadable', note: 'plans link is not a Google Drive file or folder link — robots can only fetch Drive files' })
      setProbedLink(link)
      return
    }
    // Say "checking" at once so the line never flashes green before the probe answers.
    setProbe({ kind: 'checking' })
    const t = window.setTimeout(() => void runProbe(link), PROBE_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.plansLink])

  const line = buildReadinessLine({
    plansLink: props.plansLink,
    address: props.address,
    distanceFromOffice: props.distanceFromOffice,
    bidDueDate: props.bidDueDate,
    serviceTypeId: props.serviceTypeId,
    serviceTypeName: props.serviceTypeName,
    robotOptOut: props.robotOptOut,
    probe,
    distanceBusy: props.distanceBusy,
  })

  const tone = line.tone
  const box =
    tone === 'ready'
      ? { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', border: '1px solid var(--bg-green-tint)' }
      : tone === 'blocked'
        ? { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid var(--bg-amber-tint)' }
        : { background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
  const wantsCopy = line.gaps.some((g) => g.copyIntake)
  const canRecheck = tone === 'blocked' && isProbeableLink(props.plansLink)

  async function copyIntake() {
    try {
      await navigator.clipboard.writeText(ROBOT_INTAKE_ACCOUNT)
      showToast('Intake address copied — share the file with it as Viewer', 'success')
    } catch {
      showToast(ROBOT_INTAKE_ACCOUNT, 'info')
    }
  }

  return (
    <div style={{ marginTop: '-0.35rem', marginBottom: '1rem' }}>
      <div
        role="note"
        aria-live="polite"
        data-tone={tone}
        data-testid="robot-readiness-line"
        style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.55rem 0.75rem', borderRadius: 6, fontSize: '0.84rem', lineHeight: 1.45, ...box }}
      >
        <span aria-hidden style={{ fontSize: '1rem', lineHeight: 1.2 }}>{tone === 'off' || tone === 'blocked' ? '🤖✕' : '🤖'}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{line.title}</div>
          {line.detail ? <div style={{ fontSize: '0.8rem', opacity: 0.95 }}>{line.detail}</div> : null}
          {wantsCopy || canRecheck ? (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
              {canRecheck ? (
                <button
                  type="button"
                  onClick={() => void runProbe(props.plansLink.trim())}
                  style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
                >
                  ↻ Check again
                </button>
              ) : null}
              {wantsCopy ? (
                <button
                  type="button"
                  onClick={() => void copyIntake()}
                  style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
                >
                  Copy intake address
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.45rem', fontSize: '0.8rem', color: props.robotOptOut ? 'var(--text-700)' : 'var(--text-muted)', cursor: 'pointer' }}>
        <input type="checkbox" checked={props.robotOptOut} onChange={(e) => props.onRobotOptOutChange(e.target.checked)} />
        Don’t let robots shadow this bid
      </label>
    </div>
  )
}
