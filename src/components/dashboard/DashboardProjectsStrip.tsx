import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProjectsBoard } from '../../hooks/useProjectsBoard'
import { canSetExpectedHours, paceCounts, projectLabel, worstWords } from '../../lib/jobs/projectsBoard'
import { ProjectCard } from '../projectsBoard/ProjectCard'
import { EmptyState } from '../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import OfflineRetryPanel from '../OfflineRetryPanel'

/**
 * Projects on the leader's Dashboard (punch list #242, PR 6): the bar under Money in, in the
 * same frame, closed by default to one line — how many projects are working, how many behind,
 * ahead, on pace or with no reading yet, and the worst one named — and pressed open to the
 * Projects board's own cards, the same `useProjectsBoard` read and the same `ProjectCard` the
 * page draws, so the slider and the reason work here too. The open/closed choice is remembered
 * per device, as Money in's is. Drawn for the leader and a dev; the office has the board itself.
 */
export const PROJECTS_STRIP_OPEN_KEY = 'dashboard-projects-open'

function readOpenPref(): boolean {
  try {
    return localStorage.getItem(PROJECTS_STRIP_OPEN_KEY) === '1'
  } catch {
    return false
  }
}

function writeOpenPref(open: boolean): void {
  try {
    localStorage.setItem(PROJECTS_STRIP_OPEN_KEY, open ? '1' : '0')
  } catch {
    /* a private window still works; it just forgets */
  }
}

const frame: CSSProperties = {
  marginTop: '0.75rem',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  boxSizing: 'border-box',
  width: '100%',
  color: 'inherit',
}
const quiet: CSSProperties = { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }
const seg: CSSProperties = { whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: '0.8125rem', color: 'var(--text-700)' }
const strong: CSSProperties = { fontWeight: 700, color: 'var(--text-base)' }
const doorWords: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)', whiteSpace: 'nowrap' }

export default function DashboardProjectsStrip() {
  const { role } = useAuth()
  const [open, setOpen] = useState(readOpenPref)
  // Closed, the strip reads the one server read and no day's detail, so the Dashboard stays quick.
  const board = useProjectsBoard({ dayDetail: open })
  const { rows, cards, targets, loading, failure, reload } = board
  const canEdit = canSetExpectedHours(role)
  const counts = useMemo(() => paceCounts(cards.map((c) => c.line)), [cards])
  const worst = cards[0] && cards[0].line.tone === 'behind' ? cards[0] : null
  const toggle = () => {
    const next = !open
    writeOpenPref(next)
    setOpen(next)
  }

  if (failure && !rows) {
    return (
      <div style={{ ...frame, padding: '0.5rem 1rem' }} data-testid="dashboard-projects-strip">
        <span style={quiet}>Projects</span>
        <OfflineRetryPanel failure={failure} onRetry={reload} surface="dashboard-projects" idempotent busy={loading} style={{ margin: '0.25rem 0 0' }} />
      </div>
    )
  }
  if (!rows) {
    return (
      <div role="status" data-testid="dashboard-projects-strip" style={{ ...frame, padding: '0.5rem 1rem', fontSize: '0.8125rem', color: 'var(--text-faint)' }}>
        <span style={quiet}>Projects</span> · reading the projects…
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-expanded={false}
        data-testid="dashboard-projects-strip"
        style={{ ...frame, textAlign: 'left', font: 'inherit', padding: '0.5rem 1rem', display: 'flex', gap: '0.875rem', alignItems: 'baseline', flexWrap: 'wrap', cursor: 'pointer' }}
      >
        <span style={quiet}>Projects</span>
        <span style={seg}>
          <span style={strong}>{counts.total}</span> working
        </span>
        {counts.behind > 0 ? (
          <span style={seg}>
            <span style={{ fontWeight: 700, color: 'var(--text-red-800)' }}>{counts.behind}</span> behind
          </span>
        ) : null}
        {counts.ahead > 0 ? (
          <span style={seg}>
            <span style={{ fontWeight: 700, color: 'var(--text-green-800)' }}>{counts.ahead}</span> ahead
          </span>
        ) : null}
        {counts.even > 0 ? <span style={{ ...seg, color: 'var(--text-muted)' }}>{counts.even} on pace</span> : null}
        {counts.early > 0 ? <span style={{ ...seg, color: 'var(--text-muted)' }}>{counts.early} no reading yet</span> : null}
        {worst ? (
          <span data-testid="dashboard-projects-worst" style={{ ...seg, border: '1px solid var(--border-red)', background: 'var(--bg-red-tint)', borderRadius: 999, padding: '0.125rem 0.75rem', color: 'var(--text-red-800)' }}>
            {projectLabel(worst.row)} · <span style={{ fontWeight: 700 }}>{worstWords(worst.line)}</span>
          </span>
        ) : null}
        <span style={{ ...doorWords, marginLeft: 'auto' }}>Open ▾</span>
      </button>
    )
  }

  return (
    <section aria-label="Projects" data-testid="dashboard-projects-strip" style={{ ...frame, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', padding: '0.625rem 1rem 0.5rem', flexWrap: 'wrap' }}>
        <span style={quiet}>Projects</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
          · {counts.total} working, worst first
        </span>
        <Link to="/projects-board" style={{ ...doorWords, marginLeft: 'auto', textDecoration: 'none' }}>
          Open the board →
        </Link>
        <button type="button" onClick={toggle} aria-expanded style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', ...doorWords, cursor: 'pointer' }}>
          Close ▴
        </button>
      </div>
      {targets.error ? <p role="alert" style={{ color: 'var(--text-red-700)', margin: '0 1rem 0.5rem', fontSize: '0.8125rem' }}>{targets.error}</p> : null}
      {rows.length === 0 ? (
        <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'data', noun: 'working projects', page: { label: 'Open the Pipeline', tail: 'and set a job Working with its stages.' } }), { to: '/jobs?tab=stages' })} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.75rem', padding: '0 0.75rem 0.75rem' }} data-testid="dashboard-projects-cards">
          {cards.map((c) => (
            <ProjectCard
              key={c.row.id}
              row={c.row}
              pace={c.pace}
              target={targets.byJob.get(c.row.id) ?? null}
              events={c.events}
              valueEvents={c.valueEvents}
              dollars={c.dollars}
              canEdit={canEdit}
              onSetTarget={(hours, from, why) => targets.setTarget(c.row.id, hours, from, why)}
              onClearTarget={() => targets.clearTarget(c.row.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
