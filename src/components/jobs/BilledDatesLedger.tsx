import { Fragment, type CSSProperties, type ReactNode } from 'react'
import type { BilledDatesLedger as LedgerModel, LedgerRow, LedgerTone } from '../../lib/jobs/billedDatesLedger'

/**
 * The dates block under a Billed / Collections row's money legend (v2.4168): a
 * numbered track over a ledger. Pure presentation — every row, marker and word
 * comes from `buildBilledDatesLedger`. The Expected / They said row opens the
 * promise window; every deadline row opens the job's Lien window.
 */

const INK: Record<LedgerTone, string> = {
  done: 'var(--text-muted)',
  plain: 'var(--text-muted)',
  green: 'var(--text-green-700)',
  amber: 'var(--text-amber-800)',
  red: 'var(--text-red-700)',
}
const MARK: Record<LedgerTone, string> = {
  done: 'var(--text-muted)',
  plain: 'var(--text-muted)',
  green: '#15803d',
  amber: '#b45309',
  red: '#b91c1c',
}
const HATCH = 'repeating-linear-gradient(135deg, #fca5a5 0 3px, var(--bg-red-tint) 3px 6px)'

function Badge({ n, tone, filled }: { n: number; tone: LedgerTone; filled: boolean }) {
  const color = MARK[tone]
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 15,
        height: 15,
        borderRadius: '50%',
        boxSizing: 'border-box',
        border: `1.5px solid ${color}`,
        background: filled ? color : 'var(--surface)',
        color: filled ? '#ffffff' : color,
        fontSize: '0.62rem',
        fontWeight: 700,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0,
      }}
    >
      {n}
    </span>
  )
}

/** A done marker is filled grey; an amber/red one that asks for something is filled too; the rest are rings. */
const filledFor = (r: Pick<LedgerRow, 'tone' | 'bold'>) => r.tone === 'done' || (r.bold && r.tone !== 'plain')

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
  const t = ledger.track
  const trackH = 20
  const wrap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 0, width: '100%', maxWidth: '100%', marginTop: compact ? '0.15rem' : '0.3rem', fontVariantNumeric: 'tabular-nums' }
  const byN = new Map(ledger.rows.map((r) => [r.n, r]))
  const handlerFor = (r: LedgerRow): (() => void) | undefined => {
    if (r.action === 'they-said' || r.action === 'new-date') return onMoney
    if (r.action === 'lien-desk') return onLienDesk
    return undefined
  }
  return (
    <div className="billedDatesLedger" data-testid="billed-dates-ledger" aria-label={ledger.full} style={wrap}>
      {t ? (
        <div aria-hidden style={{ position: 'relative', height: trackH + 12, width: '100%', margin: '0.35rem 0 0.2rem' }} data-testid="ledger-track">
          <div style={{ position: 'absolute', left: 0, right: 0, top: 9, height: 2, background: 'var(--border)' }} />
          {/* time used */}
          <div style={{ position: 'absolute', left: 0, width: `${t.todayPct}%`, top: 9, height: 2, background: 'var(--text-muted)' }} />
          {/* the run between the money and the lien */}
          {t.gap ? (
            <div
              style={{
                position: 'absolute',
                left: `${t.gap.fromPct}%`,
                width: `${Math.max(0, t.gap.toPct - t.gap.fromPct)}%`,
                top: 7,
                height: 6,
                borderRadius: 3,
                background: t.gap.kind === 'room' ? 'var(--bg-green-200)' : HATCH,
              }}
            />
          ) : null}
          {/* today */}
          <div style={{ position: 'absolute', left: `calc(${t.todayPct}% - 5px)`, top: 14, width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '7px solid var(--text-strong)' }} />
          <div style={{ position: 'absolute', left: `${t.todayPct}%`, top: 22, transform: 'translateX(-50%)', fontSize: '0.6rem', color: 'var(--text-muted)', lineHeight: 1 }}>today</div>
          {t.markers.map((m) => {
            const row = byN.get(m.n)
            const filled = row ? filledFor(row) : false
            return (
              <div key={m.n} data-testid="ledger-marker" style={{ position: 'absolute', left: `calc(${m.pct}% - 7.5px)`, top: 2.5, display: 'flex' }}>
                <Badge n={m.n} tone={m.tone} filled={filled} />
              </div>
            )
          })}
        </div>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: '17px minmax(0, 1fr) auto', columnGap: 6, rowGap: 3, alignItems: 'center', fontSize: '0.75rem', marginTop: t ? '0.25rem' : 0 }}>
        {ledger.rows.map((r) => {
          const ink = INK[r.tone]
          const onClick = handlerFor(r)
          const words = (
            <>
              <b style={{ fontWeight: r.bold ? 700 : 600, color: r.bold ? ink : r.tone === 'done' || r.tone === 'plain' ? 'var(--text-700)' : ink }}>{r.label}</b>
              {r.joiner ? ` ${r.joiner}` : ''}
              {r.date ? ` ${r.date}` : ''}
              {onClick && r.bold ? ' ›' : ''}
            </>
          )
          return (
            <Fragment key={r.key}>
              {r.n > 0 ? <Badge n={r.n} tone={r.tone} filled={filledFor(r)} /> : <span aria-hidden />}
              {onClick ? (
                <button
                  type="button"
                  data-testid={`ledger-row-${r.key}`}
                  title={`${r.title}${r.action === 'they-said' ? ' — click to record what the customer said' : r.action === 'new-date' ? ' — click to record a new date the customer named' : ' — click to open the Lien window'}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onClick()
                  }}
                  style={{ padding: 0, border: 'none', background: 'none', font: 'inherit', color: ink, cursor: 'pointer', textAlign: 'left', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: r.bold ? 'none' : 'underline dotted', textUnderlineOffset: 2 }}
                >
                  {words}
                </button>
              ) : (
                <span data-testid={`ledger-row-${r.key}`} title={r.title} style={{ color: ink, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {words}
                </span>
              )}
              <span style={{ textAlign: 'right', whiteSpace: 'nowrap', color: ink, fontWeight: r.bold ? 700 : r.tone === 'amber' || r.tone === 'red' ? 600 : 400 }}>{r.far}</span>
              {r.sub ? <span style={{ gridColumn: '2 / 4', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: -2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</span> : null}
              {r.key === 'money' && evidence ? <span style={{ gridColumn: '2 / 4', marginTop: -2, minWidth: 0 }}>{evidence}</span> : null}
            </Fragment>
          )
        })}
        {ledger.roomLine ? (
          onLienDesk ? (
            <button
              type="button"
              data-testid="ledger-room"
              onClick={(e) => {
                e.stopPropagation()
                onLienDesk()
              }}
              title="Expected pay lands before the lien window closes — click to open the Lien window"
              style={{ gridColumn: '1 / 4', marginTop: 3, padding: 0, border: 'none', background: 'none', font: 'inherit', fontSize: '0.75rem', fontWeight: 600, color: INK.green, cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3, textAlign: 'center' }}
            >
              {ledger.roomLine} ›
            </button>
          ) : (
            <span data-testid="ledger-room" style={{ gridColumn: '1 / 4', marginTop: 3, fontSize: '0.75rem', fontWeight: 600, color: INK.green, textAlign: 'center' }}>
              {ledger.roomLine}
            </span>
          )
        ) : null}
      </div>
    </div>
  )
}
