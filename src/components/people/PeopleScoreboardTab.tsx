import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSuperintendentScores } from '../../hooks/useSuperintendentScores'
import { bonusWords, daysColumnWords, daysWords, hoursUnderWords, jobScoreWords, keptWords, monthOf, monthRange, monthShift, monthWords, SCORE_RULE_LINES, superintendentScores } from '../../lib/people/superintendentScores'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { EmptyState } from '../EmptyState'

/**
 * People → Review → Scoreboard (punch list #234, PR 4; until v2.6666 a dev-only sample with two
 * gauges, v2.1312): the superintendents against their baselines for a month, on the owner's three
 * calls — the office's sign-off as the certified percent, the bonus a share of the labor kept, a
 * sub-performed stage on its sheet hours. One row per superintendent: the jobs signed off in the
 * month, hours used of the hours earned, days against the plan, labor kept (payroll access only)
 * and the bonus; under it the jobs that could not score, each with its reason; then the rule and
 * the door to the share in Settings. The same read gives a superintendent his own row on his phone.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const th: CSSProperties = { padding: '0.4rem 0.6rem', textAlign: 'left', fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const thNum: CSSProperties = { ...th, textAlign: 'right' }
const td: CSSProperties = { padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border)', fontSize: '0.86rem', verticalAlign: 'top' }
const tdNum: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const btn: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 6, padding: '0.25rem 0.6rem', font: 'inherit', fontSize: '0.8rem', cursor: 'pointer', color: 'inherit' }

export function PeopleScoreboardTab() {
  const { role } = useAuth()
  const canSetRule = role === 'dev' || role === 'master_technician'
  const today = todayYmdInAppTz()
  const [month, setMonth] = useState(() => monthOf(today))
  const range = useMemo(() => monthRange(month), [month])
  const { read, loading, error } = useSuperintendentScores({ fromYmd: range.fromYmd, toYmd: range.toYmd })
  const lines = useMemo(() => (read ? superintendentScores(read, today <= range.toYmd ? today : range.toYmd) : []), [read, today, range.toYmd])
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div style={{ display: 'grid', gap: '0.9rem', padding: '0.5rem 0' }} data-testid="superintendent-scoreboard">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem 1rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Superintendents · Schedule</h2>
        <span style={muted}>against their baselines, on the office's sign-off</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <button type="button" style={btn} onClick={() => setMonth((m) => monthShift(m, -1))} aria-label="Earlier month">‹</button>
          <b style={{ fontSize: '0.9rem', minWidth: 130, textAlign: 'center' }} data-testid="scoreboard-month">{monthWords(month)}</b>
          <button type="button" style={btn} onClick={() => setMonth((m) => monthShift(m, 1))} disabled={month >= monthOf(today)} aria-label="Later month">›</button>
        </span>
      </div>

      {error ? <div style={{ ...muted, color: 'var(--text-red-700)' }}>{error}</div> : null}
      {loading && !read ? <div style={muted}>Reading the scores…</div> : null}
      {read && lines.length === 0 ? <EmptyState main={`Nothing waiting on the scoreboard for ${monthWords(month)}.`} next={{ label: 'Open the projects', to: '/jobs?tab=stages&kind=project' }} tail="A row appears when a project with an hours baseline at award has a superintendent assigned and the office signs off a percent in the month." /> : null}

      {lines.length > 0 ? (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Superintendent</th>
                <th style={th}>Jobs signed off</th>
                <th style={thNum}>Hours used / earned</th>
                <th style={thNum}>Days vs plan</th>
                {read?.readsWages ? <th style={thNum}>Labor kept</th> : null}
                <th style={thNum}>Bonus</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const isOpen = open === l.userId
                return (
                  <tr key={l.userId} data-testid="scoreboard-row">
                    <td style={td}>
                      <button type="button" onClick={() => setOpen(isOpen ? null : l.userId)} aria-expanded={isOpen} style={{ ...btn, border: 'none', padding: 0, fontWeight: 700, fontSize: '0.9rem' }}>
                        {l.userName} {isOpen ? '▴' : '▾'}
                      </button>
                      {isOpen ? (
                        <div style={{ display: 'grid', gap: 4, marginTop: 6, fontSize: '0.8rem' }} data-testid="scoreboard-jobs">
                          {l.jobs.map((j) => (
                            <div key={j.jobId}>{jobScoreWords(j)}</div>
                          ))}
                          {l.held.map((h) => (
                            <div key={h.row.jobId} style={muted}>
                              {h.row.jobLabel} · not scored: {h.why}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td style={td}>
                      {l.jobs.length === 0 ? <span style={muted}>none scored</span> : l.jobs.map((j) => `${j.jobLabel} · ${Math.round(j.certifiedPct ?? 0)}%`).join(' · ')}
                      {l.held.length > 0 ? <span style={muted}>{l.jobs.length ? ' · ' : ''}{l.held.length} not scored</span> : null}
                    </td>
                    <td style={tdNum}>
                      {l.jobs.length ? `${Math.round(l.usedHours)} h / ${Math.round(l.awardedHours)} h` : '—'}
                      {l.jobs.length ? <div style={{ ...muted, fontSize: '0.74rem' }}>{hoursUnderWords(l.hoursUnder)}</div> : null}
                    </td>
                    <td style={tdNum}>{daysWords(l.daysVsPlan) || <span style={muted}>{daysColumnWords(l)}</span>}</td>
                    {read?.readsWages ? <td style={{ ...tdNum, color: l.keptUsd != null && l.keptUsd < 0 ? 'var(--text-red-700)' : 'inherit' }}>{keptWords(l.keptUsd) || '—'}</td> : null}
                    <td style={{ ...tdNum, fontWeight: 700 }}>{bonusWords(l.bonusUsd, read?.sharePct ?? 10) || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', display: 'grid', gap: 4 }} data-testid="scoreboard-rule">
        <b style={{ fontSize: '0.86rem' }}>How it is scored</b>
        {SCORE_RULE_LINES.map((line) => (
          <div key={line} style={{ fontSize: '0.8rem', color: 'var(--text-700)' }}>
            {line}
          </div>
        ))}
        <div style={{ ...muted, marginTop: 4 }}>
          The share is {read?.sharePct ?? 10}% of the labor kept, paid at the office's sign-off, read by the month.
          {canSetRule ? (
            <>
              {' '}
              <Link to="/settings?tab=settings-people#settings-people-superintendent-bonus">Change the share in Settings → People</Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default PeopleScoreboardTab
