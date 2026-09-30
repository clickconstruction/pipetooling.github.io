import type { PortalWaiverHalf, PortalWaiverRow } from '../../lib/portal/portalPayload'
import { CARD, COPPER, HAIR, INK, MUTED, PAPER } from '../../lib/portal/portalTheme'

/**
 * "Lien waivers" on the customer portal (v2.4278, our lien waiver to the GC PR 4): one row per
 * sent bill the viewer pays, two columns — the conditional that came with the bill and the
 * unconditional that follows when the check clears — each a dated PDF, "on its way" while the
 * leader signs, or the dashed "when your check clears". Rows come pre-scoped from the function
 * (`_shared/portalWaivers.ts`). Screen only.
 */
function shortDate(ymd: string | null): string {
  if (!ymd) return ''
  const d = new Date(`${ymd}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function Half({ half, kind, paid, final }: { half: PortalWaiverHalf; kind: 'conditional' | 'unconditional'; paid: boolean; final: boolean }) {
  const pill = (text: string, on: boolean, href?: string | null) => {
    const style = {
      display: 'inline-block',
      fontSize: 12,
      fontWeight: on ? 600 : 500,
      padding: '4px 10px',
      border: `1px ${on ? 'solid' : 'dashed'} ${on ? HAIR : MUTED}`,
      background: on ? PAPER : 'transparent',
      color: on ? INK : MUTED,
      textDecoration: 'none',
      whiteSpace: 'nowrap' as const,
    }
    return href ? (
      <a href={href} target="_blank" rel="noopener" style={style} data-portal-waiver-pdf>
        ⤓ {text}
      </a>
    ) : (
      <span style={style}>{text}</span>
    )
  }
  const finalWord = final ? ' · final' : ''
  switch (half.state) {
    case 'sent':
    case 'signed':
      return pill(`${shortDate(half.ymd)}${finalWord}`, true, half.pdfUrl)
    case 'signing':
      return pill(`on its way${finalWord}`, false)
    case 'none':
      if (kind === 'conditional') return pill(paid ? 'none' : 'on its way', false)
      return pill(paid ? `on its way${finalWord}` : `when your check clears${finalWord}`, false)
  }
}

export default function PortalWaiversSection({ waivers, formatUsd }: { waivers: PortalWaiverRow[]; formatUsd: (n: number) => string }) {
  if (waivers.length === 0) return null
  const th = { fontSize: 10.5, fontWeight: 700 as const, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: MUTED }
  return (
    <section data-screen-only data-portal-waivers style={{ marginTop: '1.4rem', background: CARD, border: `1px solid ${HAIR}`, padding: '16px 20px 14px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: COPPER }}>Lien waivers</div>
      <p style={{ margin: '6px 0 10px', fontSize: 12.5, color: MUTED, maxWidth: '60ch' }}>
        One pair per bill. The conditional comes with the bill and takes effect when your check clears. The unconditional comes once it has. Every one is signed by our leader; the PDF is the record.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 90px 150px 170px', gap: '0 12px', alignItems: 'center', fontSize: 13, color: INK }}>
        <div style={th}>Bill</div>
        <div style={{ ...th, textAlign: 'right' }}>Amount</div>
        <div style={th}>Conditional</div>
        <div style={th}>Unconditional</div>
        {waivers.map((w) => (
          <div key={w.invoiceId} data-portal-waiver style={{ display: 'contents' }}>
            <div style={{ borderTop: `1px solid ${HAIR}`, padding: '9px 0', minWidth: 0 }}>
              <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {w.jobLabel} · {w.billLabel}
              </div>
              <div style={{ fontSize: 12, color: w.paid ? '#166534' : MUTED }}>{w.paid ? `paid` : w.billedYmd ? `sent ${shortDate(w.billedYmd)}` : 'open'}</div>
            </div>
            <div style={{ borderTop: `1px solid ${HAIR}`, padding: '9px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatUsd(w.amount)}</div>
            <div style={{ borderTop: `1px solid ${HAIR}`, padding: '9px 0' }}>
              <Half half={w.conditional} kind="conditional" paid={w.paid} final={w.final} />
            </div>
            <div style={{ borderTop: `1px solid ${HAIR}`, padding: '9px 0' }}>
              <Half half={w.unconditional} kind="unconditional" paid={w.paid} final={w.final} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
