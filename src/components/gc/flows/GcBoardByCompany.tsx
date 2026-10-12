import type { CSSProperties } from 'react'
import { companyTable, type BoardCompany, type BoardContext, type TrackMark } from '../../../lib/flows/board'
import { th, td } from '../gcUi'

/**
 * By company (Messages cut 4, the prototype's B, `companyTableHtml`): one row per company on the flow, so a name reads
 * once. The Once lane as a track (green done, orange on now, filled orange lapsed), the step on now with whose move,
 * how long and the usual, one line per job, and the Portal column. Companies off the flow are left out. The words are
 * `flows/board.ts`'s `companyTable`.
 */

const MARK: Record<TrackMark, CSSProperties> = {
  done: { background: 'var(--text-green-700)', borderColor: 'var(--text-green-700)' },
  now: { background: 'var(--surface)', borderColor: 'var(--text-orange-700)' },
  lapsed: { background: 'var(--text-orange-700)', borderColor: 'var(--text-orange-700)' },
  '': { background: 'var(--surface)', borderColor: 'var(--border-400)' },
}

const MARK_WORDS: Record<TrackMark, string> = { done: 'done', now: 'on now', lapsed: 'lapsed', '': 'not yet' }

export function GcBoardByCompany({
  ctx,
  companies,
  portal,
  onOpen,
}: {
  ctx: BoardContext
  companies: readonly BoardCompany[]
  /** The Portal column's words for a company: "opened", "today", "3 d ago", "never". */
  portal: (contactId: string) => string
  /** Open the company, at the step it is on now when it is on one. */
  onOpen: (contactId: string, stepId: string | null) => void
}) {
  const rows = companyTable(ctx, companies)
  const hasTrack = rows.some((r) => r.track.length > 0)
  const onceWords = ctx.flow.lanes.find((l) => l.lane === 'once') ? 'Once' : null
  if (!rows.length) return <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Nobody is on this flow yet.</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th style={th}>Company</th>
            {hasTrack && onceWords && <th style={th}>{onceWords}</th>}
            <th style={th}>On now</th>
            <th style={th}>Per job</th>
            <th style={th}>Portal</th>
            <th style={th} aria-label="Open" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = portal(r.contactId)
            return (
              <tr key={r.contactId} data-board-company={r.contactId}>
                <td style={td}>
                  <b>{r.name}</b>
                  {r.sub && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{r.sub}</div>}
                </td>
                {hasTrack && onceWords && (
                  <td style={td}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      {r.track.map((t, i) => (
                        <span key={t.stepId} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          {i > 0 && <span style={{ width: 10, height: 2, background: t.mark === 'done' || t.mark === 'lapsed' ? 'var(--text-green-700)' : 'var(--border-400)' }} />}
                          <span title={`${t.name}: ${MARK_WORDS[t.mark]}`} aria-label={`${t.name}: ${MARK_WORDS[t.mark]}`} style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid', boxSizing: 'border-box', ...MARK[t.mark] }} />
                        </span>
                      ))}
                    </span>
                  </td>
                )}
                <td style={td}>
                  {r.now.tone === 'lapsed' ? (
                    <span style={{ color: 'var(--text-orange-700)', fontWeight: 600 }}>
                      {r.now.name} · {r.now.small.join(' · ')}
                    </span>
                  ) : (
                    <>
                      {r.now.name || '—'}
                      <div style={{ color: r.now.tone === 'over' ? 'var(--text-orange-700)' : 'var(--text-muted)', fontSize: '0.75rem' }}>{r.now.small.join(' · ')}</div>
                    </>
                  )}
                </td>
                <td style={td}>
                  {r.jobs.length ? (
                    r.jobs.map((j) => (
                      <div key={j.jobId} style={{ color: j.ended ? 'var(--text-muted)' : j.lateDays ? 'var(--text-red-700)' : undefined }}>
                        {j.name} · {j.words}
                      </div>
                    ))
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </td>
                <td style={{ ...td, color: p === 'never' ? 'var(--text-muted)' : undefined }}>{p}</td>
                <td style={td}>
                  <button
                    type="button"
                    onClick={() => onOpen(r.contactId, r.now.stepId)}
                    style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 8, padding: '0.2rem 0.6rem', cursor: 'pointer', font: 'inherit', fontSize: '0.8rem', color: 'inherit' }}
                  >
                    Open
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
