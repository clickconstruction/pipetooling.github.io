import type { RunGlyph } from '../../lib/jobs/runEnvelopeStage'

/**
 * The envelope drawn as what it is (Run-3): open while it waits or has not printed, sealed once it
 * printed, postmarked once it carries its number, a tick once a delivery scan came back. The tone
 * says the same thing the card's border says: amber while it waits, green once sealed.
 */
export default function LienRunEnvelopeGlyph({ glyph, waiting = false, size = 54 }: { glyph: RunGlyph; waiting?: boolean; size?: number }) {
  const stroke = waiting ? 'var(--border-amber)' : glyph === 'open' ? 'var(--border-strong)' : 'var(--text-green-700)'
  const h = Math.round((size * 40) / 54)
  if (glyph === 'open') {
    return (
      <svg width={size} height={h} viewBox="0 0 54 40" aria-hidden="true" data-glyph="open" className="lienRunGlyph">
        <rect x="1" y="12" width="52" height="27" rx="3" fill="var(--surface)" stroke={stroke} strokeWidth="2" />
        <path d="M1 14 L27 2 L53 14" fill="none" stroke={stroke} strokeWidth="2" />
        <rect x="12" y="8" width="30" height="20" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1" />
        <path d="M16 16 h22 M16 20 h14" stroke="var(--border-strong)" strokeWidth="1.5" />
      </svg>
    )
  }
  return (
    <svg width={size} height={h} viewBox="0 0 54 40" aria-hidden="true" data-glyph={glyph} className="lienRunGlyph">
      <rect x="1" y="6" width="52" height="33" rx="3" fill="var(--surface)" stroke={stroke} strokeWidth="2" />
      <path d="M1 9 L27 26 L53 9" fill="none" stroke={stroke} strokeWidth="2" />
      {glyph === 'delivered' ? (
        <>
          <circle cx="43" cy="12" r="8" fill="var(--text-green-700)" />
          <path d="M39 12 l3 3 l5 -6" stroke="var(--surface)" strokeWidth="2" fill="none" />
        </>
      ) : glyph === 'postmarked' ? (
        <>
          <circle cx="40" cy="26" r="9" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="2 2" />
          <text x="40" y="29" fontSize="7" textAnchor="middle" fill="var(--text-muted)">USPS</text>
        </>
      ) : null}
    </svg>
  )
}
