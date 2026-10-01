import type { PortalWaiverRow } from '../../lib/portal/portalPayload'
import { formatPortalDate, splitPortalAddress } from '../../lib/portal/portalPayload'
import { CARD, COPPER, HAIR, INK, MUTED, PAPER_GREEN } from '../../lib/portal/portalTheme'
import { PORTAL_WAIVER_GROUP_WORDS, portalWaiverPaperRows, type PortalWaiverNote } from '../../lib/portal/portalWaiverPapers'

/**
 * Lien waivers on the customer portal (v2.4304, replacing v2.4278's table): the one-line note a
 * signed waiver adds to its bill, and the waiver group inside Your papers. Customer-facing ⇒
 * single-theme light with the statement's own palette. Kernel: `portalWaiverPapers.ts`.
 */

const SAMPLE_TITLE = 'Sample statement — no file behind this row'

/** "⤓ Lien waiver · conditional, signed Sep 29" — in the bill's own note; prints as words. */
export function PortalWaiverNoteLink({ note }: { note: PortalWaiverNote }) {
  const label = <span style={{ color: COPPER, fontWeight: 600 }}>⤓ Lien waiver</span>
  return (
    <span data-bill-waiver style={{ display: 'inline-block' }}>
      {note.href ? (
        <a href={note.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          {label}
        </a>
      ) : (
        <span title={SAMPLE_TITLE}>{label}</span>
      )}
      <span style={{ color: MUTED }}> · {note.words}</span>
    </span>
  )
}

/** A papers group's heading — the copper eyebrow the three groups share. */
export function PortalPapersGroupHeading({ children, first = false }: { children: string; first?: boolean }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: COPPER, margin: first ? '0 0 2px' : '16px 0 2px' }}>
      {children}
    </div>
  )
}

function ViewWaiverLink({ href }: { href: string | null }) {
  const style = { display: 'inline-block', border: `1px solid ${INK}`, background: CARD, color: INK, fontSize: 12.5, fontWeight: 600, padding: '6px 14px', textDecoration: 'none', whiteSpace: 'nowrap' as const }
  if (!href) {
    return (
      <span title={SAMPLE_TITLE} data-portal-paper-button style={{ ...style, opacity: 0.55 }}>
        View waiver
      </span>
    )
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={style} data-portal-waiver-pdf data-portal-paper-button>
      View waiver
    </a>
  )
}

/** One audience's waivers inside Your papers: the heading, one plain line, a row per signed waiver. */
export function PortalWaiverPaperGroup({
  waivers,
  audience,
  formatUsd,
  first = false,
}: {
  waivers: PortalWaiverRow[]
  audience: PortalWaiverRow['audience']
  formatUsd: (n: number) => string
  first?: boolean
}) {
  const rows = portalWaiverPaperRows(
    waivers.filter((w) => w.audience === audience),
    formatUsd,
  )
  if (rows.length === 0) return null
  const words = PORTAL_WAIVER_GROUP_WORDS[audience]
  return (
    <div data-portal-waivers data-audience={audience}>
      <PortalPapersGroupHeading first={first}>{words.heading}</PortalPapersGroupHeading>
      <div style={{ color: MUTED, fontSize: 12.5, margin: '0 0 2px', maxWidth: '64ch' }}>{words.lead}</div>
      {rows.map((r) => (
        <div key={r.key} data-portal-waiver style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '8px 0', borderTop: `1px solid ${HAIR}`, fontSize: 13.5 }}>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{splitPortalAddress(r.jobAddress)?.street ?? r.jobLabel}</div>
            <div style={{ color: MUTED, fontSize: 12.5 }}>{r.line}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2 }}>
              <span style={{ color: r.status === 'PAID IN FULL' ? PAPER_GREEN : COPPER }}>{r.status}</span>
              {r.ymd ? ` · ${formatPortalDate(r.ymd) ?? r.ymd}` : ''}
            </div>
          </div>
          <ViewWaiverLink href={r.href} />
        </div>
      ))}
    </div>
  )
}
