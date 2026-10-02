import type { CSSProperties } from 'react'
import { ChevronLeft } from 'lucide-react'

/**
 * Save & record send… on a phone (v2.4414). As a panel at the foot of the Lien window it was
 * 347 px of wrapped chips and small buttons, with its fields at the bottom of the screen where
 * the keyboard comes up. Here the step takes the whole window: what is being recorded, the
 * four ways it went in two rows, the two fields at full width near the top, and one Record
 * button. Back and × sit on the title line. The same fields and the same Record as the panel
 * a computer keeps; the window owns the values and the write.
 *
 * Drawn over the window's card (`position: absolute; inset: 0`), so the letter under it keeps
 * its scroll for Back.
 */

export interface DemandRecordSendSheetProps {
  /** `Demand letter · $15,722.49` */
  headline: string
  /** The lines under it: the job, the pay-by date. */
  lines: string[]
  methods: ReadonlyArray<{ value: string; label: string }>
  method: string
  onMethod: (value: string) => void
  tracking: string
  onTracking: (value: string) => void
  sentOn: string
  onSentOn: (value: string) => void
  /** The deadline-watch sentence. */
  note: string
  busy: boolean
  onBack: () => void
  onClose: () => void
  onRecord: () => void
}

// 16 px type: an iPhone zooms the page on a field whose text is smaller.
const field: CSSProperties = { display: 'block', width: '100%', minWidth: 0, height: 48, boxSizing: 'border-box', padding: '0 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '1rem', background: 'var(--surface)', color: 'var(--text-base)' }
const label: CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6 }

export default function DemandRecordSendSheet(p: DemandRecordSendSheetProps) {
  return (
    <div data-demand-record-sheet role="group" aria-label="Record the send" style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: 'inherit', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, minHeight: 52, padding: '0 1rem 0 0.5rem', borderBottom: '1px solid var(--border)' }}>
        <button type="button" onClick={p.onBack} style={{ flexShrink: 0, minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: '0.875rem', fontWeight: 600, padding: '0 0.5rem', cursor: 'pointer' }}>
          <ChevronLeft size={16} aria-hidden />
          Back
        </button>
        <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 600, flex: 1, minWidth: 0 }}>Record the send</h3>
        <button type="button" onClick={p.onClose} aria-label="Close" style={{ flexShrink: 0, width: 44, height: 44, marginRight: '-0.6rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1, color: 'var(--text-muted)' }}>×</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.75rem 1rem 1rem', display: 'grid', gap: '0.85rem', alignContent: 'start' }}>
        {/* The letter is under the sheet, so the sheet says what is being recorded. */}
        <div data-demand-record-summary style={{ border: '1px solid var(--border)', background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.8125rem', lineHeight: 1.45 }}>
          <strong>{p.headline}</strong>
          {p.lines.map((l) => (
            <div key={l} style={{ color: 'var(--text-700)' }}>{l}</div>
          ))}
          <div style={{ color: 'var(--text-muted)' }}>The letter only counts if it can be proven.</div>
        </div>
        <div role="group" aria-label="How it went">
          <span style={label}>How it went</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {p.methods.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={p.method === m.value}
                onClick={() => p.onMethod(m.value)}
                style={{ minHeight: 48, padding: '0 0.4rem', fontSize: '0.875rem', borderRadius: 6, border: p.method === m.value ? '2px solid var(--text-amber-700)' : '1px solid var(--border-strong)', background: p.method === m.value ? 'var(--bg-amber-tint)' : 'var(--surface)', color: 'var(--text-base)', fontWeight: p.method === m.value ? 700 : 400, cursor: 'pointer' }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <label style={{ display: 'block' }}>
          <span style={label}>Tracking / receipt number</span>
          <input type="text" value={p.tracking} onChange={(e) => p.onTracking(e.target.value)} placeholder="9407 1112 0108 …" autoComplete="off" style={field} />
        </label>
        <label style={{ display: 'block' }}>
          <span style={label}>
            Sent on <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)' }}>effective on mailing</span>
          </span>
          <input type="date" value={p.sentOn} onChange={(e) => p.onSentOn(e.target.value)} style={field} />
        </label>
        <div style={{ fontSize: '0.75rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>{p.note}</div>
        <button type="button" onClick={p.onRecord} disabled={p.busy} style={{ minHeight: 48, fontSize: '0.9375rem', background: '#b45309', color: 'white', border: 'none', borderRadius: 6, cursor: p.busy ? 'wait' : 'pointer', fontWeight: 600 }}>
          {p.busy ? 'Recording…' : 'Record'}
        </button>
      </div>
    </div>
  )
}
