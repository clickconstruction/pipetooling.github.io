import type { GoalsStageRow } from '../../lib/roadmapBridge'

/**
 * The Goals-card segmented stage bar (v2.2021) — one segment per stage in
 * curated order: done solid green, current amber-ringed with its own blue
 * fill, locked muted, unplanned dashed.
 *
 * Wraps into rows once segments outgrow the card (50+ stages on a phone) —
 * each keeps a legible 12px minimum instead of bleeding off-screen; desktop
 * still reads as one full-width row. rowGap clears the amber "current"
 * outline between rows. First shipped as v2.2263, silently reverted by a
 * stale-checkout merge in v2.2264, restored and extracted here (v2.2278) —
 * the render test pins the wrap styling so that cannot happen quietly again.
 */
export function GoalsStageStrip({ stages }: { stages: GoalsStageRow[] }) {
  return (
    <div data-testid="goals-stage-strip" style={{ display: 'flex', flexWrap: 'wrap', gap: 2, rowGap: 6 }}>
      {stages.map((s, stageIndex) => (
        <span
          key={s.groupId}
          title={`${stageIndex + 1} · ${s.title} — ${s.total > 0 ? `${s.done} of ${s.total}` : s.state === 'unplanned' ? 'not planned yet' : 'milestone'}`}
          style={{
            flex: '1 0 12px',
            height: 13,
            borderRadius: 3,
            position: 'relative',
            overflow: 'hidden',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            background: s.state === 'complete' ? '#16a34a' : s.state === 'unplanned' ? 'transparent' : 'var(--bg-muted)',
            ...(s.state === 'current' ? { outline: '1.5px solid #d97706', outlineOffset: 1 } : {}),
            ...(s.state === 'unplanned' ? { border: '1px dashed var(--border-strong)' } : {}),
          }}
        >
          {s.state === 'current' && s.total > 0 && s.done > 0 ? (
            <span style={{ position: 'absolute', inset: 0, display: 'block', width: `${Math.round((s.done / s.total) * 100)}%`, background: '#2563eb' }} />
          ) : null}
          {/* The 12px wrap minimum always fits a number, so the pre-wrap ">40 stages hides them" gate is gone. */}
          <span
            style={{
              position: 'relative',
              fontSize: '0.58rem',
              fontWeight: 700,
              lineHeight: 1,
              pointerEvents: 'none',
              color: s.state === 'complete' ? 'white' : s.state === 'current' ? 'var(--text-700)' : 'var(--text-faint)',
            }}
          >
            {stageIndex + 1}
          </span>
        </span>
      ))}
    </div>
  )
}
