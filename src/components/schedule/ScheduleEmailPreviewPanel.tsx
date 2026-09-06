import {
  schedulePreviewByPerson,
  schedulePreviewSummary,
  schedulePreviewSummaryLabel,
  type SchedulePreviewLine,
} from '../../lib/scheduleSharePreview'

/**
 * "What will send" panel shared by the Share and Day-email modals (J18-F9):
 * the rows the email RPC returns right now, rendered in the email's own order
 * — grouped by person for the Share board, flat by time for a day email.
 */
export function ScheduleEmailPreviewPanel({
  lines,
  loading,
  error,
  multiDay,
  groupByPerson,
  caption,
}: {
  lines: SchedulePreviewLine[]
  loading: boolean
  error: string | null
  /** Show the date on each row (Share with more than one day). */
  multiDay: boolean
  /** Share email sections are per person; the day email is one time-ordered list. */
  groupByPerson: boolean
  /** One muted line under the headline, e.g. whose visibility the rows reflect. */
  caption?: string
}) {
  const summary = schedulePreviewSummary(lines)
  const headline = loading
    ? 'Loading what will send…'
    : error
      ? 'Could not load the preview'
      : schedulePreviewSummaryLabel(summary, { multiDay })

  const renderLine = (line: SchedulePreviewLine, showPerson: boolean) => (
    <li key={line.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '2px 0', minWidth: 0 }}>
      <span style={{ flex: '0 0 auto', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {multiDay ? `${line.dateLabel} · ` : ''}
        {line.window}
      </span>
      <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={[line.jobLabel, line.address, line.note].filter(Boolean).join('\n')}>
        {showPerson ? <strong>{line.person}</strong> : null}
        {showPerson ? ' · ' : ''}
        {line.jobLabel}
        {line.note ? <span style={{ color: 'var(--text-muted)' }}> — {line.note}</span> : null}
      </span>
    </li>
  )

  return (
    <section
      aria-label="What will send"
      aria-busy={loading || undefined}
      style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.65rem', marginTop: '0.6rem', fontSize: '0.78rem' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600 }}>What will send</span>
        <span role="status" style={{ color: error ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
          {headline}
        </span>
      </div>
      {caption ? <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.72rem' }}>{caption}</p> : null}
      {error ? <p style={{ margin: '0.35rem 0 0', color: 'var(--text-red-700)' }}>{error}</p> : null}
      {!loading && !error && lines.length > 0 ? (
        <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: '0.4rem' }}>
          {groupByPerson ? (
            schedulePreviewByPerson(lines).map((group) => (
              <div key={group.person} style={{ marginBottom: '0.4rem' }}>
                <div style={{ fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 2 }}>{group.person}</div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{group.lines.map((line) => renderLine(line, false))}</ul>
              </div>
            ))
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{lines.map((line) => renderLine(line, true))}</ul>
          )}
        </div>
      ) : null}
    </section>
  )
}
