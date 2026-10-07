import { CARD, COPPER, FAINT, HAIR, INK, MUTED } from '../../../lib/portal/portalTheme'
import { legalOfficeContactLines, legalOfficeContactsHoursLine, type LegalOfficeContacts } from '../../../lib/legal/legalOfficeContacts'

/**
 * Who the firm calls (v2.4755): one strip under the portal's letterhead, on
 * every view — the office number with the assistants to ask for, the
 * controller's own line, and what each number is for. The numbers are
 * tap-to-call links. Nothing to draw when the office has no number at all.
 */
export default function LegalPortalReachStrip({ contacts }: { contacts: LegalOfficeContacts }) {
  const lines = legalOfficeContactLines(contacts)
  if (lines.length === 0) return null
  return (
    <div className="legalReachStrip" data-legal-reach-strip style={{ background: CARD, border: `1px solid ${HAIR}`, color: INK }}>
      <span style={{ fontSize: 11, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Reach the office</span>
      {lines.map((l, i) => (
        <span key={l.role} className="legalReachWho">
          {i > 0 ? <span className="legalReachSep" style={{ color: HAIR, marginRight: 12 }}>|</span> : null}
          <span style={{ color: MUTED }}>{l.role}</span>
          {l.name ? <b style={{ fontWeight: 600 }}>{l.name}</b> : null}
          <a href={l.href} style={{ color: COPPER, textDecoration: 'none', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{l.phoneWords}</a>
          {l.note ? <span style={{ color: MUTED }}>· {l.note}</span> : null}
        </span>
      ))}
      <span className="legalReachAny" style={{ color: FAINT, fontSize: 12 }}>{legalOfficeContactsHoursLine(contacts)}</span>
    </div>
  )
}
