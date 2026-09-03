// "Where the number comes from" for the selected person — the formula with
// today's figures, what moves it, and the watch-outs. Sibling in spirit to
// the Overhead tab's lens modals, rendered inline beside the ranked list.

import { REVIEW_GROUP_LABEL, type ReviewPersonMath } from '../../../lib/people/reviewRanked'
import { fmtH, fmtMoney } from '../teamSummary/formatters'

const sectionLabel: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginBottom: 6,
}

export function PeopleReviewMathDrawer({ math }: { math: ReviewPersonMath | null }) {
  const shell: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.8rem 0.9rem',
    background: 'var(--bg-subtle)',
    display: 'grid',
    gap: '0.7rem',
    alignContent: 'start',
    minWidth: 0,
  }
  if (!math) {
    return (
      <div style={{ ...shell, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Click a name to see where their number comes from — the formula with this period's figures, what moves it, and the watch-outs.
      </div>
    )
  }
  const profitLine = math.lines.find((l) => l.key === 'profit')
  const headline = profitLine?.usd == null ? '…' : fmtMoney(profitLine.usd)
  return (
    <div style={shell} aria-live="polite">
      <div>
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
          {math.name} · where {headline} comes from
        </h4>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{REVIEW_GROUP_LABEL[math.group]}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 12, rowGap: 3, fontSize: '0.82rem', alignItems: 'baseline' }}>
        {math.lines.map((l) => {
          const total = l.kind === 'total'
          const neg = l.usd != null && l.usd < 0
          return (
            <div key={l.key} style={{ display: 'contents' }}>
              <div
                style={{
                  color: total ? 'var(--text-base)' : 'var(--text-muted)',
                  fontWeight: total ? 700 : 400,
                  borderTop: total ? '1px solid var(--border)' : undefined,
                  paddingTop: total ? 5 : 0,
                }}
              >
                {l.label}
                {l.why && <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: 1 }}>{l.why}</div>}
              </div>
              <div
                style={{
                  textAlign: 'right',
                  fontWeight: total ? 700 : 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: neg ? 'var(--text-red-700)' : 'var(--text-base)',
                  borderTop: total ? '1px solid var(--border)' : undefined,
                  paddingTop: total ? 5 : 0,
                  alignSelf: 'start',
                }}
              >
                {l.usd == null ? '…' : fmtMoney(l.usd)}
              </div>
            </div>
          )
        })}
        <div style={{ color: 'var(--text-muted)' }}>
          ÷ Hours
          <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: 1 }}>
            {fmtH(math.perHour.hours)} {math.perHour.basis === 'assumed' ? 'assumed salaried hours (8 h × weekdays), not clock time' : 'clocked hours, office and bid time included'}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', alignSelf: 'start' }}>
          {math.perHour.profit == null ? '…' : `${fmtMoney(math.perHour.profit)}/hr`}
        </div>
      </div>

      {math.levers.length > 0 && (
        <div>
          <div style={sectionLabel}>What moves it</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem', color: 'var(--text-700)', display: 'grid', gap: 3 }}>
            {math.levers.map((lv, i) => (
              <li key={i} style={{ color: lv.tone === 'warn' ? 'var(--text-amber-900)' : lv.tone === 'good' ? 'var(--text-green-800)' : undefined }}>
                {lv.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div style={sectionLabel}>Watch-outs</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.78rem', color: 'var(--text-muted)', display: 'grid', gap: 3 }}>
          {math.watchouts.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
