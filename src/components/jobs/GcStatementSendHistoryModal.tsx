import { useEffect, useState } from 'react'
import { listGcStatementSentHistory } from '../../lib/gcStatementRoundIo'
import { sendChannelLabel, type RoundMarkRow } from '../../lib/jobs/gcStatementRounds'

/**
 * Send history for one GC (v2.2761): every sent mark on record — date, how,
 * who, note — newest first. Opens from the last-sent pill on the GC Review
 * group header. App-sent emails are not marks; the caller passes the latest
 * app send so the list can say so.
 */
export default function GcStatementSendHistoryModal({
  gcId,
  gcName,
  appLastSentAt,
  onClose,
}: {
  gcId: string
  gcName: string
  /** newest app-sent statement email for this GC, if any (not a round mark) */
  appLastSentAt: string | null
  onClose: () => void
}) {
  const [rows, setRows] = useState<RoundMarkRow[] | null>(null)
  useEffect(() => {
    let cancelled = false
    void listGcStatementSentHistory(gcId).then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [gcId])
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Send history for ${gcName}`}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 64 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 10, padding: '1rem 1.2rem', width: 'min(600px, 92vw)', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '1rem', fontWeight: 700, flex: 1, minWidth: 0 }}>{gcName}</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
            ×
          </button>
        </div>
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Send history — every time someone marked this GC&apos;s statement sent or spoke with them, with how, the temperature, and any note.
        </p>
        {rows == null ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No marks yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textAlign: 'left' }}>
                <th style={{ padding: '0.2rem 0', fontWeight: 600 }}>When</th>
                <th style={{ padding: '0.2rem 0.5rem', fontWeight: 600 }}>What</th>
                <th style={{ padding: '0.2rem 0.5rem', fontWeight: 600 }}>How</th>
                <th style={{ padding: '0.2rem 0.5rem', fontWeight: 600 }}>Temp</th>
                <th style={{ padding: '0.2rem 0.5rem', fontWeight: 600 }}>Who</th>
                <th style={{ padding: '0.2rem 0', fontWeight: 600 }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.week_start}-${r.acted_at}`} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.35rem 0', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{fmtDate(r.acted_at)}</td>
                  <td style={{ padding: '0.35rem 0.5rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{r.action === 'contacted' ? 'Spoke' : 'Statement'}</td>
                  <td style={{ padding: '0.35rem 0.5rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{sendChannelLabel(r.channel)}</td>
                  <td style={{ padding: '0.35rem 0.5rem', whiteSpace: 'nowrap', verticalAlign: 'top', color: r.temperature ? 'inherit' : 'var(--text-muted)' }}>{r.temperature ?? '—'}{r.expected_pay_by ? ` · pays ${r.expected_pay_by}` : ''}</td>
                  <td style={{ padding: '0.35rem 0.5rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{r.acted_by_name || '—'}</td>
                  <td style={{ padding: '0.35rem 0', color: r.note ? 'inherit' : 'var(--text-muted)', verticalAlign: 'top' }}>{r.note?.trim() || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {appLastSentAt ? (
          <p style={{ margin: '0.6rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            App-sent statement emails count as sent too — the latest went out {fmtDate(appLastSentAt)}.
          </p>
        ) : null}
      </div>
    </div>
  )
}
