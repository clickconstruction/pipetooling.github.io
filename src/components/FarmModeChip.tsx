import { FARM_MODE_CHIP_EXIT_LABEL, FARM_MODE_CHIP_LABEL, FARM_MODE_CHIP_TITLE } from '../lib/farmModeToggle'

/**
 * "Farm Mode · Exit" (journey-map Tier-2 #41, J30-4). While the mode is on,
 * the app is one page with a gear — and until this chip nothing on that page
 * said so; the only way out was knowing the toggle lives in the gear menu. A
 * shared barn tablet left in the mode looked like a broken app to the next
 * person. Layout renders this at the top of the page content whenever the
 * mode is active; Exit turns it off (same write as the gear toggle) and
 * records one `farm_mode_exit` nav-click row.
 */
export function FarmModeChip({ onExit }: { onExit: () => void }) {
  return (
    <div
      role="status"
      aria-label="Farm Mode is on"
      title={FARM_MODE_CHIP_TITLE}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
        padding: '0.3rem 0.75rem',
        background: 'var(--bg-green-tint)',
        borderBottom: '1px solid var(--border-green)',
        color: 'var(--text-green-800)',
        fontSize: '0.8125rem',
        lineHeight: 1.3,
      }}
    >
      <span aria-hidden="true">🌾</span>
      <span style={{ fontWeight: 700 }}>{FARM_MODE_CHIP_LABEL}</span>
      <span aria-hidden="true" style={{ color: 'var(--text-green-700)' }}>·</span>
      <button
        type="button"
        onClick={onExit}
        aria-label="Exit Farm Mode"
        style={{
          font: 'inherit',
          fontWeight: 700,
          color: 'var(--text-green-800)',
          background: 'var(--surface)',
          border: '1px solid var(--border-green)',
          borderRadius: 999,
          padding: '0.1rem 0.7rem',
          minHeight: 28,
          cursor: 'pointer',
        }}
      >
        {FARM_MODE_CHIP_EXIT_LABEL}
      </button>
    </div>
  )
}
