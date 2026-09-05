import { useEffect, useState } from 'react'
import { listGcStatementSentHistory } from '../../lib/gcStatementRoundIo'
import { listGcStatementAppSends, listGcStatementSendLog } from '../../lib/gcStatementSendHistoryIo'
import { buildGcStatementSendHistory, summarizeStatementLanes, type GcStatementHistoryEntry } from '../../lib/jobs/gcStatementSendHistory'

/**
 * "What went out" for one GC (v2.2761; three lanes since journey-map #45):
 * every statement on record, newest first — the personal round's marks (date,
 * how, who, temperature, note) AND the app-sent emails (Draft Message or a
 * scheduled send) with recipient, total, and delivery status. One list is the
 * truth. Opens from the last-sent pill and the temperature pill on the GC
 * Review group header, and from the Temperature board.
 */
export default function GcStatementSendHistoryModal({
  gcId,
  gcName,
  onClose,
}: {
  gcId: string
  gcName: string
  onClose: () => void
}) {
  const [rows, setRows] = useState<GcStatementHistoryEntry[] | null>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [marks, emails] = await Promise.all([listGcStatementSentHistory(gcId), listGcStatementAppSends(gcId)])
      const log = await listGcStatementSendLog(emails.map((e) => e.resend_email_id).filter((id): id is string => !!id))
      if (!cancelled) setRows(buildGcStatementSendHistory({ marks, emails, log }))
    })()
    return () => {
      cancelled = true
    }
  }, [gcId])
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const fmtMoney = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  const chipColor = (tone: 'good' | 'bad' | 'neutral') =>
    tone === 'good' ? 'var(--text-green-600)' : tone === 'bad' ? 'var(--text-red-700)' : 'var(--text-muted)'
  const summary = rows ? summarizeStatementLanes(rows) : ''
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`What went out to ${gcName}`}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 64 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 10, padding: '1rem 1.2rem', width: 'min(680px, 92vw)', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '1rem', fontWeight: 700, flex: 1, minWidth: 0 }}>{gcName}</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
            ×
          </button>
        </div>
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          What went out — every statement on record for this GC, by every lane: the personal round (marked Sent it), Draft Message, and scheduled sends — plus every time someone spoke with them.
          {summary ? <> Statements: {summary}.</> : null}
        </p>
        {rows == null ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nothing on record yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textAlign: 'left' }}>
                  <th style={{ padding: '0.2rem 0', fontWeight: 600 }}>When</th>
                  <th style={{ padding: '0.2rem 0.5rem', fontWeight: 600 }}>What</th>
                  <th style={{ padding: '0.2rem 0.5rem', fontWeight: 600 }}>Lane</th>
                  <th style={{ padding: '0.2rem 0.5rem', fontWeight: 600 }}>Who</th>
                  <th style={{ padding: '0.2rem 0', fontWeight: 600 }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.35rem 0', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{fmtDate(r.at)}</td>
                    <td style={{ padding: '0.35rem 0.5rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{r.kind === 'spoke' ? 'Spoke' : 'Statement'}</td>
                    <td style={{ padding: '0.35rem 0.5rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{r.laneLabel}</td>
                    <td style={{ padding: '0.35rem 0.5rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{r.who}</td>
                    <td style={{ padding: '0.35rem 0', verticalAlign: 'top' }}>
                      {r.recipient ? (
                        <span>
                          to {r.recipient}
                          {r.total != null ? ` · ${fmtMoney(r.total)}` : ''}
                          {r.status ? (
                            <span
                              style={{ marginLeft: '0.4rem', color: chipColor(r.status.tone), border: `1px solid ${chipColor(r.status.tone)}`, borderRadius: 999, padding: '0 0.45rem', fontSize: '0.7rem', whiteSpace: 'nowrap' }}
                            >
                              {r.status.label}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span style={{ color: r.temperature || r.note ? 'inherit' : 'var(--text-muted)' }}>
                          {r.temperature ?? ''}
                          {r.expectedPayBy ? `${r.temperature ? ' · ' : ''}pays ${r.expectedPayBy}` : ''}
                          {r.note ? `${r.temperature || r.expectedPayBy ? ' — ' : ''}${r.note}` : ''}
                          {!r.temperature && !r.expectedPayBy && !r.note ? '—' : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
