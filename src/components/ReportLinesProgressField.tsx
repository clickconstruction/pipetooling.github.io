import { useState, type CSSProperties, type ReactNode } from 'react'
import { stagePickerNumber, type StageProgressRow } from '../lib/reports/stageProgressReport'
import { StagePctControl } from './reports/StagePctControl'
import {
  LINES_HINT,
  LINES_QUESTION,
  WHOLE_JOB_LINK,
  howRows,
  jobLine,
  linePct,
  lineWords,
  type LinePicks,
  type LineWordsTone,
} from '../lib/reports/lineProgressReport'

/**
 * Report by line (punch list #130, v2.5663): the percent field on a job with
 * two or more priced lines. The lines in plan order, every one in view with its
 * own number on the right, one open at a time, and the job's number once under
 * the list — derived by the host from the lines' shares, never a price on the
 * screen. The arithmetic waits behind "how?". Since punch list #189, PR 5a, the
 * open row takes the precise-number control (`StagePctControl`: quick picks at
 * 48 px, −5 and +5 at 56 px, or a typed number) in place of the 33 px chips and
 * the slider, and a row nobody has reported reads *not started*. The host owns
 * the picks; this component only draws.
 */

const ROW_GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '26px 1fr auto',
  gap: '0.6rem',
  alignItems: 'center',
  width: '100%',
  padding: '0.55rem 0.7rem',
  textAlign: 'left',
  font: 'inherit',
  color: 'inherit',
  border: 'none',
  background: 'transparent',
  boxSizing: 'border-box',
}

function toneColor(tone: LineWordsTone, open: boolean): string {
  if (tone === 'paid' || tone === 'done' || tone === 'up') return 'var(--text-green-800)'
  if (tone === 'down') return 'var(--text-amber-800)'
  if (open) return 'var(--text-blue-700)'
  return 'var(--text-muted)'
}

export function ReportLinesProgressField({
  rows,
  picks,
  openId,
  onOpen,
  onPct,
  recordedPct,
  onSwitchToWholeJob,
  rowFoot,
}: {
  rows: StageProgressRow[]
  picks: LinePicks
  openId: string | null
  onOpen: (fixtureId: string | null) => void
  onPct: (fixtureId: string, pct: number) => void
  /** The job's number on record, for the job line's "was". */
  recordedPct?: number | null
  /** When given, the link under the job line that brings the whole-job slider back. */
  onSwitchToWholeJob?: () => void
  /** Drawn at the foot of every row, open or not: the photos on the stage and its camera (punch list #189, PR 5b). */
  rowFoot?: (row: StageProgressRow) => ReactNode
}) {
  const [showHow, setShowHow] = useState(false)
  const job = jobLine(rows, picks, recordedPct)
  const how = showHow ? howRows(rows, picks) : null

  return (
    <div style={{ marginBottom: '0.75rem', width: '100%' }} data-testid="report-lines-progress">
      <div style={{ fontWeight: 500, lineHeight: 1.3, marginBottom: 2 }}>{LINES_QUESTION}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>{LINES_HINT}</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
        {rows.map((r, idx) => {
          const open = r.fixtureId === openId && !r.drawPaid
          const words = lineWords(r, picks)
          const done = r.drawPaid || linePct(r, picks) >= 100
          const pct = linePct(r, picks)
          const sub = r.drawPaid ? 'paid' : r.kind === 'any' ? 'any time' : null
          const rowStyle: CSSProperties = {
            ...ROW_GRID,
            borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
            background: open ? 'var(--bg-blue-tint)' : 'transparent',
            cursor: r.drawPaid ? 'default' : 'pointer',
          }
          const inner = (
            <>
              <span
                aria-hidden
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: open ? '#2563eb' : done ? 'var(--bg-green-tint)' : 'var(--bg-muted)',
                  color: open ? '#fff' : done ? 'var(--text-green-800)' : 'var(--text-muted)',
                }}
              >
                {stagePickerNumber(rows, r)}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                {sub ? <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub}</span> : null}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', color: toneColor(words.tone, open) }}>
                {words.text}
                {!r.drawPaid ? (
                  <span aria-hidden style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {open ? '⌃' : '⌄'}
                  </span>
                ) : null}
              </span>
            </>
          )
          return (
            <div key={r.fixtureId}>
              {r.drawPaid ? (
                <div style={rowStyle} aria-label={`${r.name}: ${words.text}`}>
                  {inner}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpen(open ? null : r.fixtureId)}
                  aria-expanded={open}
                  aria-label={`${r.name}: ${words.text}`}
                  style={rowStyle}
                >
                  {inner}
                </button>
              )}
              {open ? (
                <div style={{ padding: '0.25rem 0.7rem 0.7rem', background: 'var(--bg-blue-tint)' }}>
                  <StagePctControl name={r.name} value={pct} onChange={(p) => onPct(r.fixtureId, p)} />
                </div>
              ) : null}
              {rowFoot ? rowFoot(r) : null}
            </div>
          )
        })}
      </div>

      <div
        data-testid="report-lines-job"
        style={{
          marginTop: '0.6rem',
          padding: '0.6rem 0.7rem',
          borderRadius: 8,
          background: job.moved ? 'var(--bg-green-tint)' : 'var(--bg-subtle)',
          border: job.moved ? '1px solid var(--border-green)' : '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <div style={{ fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ fontSize: '1.15rem', fontWeight: 700, color: job.moved ? 'var(--text-green-800)' : 'inherit' }}>
            {job.moved ? `Job ${job.before}% → ${job.after}%` : `Job ${job.before}%`}
          </span>
          <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{job.moved ? `was ${job.before}%` : 'nothing moved yet'}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowHow((v) => !v)}
          aria-expanded={showHow}
          style={{ padding: 0, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          how?
        </button>
      </div>

      {how ? (
        <div data-testid="report-lines-how" style={{ marginTop: '0.4rem', padding: '0.5rem 0.7rem', borderRadius: 8, border: '1px dashed var(--border)', fontSize: '0.75rem', color: 'var(--text-700)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {how.rows.map((h) => (
                <tr key={h.fixtureId}>
                  <td style={{ padding: '2px 0' }}>{h.name}</td>
                  <td style={{ padding: '2px 0', textAlign: 'right', color: 'var(--text-muted)' }}>{`${h.sharePct}% of the job · ${h.standing}`}</td>
                  <td style={{ padding: '2px 0 2px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{h.points}</td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: '2px 0', borderTop: '1px solid var(--border)', fontWeight: 700 }}>Job</td>
                <td style={{ borderTop: '1px solid var(--border)' }} />
                <td style={{ padding: '2px 0 2px 10px', borderTop: '1px solid var(--border)', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{`${how.total}%`}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      {onSwitchToWholeJob ? (
        <button
          type="button"
          onClick={onSwitchToWholeJob}
          style={{ marginTop: 6, padding: 0, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.75rem', fontWeight: 600 }}
        >
          {WHOLE_JOB_LINK}
        </button>
      ) : null}
    </div>
  )
}
