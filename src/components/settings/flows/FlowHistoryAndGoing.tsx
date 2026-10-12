/**
 * Settings → Flows' History and How it is going (the prototype's History tab and `goingHtml`, v1.102 to v1.178).
 * History: every change with its person and day, the flow's first line from the seed at the bottom, and Removed, each
 * removed step with Put it back. How it is going: this quarter's funnel through the per-job lane, then one row per
 * step: on it now, the usual, the longest on it now, done this quarter, and where it sticks.
 */
import type { CSSProperties } from 'react'
import { drawnEntry, historyLines, removedLines, type FlowDraft, type FlowHistoryEntry } from '../../../lib/flows/editor'
import { sticksWords, type Funnel, type GoingRow } from '../../../lib/flows/going'
import { flowHead, flowNote, flowQuiet } from './flowStyles'

const line: CSSProperties = { fontSize: '0.85rem', padding: '0.3rem 0', borderTop: '1px solid var(--border)' }

export function FlowHistory({
  draft,
  history,
  drawnAt,
  onPutBack,
}: {
  draft: FlowDraft
  history: readonly FlowHistoryEntry[]
  drawnAt: string | null
  onPutBack: (stepId: string) => void
}) {
  const lines = historyLines(history)
  const drawn = drawnAt ? historyLines([drawnEntry(draft.saved.flow, 'PipeTooling', drawnAt)])[0] : null
  const removed = removedLines(draft.removed)
  return (
    <div style={{ display: 'grid', gap: '0.4rem' }} data-flow-history>
      <h3 style={{ margin: '0.6rem 0 0.2rem', fontSize: '1rem' }}>Every change, with its person and day</h3>
      {lines.length || drawn ? (
        <div>
          {lines.map((l, i) => (
            <div key={i} style={line}>
              {l}
            </div>
          ))}
          {drawn && <div style={{ ...line, color: 'var(--text-muted)' }}>{drawn}</div>}
        </div>
      ) : (
        <p style={flowNote}>Nothing yet.</p>
      )}
      <h3 style={{ margin: '0.8rem 0 0.2rem', fontSize: '1rem' }}>Removed</h3>
      {removed.length ? (
        <div>
          {draft.removed.map((r, i) => (
            <div key={r.step.id} style={{ ...line, display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span>{removed[i]}</span>
              <button type="button" onClick={() => onPutBack(r.step.id)} style={flowQuiet}>
                Put it back
              </button>
            </div>
          ))}
          <p style={{ ...flowNote, marginTop: '0.3rem' }}>A step put back goes at the end of its lane, and comes back on Save.</p>
        </div>
      ) : (
        <p style={flowNote}>Nothing removed.</p>
      )}
    </div>
  )
}

const cell: CSSProperties = { padding: '0.35rem 0.5rem', borderTop: '1px solid var(--border)', fontSize: '0.85rem', textAlign: 'left' }
const head: CSSProperties = { ...flowHead, padding: '0.3rem 0.5rem', textAlign: 'left' }
const toneColor: Readonly<Record<string, string>> = { late: 'var(--text-red-600)', lapsed: 'var(--text-red-600)', over: 'var(--text-orange-700)', wait: 'var(--text-muted)', '': 'var(--text-base)' }

export function FlowGoing({ rows, funnel }: { rows: readonly GoingRow[]; funnel: Funnel | null }) {
  return (
    <div style={{ display: 'grid', gap: '0.6rem' }} data-flow-going>
      <p style={{ ...flowNote, marginTop: '0.5rem' }}>
        This quarter. The funnel counts each job’s run through the per-job lane, and the ones that fell out. The table has one row per step: on it now,
        the usual, the longest on it now, done this quarter, and where it sticks.
      </p>
      {funnel && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }} aria-label="The funnel">
          {funnel.stages.map((s, i) => (
            <div key={s.label} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              {i > 0 && s.pctOfPrev != null && <span style={{ ...flowNote, paddingBottom: '0.4rem' }}>→ {s.pctOfPrev}%</span>}
              <div style={{ display: 'grid', justifyItems: 'center', gap: '0.15rem', minWidth: 64 }}>
                <div
                  style={{
                    width: 40,
                    height: Math.max(12, Math.round((64 * s.n) / Math.max(1, funnel.stages[0]?.n ?? 1))),
                    background: 'var(--bg-blue-tint)',
                    border: '1px solid var(--border-blue)',
                    borderRadius: 4,
                  }}
                />
                <strong>{s.n}</strong>
                <span style={{ ...flowNote, fontSize: '0.78rem' }}>{s.label}</span>
              </div>
            </div>
          ))}
          {funnel.out && (
            <div style={{ display: 'grid', justifyItems: 'center', gap: '0.15rem', minWidth: 64 }}>
              <div style={{ width: 40, height: 12, background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 4 }} />
              <strong>{funnel.out.n}</strong>
              <span style={{ ...flowNote, fontSize: '0.78rem' }}>{funnel.out.label}</span>
            </div>
          )}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={head}>Step</th>
              <th style={head}>On it now</th>
              <th style={head}>Usual</th>
              <th style={head}>Longest now</th>
              <th style={head}>Done this quarter</th>
              <th style={head}>Where it sticks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.stepId} data-going-step={r.stepId}>
                <td style={cell}>{r.name}</td>
                <td style={cell}>{r.onItNow}</td>
                <td style={cell}>{r.usual != null ? `${r.usual} d` : '—'}</td>
                <td style={{ ...cell, color: r.longest ? toneColor[r.longest.tone] : undefined }}>{r.longest ? `${r.longest.name} · ${r.longest.days} d` : '—'}</td>
                <td style={cell}>{r.doneThisQuarter}</td>
                <td style={cell}>{r.sticks ? sticksWords(r.sticks) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
