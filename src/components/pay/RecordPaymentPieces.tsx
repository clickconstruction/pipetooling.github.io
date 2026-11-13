/**
 * The pieces of a Record payment window (v2.7176): the frame, the one grey line of sums, the amount, the date
 * sent, the method chips, the note and the two presses.
 *
 * They were the body of People → Pay stubs' Record payment (`RecordPayStubPaymentModal`). The owner asked for the
 * same window when paying a sub, so they are lifted out and both windows are built from them: a change to one piece
 * shows in both. Each window keeps its own words, its own sums and its own rule for an amount past what is left.
 */
import type { CSSProperties, ReactNode } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'

const FIELD_LABEL: CSSProperties = { display: 'block', marginBottom: '0.35rem', fontWeight: 500 }
const SHORT_BOX: CSSProperties = { padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, width: '100%', maxWidth: 200 }

/** The backdrop and the card. `zIndex` is the caller's: each window sits above the overlays that open it. */
export function RecordPaymentShell({ title, zIndex, children, testId }: { title: string; zIndex: number; children: ReactNode; testId?: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-modal="true" aria-label={title} data-testid={testId} style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 440, width: '100%', maxHeight: 'calc(100dvh - var(--app-top-chrome, 0px) - 1rem)', overflowY: 'auto', boxSizing: 'border-box' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.25rem' }}>{title}</h2>
        {children}
      </div>
    </div>
  )
}

/** The one grey line under the title: who, and the sums with what remains. */
export function RecordPaymentSummary({ children }: { children: ReactNode }) {
  return (
    <p data-record-payment-summary style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
      {children}
    </p>
  )
}

export function AmountPaidField({ value, onChange, label = 'Amount paid', disabled = false }: { value: string; onChange: (value: string) => void; label?: string; disabled?: boolean }) {
  return (
    <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem' }}>
      <span style={FIELD_LABEL}>{label}</span>
      <input type="text" inputMode="decimal" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder="0.00" style={SHORT_BOX} />
    </label>
  )
}

/** The words under the amount: what the press records. */
export function RecordPaymentHelp({ children }: { children: ReactNode }) {
  return <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{children}</p>
}

export function PaidDateField({ value, onChange, label = 'Paid date (sent)', disabled = false }: { value: string; onChange: (value: string) => void; label?: string; disabled?: boolean }) {
  return (
    <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
      <span style={FIELD_LABEL}>{label}</span>
      <input type="date" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={SHORT_BOX} />
    </label>
  )
}

const pill = (on: boolean, disabled: boolean): CSSProperties => ({
  font: 'inherit',
  fontSize: '0.8rem',
  fontWeight: 600,
  padding: '0.3rem 0.7rem',
  border: `1px solid ${on ? '#2563eb' : 'var(--border-strong)'}`,
  borderRadius: 999,
  background: on ? '#2563eb' : 'var(--surface)',
  color: on ? '#fff' : 'var(--text-700)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
})

/** The box a method opens for its own number (a Cash App transaction id, a check number). */
export type PayMethodRefBox = { id: string; label: string; placeholder?: string; title?: string }

export type PayMethodPickerProps<K extends string> = {
  options: ReadonlyArray<{ key: K; label: string }>
  value: K | null
  onChange: (value: K | null) => void
  /** Drawn under the chips when the chosen method has a number to keep; null when it has none. */
  refBox?: PayMethodRefBox | null
  refValue?: string
  onRefChange?: (value: string) => void
  disabled?: boolean
}

/**
 * "How it was sent": one pill per method in the order given. The chosen one clears on a second press, since a
 * method is welcome and not required.
 */
export function PayMethodPicker<K extends string>({ options, value, onChange, refBox = null, refValue = '', onRefChange, disabled = false }: PayMethodPickerProps<K>) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <span style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}>How it was sent</span>
      <div role="group" aria-label="How it was sent" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {options.map((o) => {
          const on = value === o.key
          return (
            <button key={o.key} type="button" aria-pressed={on} disabled={disabled} onClick={() => onChange(on ? null : o.key)} style={pill(on, disabled)}>
              {o.label}
            </button>
          )
        })}
      </div>
      {refBox ? (
        <label htmlFor={refBox.id} style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.8125rem' }}>
          <span style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>{refBox.label}</span>
          <input
            id={refBox.id}
            type="text"
            value={refValue}
            disabled={disabled}
            onChange={(e) => onRefChange?.(e.target.value)}
            placeholder={refBox.placeholder}
            title={refBox.title}
            spellCheck={false}
            autoComplete="off"
            style={{ padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, width: '100%', maxWidth: 200, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text)' }}
          />
        </label>
      ) : null}
    </div>
  )
}

/** The free-text box. `children` sit under it: who reads the note, a tick that changes it. */
export function PaymentNoteField({ value, onChange, label = 'Note (optional)', placeholder, rows = 3, disabled = false, children }: { value: string; onChange: (value: string) => void; label?: string; placeholder?: string; rows?: number; disabled?: boolean; children?: ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', fontSize: '0.875rem' }}>
        <span style={FIELD_LABEL}>{label}</span>
        <textarea
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          style={{ padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, width: '100%', fontFamily: 'inherit', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box' }}
        />
      </label>
      {children}
    </div>
  )
}

/** Cancel and the green press. `confirmLabel` names the act; `disabled` is a press with nothing ready to record. */
export function RecordPaymentFooter({ onCancel, onConfirm, confirmLabel, busy, busyLabel = 'Saving…', disabled = false }: { onCancel: () => void; onConfirm: () => void; confirmLabel: string; busy: boolean; busyLabel?: string; disabled?: boolean }) {
  const dead = busy || disabled
  return (
    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
      <button type="button" onClick={onCancel} disabled={busy} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}>
        Cancel
      </button>
      <button type="button" disabled={dead} onClick={onConfirm} style={{ padding: '0.5rem 1rem', background: dead ? DEAD_PRESS_FILL : '#059669', color: dead ? DEAD_PRESS_TEXT : 'white', border: 'none', borderRadius: 4, cursor: dead ? 'not-allowed' : 'pointer' }}>
        {busy ? busyLabel : confirmLabel}
      </button>
    </div>
  )
}
