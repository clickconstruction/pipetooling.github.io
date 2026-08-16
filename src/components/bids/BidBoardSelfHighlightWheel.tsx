import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useTheme } from '../../contexts/ThemeContext'
import { useToastContext } from '../../contexts/ToastContext'
import type { ThemeName } from '../../lib/themeSchedule'
import {
  BID_BOARD_SELF_HIGHLIGHT_SWATCHES,
  autoContrastText,
  isValidHexColor,
  parseBidBoardSelfHighlightPref,
  resolveBidBoardSelfHighlight,
  withThemePref,
  type BidBoardSelfHighlightPref,
} from '../../lib/bids/bidBoardSelfHighlight'

/**
 * The Bid Board's color wheel (v2.1710): a small wheel button at the right end
 * of the jump strip (the Health line) that opens a popover where the viewer
 * picks how their OWN name is boxed when they're a bid's Estimator or Account
 * Man — box color + text color, separately for light mode and dark mode.
 *
 * The choice is per-account (`users.bid_board_self_highlight`, written through
 * the "update own profile" policy) so it follows the user across devices, and
 * per-theme because a box that pops at noon can vanish at night. Saves on
 * every click — no Save button, like the rest of the app.
 */

/** Loads the viewer's pref (+ first name for the preview) and resolves the style for the CURRENT theme. */
export function useBidBoardSelfHighlight(userId: string | null | undefined) {
  const { theme } = useTheme()
  const { showToast } = useToastContext()
  const [pref, setPref] = useState<BidBoardSelfHighlightPref>({})
  const [previewName, setPreviewName] = useState('You')

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      try {
        const row = await withSupabaseRetry(
          async () =>
            await supabase.from('users').select('name, bid_board_self_highlight').eq('id', userId).maybeSingle(),
          'load bid board self highlight',
        )
        if (cancelled) return
        const r = row as { name?: string | null; bid_board_self_highlight?: unknown } | null
        setPref(parseBidBoardSelfHighlightPref(r?.bid_board_self_highlight))
        const first = (r?.name ?? '').trim().split(/\s+/)[0]
        if (first) setPreviewName(first)
      } catch {
        /* defaults are fine — the picker still works and saves */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const savePref = useCallback(
    (next: BidBoardSelfHighlightPref) => {
      setPref(next)
      if (!userId) return
      void (async () => {
        try {
          await withSupabaseRetry(
            async () =>
              await supabase
                .from('users')
                // Cast: the column is newer than the generated types; the
                // payload shape is validated by the kernel either way.
                .update({ bid_board_self_highlight: next } as never)
                .eq('id', userId),
            'save bid board self highlight',
          )
        } catch {
          showToast('Could not save your board colors — check your connection and try again.', 'error')
        }
      })()
    },
    [userId, showToast],
  )

  return { pref, savePref, previewName, selfHighlightStyle: resolveBidBoardSelfHighlight(pref, theme) }
}

const PLABEL: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
}

function segBtnStyle(active: boolean): CSSProperties {
  return {
    flex: 1,
    border: 'none',
    background: active ? '#2563eb' : 'var(--surface)',
    color: active ? '#ffffff' : 'var(--text-muted)',
    font: 'inherit',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.3rem 0',
    cursor: 'pointer',
  }
}

type Props = {
  pref: BidBoardSelfHighlightPref
  onSave: (next: BidBoardSelfHighlightPref) => void
  /** Shown in the popover preview chip (e.g. the viewer's first name). */
  previewName: string
}

export function BidBoardSelfHighlightWheel({ pref, onSave, previewName }: Props) {
  const { theme } = useTheme()
  const [open, setOpen] = useState(false)
  // Which theme the popover is editing; starts on the one the user is looking at.
  const [mode, setMode] = useState<ThemeName>(theme)
  const rootRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const resolved = resolveBidBoardSelfHighlight(pref, mode)
  const chosen = pref[mode] ?? null
  const textMode: 'auto' | 'white' | 'black' | 'custom' =
    chosen == null || chosen.text === 'auto'
      ? 'auto'
      : chosen.text === '#ffffff'
        ? 'white'
        : chosen.text === '#111827'
          ? 'black'
          : 'custom'

  const setBg = (bg: string) => {
    if (!isValidHexColor(bg)) return
    onSave(withThemePref(pref, mode, { bg, text: chosen?.text ?? 'auto' }))
  }
  const setText = (text: 'auto' | string) => {
    const bg = chosen?.bg ?? resolved.backgroundColor
    onSave(withThemePref(pref, mode, { bg, text }))
  }

  return (
    <span ref={rootRef} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Pick how your name looks on the board"
        aria-label="Pick how your name looks on the board"
        aria-expanded={open}
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          border: '1px solid var(--border-strong)',
          background: 'var(--surface)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background:
              'conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)',
            border: '1.5px solid var(--surface)',
            boxShadow: '0 0 0 1px var(--border-strong)',
          }}
        />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Your name on the board"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            zIndex: 60,
            width: 250,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 10,
            boxShadow: '0 18px 50px rgba(0,0,0,0.3)',
            padding: '0.75rem 0.8rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            fontSize: '0.8125rem',
            color: 'var(--text-700)',
            cursor: 'default',
            textAlign: 'left',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontWeight: 700, color: 'var(--text-strong)' }}>Your name on the board</div>
          <div style={{ display: 'flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden' }} role="group" aria-label="Which theme you're setting">
            <button type="button" aria-pressed={mode === 'light'} onClick={() => setMode('light')} style={segBtnStyle(mode === 'light')}>
              ☀ Light mode
            </button>
            <button
              type="button"
              aria-pressed={mode === 'dark'}
              onClick={() => setMode('dark')}
              style={{ ...segBtnStyle(mode === 'dark'), borderLeft: '1px solid var(--border-strong)' }}
            >
              🌙 Dark mode
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              // Literals on purpose (rgb so the theme codemod leaves them):
              // the preview shows the EDITED theme's surface, not the live
              // theme's tokens — that's the whole point of the mode tabs.
              background: mode === 'light' ? 'rgb(249, 250, 251)' : 'rgb(24, 33, 47)',
              border: `1px solid ${mode === 'light' ? 'rgb(229, 231, 235)' : 'rgb(55, 65, 81)'}`,
              borderRadius: 8,
              padding: '0.4rem 0.5rem',
            }}
          >
            <span style={{ ...PLABEL }}>Preview</span>
            <span
              style={{
                backgroundColor: resolved.backgroundColor,
                color: resolved.color,
                padding: '0.125rem 0.35rem',
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              {previewName}
            </span>
          </div>
          <div>
            <div style={{ ...PLABEL, marginBottom: '0.25rem' }}>Box color</div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {BID_BOARD_SELF_HIGHLIGHT_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Box color ${c}`}
                  aria-pressed={(chosen?.bg ?? resolved.backgroundColor) === c}
                  onClick={() => setBg(c)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    cursor: 'pointer',
                    padding: 0,
                    background: c,
                    border: '1px solid var(--border-strong)',
                    outline: (chosen?.bg ?? resolved.backgroundColor) === c ? '2px solid #2563eb' : 'none',
                    outlineOffset: 1,
                  }}
                />
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <input
                type="color"
                value={chosen?.bg ?? resolved.backgroundColor}
                onChange={(e) => setBg(e.target.value)}
                aria-label="Custom box color"
                style={{ width: 34, height: 26, padding: 0, border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer' }}
              />
              Custom…
            </label>
          </div>
          <div>
            <div style={{ ...PLABEL, marginBottom: '0.25rem' }}>Text color</div>
            <div style={{ display: 'flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden' }} role="group" aria-label="Text color">
              <button type="button" aria-pressed={textMode === 'auto'} onClick={() => setText('auto')} style={segBtnStyle(textMode === 'auto')}>
                Auto
              </button>
              <button
                type="button"
                aria-pressed={textMode === 'white'}
                onClick={() => setText('#ffffff')}
                style={{ ...segBtnStyle(textMode === 'white'), borderLeft: '1px solid var(--border-strong)' }}
              >
                White
              </button>
              <button
                type="button"
                aria-pressed={textMode === 'black'}
                onClick={() => setText('#111827')}
                style={{ ...segBtnStyle(textMode === 'black'), borderLeft: '1px solid var(--border-strong)' }}
              >
                Black
              </button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <input
                type="color"
                value={
                  chosen && chosen.text !== 'auto' ? chosen.text : autoContrastText(chosen?.bg ?? resolved.backgroundColor)
                }
                onChange={(e) => setText(e.target.value)}
                aria-label="Custom text color"
                style={{ width: 34, height: 26, padding: 0, border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer' }}
              />
              Custom…
            </label>
          </div>
          <button
            type="button"
            onClick={() => onSave(withThemePref(pref, mode, null))}
            style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0, font: 'inherit', textAlign: 'left' }}
          >
            Reset this mode to default
          </button>
        </div>
      ) : null}
    </span>
  )
}
