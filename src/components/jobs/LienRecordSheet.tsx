import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'

/**
 * A record step of the Lien window on a phone, as a sheet (v2.4414 for the demand letter; one
 * shell for every paper since v2.4422). As panels these steps were wrapped chips and 30 px
 * boxes in 12.5 px type, at the bottom of the screen where the keyboard comes up. The sheet
 * takes the whole window: ‹ Back and × on the title line, what is being recorded (the paper is
 * under the sheet), the step's fields, and one full-width button.
 *
 * Drawn over the window's card (`position: absolute; inset: 0`; the card is `position:
 * relative` and, by a rule in index.css, holds its full height while a sheet is up), so the
 * paper under it keeps its scroll for Back. It holds no state: the caller owns the values and
 * the write.
 */

export interface LienRecordSheetProps {
  /** Which step this is, for tests and styles — `demand`, `notice_sends`, `affidavit_filing`, `affidavit_service`. */
  kind: string
  title: string
  /** `Demand letter · $15,722.49` */
  headline: string
  /** The lines under it: the job, a date, one sentence on why the record matters. */
  lines: string[]
  children: ReactNode
  /** The small print above the button. */
  note?: string
  action: { label: string; busyLabel: string; busy: boolean; onClick: () => void; fill: string }
  onBack: () => void
  /** Closes the whole window; the × is not drawn without it. */
  onClose?: () => void
}

export default function LienRecordSheet(p: LienRecordSheetProps) {
  return (
    <div data-lien-record-sheet={p.kind} role="group" aria-label={p.title} style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: 'inherit', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, minHeight: 52, padding: '0 1rem 0 0.5rem', borderBottom: '1px solid var(--border)' }}>
        <button type="button" onClick={p.onBack} style={{ flexShrink: 0, minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: '0.875rem', fontWeight: 600, padding: '0 0.5rem', cursor: 'pointer' }}>
          <ChevronLeft size={16} aria-hidden />
          Back
        </button>
        <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 600, flex: 1, minWidth: 0 }}>{p.title}</h3>
        {p.onClose ? (
          <button type="button" onClick={p.onClose} aria-label="Close" style={{ flexShrink: 0, width: 44, height: 44, marginRight: '-0.6rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1, color: 'var(--text-muted)' }}>×</button>
        ) : null}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.75rem 1rem 1rem', display: 'grid', gap: '0.85rem', alignContent: 'start' }}>
        <div data-lien-record-summary style={{ border: '1px solid var(--border)', background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.8125rem', lineHeight: 1.45 }}>
          <strong>{p.headline}</strong>
          {p.lines.map((l, i) => (
            <div key={l} style={{ color: i === p.lines.length - 1 ? 'var(--text-muted)' : 'var(--text-700)' }}>{l}</div>
          ))}
        </div>
        {p.children}
        {p.note ? <div style={{ fontSize: '0.75rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>{p.note}</div> : null}
        <button type="button" data-lien-record-action onClick={p.action.onClick} disabled={p.action.busy} style={{ minHeight: 48, fontSize: '0.9375rem', background: p.action.fill, color: 'white', border: 'none', borderRadius: 6, cursor: p.action.busy ? 'wait' : 'pointer', fontWeight: 600 }}>
          {p.action.busy ? p.action.busyLabel : p.action.label}
        </button>
      </div>
    </div>
  )
}
