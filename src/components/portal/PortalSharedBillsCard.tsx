/**
 * Share this bill (v2.3375): the card under the ledger for bills on this
 * viewer's jobs that someone else pays and the office chose to show them.
 * Two wordings, one card: the GC reads "Your customers' open bills" (repairs
 * on homes they sent us, billed to the owner); the owner reads "On your job,
 * billed to your builder". Facts about the bill only — who it went to, the
 * address and job, billed date and age, received so far, what is open — no
 * Pay button, never in the balance. Customer-facing ⇒ single-theme light
 * with the statement's own palette. Prints as its own page after the ledger.
 */
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, PAPER_RED } from '../../lib/portal/portalTheme'
import { formatPortalDate, formatPortalUsd, portalDaysSinceBilled, splitPortalAddress, type PortalSharedBill } from '../../lib/portal/portalPayload'

export type PortalSharedBillsCardProps = {
  bills: PortalSharedBill[]
  todayYmd: string
}

const WORDING = {
  gc: {
    eyebrow: 'Your customers’ open bills',
    why: 'Bills on homes you sent us that our office shared with you — billed to the owner, not to you, and not in your balance. Listed so you know where each one stands.',
    foot: 'Open on your customers’ jobs · not in your balance',
  },
  customer: {
    eyebrow: 'On your job, billed to your builder',
    why: 'Shared with you by our office for your records. Not yours to pay, and not in your balance.',
    foot: 'Shown for your records · not yours to pay',
  },
} as const

function sum(list: PortalSharedBill[]): number {
  return Math.round(list.reduce((s, b) => s + b.amount, 0) * 100) / 100
}

function SharedGroup({ role, bills, todayYmd }: { role: 'gc' | 'customer'; bills: PortalSharedBill[]; todayYmd: string }) {
  const words = WORDING[role]
  const owners = new Set(bills.map((b) => b.billedTo)).size
  const oldest = bills.map((b) => portalDaysSinceBilled(b.billedOn, todayYmd)).find((d) => d != null) ?? null
  const summary = [
    role === 'gc' ? `${owners} ${owners === 1 ? 'owner' : 'owners'}` : null,
    `${formatPortalUsd(sum(bills))} open`,
    oldest ? `oldest ${oldest.label}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <div data-portal-shared-bills data-role={role} data-print-page style={{ margin: '14px 0 4px', border: `1px solid ${HAIR}`, background: CARD, padding: '12px 14px 6px', fontSize: 12.5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: COPPER }}>{words.eyebrow}</span>
        <span style={{ fontSize: 12, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{summary}</span>
      </div>
      <div style={{ color: MUTED, margin: '4px 0 6px', fontSize: 12 }}>{words.why}</div>
      {bills.map((b, i) => {
        const addr = splitPortalAddress(b.jobAddress)
        const where = [addr?.street ?? b.jobName ?? b.jobLabel, addr?.rest ?? null].filter(Boolean).join(', ')
        const age = portalDaysSinceBilled(b.billedOn, todayYmd)
        const meta = [
          b.billedOn ? `Billed ${formatPortalDate(b.billedOn) ?? b.billedOn}` : 'Billed',
          age ? age.label : null,
          b.totalPaid > 0 ? `${formatPortalUsd(b.totalPaid)} received` : null,
        ].filter(Boolean)
        return (
          <div key={i} data-portal-shared-bill style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '2px 14px', padding: '9px 0', borderTop: `1px solid ${HAIR}`, alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: INK }}>{b.billedTo}</div>
              <div style={{ color: MUTED }}>
                {where}
                {b.jobNumber ? ` · ${b.jobNumber}` : ''}
                {b.jobName && addr ? ` · ${b.jobName}` : ''}
              </div>
              <div style={{ fontSize: 11.5, color: FAINT, marginTop: 2 }}>
                {meta.map((m, k) => (
                  <span key={k}>
                    {k > 0 ? ' · ' : ''}
                    <span style={age && k === 1 && age.aging ? { color: PAPER_RED, fontWeight: 700 } : undefined}>{m}</span>
                  </span>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 14, color: INK }}>{formatPortalUsd(b.amount)}</div>
              {b.totalPaid > 0 ? <div style={{ fontSize: 11, color: FAINT, fontVariantNumeric: 'tabular-nums' }}>of {formatPortalUsd(b.billedAmount)}</div> : null}
            </div>
          </div>
        )
      })}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', borderTop: `1.5px solid ${INK}`, padding: '8px 0 4px', fontSize: 12, color: MUTED }}>
        <span>{words.foot}</span>
        <span style={{ fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums' }}>{formatPortalUsd(sum(bills))}</span>
      </div>
    </div>
  )
}

export function PortalSharedBillsCard({ bills, todayYmd }: PortalSharedBillsCardProps) {
  const asGc = bills.filter((b) => b.viewerRole === 'gc')
  const asCustomer = bills.filter((b) => b.viewerRole === 'customer')
  return (
    <>
      {asGc.length > 0 ? <SharedGroup role="gc" bills={asGc} todayYmd={todayYmd} /> : null}
      {asCustomer.length > 0 ? <SharedGroup role="customer" bills={asCustomer} todayYmd={todayYmd} /> : null}
    </>
  )
}
