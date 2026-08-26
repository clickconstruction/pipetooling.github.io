import { useEffect, useState } from 'react'
import type { UserRole } from '../../hooks/useAuth'
import {
  readNeedsYouMode,
  writeNeedsYouMode,
  type NeedsYouItem,
  type NeedsYouMode,
  type NeedsYouSeverity,
} from '../../lib/dashboardNeedsYou'
import { recordNavClick } from '../../lib/navClickTelemetry'

/**
 * The dashboard "Needs you" card (v2.2339, CX-audit Phase 3 — owner-approved
 * mockup): the hook-driven attention banners consolidated into one card with
 * two views — Cards (severity-railed rows, one action each) and Walk the list
 * (one item at a time with Skip, call-mode style). The Cards/Walk toggle sits
 * bottom-right and remembers per user per device. Renders nothing when the
 * list is empty, exactly like the banners it replaces.
 */

const RAIL: Record<NeedsYouSeverity, string> = {
  blue: '#3b82f6',
  amber: '#f59e0b',
  gray: 'var(--border-400)',
}

const ACTION_BG: Record<NeedsYouSeverity, string> = {
  blue: '#1d4ed8',
  amber: '#b45309',
  gray: 'var(--bg-muted)',
}

const ACTION_FG: Record<NeedsYouSeverity, string> = {
  blue: '#ffffff',
  amber: '#ffffff',
  gray: 'var(--text-700)',
}

const WALK_TINT: Record<NeedsYouSeverity, { background: string; border: string }> = {
  blue: { background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)' },
  amber: { background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)' },
  gray: { background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)' },
}

export function DashboardNeedsYouCard({
  userId,
  role,
  items,
  onAction,
}: {
  userId: string | undefined
  role: UserRole | null
  items: NeedsYouItem[]
  /** Parent owns what each item's action does (navigate / open modal). */
  onAction: (item: NeedsYouItem) => void
}) {
  const [mode, setMode] = useState<NeedsYouMode>(() => readNeedsYouMode(userId))
  const [walkIndex, setWalkIndex] = useState(0)

  // Re-read the stored preference once the user id arrives (auth loads async).
  useEffect(() => {
    setMode(readNeedsYouMode(userId))
  }, [userId])

  // Items shrink as work gets done — keep the walk pointer in range.
  useEffect(() => {
    if (walkIndex >= items.length) setWalkIndex(0)
  }, [items.length, walkIndex])

  if (items.length === 0) return null

  const pickMode = (next: NeedsYouMode) => {
    setMode(next)
    writeNeedsYouMode(userId, next)
    recordNavClick(userId, role, 'needs-you', `#mode-${next}`)
  }

  const act = (item: NeedsYouItem) => {
    recordNavClick(userId, role, 'needs-you', `#${item.key}`)
    onAction(item)
  }

  const current = items[Math.min(walkIndex, items.length - 1)] as NeedsYouItem
  const upNext = items.filter((_, i) => i !== Math.min(walkIndex, items.length - 1)).slice(0, 2)

  const modeChip = (value: NeedsYouMode, label: string) => {
    const active = mode === value
    return (
      <button
        key={value}
        type="button"
        onClick={() => pickMode(value)}
        aria-pressed={active}
        aria-label={`${label} view`}
        style={{
          padding: '0.2rem 0.7rem',
          fontSize: '0.75rem',
          fontWeight: active ? 700 : 500,
          border: active ? '1px solid var(--border-blue)' : '1px solid var(--border)',
          borderRadius: 999,
          background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
          color: active ? 'var(--text-blue-700)' : 'var(--text-muted)',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <section
      aria-label={`Needs you, ${items.length} item${items.length === 1 ? '' : 's'}`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '1rem 1.25rem 0.75rem',
        marginBottom: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.75rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700 }}>Needs you</h2>
        <span
          style={{
            background: 'var(--bg-amber-100)',
            color: 'var(--text-amber-800)',
            borderRadius: 999,
            padding: '1px 9px',
            fontSize: '0.8125rem',
            fontWeight: 700,
          }}
        >
          {items.length}
        </span>
        {mode === 'walk' ? (
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
            {Math.min(walkIndex, items.length - 1) + 1} of {items.length}
          </span>
        ) : null}
      </div>

      {mode === 'walk' ? (
        <>
          <div style={{ display: 'flex', gap: 4, marginBottom: '0.875rem' }} aria-hidden>
            {items.map((it, i) => (
              <div
                key={it.key}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background: i === Math.min(walkIndex, items.length - 1) ? RAIL[it.severity] : 'var(--bg-200)',
                }}
              />
            ))}
          </div>
          <div style={{ ...WALK_TINT[current.severity], borderRadius: 10, padding: '1.1rem 1.2rem', marginBottom: '0.75rem' }}>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginBottom: '0.3rem',
              }}
            >
              {current.kicker}
            </div>
            <div style={{ fontSize: '1.1875rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              {current.title}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.9rem' }}>{current.detail}</div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => act(current)}
                style={{
                  background: ACTION_BG[current.severity],
                  color: ACTION_FG[current.severity],
                  border: 'none',
                  borderRadius: 6,
                  padding: '0.55rem 1.1rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {current.actionLabel}
              </button>
              {items.length > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    recordNavClick(userId, role, 'needs-you', '#skip')
                    setWalkIndex((i) => (i + 1) % items.length)
                  }}
                  style={{
                    background: 'var(--surface)',
                    color: 'var(--text-700)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    padding: '0.55rem 1.1rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  Skip for now
                </button>
              ) : null}
            </div>
          </div>
          {upNext.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.5rem' }}>
              {upNext.map((it, i) => (
                <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-muted)', fontSize: '0.8125rem', padding: '0.15rem 0.4rem' }}>
                  <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: RAIL[it.severity], flexShrink: 0 }} />
                  <span style={{ minWidth: 0 }}>
                    {i === 0 ? 'Next: ' : 'Then: '}
                    {it.title}
                    {i === 1 && items.length > 3 ? ` · and ${items.length - 3} more` : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {items.map((it) => (
            <div
              key={it.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.6rem 0.875rem',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border)',
                borderLeft: `4px solid ${RAIL[it.severity]}`,
                borderRadius: 8,
                padding: '0.7rem 0.875rem',
              }}
            >
              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{it.title}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: 1 }}>{it.detail}</div>
              </div>
              <div style={{ fontSize: '1.0625rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {it.figure}
              </div>
              <button
                type="button"
                onClick={() => act(it)}
                style={{
                  background: ACTION_BG[it.severity],
                  color: ACTION_FG[it.severity],
                  border: it.severity === 'gray' ? '1px solid var(--border-strong)' : 'none',
                  borderRadius: 6,
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {it.actionLabel}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem', paddingBottom: '0.25rem' }}>
        {modeChip('cards', 'Cards')}
        {modeChip('walk', 'Walk the list')}
      </div>
    </section>
  )
}
