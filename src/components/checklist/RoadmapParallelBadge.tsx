/**
 * ⇊ — marks a stage running in parallel (v2.2266: `sequential = false`, every
 * task offered at once). No badge = the default in-order mode; the badge only
 * marks the exception, so surfaces stay quiet.
 */
export function ParallelArrowsIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 640 640" width={size} height={size} fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M278.6 374.6L214.6 438.6C202.1 451.1 181.8 451.1 169.3 438.6L105.3 374.6C92.8 362.1 92.8 341.8 105.3 329.3C117.8 316.8 138.1 316.8 150.6 329.3L160 338.7L160 96C160 78.3 174.3 64 192 64C209.7 64 224 78.3 224 96L224 338.7L233.4 329.3C245.9 316.8 266.2 316.8 278.7 329.3C291.2 341.8 291.2 362.1 278.7 374.6zM534.6 374.6L470.6 438.6C458.1 451.1 437.8 451.1 425.3 438.6L361.3 374.6C348.8 362.1 348.8 341.8 361.3 329.3C373.8 316.8 394.1 316.8 406.6 329.3L416 338.7L416 96C416 78.3 430.3 64 448 64C465.7 64 480 78.3 480 96L480 338.7L489.4 329.3C501.9 316.8 522.2 316.8 534.7 329.3C547.2 341.8 547.2 362.1 534.7 374.6zM96 576C78.3 576 64 561.7 64 544C64 526.3 78.3 512 96 512L544 512C561.7 512 576 526.3 576 544C576 561.7 561.7 576 544 576L96 576z" />
    </svg>
  )
}

export function RoadmapParallelBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      title="Parallel stage — every task is offered at once"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: '0.7rem',
        fontWeight: 600,
        padding: compact ? '1px 6px' : '2px 8px',
        borderRadius: 999,
        border: '1px solid #2563eb',
        background: 'var(--bg-blue-tint)',
        color: 'var(--text-blue-800)',
        whiteSpace: 'nowrap',
      }}
    >
      <ParallelArrowsIcon />
      {compact ? null : 'parallel'}
    </span>
  )
}
