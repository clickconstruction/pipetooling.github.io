import { useEffect, useState } from 'react'
import { formatTimerSeconds } from '../../lib/prospects/prospectFormat'
import { loadMyTimeStats, type MyTimeStats } from '../../lib/prospects/prospectTimerIo'

/**
 * My time prospecting: a caller's seconds on calls today, yesterday, over seven days and in all. Moved out of
 * `src/pages/Prospects.tsx` with its read. `liveSeconds` is the running card clock, which the page adds to every
 * figure but yesterday's while the deck is the tab on screen.
 */
export function ProspectMyTimeModal({ userId, liveSeconds, onClose }: { userId: string | null; liveSeconds: number; onClose: () => void }) {
  const [stats, setStats] = useState<MyTimeStats | null>(null)
  const [loading, setLoading] = useState(!!userId)

  useEffect(() => {
    if (!userId) return
    let live = true
    void loadMyTimeStats(userId).then((next) => {
      if (!live) return
      setStats(next)
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
          maxWidth: 360,
          width: '90%',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 1rem 0' }}>My time prospecting</h3>
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : stats ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9375rem' }}>
            {(() => {
              const sessionBonus = liveSeconds
              const today = stats.today + sessionBonus
              const last7 = stats.last7Days + sessionBonus
              const lifetime = stats.lifetime + sessionBonus
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Today</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace', fontWeight: 500, color: 'var(--text-green-600)' }}>
                      {today === 0 ? '—' : formatTimerSeconds(today)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Yesterday</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace', fontWeight: 500 }}>
                      {stats.yesterday === 0 ? '—' : formatTimerSeconds(stats.yesterday)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Last 7 days</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace', fontWeight: 500, color: 'var(--text-green-600)' }}>
                      {last7 === 0 ? '—' : formatTimerSeconds(last7)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Lifetime</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace', fontWeight: 500, color: 'var(--text-green-600)' }}>
                      {lifetime === 0 ? '—' : formatTimerSeconds(lifetime)}
                    </span>
                  </div>
                </>
              )
            })()}
          </div>
        ) : null}
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
