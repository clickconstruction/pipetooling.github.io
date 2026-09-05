import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import type { Temperature } from '../../lib/jobs/gcStatementRounds'
import type { TemperatureBoardRow } from '../../lib/jobs/temperatureBoard'

/**
 * Temperature board (v2.2813): every GC over the round threshold, cold first,
 * with the account man, the current read, a six-week trend, the last word,
 * and the pay date — plus the guardrail (contacted-only weeks with no
 * statement) and the "no read" rows nobody has talked to. Pure presentation
 * over buildTemperatureBoard; the GC name opens the send history.
 */
export const TEMP_DOT: Record<Temperature, string> = { hot: '#5DCAA5', warm: '#FAC775', cool: '#85B7EB', cold: '#E24B4A' }
export const TEMP_PILL: Record<Temperature, { bg: string; fg: string }> = {
  hot: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)' },
  warm: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' },
  cool: { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)' },
  cold: { bg: 'var(--bg-orange-tint)', fg: 'var(--text-red-700)' },
}

export default function GcTemperatureBoard({
  rows,
  weekLabels,
  userNameById,
  onOpenGc,
}: {
  rows: readonly TemperatureBoardRow[]
  /** one short label per trend slot, oldest first (e.g. "Aug 3") */
  weekLabels: readonly string[]
  userNameById: (id: string | null) => string
  onOpenGc: (gc: { id: string; name: string }) => void
}) {
  const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short' })
  const fmtYmd = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number)
    return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
  }
  return (
    <div style={{ margin: '0 auto 1rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Temperature board</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>every GC in the round · cold first · six-week trend · who is going cold, and who nobody has talked to</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', minWidth: 640 }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textAlign: 'left' }}>
              <th style={{ padding: '0.2rem 0', fontWeight: 600 }}>GC · account man</th>
              <th style={{ padding: '0.2rem 0.4rem', fontWeight: 600 }}>Now</th>
              <th style={{ padding: '0.2rem 0.4rem', fontWeight: 600, whiteSpace: 'nowrap' }} title={weekLabels.join(' · ')}>
                6 weeks
              </th>
              <th style={{ padding: '0.2rem 0.4rem', fontWeight: 600 }}>Last word</th>
              <th style={{ padding: '0.2rem 0', fontWeight: 600, textAlign: 'right' }}>Pays by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pill = r.now ? TEMP_PILL[r.now] : { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)' }
              return (
                <tr key={r.gcId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.35rem 0', verticalAlign: 'top' }}>
                    <button
                      type="button"
                      onClick={() => onOpenGc({ id: r.gcId, name: r.gcName })}
                      title={`Send history for ${r.gcName}`}
                      style={{ font: 'inherit', fontWeight: 700, border: 'none', background: 'none', padding: 0, color: 'inherit', cursor: 'pointer', textDecoration: 'underline dotted' }}
                    >
                      {r.gcName}
                    </button>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {' '}· ${formatCurrency(r.amount)} · {userNameById(r.senderUserId)}
                    </span>
                  </td>
                  <td style={{ padding: '0.35rem 0.4rem', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    <span
                      title={r.now && r.nowAt ? `${r.now} · ${fmtShort(r.nowAt)} · ${r.nowBy}` : 'nobody has recorded a read'}
                      style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.1rem 0.5rem', borderRadius: 999, background: pill.bg, color: pill.fg }}
                    >
                      {r.now ?? 'no read'}
                    </span>
                  </td>
                  <td style={{ padding: '0.35rem 0.4rem', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    {r.trend.map((t, i) => (
                      <span
                        key={i}
                        aria-hidden
                        title={`${weekLabels[i] ?? ''}: ${t ?? 'no contact'}`}
                        style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 999, marginRight: 3, background: t ? TEMP_DOT[t] : 'var(--border-400)' }}
                      />
                    ))}
                  </td>
                  <td style={{ padding: '0.35rem 0.4rem', verticalAlign: 'top', color: 'var(--text-muted)', maxWidth: 320 }}>
                    {r.lastWord ? (
                      <span title={r.lastWord.note}>
                        “{r.lastWord.note.length > 90 ? `${r.lastWord.note.slice(0, 90)}…` : r.lastWord.note}” — {r.lastWord.by}, {fmtShort(r.lastWord.at)}
                      </span>
                    ) : r.now == null ? (
                      <span>
                        {r.lastStatementAt ? 'Statements only — ' : ''}nobody has written down what this GC said
                      </span>
                    ) : (
                      '—'
                    )}
                    {r.contactedOnlyWeeks >= 2 ? (
                      <span style={{ display: 'block', color: 'var(--text-red-700)', fontWeight: 600 }}>
                        ⚠ spoken to {r.contactedOnlyWeeks} weeks running · no statement{r.lastStatementAt ? ` since ${new Date(r.lastStatementAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ' on record'}
                      </span>
                    ) : null}
                  </td>
                  <td style={{ padding: '0.35rem 0', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap', color: r.expectedPayBy ? 'var(--text-green-800)' : 'var(--text-muted)', fontWeight: r.expectedPayBy ? 600 : 400 }}>
                    {r.expectedPayBy ? fmtYmd(r.expectedPayBy) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
        {(['hot', 'warm', 'cool', 'cold'] as Temperature[]).map((t) => (
          <span key={t}>
            <span aria-hidden style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 999, background: TEMP_DOT[t], verticalAlign: 'middle', marginRight: 4 }} />
            {t}
          </span>
        ))}
        <span>
          <span aria-hidden style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 999, background: 'var(--border-400)', verticalAlign: 'middle', marginRight: 4 }} />
          no contact that week
        </span>
      </div>
    </div>
  )
}
