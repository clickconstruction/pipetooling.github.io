import { useEffect, type CSSProperties } from 'react'
import LegalFirmSettingsBlock from '../../settings/LegalFirmSettingsBlock'
import { LEGAL_FIRM_SETTINGS_HREF } from './LegalFirmWindow'

const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 0.6rem', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }

/**
 * **Firms…** (punch list #144, PR 2, v2.5792): the Settings block *Collections law firms* — a card per
 * firm, Add a firm, the county map, Save counties — in a window over the Legal desk, so a dev can add
 * the second firm and color its counties without leaving the account; the desk reloads on each save
 * (`onSaved`) and the account's firm segment follows. A dev's door only: the block itself is dev-only.
 * A line in the title bar opens the same block on its Settings page.
 */
export default function LegalFirmsWindow({ onClose, onSaved, zIndex, pickFirmId = null }: {
  onClose: () => void
  onSaved: () => void
  zIndex: number
  /** The firm the block opens picked (punch list #222, PR 1): the firm window's *Color its counties…* names it. */
  pickFirmId?: string | null
}) {
  // Esc closes this window and nothing under it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div role="presentation" onClick={(e) => { e.stopPropagation(); onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(14px + var(--app-top-chrome, 0px)) 14px 14px' }}>
      <div role="dialog" aria-modal="true" aria-label="Collections law firms" data-legal-firms-window onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, width: '100%', maxWidth: 1100, maxHeight: 'calc(100dvh - 28px - var(--app-top-chrome, 0px))', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <span aria-hidden>⚖</span>
          <div style={{ flex: 1, fontWeight: 600 }}>Collections law firms</div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Add a firm, then color the counties it covers. The desk picks the firm from the account’s county.</span>
          <a href={LEGAL_FIRM_SETTINGS_HREF} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: 'none' }} title="The same block on its Settings page, in a new tab">Open in Settings ↗</a>
          <button type="button" onClick={onClose} aria-label="Close the firms window" style={{ ...btn, width: 30, height: 30, padding: 0, justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: '14px 16px 16px' }}>
          <LegalFirmSettingsBlock onSaved={onSaved} pickFirmId={pickFirmId} />
        </div>
      </div>
    </div>
  )
}
