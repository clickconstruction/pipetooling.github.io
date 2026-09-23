import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import type { UserRole } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { PUNCH_LIST_PATH } from '../../lib/todos/punchListAccess'
import {
  phoneDockPage,
  phoneDockPagesFor,
  suggestedDockPages,
  type ActivityMinutesRow,
  type PhoneDockPage,
  type PhoneDockPageKey,
} from '../../lib/phoneDock'
import { PhoneDockGlyph } from './PhoneDockGlyph'

export type PhoneDockModeRow = {
  key: string
  label: string
  on: boolean
  onToggle: () => void
}

export type PhoneDockMoreSheetProps = {
  open: boolean
  /** A slot index when opened by a long-press: tapping a page swaps it in instead of opening it. */
  swapIndex: number | null
  onClose: () => void
  role: UserRole | null
  userId: string | null
  slots: PhoneDockPageKey[]
  /** True when this device has its own four (the Reset row shows). */
  customized: boolean
  onSwap: (index: number, key: PhoneDockPageKey) => void
  onReset: () => void
  modes: PhoneDockModeRow[]
  showPunchList: boolean
  onSignOut: () => void | Promise<void>
}

const SUGGESTION_DAYS = 90

async function loadOwnMinutes(userId: string): Promise<ActivityMinutesRow[]> {
  const since = new Date(Date.now() - SUGGESTION_DAYS * 86400_000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('user_app_activity_page_daily')
    .select('page, active_seconds')
    .eq('user_id', userId)
    .gte('activity_date', since)
    .limit(5000)
  if (error || !data) return []
  return data as ActivityMinutesRow[]
}

const sectionLabel: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  margin: '0.75rem 0 0.35rem',
}

const rowBtn: CSSProperties = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
  padding: '0.7rem 0.25rem',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: '1rem',
  textAlign: 'left',
  cursor: 'pointer',
  boxSizing: 'border-box',
}

/**
 * The phone's one menu (punch list #30, PR 1): pages first, then modes, then settings —
 * the hamburger, the modes menu and the gear folded into a bottom sheet the thumb can
 * reach. Opened by the dock's More slot, or by a long-press on any slot (then it swaps).
 */
export function PhoneDockMoreSheet(props: PhoneDockMoreSheetProps) {
  const { open, swapIndex, onClose, role, userId, slots, customized, onSwap, onReset, modes, showPunchList, onSignOut } = props
  const navigate = useNavigate()
  const [rows, setRows] = useState<ActivityMinutesRow[] | null>(null)

  useEffect(() => {
    if (!open || !userId) return
    let cancelled = false
    void loadOwnMinutes(userId).then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [open, userId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const swapping = swapIndex != null
  const swapLabel = swapping ? phoneDockPage(slots[swapIndex]!).label : null
  const pages = phoneDockPagesFor(role)
  const suggested = suggestedDockPages(rows ?? [], slots, role)

  const pick = (page: PhoneDockPage) => {
    if (swapping) {
      onSwap(swapIndex, page.key)
      onClose()
      return
    }
    recordNavClick(userId, role, 'more-sheet', page.to)
    onClose()
    navigate(page.to)
  }

  const go = (to: string) => {
    recordNavClick(userId, role, 'more-sheet', to)
    onClose()
    navigate(to)
  }

  const tile = (page: PhoneDockPage, minutes?: number) => {
    const onDock = slots.includes(page.key)
    return (
      <button
        key={page.key}
        type="button"
        onClick={() => pick(page)}
        aria-label={swapping ? `Put ${page.label} in the ${swapLabel} slot` : page.label}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          padding: '0.6rem 0.25rem',
          minHeight: 64,
          background: onDock ? 'var(--bg-blue-tint)' : 'var(--surface-2, var(--surface))',
          border: `1px solid ${onDock ? 'var(--border-blue)' : 'var(--border)'}`,
          borderRadius: 10,
          color: onDock ? 'var(--text-blue-700)' : 'var(--text)',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: 600,
          lineHeight: 1.15,
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        <PhoneDockGlyph icon={page.icon} size={20} />
        <span>{page.label}</span>
        {minutes != null ? (
          <span style={{ fontSize: '0.6875rem', fontWeight: 400, color: 'var(--text-muted)' }}>
            {minutes >= 60 ? `${Math.round(minutes / 60)} h` : `${minutes} min`}
          </span>
        ) : onDock ? (
          <span style={{ fontSize: '0.6875rem', fontWeight: 400, color: 'var(--text-muted)' }}>on the dock</span>
        ) : null}
      </button>
    )
  }

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1004,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-dock-more-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text)',
          borderRadius: '14px 14px 0 0',
          width: '100%',
          maxWidth: 640,
          maxHeight: '88vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '0.6rem 0.85rem calc(0.85rem + env(safe-area-inset-bottom))',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.25)',
          boxSizing: 'border-box',
        }}
      >
        <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 0.5rem' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
          <h2 id="phone-dock-more-title" style={{ margin: 0, fontSize: '1.0625rem', color: 'var(--text-strong)' }}>
            {swapping ? `Swap ${swapLabel} for…` : 'More'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1rem', padding: '0.25rem 0.5rem', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {swapping ? 'Tap a page to put it in that slot. A page already on the dock trades places.' : 'Long-press a dock slot to swap it for any page here.'}
        </div>

        {suggested.length > 0 ? (
          <>
            <div style={sectionLabel}>Suggested for you</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {suggested.map((s) => tile(s.page, s.minutes))}
            </div>
          </>
        ) : null}

        <div style={sectionLabel}>Pages</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>{pages.map((p) => tile(p))}</div>

        {swapping ? (
          customized ? (
            <button
              type="button"
              onClick={() => {
                onReset()
                onClose()
              }}
              style={{ ...rowBtn, marginTop: '0.75rem', borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              <span>Reset to the role’s four</span>
            </button>
          ) : null
        ) : (
          <>
            {modes.length > 0 ? (
              <>
                <div style={sectionLabel}>Modes</div>
                <div>
                  {modes.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      role="switch"
                      aria-checked={m.on}
                      onClick={() => {
                        m.onToggle()
                        onClose()
                      }}
                      style={{ ...rowBtn, fontWeight: m.on ? 600 : 400 }}
                    >
                      <span>{m.label}</span>
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'inline-flex',
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: '1px solid var(--border)',
                          background: m.on ? '#16a34a' : 'var(--surface)',
                          color: '#fff',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          flexShrink: 0,
                        }}
                      >
                        {m.on ? '✓' : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            <div style={sectionLabel}>Settings</div>
            <div>
              {showPunchList ? (
                <button type="button" onClick={() => go(PUNCH_LIST_PATH)} style={rowBtn}>
                  <span>Punch list</span>
                </button>
              ) : null}
              <button type="button" onClick={() => go('/help')} style={rowBtn}>
                <span>Help</span>
              </button>
              <button type="button" onClick={() => go('/settings')} style={rowBtn}>
                <span>Settings</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  void onSignOut()
                }}
                style={{ ...rowBtn, borderBottom: 'none', color: 'var(--text-red-700)' }}
              >
                <span>Sign out</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
