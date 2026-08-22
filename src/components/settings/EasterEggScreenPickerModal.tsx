import { useState } from 'react'
import type { UserRole } from '../../hooks/useAuth'
import {
  EGG_BIDS_TABS,
  EGG_PAGES,
  EGG_PAGE_GROUPS,
  eggSurfaceKeyForBidsTab,
  eggSurfaceKeyForPage,
  eggSurfaceLabel,
  eggSurfaceVisibleForRole,
} from '../../lib/easterEggSurfaceTree'

export type EggTargetPerson = { name: string; role: UserRole | null; estimatorProspectsAccess: boolean }

/**
 * "+ add screens" picker (v2.2082): every app screen in an expandable tree —
 * groups → pages, Bids opens to its tabs. Screens a targeted person can't
 * reach get a soft amber "hidden for …" hint (from the router's own
 * `isPathAllowedForRole`), never a block: an unreachable pick just never fires.
 */
export default function EasterEggScreenPickerModal({
  eggLabel,
  selected,
  targets,
  onChange,
  onClose,
}: {
  eggLabel: string
  selected: string[]
  targets: EggTargetPerson[]
  onChange: (next: string[]) => void
  onClose: () => void
}) {
  const [bidsOpen, setBidsOpen] = useState(() => selected.some((k) => k.startsWith('t:/bids:')))

  const toggle = (key: string) => {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key])
  }

  /** Names of targeted people who can never reach this surface (empty = no hint). */
  const hiddenFor = (key: string): string[] =>
    targets
      .filter((t) => !eggSurfaceVisibleForRole(key, t.role, t.estimatorProspectsAccess))
      .map((t) => t.name)

  const hintFor = (key: string, devOnlyish: boolean): string | null => {
    if (devOnlyish) return 'dev only'
    const names = hiddenFor(key)
    if (names.length === 0 || targets.length === 0) return null
    return `hidden for ${names.join(', ')}`
  }

  const hintStyle: React.CSSProperties = {
    marginLeft: 'auto',
    fontSize: '0.66rem',
    color: 'var(--text-amber-800)',
    background: 'var(--bg-amber-tint)',
    border: '1px solid var(--border-amber-soft)',
    borderRadius: 999,
    padding: '0.02rem 0.5rem',
    whiteSpace: 'nowrap',
  }
  const nodeStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.26rem 0.5rem',
    borderRadius: 6,
    fontSize: '0.8125rem',
    cursor: 'pointer',
  }

  const bidsTabCount = selected.filter((k) => k.startsWith('t:/bids:')).length

  const renderNode = (key: string, label: string, devOnlyish: boolean, extra?: React.ReactNode) => {
    const hint = hintFor(key, devOnlyish)
    return (
      <label key={key} style={nodeStyle}>
        <input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)} style={{ margin: 0 }} />
        <span style={{ color: 'var(--text-strong)' }}>{label}</span>
        {extra}
        {hint ? <span style={hintStyle}>{hint}</span> : null}
      </label>
    )
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, width: 'min(30rem, 100%)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{ padding: '0.9rem 1.1rem 0.7rem', borderBottom: '1px solid var(--border)' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Where can {eggLabel} appear?</h4>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Check whole screens, or open Bids to aim at single tabs. Screens a targeted person can’t see are marked — fine to leave checked, the visit just never triggers there.
          </p>
        </div>
        <div style={{ overflowY: 'auto', padding: '0.5rem 0.6rem 0.8rem' }}>
          {EGG_PAGE_GROUPS.map((group) => (
            <div key={group} style={{ marginTop: '0.45rem' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '0.25rem 0.5rem' }}>
                {group}
              </div>
              {EGG_PAGES.filter((p) => p.group === group).map((page) => {
                const key = eggSurfaceKeyForPage(page.path)
                if (page.path !== '/bids') return renderNode(key, page.label, page.allowedOverride != null)
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setBidsOpen((o) => !o)}
                        aria-label={bidsOpen ? 'Collapse Bids tabs' : 'Expand Bids tabs'}
                        style={{ font: 'inherit', fontSize: '0.7rem', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', width: '1.2rem', padding: 0 }}
                      >
                        {bidsOpen ? '▾' : '▸'}
                      </button>
                      <div style={{ flex: 1 }}>
                        {renderNode(
                          key,
                          'Bids',
                          false,
                          !bidsOpen && bidsTabCount > 0 ? (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              {bidsTabCount} tab{bidsTabCount === 1 ? '' : 's'} picked
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>anywhere on Bids</span>
                          ),
                        )}
                      </div>
                    </div>
                    {bidsOpen ? (
                      <div style={{ marginLeft: '1.7rem', display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '0.2rem' }}>
                        {EGG_BIDS_TABS.map((t) => renderNode(eggSurfaceKeyForBidsTab(t.key), t.label, false))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.7rem 1.1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected.length === 0
              ? 'No screens picked — the visitor stays home'
              : `${selected.length} screen${selected.length === 1 ? '' : 's'} picked · ${selected.map(eggSurfaceLabel).join(', ')}`}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ marginLeft: 'auto', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 1rem', borderRadius: 8, border: '1px solid #1d4ed8', background: '#1d4ed8', color: '#fff', cursor: 'pointer' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
