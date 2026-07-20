import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

const FETCH_LIMIT = 500

export type QuickfillSectionMarkHistoryModalProps = {
  open: boolean
  onClose: () => void
  sectionId: string | null
  sectionLabel: string | null
}

type EventRow = {
  id: string
  marked_at: string
  outstanding_count: number | null
  note_text: string | null
  marked_by: string | null
  users: { name: string | null } | null
}

function formatMarkedAt(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString(undefined, {
      timeZone: APP_CALENDAR_TZ,
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export function QuickfillSectionMarkHistoryModal({
  open,
  onClose,
  sectionId,
  sectionLabel,
}: QuickfillSectionMarkHistoryModalProps) {
  const cutoffRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentRows, setRecentRows] = useState<EventRow[]>([])

  const [olderExpanded, setOlderExpanded] = useState(false)
  const [olderRows, setOlderRows] = useState<EventRow[] | null>(null)
  const [olderFetched, setOlderFetched] = useState(false)
  const [olderLoading, setOlderLoading] = useState(false)
  const [olderError, setOlderError] = useState<string | null>(null)

  const loadRecent = useCallback(async () => {
    if (!sectionId) return
    const cutoffIso = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()
    cutoffRef.current = cutoffIso
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('quickfill_section_mark_events')
        .select(
          'id, marked_at, outstanding_count, note_text, marked_by, users!quickfill_section_mark_events_marked_by_fkey(name)',
        )
        .eq('section_id', sectionId)
        .gte('marked_at', cutoffIso)
        .order('marked_at', { ascending: false })
        .limit(FETCH_LIMIT)
      if (qErr) {
        setError(qErr.message)
        setRecentRows([])
        return
      }
      setRecentRows((data ?? []) as EventRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history')
      setRecentRows([])
    } finally {
      setLoading(false)
    }
  }, [sectionId])

  const loadOlder = useCallback(async () => {
    const cutoffIso = cutoffRef.current
    if (!sectionId || !cutoffIso) return
    setOlderLoading(true)
    setOlderError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('quickfill_section_mark_events')
        .select(
          'id, marked_at, outstanding_count, note_text, marked_by, users!quickfill_section_mark_events_marked_by_fkey(name)',
        )
        .eq('section_id', sectionId)
        .lt('marked_at', cutoffIso)
        .order('marked_at', { ascending: false })
        .limit(FETCH_LIMIT)
      if (qErr) {
        setOlderError(qErr.message)
        setOlderRows([])
        return
      }
      setOlderRows((data ?? []) as EventRow[])
    } catch (e) {
      setOlderError(e instanceof Error ? e.message : 'Failed to load older history')
      setOlderRows([])
    } finally {
      setOlderLoading(false)
      setOlderFetched(true)
    }
  }, [sectionId])

  useEffect(() => {
    if (!open || !sectionId) {
      cutoffRef.current = null
      setLoading(false)
      setError(null)
      setRecentRows([])
      setOlderExpanded(false)
      setOlderRows(null)
      setOlderFetched(false)
      setOlderLoading(false)
      setOlderError(null)
      return
    }
    setOlderExpanded(false)
    setOlderRows(null)
    setOlderFetched(false)
    setOlderLoading(false)
    setOlderError(null)
    void loadRecent()
  }, [open, sectionId, loadRecent])

  useEffect(() => {
    if (!open || !sectionId || !olderExpanded || olderFetched || loading) return
    if (!cutoffRef.current) return
    void loadOlder()
  }, [open, sectionId, olderExpanded, olderFetched, loading, loadOlder])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !sectionId || !sectionLabel) return null

  const olderPanelId = `quickfill-mark-history-older-${sectionId}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quickfill-mark-history-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 10,
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <h2 id="quickfill-mark-history-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>
            Mark history — {sectionLabel}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: 6,
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-subtle)',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
        <div style={{ padding: '1rem 1.25rem', overflow: 'auto', flex: 1 }}>
          {loading && <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading…</p>}
          {error && !loading && <p style={{ margin: 0, color: 'var(--text-red-700)' }}>{error}</p>}
          {!loading && !error && (
            <>
              <HistoryTable title="Last 7 days" rows={recentRows} emptyCopy="No marks in the last 7 days." />
              <div style={{ marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  id={`${olderPanelId}-trigger`}
                  aria-expanded={olderExpanded}
                  aria-controls={olderPanelId}
                  disabled={loading}
                  title={loading ? 'Wait for recent history to load' : undefined}
                  onClick={() => setOlderExpanded((v) => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    width: '100%',
                    margin: 0,
                    padding: '0.25rem 0',
                    border: 'none',
                    borderRadius: 0,
                    background: 'transparent',
                    appearance: 'none',
                    cursor: 'pointer',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    ...(loading ? { opacity: 0.55, cursor: 'not-allowed' } : {}),
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: '0.75rem', width: '1rem', flexShrink: 0, color: 'var(--text-muted)' }}>
                    {olderExpanded ? '▼' : '▶'}
                  </span>
                  Earlier (all time)
                  {olderFetched && olderRows != null && !olderLoading && (
                    <span style={{ fontWeight: 500, color: 'var(--text-slate-500)', fontSize: '0.8125rem' }}>
                      ({olderRows.length} loaded)
                    </span>
                  )}
                </button>
                {olderExpanded && (
                  <div
                    id={olderPanelId}
                    role="region"
                    aria-labelledby={`${olderPanelId}-trigger`}
                    style={{ marginTop: '0.65rem' }}
                  >
                    {olderLoading && <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</p>}
                    {olderError && !olderLoading && (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-red-700)' }}>{olderError}</p>
                    )}
                    {!olderLoading && !olderError && olderRows != null && (
                      <HistoryTable title="" rows={olderRows} emptyCopy="No older marks in this history window." />
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function HistoryTable({
  title,
  rows,
  emptyCopy,
}: {
  title: string
  rows: EventRow[]
  emptyCopy: string
}) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {title !== '' && (
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-700)' }}>{title}</h3>
      )}
      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-faint)' }}>{emptyCopy}</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.65rem', fontWeight: 600 }}>When</th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.65rem', fontWeight: 600 }}>By</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0.65rem', fontWeight: 600 }}>Open items</th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.65rem', fontWeight: 600 }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.5rem 0.65rem', whiteSpace: 'nowrap' }}>{formatMarkedAt(r.marked_at)}</td>
                  <td style={{ padding: '0.5rem 0.65rem' }}>{r.users?.name?.trim() || '—'}</td>
                  <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right' }}>
                    {r.outstanding_count == null ? '—' : r.outstanding_count}
                  </td>
                  <td
                    style={{
                      padding: '0.5rem 0.65rem',
                      maxWidth: '14rem',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      verticalAlign: 'top',
                      color: 'var(--text-700)',
                    }}
                  >
                    {r.note_text == null || r.note_text === '' ? '—' : r.note_text}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
