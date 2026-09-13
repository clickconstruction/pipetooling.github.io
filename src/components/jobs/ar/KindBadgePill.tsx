/**
 * The Mercury kind badge ("check", "ACH", …) coloured by the org's badge
 * settings — lifted out of BankPaymentsModal in the AR refresh (v2.3379) so
 * the deposit row and the deposit header share one pill.
 */
import { defaultKindBadgeColor, mercuryKindPaymentTypeLabel, normalizeHexColor, pickTextOnBackground, type MercuryKindBadge } from '../../../lib/bankPaymentsKindBadges'

export function KindBadgePill({ kind, kindBadges }: { kind: string; kindBadges: Record<string, MercuryKindBadge> }) {
  const b = kindBadges[kind]
  const label = mercuryKindPaymentTypeLabel(kind, kindBadges)
  const bg = normalizeHexColor(b?.color ?? '') ?? defaultKindBadgeColor()
  const color = pickTextOnBackground(bg)
  return (
    <span
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        maxWidth: '100%',
        padding: '1px 6px',
        borderRadius: 4,
        fontSize: '0.7rem',
        fontWeight: 600,
        lineHeight: 1.35,
        background: bg,
        color,
        wordBreak: 'break-word',
      }}
    >
      {label}
    </span>
  )
}
