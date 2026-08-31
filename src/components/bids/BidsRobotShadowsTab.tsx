import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { shadowGateProgress, shadowStorySteps, type ShadowRunRow } from '../../lib/bids/shadowStory'

// list_shadow_runs predates the generated types (BidsAuditsTab pattern).
const shadowDb = supabase as unknown as SupabaseClient

type BidsRobotShadowsTabProps = {
  onOpenBidNumber?: (bidNumber: string) => void
}

/**
 * The Shadows lens (v2.2544): every robot practice bid as the five-step
 * sealed-envelope story — requested, estimated blind, sealed, waiting on our
 * number, opened & scored — plus per-axis Gate-B pips. Read-only over
 * list_shadow_runs(), which keeps the sealed money NULL until scoring, so this
 * surface can't leak a number that would anchor the human estimate.
 */
export function BidsRobotShadowsTab({ onOpenBidNumber }: BidsRobotShadowsTabProps) {
  const [runs, setRuns] = useState<ShadowRunRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await shadowDb.rpc('list_shadow_runs')
      if (cancelled) return
      if (error) setLoadError(error.message)
      else setRuns((data ?? []) as ShadowRunRow[])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const dotStyle = (state: 'done' | 'now' | 'todo', seal?: boolean): React.CSSProperties => ({
    width: 26,
    height: 26,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    flexShrink: 0,
    border: `2px solid ${seal ? '#7c3aed' : state === 'done' ? '#16a34a' : state === 'now' ? '#eab308' : 'var(--border-strong)'}`,
    background: seal ? '#7c3aed' : state === 'done' ? '#16a34a' : state === 'now' ? 'var(--bg-amber-100)' : 'var(--bg-subtle)',
    color: seal || state === 'done' ? 'white' : state === 'now' ? 'var(--text-amber-800)' : 'var(--text-faint)',
  })

  const renderRun = (run: ShadowRunRow) => {
    const steps = shadowStorySteps(run)
    const gate = shadowGateProgress(runs ?? [], run.axis)
    return (
      <div
        key={run.id}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '0.6rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => run.reference_bid_number && onOpenBidNumber?.(run.reference_bid_number)}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-blue-500)', fontWeight: 700, cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}
          >
            b{run.reference_bid_number ?? '?'}
          </button>
          <span style={{ fontWeight: 600 }}>{run.project_name ?? 'Untitled'}</span>
          {run.axis ? (
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderRadius: 4, padding: '2px 7px' }}>
              {run.axis}
            </span>
          ) : null}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>robot bid b{run.shadow_bid_number ?? '?'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.6rem', margin: '0.7rem 0 0.15rem' }}>
          {steps.map((step, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <span style={dotStyle(step.state, step.seal)} aria-hidden>
                {step.seal ? '🔒' : step.state === 'done' ? '✓' : step.state === 'now' ? '⏳' : i + 1}
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: step.state === 'todo' ? 'var(--text-faint)' : 'var(--text-700)',
                  fontWeight: i === 4 && run.status === 'scored' && run.delta_pct != null && Math.abs(Number(run.delta_pct)) <= 8 ? 700 : 400,
                  margin: '0 10px 0 6px',
                  maxWidth: 120,
                  lineHeight: 1.25,
                }}
              >
                {step.label}
              </span>
              {i < steps.length - 1 ? (
                <span style={{ width: 30, height: 2, background: step.state === 'done' ? '#16a34a' : 'var(--border)', marginRight: 10, flexShrink: 0 }} aria-hidden />
              ) : null}
            </span>
          ))}
        </div>

        {run.status === 'scored' && gate.pips.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.45rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {run.axis ?? 'this'} progress toward first-draft duty:
            <span style={{ display: 'inline-flex', gap: 3 }} aria-hidden>
              {gate.pips.map((hit, i) => (
                <span key={i} style={{ width: 12, height: 12, borderRadius: 3, background: hit ? '#16a34a' : 'var(--border-strong)' }} />
              ))}
            </span>
            {gate.gateMet ? 'gate met — 5 close in a row ✓' : `${gate.streak} of 5 close in a row`}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div>
      <details open style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 1rem', marginBottom: '0.9rem', fontSize: '0.85rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>How shadow bids work (30 seconds)</summary>
        <p style={{ margin: '0.5rem 0 0', maxWidth: '75ch' }}>
          The robots practice on real bids. When a bid has everything a robot needs, the robot does its own version{' '}
          <b>in secret</b> — it can&apos;t peek at our number, because our number doesn&apos;t exist yet. It seals its
          price in an envelope. When we send the real bid, the envelope opens and the score is kept automatically. When a
          robot gets close enough, often enough — five in a row within 8% — it earns first drafts for that kind of job.
        </p>
      </details>

      {loadError ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-red-600)' }}>Couldn&apos;t load shadows: {loadError}</p>
      ) : runs === null ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading shadows…</p>
      ) : runs.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          No shadow bids yet — request one with the yellow robot icon on the Bid Board.
        </p>
      ) : (
        runs.map(renderRun)
      )}
    </div>
  )
}
