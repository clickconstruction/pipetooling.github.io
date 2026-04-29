type Props = {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
}

function clampPercentString(raw: string): string {
  const n = Number.parseInt(String(raw).trim(), 10)
  if (Number.isNaN(n)) return '0'
  return String(Math.max(0, Math.min(100, n)))
}

/**
 * 0–100% slider; value is a string 0..100 in field_values (same as other report fields).
 */
export function ReportTemplatePercentField({ id, label, value, onChange }: Props) {
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
            color: '#374151',
            textAlign: 'right',
          }}
        >
          {n}%
        </output>
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
          style={{ width: '100%', minWidth: 0, display: 'block' }}
        />
      </div>
    </div>
  )
}
