import { roundCloseSummary, roundCloseTitle, type RoundCloseSheet } from '../../lib/quickfill/roundClose'

/**
 * The round's close sheet (punch list #176, change 5), drawn where *Round done ✓* was on the
 * Roller and on the phone's list: what is clean, what was worked and is still open (each a
 * door back into the station), and what was handed up as a question. Nothing is written; the
 * day's mark events are the record. `extra` is the host's own row under it (the Roller's
 * *Show the N marked today* switch).
 */
export function QuickfillRoundCloseSheet({ sheet, onOpenStation, extra }: { sheet: RoundCloseSheet; onOpenStation: (sectionId: string) => void; extra?: React.ReactNode }) {
  const door = (l: { sectionId: string; label: string; count: number | null }) => (
    <li key={l.sectionId} style={{ margin: '0.1rem 0' }}>
      <button type="button" onClick={() => onOpenStation(l.sectionId)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.875rem', color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }}>
        {l.label}
        {l.count != null ? ` · ${l.count}` : ''}
      </button>
    </li>
  )
  const empty = sheet.stations === 0
  return (
    <div data-testid="quickfill-round-close-sheet" style={{ padding: '1.25rem 1.25rem 1rem', border: '1px solid var(--border-green)', background: 'var(--bg-green-tint)', borderRadius: 10, color: 'var(--text-green-800)' }}>
      <p style={{ margin: '0 0 0.25rem', fontSize: '1.125rem', fontWeight: 700 }}>{empty ? 'Round done ✓' : roundCloseTitle(sheet)}</p>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem' }}>
        {empty ? 'Every group has been looked at today.' : roundCloseSummary(sheet)}
        {!empty && sheet.who ? ` · ${sheet.who}` : ''}
        {!empty && sheet.minutes > 0 ? ` · ${sheet.minutes} min` : ''}
      </p>
      {sheet.open.length > 0 || sheet.questions.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem 1.25rem', textAlign: 'left', color: 'var(--text)' }}>
          {sheet.open.length > 0 ? (
            <div>
              <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.6875rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Still open</h4>
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>{sheet.open.map(door)}</ul>
            </div>
          ) : null}
          {sheet.questions.length > 0 ? (
            <div>
              <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.6875rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Questions for the owner</h4>
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>{sheet.questions.map(door)}</ul>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Each one is a request in the Dispatch inbox.</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {sheet.clean.length > 0 ? (
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: 'var(--text-700)', textAlign: 'left' }}>
          <b>Clean:</b> {sheet.clean.map((l) => l.label).join(', ')}
        </p>
      ) : null}
      {extra ? <div style={{ marginTop: '0.75rem' }}>{extra}</div> : null}
    </div>
  )
}
