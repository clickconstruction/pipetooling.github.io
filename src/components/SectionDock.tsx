import { useCallback, useEffect, useRef, useState } from 'react'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { pickActiveDashboardSection, clampedCenterScrollLeft } from '../lib/dashboardSectionDock'

export type SectionDockSection = { id: string; label: string }

/**
 * Desktop-only floating dock at the bottom of a long page: one chip per major
 * section, the section currently in view ringed (scrollspy), click to jump.
 * When the chip list overflows, the dock auto-scrolls so the active chip sits
 * centered — clamped at both ends, so once the list's tail is on screen the
 * highlight walks to the edge instead of over-scrolling.
 * Parent passes only the sections that actually rendered.
 */
export function SectionDock({
  sections,
  ariaLabel = 'Page sections',
}: {
  sections: SectionDockSection[]
  ariaLabel?: string
}) {
  const narrow = useNarrowViewport640()
  const [activeId, setActiveId] = useState<string | null>(null)
  const navRef = useRef<HTMLElement | null>(null)

  const recompute = useCallback(() => {
    const anchors = sections
      .map((s) => {
        const el = document.getElementById(s.id)
        if (!el) return null
        return { id: s.id, top: el.getBoundingClientRect().top + window.scrollY }
      })
      .filter((a): a is { id: string; top: number } => a !== null)
    setActiveId(pickActiveDashboardSection(anchors, window.scrollY + window.innerHeight * 0.33))
  }, [sections])

  useEffect(() => {
    if (narrow) return
    let raf = 0
    const onScrollOrResize = () => {
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        recompute()
      })
    }
    recompute()
    window.addEventListener('scroll', onScrollOrResize, { passive: true })
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScrollOrResize)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [narrow, recompute])

  // Keep the active chip centered while the chip list overflows the dock.
  useEffect(() => {
    const nav = navRef.current
    if (!nav || !activeId) return
    const chip = nav.querySelector<HTMLElement>(`[data-dock-chip="${CSS.escape(activeId)}"]`)
    if (!chip) return
    nav.scrollTo({
      left: clampedCenterScrollLeft(chip.offsetLeft, chip.offsetWidth, nav.clientWidth, nav.scrollWidth),
      behavior: 'smooth',
    })
  }, [activeId])

  if (narrow || sections.length < 2) return null

  return (
    <nav
      ref={(el) => {
        navRef.current = el
      }}
      aria-label={ariaLabel}
      style={{
        position: 'fixed',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 900,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0.3rem 0.5rem',
        background: 'var(--menu-bg)',
        border: '1px solid var(--chrome-border)',
        borderRadius: 999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
        maxWidth: 'calc(100vw - 2rem)',
        overflowX: 'auto',
      }}
    >
      {sections.map((s) => {
        const active = s.id === activeId
        return (
          <button
            key={s.id}
            type="button"
            data-dock-chip={s.id}
            aria-current={active ? 'true' : undefined}
            onClick={() => {
              setActiveId(s.id)
              document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            style={{
              padding: '0.3rem 0.75rem',
              fontSize: '0.8125rem',
              fontWeight: active ? 700 : 500,
              whiteSpace: 'nowrap',
              border: active ? '2px solid #3b82f6' : '2px solid transparent',
              borderRadius: 999,
              background: active ? 'var(--bg-blue-tint)' : 'none',
              color: active ? 'var(--text-blue-700)' : 'var(--text-muted)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {s.label}
          </button>
        )
      })}
    </nav>
  )
}
