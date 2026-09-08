/**
 * The quiet electronic-signature consent (v2.3100): one muted sentence with
 * "How electronic signing works" at its end, two paragraphs that open beneath
 * it, and — when the surface wants one — the five-word consent checkbox.
 * Words come from `lib/esignConsent.ts` (versioned); this file is only the
 * shape. Same size and colour as the disclosure sentence the signing pages
 * already carry, so nothing here is louder than what was there before.
 */
import { useId, useState, type CSSProperties } from 'react'
import { ESIGN_DISCLOSURE_PATH, type EsignConsentText } from '../lib/esignConsent'

export type EsignConsentLineProps = {
  text: EsignConsentText
  /** When set, renders the consent checkbox under the line (the surfaces with one agree box of their own pass nothing). */
  checkbox?: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }
  disabled?: boolean
  /** Extra text placed before the line, in the same paragraph (a surface's own disclosure sentence). */
  lead?: string | null
  style?: CSSProperties
}

const MUTED: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }

export function EsignConsentLine({ text, checkbox, disabled = false, lead, style }: EsignConsentLineProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <div style={{ marginTop: '1rem', marginBottom: '0.5rem', ...style }}>
      <p style={{ ...MUTED, margin: 0 }}>
        {lead?.trim() ? `${lead.trim()} ` : ''}
        {text.line}{' '}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          style={{
            font: 'inherit',
            color: open ? 'var(--text-muted)' : 'var(--text-link)',
            background: 'none',
            border: 0,
            padding: 0,
            cursor: disabled ? 'default' : 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: 2,
            whiteSpace: 'nowrap',
          }}
        >
          {text.howLabel} {open ? '▾' : '▸'}
        </button>
      </p>
      <div id={panelId} hidden={!open} style={{ ...MUTED, margin: '0.5rem 0 0', padding: '0.4rem 0 0.2rem 0.65rem', borderLeft: '2px solid var(--border)' }}>
        <p style={{ margin: 0 }}>{text.paragraphs[0]}</p>
        <p style={{ margin: '0.4rem 0 0' }}>
          {text.paragraphs[1]}{' '}
          <a href={ESIGN_DISCLOSURE_PATH} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)' }}>
            {text.disclosureLabel} ›
          </a>
        </p>
      </div>
      {checkbox ? (
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '0.6rem' }}>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', textAlign: 'left' }}>
            <input
              type="checkbox"
              checked={checkbox.checked}
              onChange={(e) => checkbox.onChange(e.target.checked)}
              disabled={disabled || checkbox.disabled}
            />
            <span>{text.checkbox}</span>
          </label>
        </div>
      ) : null}
    </div>
  )
}

export default EsignConsentLine
