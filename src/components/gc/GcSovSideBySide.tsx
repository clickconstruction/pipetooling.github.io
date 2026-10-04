import {
  claimedToDate,
  money,
  stageReached,
  stageReachedWords,
  theirSovGap,
  type Sow,
} from '../../lib/gcMode/gcModel'
import { td, th as thBase } from './gcUi'

/** Each table scrolls inside its own column rather than spilling into the other. */
const box = { minWidth: 0, overflowX: 'auto' } as const
/** The headings wrap, so the two columns sit side by side on a narrower card. */
const th = { ...thBase, whiteSpace: 'normal' } as const

/**
 * GC mode design spike: our schedule of values beside the trade's own (the owner, 2026-10-04,
 * question 4). Draws bill by percent on ours; theirs is how they think of the job, usually by stage
 * (rough-in, top out, trim), so the line under them says how far the money claimed has reached.
 * The Building lane can show it on a draw too.
 */
export function GcSovSideBySide({
  sow,
  claimed,
}: {
  sow: Sow
  /** Defaults to what the draws billed. */ claimed?: number
}) {
  const ours = sow.sov.filter((l) => !l.changeOrderId)
  const theirs = sow.theirSov ?? []
  const toDate = claimed ?? claimedToDate(sow)
  const gap = theirs.length > 0 ? theirSovGap(theirs, sow.price) : 0
  const pct = (n: number) =>
    `${Math.round((n / Math.max(1, sow.price)) * 100)}%`
  return (
    <div style={{ display: 'grid', gap: '0.4rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(17rem, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div style={box}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.875rem',
            }}
          >
            <thead>
              <tr>
                <th style={th}>Our schedule of values</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                <th style={{ ...th, textAlign: 'right' }}>Billed</th>
              </tr>
            </thead>
            <tbody>
              {ours.map((l) => (
                <tr key={l.id}>
                  <td style={td}>{l.label}</td>
                  <td
                    style={{
                      ...td,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {money(l.amount)}
                  </td>
                  <td
                    style={{
                      ...td,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {l.pctBilled}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={box}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.875rem',
            }}
          >
            <thead>
              <tr>
                <th style={th}>Theirs, as they sent it</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                <th style={{ ...th, textAlign: 'right' }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {theirs.length === 0 ? (
                <tr>
                  <td style={{ ...td, color: 'var(--text-muted)' }} colSpan={3}>
                    They have not sent their own yet. It comes with their quote
                    or from their portal.
                  </td>
                </tr>
              ) : (
                theirs.map((l, i) => (
                  <tr key={`${l.label}-${i}`}>
                    <td style={td}>{l.label}</td>
                    <td
                      style={{
                        ...td,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {money(l.amount)}
                    </td>
                    <td
                      style={{
                        ...td,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {pct(l.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {theirs.length > 0 && (
        <div style={{ fontSize: '0.875rem' }}>
          {stageReachedWords(theirs, stageReached(theirs, toDate))}
          {gap !== 0 && (
            <span style={{ color: 'var(--text-amber-800)' }}>
              {' '}
              Their lines add up to {money(sow.price + gap)},{' '}
              {money(Math.abs(gap))} {gap > 0 ? 'over' : 'under'} the price.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
