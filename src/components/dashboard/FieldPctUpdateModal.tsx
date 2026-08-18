import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import {
  FIELD_PCT_STEPS,
  applyFieldPctStep,
  fieldPctDeltaLabel,
  fieldPctStartValue,
} from '../../lib/jobs/fieldPctUpdate'
import { MarkJobReadyToBillPrompt } from '../jobs/MarkJobReadyToBillPrompt'
import AutosizeTextarea from '../AutosizeTextarea'

const BAR_BASE_COLOR = '#3b82f6'
const BAR_GAIN_COLOR = '#16a34a'
const BAR_DROP_COLOR = '#d97706'

/**
 * Field "% done" stepper (v2.1806): subs and helpers move a job's percent
 * complete from their My Schedule cards — ±1/±5/±20 chips, a live
 * "45% → 65% (▲ 20)" preview over the same blue/green bar idiom as the card,
 * and an optional note. Saves through the set_job_pct_from_field RPC
 * (v2.1805), which posts the "N% complete — <note>" thread note as the caller
 * and writes jobs_ledger.pct_complete atomically, so Stages activity and the
 * card's day-delta layer light up on their own. Saving 100% on a Working job
 * chains into the existing MarkJobReadyToBillPrompt (helpers are authorized
 * via update_job_status).
 *
 * The saved-from base is fetched fresh on open — the card's cached % can lag
 * another crew member's update.
 */
export default function FieldPctUpdateModal({
  job,
  onClose,
  onSaved,
}: {
  job: {
    id: string
    /** Display number for the title / RTB prompt (e.g. "J949"). */
    hcpNumber: string
    jobName: string
    /** e.g. "J949 · Dominguez- Run camera" — the card's row label. */
    label: string
  }
  onClose: () => void
  /** Fired after a successful save (and after the RTB prompt, when shown). */
  onSaved: (newPct: number) => void
}) {
  const { showToast } = useToastContext()
  const [base, setBase] = useState<number | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  const [next, setNext] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rtbJob, setRtbJob] = useState<{ id: string; hcpNumber: string; jobName: string } | null>(null)
  const [savedPct, setSavedPct] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase.from('jobs_ledger').select('pct_complete, status').eq('id', job.id).maybeSingle(),
          'load job pct for field update',
        )
        if (cancelled) return
        const row = data as { pct_complete: number | null; status: string | null } | null
        const start = fieldPctStartValue(row?.pct_complete ?? null, row?.status ?? null)
        setBase(start)
        setNext(start)
        setJobStatus(row?.status ?? null)
      } catch (e) {
        if (!cancelled) setError(formatErrorMessage(e, 'Could not load the job'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [job.id])

  // Esc closes — but only while this layer is on top (the RTB prompt swaps in
  // with its own close, one layer at a time).
  useEffect(() => {
    if (rtbJob) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rtbJob, onClose])

  const save = async () => {
    if (base == null || next == null || saving) return
    setSaving(true)
    setError(null)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase.rpc('set_job_pct_from_field', {
            p_job_id: job.id,
            p_pct: next,
            p_note: note.trim() || undefined,
          }),
        'field pct update',
      )
      const r = data as { ok?: boolean; error?: string } | null
      if (!r?.ok) throw new Error(r?.error || 'Could not save the update')
      showToast(`Saved — ${job.hcpNumber} is now ${next}% done.`, 'success')
      if (next === 100 && jobStatus === 'working') {
        setSavedPct(next)
        setRtbJob({ id: job.id, hcpNumber: job.hcpNumber, jobName: job.jobName })
        return
      }
      onSaved(next)
      onClose()
    } catch (e) {
      setError(formatErrorMessage(e, 'Could not save the update'))
    } finally {
      setSaving(false)
    }
  }

  if (rtbJob) {
    return (
      <MarkJobReadyToBillPrompt
        job={rtbJob}
        onClose={() => {
          setRtbJob(null)
          if (savedPct != null) onSaved(savedPct)
          onClose()
        }}
      />
    )
  }

  const delta = base != null && next != null ? fieldPctDeltaLabel(base, next) : null
  const loaded = base != null && next != null
  const canSave = loaded && !saving && (next !== base || note.trim() !== '')
  const barBase = loaded ? Math.min(base, next) : 0
  const barChange = loaded ? Math.abs(next - base) : 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Update % done for ${job.label}`}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          padding: '1.25rem',
          borderRadius: 8,
          width: 'min(420px, calc(100vw - 2rem))',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>How done is this job?</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{job.label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, color: 'var(--text-muted)', minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '-0.5rem -0.5rem 0 0' }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.6rem', marginTop: '1rem' }}>
          {loaded ? (
            <>
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{base}%</span>
              <span aria-hidden style={{ color: 'var(--text-faint)' }}>→</span>
              <span style={{ fontSize: '2rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{next}%</span>
              {delta ? (
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color:
                      delta.tone === 'up'
                        ? 'var(--text-green-600)'
                        : delta.tone === 'down'
                          ? 'var(--text-amber-800)'
                          : 'var(--text-faint)',
                  }}
                >
                  {delta.label}
                </span>
              ) : null}
            </>
          ) : (
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{error ?? 'Loading…'}</span>
          )}
        </div>

        {/* Same bar idiom as the schedule card (v2.1567): blue = where it was,
            green = the gain being proposed (amber = a downward correction). */}
        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-muted)', marginTop: '0.75rem' }}>
          <span style={{ width: `${barBase}%`, background: BAR_BASE_COLOR }} />
          <span style={{ width: `${barChange}%`, background: loaded && next < base ? BAR_DROP_COLOR : BAR_GAIN_COLOR }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginTop: '1rem' }}>
          {FIELD_PCT_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              disabled={!loaded || saving}
              onClick={() => setNext((cur) => (cur == null ? cur : applyFieldPctStep(cur, step)))}
              style={{
                padding: '0.6rem 0',
                fontSize: '1rem',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                background: 'var(--surface)',
                color: loaded ? 'var(--text-strong)' : 'var(--text-muted)',
                cursor: loaded && !saving ? 'pointer' : 'default',
              }}
            >
              {step > 0 ? `+${step}` : `−${-step}`}
            </button>
          ))}
        </div>

        <label style={{ display: 'block', marginTop: '0.9rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>What got done? (optional)</span>
          <AutosizeTextarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            minRows={2}
            placeholder="Set fixtures in units 3–5, waiting on parts for 6…"
            style={{ width: '100%', marginTop: '0.3rem', padding: '0.5rem', fontFamily: 'inherit', fontSize: '0.9375rem', border: '1px solid var(--border-strong)', borderRadius: 6, boxSizing: 'border-box' }}
          />
        </label>

        {error && loaded ? (
          <p style={{ margin: '0.6rem 0 0', fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>{error}</p>
        ) : null}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ flex: 1, padding: '0.55rem 0', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave}
            style={{
              flex: 2,
              padding: '0.55rem 0',
              fontSize: '0.875rem',
              fontWeight: 600,
              background: canSave ? '#3b82f6' : 'var(--bg-muted)',
              color: canSave ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 6,
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Saving…' : loaded ? `Save ${next}%` : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
