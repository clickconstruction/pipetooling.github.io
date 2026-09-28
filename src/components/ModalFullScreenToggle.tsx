/**
 * The full-screen toggle any dialog can carry (v2.4065) — the state, the memory
 * and the button that `ResponsiveModalShell` puts in its title bar (v2.4045),
 * for dialogs that draw their own frame (the Lien desk, Put a GC on notice,
 * Accounts Receivable). One hook, one button; the panel styles itself.
 */
import { useState, type CSSProperties } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { modalFullScreenToggleLabel, readModalFullScreen, writeModalFullScreen } from '../lib/modalFullScreen'
import { ModalFullScreenIcon } from './icons/ModalFullScreenIcon'

/** The button's chrome — the ⋯ header menu's, so the two read as one row of controls. */
export const MODAL_FULL_SCREEN_BUTTON_STYLE: CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  borderRadius: 6,
  padding: '0.35rem 0.6rem',
  cursor: 'pointer',
  lineHeight: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 32,
  flexShrink: 0,
}

export type ModalFullScreenState = {
  /** Fill the screen now. False on a phone whatever was remembered — the sheet is full screen already. */
  fullScreen: boolean
  toggle: () => void
  /** Whether to show the button at all: a key was given and this is not a phone. */
  showToggle: boolean
}

/** The remembered choice for `key`, and the press that flips it. No key, no toggle. */
export function useModalFullScreen(key: string | undefined): ModalFullScreenState {
  const isMobile = useIsMobile()
  const [choice, setChoice] = useState(() => (key ? readModalFullScreen(key) : false))
  const showToggle = Boolean(key) && !isMobile
  const fullScreen = showToggle && choice
  const toggle = () => {
    if (!key) return
    const next = !choice
    setChoice(next)
    writeModalFullScreen(key, next)
  }
  return { fullScreen, toggle, showToggle }
}

/** The button: it shows the state you are in and names the other, as its label and its tooltip. */
export function ModalFullScreenButton({ fullScreen, onToggle, style }: { fullScreen: boolean; onToggle: () => void; style?: CSSProperties }) {
  const label = modalFullScreenToggleLabel(fullScreen)
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{ ...MODAL_FULL_SCREEN_BUTTON_STYLE, background: fullScreen ? 'var(--bg-muted)' : 'var(--surface)', ...style }}
      aria-label={label}
      aria-pressed={fullScreen}
      title={label}
      data-testid="modal-full-screen-toggle"
    >
      <ModalFullScreenIcon fullScreen={fullScreen} />
    </button>
  )
}
