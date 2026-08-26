import { useState } from 'react'
import {
  BILL_DATE_PLACEHOLDER,
  billDateInputWidthCh,
  formatBillDateInput,
  parseBillDateInput,
} from '../../lib/jobs/billDateEntry'

/**
 * The inline MM/DD/YY bill-date editor (v2.2319; shared since v2.2326 —
 * Data health drill-down + Quickfill Missing bill dates). Six digits, the
 * slashes fill themselves in, the field hugs exactly what's typed. Save is
 * enabled only for a real calendar date; Enter saves, Esc cancels.
 */
export default function InlineBillDateEditor({
  saving,
  onSave,
  onCancel,
}: {
  saving: boolean
  /** Called with the validated 'YYYY-MM-DD'. */
  onSave: (ymd: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState('')
  const parsed = parseBillDateInput(draft)
  // A bill date after today is a typo — bills went out in the past. YMD
  // strings compare lexicographically, so string <= is date <=.
  const now = new Date()
  const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const future = parsed != null && parsed > todayYmd
  const ymd = future ? null : parsed
  const valid = ymd != null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
      <input
        type="text"
        inputMode="numeric"
        autoFocus
        value={draft}
        placeholder={BILL_DATE_PLACEHOLDER}
        aria-label="Bill date (MM/DD/YY)"
        title={future ? "That's in the future — the bill date is the day the bill went out." : undefined}
        onChange={(e) => setDraft(formatBillDateInput(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && valid) onSave(ymd)
          if (e.key === 'Escape') onCancel()
        }}
        style={{
          font: 'inherit',
          fontSize: '0.9rem',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.03em',
          padding: '0.22rem 0.4rem',
          border: `1px solid ${future ? 'var(--text-amber-800)' : 'var(--text-link)'}`,
          borderRadius: 6,
          background: 'var(--surface)',
          color: 'var(--text-700)',
          width: `calc(${billDateInputWidthCh(draft)}ch + 1.1em)`,
        }}
      />
      <button
        type="button"
        disabled={!valid || saving}
        onClick={() => valid && onSave(ymd)}
        style={{
          font: 'inherit',
          fontSize: '0.72rem',
          fontWeight: 700,
          padding: '0.22rem 0.55rem',
          borderRadius: 6,
          border: 'none',
          background: 'var(--text-link)',
          color: '#fff',
          cursor: 'pointer',
          opacity: !valid || saving ? 0.5 : 1,
        }}
      >
        {saving ? '…' : 'Save'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel bill date"
        style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', padding: '0.1rem' }}
      >
        ✕
      </button>
    </span>
  )
}

/** The dashed "＋ add date" affordance that opens the editor (shared styling). */
export function AddBillDateButton({ onClick, title }: { onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? 'Type the bill date right here'}
      style={{
        font: 'inherit',
        fontSize: '0.66rem',
        fontWeight: 600,
        color: 'var(--text-link)',
        border: '1px dashed var(--border-strong)',
        borderRadius: 6,
        background: 'none',
        padding: '0.05rem 0.4rem',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      ＋ add date
    </button>
  )
}
