type Props = {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  /** One line under the label — "Currently 30% — move to update · crew report Aug 27" (v2.2852). */
  hint?: string | null
}

function clampPercentString(raw: string): string {
  const n = Number.parseInt(String(raw).trim(), 10)
  if (Number.isNaN(n)) return '0'
  return String(Math.max(0, Math.min(100, n)))
}

/** One-tap values covering almost every real answer; the slider below fine-tunes (v2.1554). */
const PERCENT_QUICK_PICKS = [0, 25, 50, 75, 100]

/**
 * 0–100% field: five thumb-size quick-pick chips plus the slider for
 * fine-tuning; value is a string 0..100 in field_values (same as other report
 * fields).
 */
export function ReportTemplatePercentField({ id, label, value, onChange, hint }: Props) {
  const n = (() => {
    const p = Number.parseInt(value, 10)
    if (Number.isNaN(p)) return 0
    return Math.max(0, Math.min(100, p))
  })()

  return (
    <div style={{ marginBottom: '0.75rem', width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          width: '100%',
          minWidth: 0,
          marginBottom: 4,
        }}
      >
        <div style={{ flex: 1, minWidth: 0, fontWeight: 500, lineHeight: 1.3 }}>{label}</div>
        <output
          htmlFor={id}
          style={{
            flexShrink: 0,
            minWidth: '3.25rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text-700)',
            textAlign: 'right',
          }}
        >
          {n}%
        </output>
      </div>
      {hint ? (
        <div data-testid="report-pct-hint" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.3 }}>
          {hint}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: 6 }}>
        {PERCENT_QUICK_PICKS.map((p) => {
          const active = n === p
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange(String(p))}
              aria-pressed={active}
              aria-label={`Set ${label} to ${p} percent`}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '0.45rem 0',
                fontSize: '0.8125rem',
                fontWeight: 600,
                border: active ? '1px solid #2563eb' : '1px solid var(--border-strong)',
                borderRadius: 6,
                background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
                color: active ? 'var(--text-blue-700)' : 'var(--text-700)',
                cursor: 'pointer',
              }}
            >
              {p}
            </button>
          )
        })}
      </div>
      <div style={{ width: '100%', minWidth: 0 }}>
        <input
          type="range"
          id={id}
          min={0}
          max={100}
          step={1}
          value={n}
          onChange={(e) => onChange(clampPercentString(e.target.value))}
          aria-label={`${label}: ${n} percent complete`}
          className="reportPercentSlider"
          style={{ width: '100%', minWidth: 0, display: 'block' }}
        />
      </div>
    </div>
  )
}
