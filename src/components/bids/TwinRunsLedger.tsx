import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { describeTwinRun, relativeTimeFrom } from '../../lib/twinConsoleDisplay'
import { CARD, CARD_TITLE, CHIP, MUTED, STEP_REF } from './twinConsoleStyles'

/**
 * The run ledger, translated to plain English (v2.2433 kernel `twinConsoleDisplay`):
 * every sign-in, mission report, pipeline run and heartbeat the robots log to
 * `twin_runs`, newest first. On the Console lens since v2.3224 (it was step 4 of
 * Settings → Digital twins). Twin tables predate the generated types — untyped
 * client, fail-soft: no table, no card.
 */
type RunRow = { twin_user_id: string; mission: string; notes: string | null; started_at: string }
type CredRow = { id: string; label: string }
type TwinName = { id: string; name: string | null; email: string }

const db = supabase as unknown as SupabaseClient
const LIMIT = 15

export function TwinRunsLedger() {
  const [runs, setRuns] = useState<RunRow[] | null>(null)
  const [creds, setCreds] = useState<CredRow[]>([])
  const [twins, setTwins] = useState<TwinName[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [r, c, t] = await Promise.all([
          db.from('twin_runs').select('twin_user_id, mission, notes, started_at').order('started_at', { ascending: false }).limit(LIMIT),
          db.from('twin_credentials').select('id, label').order('created_at', { ascending: false }).limit(100),
          db.from('users').select('id, name, email').eq('is_digital_twin', true).order('email'),
        ])
        if (cancelled) return
        if (r.error) {
          setRuns(null)
          return
        }
        setRuns((r.data as RunRow[] | null) ?? [])
        setCreds((c.data as CredRow[] | null) ?? [])
        setTwins((t.data as TwinName[] | null) ?? [])
      } catch {
        if (!cancelled) setRuns(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (runs === null) return null

  const nowMs = Date.now()
  const credLabel = (id: string) => creds.find((c) => c.id === id)?.label
  const twinName = (id: string) => {
    const t = twins.find((x) => x.id === id)
    return t ? (t.name ?? t.email.split('@')[0]) : id.slice(0, 8)
  }

  return (
    <div style={CARD}>
      <h4 style={CARD_TITLE}>
        <span style={STEP_REF}>▶</span>Recent runs
      </h4>
      {runs.length === 0 ? <p style={{ ...MUTED, marginBottom: 0 }}>No runs logged yet — the first sign-in or mission report lands here.</p> : null}
      {runs.map((r, i) => {
        const d = describeTwinRun(r.mission, r.notes, credLabel)
        const chip =
          d.verb === 'sign-in'
            ? { text: 'SIGN-IN', bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)' }
            : d.verb === 'report'
              ? { text: 'REPORT', bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)' }
              : d.verb === 'heartbeat'
                ? d.mission === 'blocked'
                  ? { text: 'BLOCKED', bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' }
                  : { text: 'PULSE', bg: 'var(--bg-muted)', fg: 'var(--text-muted)' }
                : { text: 'RUN', bg: 'var(--bg-violet-100)', fg: 'var(--text-violet-800)' }
        return (
          <div key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', fontSize: '0.76rem', padding: '0.26rem 0', borderBottom: i < runs.length - 1 ? '1px solid var(--border)' : 'none', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', width: '4.5rem', flex: 'none' }} title={r.started_at.slice(0, 16).replace('T', ' ')}>
              {relativeTimeFrom(r.started_at, nowMs)}
            </span>
            <span style={{ ...CHIP, padding: '0.08rem 0.45rem', background: chip.bg, color: chip.fg, flex: 'none', width: '3.6rem', textAlign: 'center' }}>{chip.text}</span>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              <span style={{ fontWeight: 600 }}>{twinName(r.twin_user_id)}</span>
              {d.verb !== 'sign-in' ? <span style={{ color: 'var(--text-muted)'}}> · {d.mission}</span> : null}
              {d.detail ? <span style={{ color: 'var(--text-muted)' }}> · {d.detail.slice(0, 140)}</span> : null}
            </span>
          </div>
        )
      })}
    </div>
  )
}
