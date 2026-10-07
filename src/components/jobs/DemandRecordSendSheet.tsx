import LienRecordSheet from './LienRecordSheet'
import { recordSheetField, recordSheetLabel } from './lienRecordSheetStyles'

/**
 * Save & record send… on a phone (v2.4414): the demand letter's record step on the Lien
 * window's record sheet. What is being recorded, the four ways it went in two rows, the
 * tracking number and the date at full width, and one Record button. The same fields and the
 * same Record as the panel a computer keeps; the window owns the values and the write.
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

export default function DemandRecordSendSheet(p: DemandRecordSendSheetProps) {
  return (
    <LienRecordSheet
      kind="demand"
      title="Record the send"
      headline={p.headline}
      lines={[...p.lines, 'The letter only counts if it can be proven.']}
      note={p.note}
      action={{ label: 'Record', busyLabel: 'Recording…', busy: p.busy, onClick: p.onRecord, fill: '#b45309' }}
      onBack={p.onBack}
      onClose={p.onClose}
    >
      <div role="group" aria-label="How it went">
        <span style={recordSheetLabel}>How it went</span>
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
        <span style={recordSheetLabel}>Tracking / receipt number</span>
        <input type="text" value={p.tracking} onChange={(e) => p.onTracking(e.target.value)} placeholder="9407 1112 0108 …" autoComplete="off" style={recordSheetField} />
      </label>
      <label style={{ display: 'block' }}>
        <span style={recordSheetLabel}>
          Sent on <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)' }}>effective on mailing</span>
        </span>
        <input type="date" value={p.sentOn} onChange={(e) => p.onSentOn(e.target.value)} style={recordSheetField} />
      </label>
    </LienRecordSheet>
  )
}
