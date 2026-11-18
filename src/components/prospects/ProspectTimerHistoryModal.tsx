import { useEffect, useState } from 'react'
import { EmptyState } from '../EmptyState'
import { formatDateTime, formatTimerButtonName, formatTimerSeconds } from '../../lib/prospects/prospectFormat'
import { loadProspectTimerEvents, type ProspectTimerEvent } from '../../lib/prospects/prospectTimerIo'

/**
 * Timer history: a caller's last hundred timed presses on Follow Up. Moved out of `src/pages/Prospects.tsx` with
 * its read: the page mounts it while it is open, and it loads as it opens, as the card's clock did.
 */
export function ProspectTimerHistoryModal({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const [events, setEvents] = useState<ProspectTimerEvent[]>([])
  const [loading, setLoading] = useState(!!userId)

  useEffect(() => {
    if (!userId) return
    let live = true
    void loadProspectTimerEvents(userId).then((rows) => {
      if (!live) return
      setEvents(rows)
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [userId])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 750,
        paddingTop: 'var(--app-top-chrome, 0px)',
      }}
      onClick={() => onClose()}
    >
      <div role="dialog" aria-modal="true"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.5rem',
          maxWidth: 480,
          maxHeight: 'min(80vh, 100%)',
          width: '90%',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 1rem 0' }}>Timer history</h3>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Past instances when you clicked No Longer a Fit, Next Prospect, or Can&apos;t reach.
        </p>
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : events.length === 0 ? (
          <EmptyState compact main="No events yet." />
        ) : (
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Date & time</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Timer</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Button</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Prospect</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{formatDateTime(e.created_at)}</td>
                    <td style={{ padding: '0.5rem 0.75rem', fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace' }}>{formatTimerSeconds(e.timer_seconds)}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{formatTimerButtonName(e.button_name)}</td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>{e.prospect?.company_name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: '1rem' }}>
          <button
            type="button"
            onClick={() => onClose()}
            style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
