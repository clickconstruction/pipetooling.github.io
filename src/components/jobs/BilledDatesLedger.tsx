import { Fragment, type CSSProperties, type ReactNode } from 'react'
import type { BilledDatesLedger as LedgerModel, LedgerAction, LedgerRow, LedgerTone } from '../../lib/jobs/billedDatesLedger'

/**
 * The dates block under a Billed / Collections row's money legend (v2.4168;
 * the legend's grammar v2.4189; rows and one bold line v2.4205): rows with a
 * dot, the words and *how far from today* on the right, then — only when it
 * adds something — one bold verdict under a hairline. Pure presentation:
 * every row and word comes from `buildBilledDatesLedger`. The Expected / They
 * said row opens the promise window; the deadline row and the verdict open
 * the job's Lien window (or They said… when the verdict asks for a date).
 */

const INK: Record<LedgerTone, string> = {
  done: 'var(--text-strong)',
  plain: 'var(--text-strong)',
  green: 'var(--text-green-700)',
  amber: 'var(--text-amber-800)',
  red: 'var(--text-red-700)',
}
const DOT: Record<LedgerTone, string> = {
  done: 'var(--border-strong)',
  plain: 'var(--border-strong)',
  green: '#16a34a',
  amber: '#d97706',
  red: '#dc2626',
}

function Dot({ tone, dot }: { tone: LedgerTone; dot: LedgerRow['dot'] }) {
  const color = DOT[tone]
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        boxSizing: 'border-box',
        border: `1.5px solid ${color}`,
        background: dot === 'filled' ? color : 'var(--surface)',
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  )
}

const doorStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, width: '100%', minWidth: 0, padding: 0, border: 'none', background: 'none', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }
const rowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, minWidth: 0, color: 'var(--text-muted)' }

export default function BilledDatesLedger({
  ledger,
  evidence,
  onMoney,
  onLienDesk,
  compact = false,
}: {
  ledger: LedgerModel
  /** The customer's pay history line, drawn under the money row. */
  evidence?: ReactNode
  /** Opens They said… / New date… (absent for roles that may not record a promise). */
  onMoney?: () => void
  /** Opens the job's Lien window. */
  onLienDesk?: () => void
  compact?: boolean
}) {
  if (ledger.rows.length === 0) return null
  const handlerFor = (action: LedgerAction | null): (() => void) | undefined => {
    if (action === 'they-said' || action === 'new-date') return onMoney
    if (action === 'lien-desk') return onLienDesk
    return undefined
  }
  const doorTitle = (title: string, action: LedgerAction | null) => `${title}${action === 'they-said' ? ' — click to record what the customer said' : action === 'new-date' ? ' — click to record a new date the customer named' : ' — click to open the Lien window'}`
  const wrap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: compact ? 4 : 5, width: '100%', maxWidth: '100%', marginTop: compact ? '0.35rem' : '0.5rem', textAlign: 'left', fontSize: '0.75rem', lineHeight: 1.35, fontVariantNumeric: 'tabular-nums' }
  const v = ledger.verdict
  const verdictClick = v ? handlerFor(v.action) : undefined
  const verdictBody = v ? (
    <>
      <span style={{ color: v.tone === 'amber' || v.tone === 'red' ? INK[v.tone] : 'var(--text-strong)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.label}</span>
      <span style={{ color: INK[v.tone], whiteSpace: 'nowrap' }}>{v.value}</span>
    </>
  ) : null
  const verdictStyle: CSSProperties = { borderTop: '1px solid var(--border)', paddingTop: 3, marginTop: 1, fontWeight: 600 }
  return (
    <div className="billedDatesLedger" data-testid="billed-dates-ledger" aria-label={ledger.full} style={wrap}>
      {ledger.rows.map((r) => {
        const onClick = handlerFor(r.action)
        const valueInk = r.tone === 'done' || r.tone === 'plain' ? 'var(--text-strong)' : INK[r.tone]
        const loud = r.bold || r.tone === 'amber' || r.tone === 'red'
        const body = (
          <>
            <span style={{ display: 'flex', alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <Dot tone={r.tone} dot={r.dot} />
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.bold ? <b style={{ fontWeight: 600, color: INK[r.tone] }}>{r.label}</b> : r.label}
                {[r.joiner, r.date].filter(Boolean).map((w) => ` ${w}`).join('')}
              </span>
            </span>
            <span style={{ whiteSpace: 'nowrap', color: valueInk, fontWeight: loud ? 600 : 400 }}>{r.far}</span>
          </>
        )
        return (
          <Fragment key={r.key}>
            {onClick ? (
              <button
                type="button"
                data-testid={`ledger-row-${r.key}`}
                title={doorTitle(r.title, r.action)}
                onClick={(e) => {
                  e.stopPropagation()
                  onClick()
                }}
                style={{ ...doorStyle, color: 'var(--text-muted)' }}
              >
                {body}
              </button>
            ) : (
              <div data-testid={`ledger-row-${r.key}`} title={r.title} style={rowStyle}>
                {body}
              </div>
            )}
            {r.sub ? <div style={{ paddingLeft: 14, marginTop: -3, fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</div> : null}
            {r.key === 'money' && evidence ? <div style={{ paddingLeft: 14, marginTop: -3, minWidth: 0 }}>{evidence}</div> : null}
          </Fragment>
        )
      })}
      {v ? (
        verdictClick ? (
          <button type="button" data-testid="ledger-verdict" title={doorTitle(v.title, v.action)} onClick={(e) => { e.stopPropagation(); verdictClick() }} style={{ ...doorStyle, ...verdictStyle }}>
            {verdictBody}
          </button>
        ) : (
          <div data-testid="ledger-verdict" title={v.title} style={{ ...rowStyle, ...verdictStyle }}>
            {verdictBody}
          </div>
        )
      ) : null}
    </div>
  )
}
