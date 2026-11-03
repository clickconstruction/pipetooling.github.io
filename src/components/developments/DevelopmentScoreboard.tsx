/**
 * The Scoreboard, the Money look's second view (v2.6407, punch list #250). One grid: the site's
 * flag block over the Job column and the nine tiles with the site's totals as the column heads; a
 * row per job, folded to Earned · Cost · Profit, opened to the nine; the jobs with nothing on them
 * folded under one line; the foot the site again. A tile press sorts. Green tiles are effort, red
 * what it cost, gold the money; a job's number is the page's JobChip with the Pipeline's status dot.
 * On a phone the rows are cards and an open card shows the nine as a labelled grid. Draws what
 * `lib/developments/scoreboard.ts` built; reads nothing.
 */
import { useState, type CSSProperties, type ReactNode } from 'react'
import { EmptyState } from '../EmptyState'
import { jobsLedgerStatusDotColor, labelJobsLedgerStatus } from '../../lib/jobsLedgerStatusPipeline'
import {
  SCOREBOARD_FLAG_WORDS,
  scoreboardCellStands,
  scoreboardCellWords,
  scoreboardFoldWords,
  scoreboardFoldedKeys,
  scoreboardPctOf,
  scoreboardWorkWords,
  type ScoreboardColumn,
  type ScoreboardColumnKey,
  type ScoreboardJob,
  type ScoreboardModel,
  type ScoreboardReads,
} from '../../lib/developments/scoreboard'
import { capStyle, LinkButton } from './developmentPageBits'
import { JobChip } from './JobChip'

export type DevelopmentScoreboardProps = {
  model: ScoreboardModel
  columns: ReadonlyArray<ScoreboardColumn>
  phone: boolean
  onSort: (key: ScoreboardColumnKey) => void
  openJob: (jobId: string) => void
  /** The flag block: the development's name, the line under it, and the small line. */
  head: { name: string; line: string; small: string | null }
}

/** The three groups' solid tiles: saturated colours stay literal, white glyphs on them (the mock-up's pick). */
const TILE_FILL: Record<ScoreboardColumn['group'], string> = { effort: '#15803d', cost: '#b91c1c', money: '#b45309' }

const num: CSSProperties = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right' }
const cellPad: CSSProperties = { padding: '0 6px', height: 30, borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }

function Tile({ col, value, small, sorted, desc, onSort }: { col: ScoreboardColumn; value: string; small: ReactNode; sorted: boolean; desc: boolean; onSort: () => void }) {
  return (
    <button
      type="button"
      onClick={onSort}
      title={`${col.title}. Press to sort by ${col.label.toLowerCase()}${sorted ? (desc ? ', smallest first' : ', biggest first') : ''}`}
      aria-pressed={sorted}
      data-testid={`scoreboard-tile-${col.key}`}
      style={{ display: 'grid', justifyItems: 'center', gap: 2, width: '100%', border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit' }}
    >
      <span aria-hidden style={{ width: '100%', maxWidth: 54, height: 34, borderRadius: 7, display: 'grid', placeItems: 'center', fontSize: 17, fontWeight: 700, color: 'white', background: TILE_FILL[col.group], boxShadow: sorted ? '0 0 0 2px var(--surface), 0 0 0 4px var(--border-strong)' : undefined }}>
        {col.glyph}
      </span>
      <span style={{ ...num, textAlign: 'center', fontWeight: 800, color: 'var(--text-strong)', fontSize: '0.86rem', lineHeight: 1.1, marginTop: 2 }}>{value}</span>
      {small ? <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', lineHeight: 1.2, textAlign: 'center' }}>{small}</span> : null}
      <span style={{ ...capStyle, fontSize: '0.62rem', lineHeight: 1.2 }}>
        {col.label}
        {sorted ? <span aria-hidden> {desc ? '▾' : '▴'}</span> : null}
      </span>
    </button>
  )
}

/** A figure for a cell, or what stands in for it while its read is out: … reading, *not read* failed, nothing when the role does not read it. */
function Cell({ col, row, reads, open }: { col: ScoreboardColumn; row: ScoreboardJob; reads: ScoreboardReads; open: boolean }) {
  const stands = scoreboardCellStands(col.key, reads)
  const firstMoney = col.key === 'earned' ? { borderLeft: '1px solid var(--border)' } : undefined
  const style: CSSProperties = { ...cellPad, ...num, ...firstMoney }
  if (stands === 'off') return <td style={style} />
  if (stands === 'reading') return <td style={{ ...style, color: 'var(--text-faint)' }} title="Still reading">…</td>
  if (stands === 'failed')
    return (
      <td style={{ ...style, color: 'var(--text-faint)', fontSize: '0.72rem' }} title="A source would not read; the Job window has the figure">
        not read
      </td>
    )
  const v = row.m[col.key]
  const words = scoreboardCellWords(col.key, v)
  const pc: CSSProperties = { fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: 4 }
  if (col.key === 'profit') {
    if (row.flags.includes('assumed-50'))
      return (
        <td style={{ ...style, color: 'var(--text-faint)' }} title="Half the price counted, nothing spent: not a profit yet">
          {words}
          <span style={pc}>≈</span>
        </td>
      )
    const tone = v < 0 ? 'var(--text-red-700)' : v > 0 ? 'var(--text-green-700)' : undefined
    return (
      <td style={{ ...style, color: tone, fontWeight: tone ? 700 : undefined }}>
        {words}
        <span style={pc}>{scoreboardPctOf(v, row.m.earned)}</span>
      </td>
    )
  }
  if (col.key === 'earned') {
    const note = row.flags.includes('assumed-50') ? '≈ 50%' : row.pct != null && !row.finished ? `${row.pct}%` : null
    return (
      <td style={style} title={row.flags.includes('assumed-50') ? SCOREBOARD_FLAG_WORDS['assumed-50'].title : undefined}>
        {words}
        {note ? <span style={pc}>{note}</span> : null}
      </td>
    )
  }
  return (
    <td style={{ ...style, fontWeight: open ? 700 : undefined }}>
      {words}
    </td>
  )
}

function StatusDot({ row }: { row: ScoreboardJob }) {
  if (!row.status) return null
  return <span aria-hidden title={labelJobsLedgerStatus(row.status)} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9999, background: jobsLedgerStatusDotColor(row.status), flex: 'none' }} />
}

function stateWords(row: ScoreboardJob): string {
  const status = row.status ? labelJobsLedgerStatus(row.status).toLowerCase() : ''
  return row.status === 'working' && row.pct != null ? `${status} · ${row.pct}%` : status
}

function Flags({ row }: { row: ScoreboardJob }) {
  const shown = row.flags.filter((f) => f !== 'no-pct' || !row.flags.includes('assumed-50'))
  return (
    <>
      {shown.map((f) => {
        const w = SCOREBOARD_FLAG_WORDS[f]
        const tone = f === 'no-price' ? { background: 'var(--bg-red-100)', color: 'var(--text-red-800)' } : f === 'materials-only' ? { background: 'var(--bg-muted)', color: 'var(--text-700)' } : { background: 'var(--bg-amber-100)', color: 'var(--text-amber-900)' }
        return (
          <span key={f} title={w.title} style={{ ...tone, display: 'inline-block', padding: '0 6px', borderRadius: 9999, fontSize: '0.64rem', fontWeight: 700, lineHeight: '16px', whiteSpace: 'nowrap' }}>
            {w.label}
          </span>
        )
      })}
    </>
  )
}

function JobName({ row, open, onToggle, openJob }: { row: ScoreboardJob; open: boolean; onToggle: () => void; openJob: () => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, maxWidth: '100%', minWidth: 0 }}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-label={open ? `Fold ${row.label} to three figures` : `Open ${row.label}'s nine figures`} title={open ? 'Fold to the three' : 'Open the nine'} data-testid={`scoreboard-open-${row.jobId}`} style={{ border: 'none', background: 'none', padding: 0, width: 14, color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.6rem' }}>
        <span aria-hidden>{open ? '▼' : '▶'}</span>
      </button>
      <StatusDot row={row} />
      <JobChip jobId={row.jobId} onOpen={openJob} strong nowrap>
        {row.label}
      </JobChip>
      <span style={{ fontWeight: 600, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={row.name}>
        {row.name}
      </span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{stateWords(row)}</span>
      <Flags row={row} />
    </span>
  )
}

export function DevelopmentScoreboard({ model, columns, phone, onSort, openJob, head }: DevelopmentScoreboardProps) {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set())
  const [showEmpties, setShowEmpties] = useState(false)
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const folded = scoreboardFoldedKeys(columns)
  const total = model.rows.length + model.empties.length
  if (total === 0) {
    return <EmptyState main="No job on this site yet." next={{ label: 'Bid Board', to: '/bids' }} tail="makes a job from a won bid, and the board fills from it." compact />
  }
  const tileSmall = (col: ScoreboardColumn): ReactNode => {
    if (col.key === 'profit') {
      const work = scoreboardWorkWords(model.work)
      return (
        <>
          {scoreboardPctOf(model.site.profit, model.site.earned)} of earned
          {work ? (
            <>
              <br />
              <span title="Materials-only jobs set aside">{work}</span>
            </>
          ) : null}
        </>
      )
    }
    if (col.key === 'days') return 'each counted once'
    if (col.key === 'earned') return `${model.rows.length} ${model.rows.length === 1 ? 'job' : 'jobs'} with money`
    return null
  }
  const tileValue = (col: ScoreboardColumn): string => {
    const stands = scoreboardCellStands(col.key, model.reads)
    if (stands === 'reading') return '…'
    if (stands === 'failed') return 'not read'
    return scoreboardCellWords(col.key, model.site[col.key])
  }
  const emptiesLine = (
    <span style={{ color: 'var(--text-muted)' }} data-testid="scoreboard-fold">
      {scoreboardFoldWords(model.empties.length)} ·{' '}
      <LinkButton onClick={() => setShowEmpties((v) => !v)} title={showEmpties ? 'Fold the jobs with nothing on them' : 'Show the jobs with nothing on them yet'}>
        {showEmpties ? 'Hide them' : 'Show them'}
      </LinkButton>
    </span>
  )
  const legend = (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)', paddingTop: 6 }}>
      {(['effort', 'cost', 'money'] as const).map((g) => (
        <span key={g}>
          <i aria-hidden style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 5, verticalAlign: -1, background: TILE_FILL[g] }} />
          {g === 'effort' ? 'effort' : g === 'cost' ? 'what it cost' : 'the money'}
        </span>
      ))}
      <span>the dot is the job’s status, as on the Pipeline</span>
      <span>press a tile to sort</span>
    </div>
  )

  if (phone) {
    const three = columns.filter((c) => folded.has(c.key))
    const card = (row: ScoreboardJob) => {
      const open = openIds.has(row.jobId)
      const cols = open ? columns : three
      return (
        <div key={row.jobId} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: open ? 'var(--bg-subtle)' : 'var(--surface)' }} data-testid={`scoreboard-card-${row.jobId}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <StatusDot row={row} />
            <JobChip jobId={row.jobId} onOpen={() => openJob(row.jobId)} strong nowrap>
              {row.label}
            </JobChip>
            <span style={{ fontWeight: 600, color: 'var(--text-strong)', flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
            <button type="button" onClick={() => toggle(row.jobId)} aria-expanded={open} aria-label={open ? `Fold ${row.label} to three figures` : `Open ${row.label}'s nine figures`} data-testid={`scoreboard-open-${row.jobId}`} style={{ border: 'none', background: 'none', padding: '0 2px', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.6rem' }}>
              <span aria-hidden>{open ? '▼' : '▶'}</span>
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
            <span>{stateWords(row)}</span>
            <Flags row={row} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginTop: 8 }}>
            {cols.map((c) => {
              const stands = scoreboardCellStands(c.key, model.reads)
              const v = row.m[c.key]
              const words = stands === 'stands' ? scoreboardCellWords(c.key, v) : stands === 'reading' ? '…' : stands === 'failed' ? 'not read' : ''
              const tone = c.key === 'profit' && stands === 'stands' ? (v < 0 ? 'var(--text-red-700)' : v > 0 ? 'var(--text-green-700)' : undefined) : undefined
              return (
                <div key={c.key} style={{ padding: '5px 6px', borderRadius: 6, background: 'var(--surface)', borderTop: `3px solid ${TILE_FILL[c.group]}` }}>
                  <span style={{ ...capStyle, display: 'block', fontSize: '0.6rem' }}>{c.label}</span>
                  <b style={{ ...num, display: 'block', textAlign: 'left', fontSize: '0.8rem', color: tone ?? 'var(--text-strong)' }}>{words}</b>
                  {c.key === 'profit' && stands === 'stands' ? <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{scoreboardPctOf(v, row.m.earned)}</span> : null}
                  {c.key === 'earned' && row.pct != null && !row.finished ? <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{row.pct}% done</span> : null}
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    return (
      <div style={{ display: 'grid', gap: 8 }} data-testid="scoreboard-phone">
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--surface)' }}>
          <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-strong)' }}>{head.name}</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{head.line}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 8 }}>
            {three.map((c) => (
              <div key={c.key} style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 7, background: 'var(--bg-subtle)', borderTop: `3px solid ${TILE_FILL[c.group]}` }}>
                <b style={{ ...num, display: 'block', textAlign: 'center', fontSize: '0.88rem', color: 'var(--text-strong)' }}>{tileValue(c)}</b>
                <span style={{ ...capStyle, fontSize: '0.6rem' }}>{c.label}</span>
                {c.key === 'profit' ? <span style={{ display: 'block', fontSize: '0.64rem', color: 'var(--text-muted)' }}>{tileSmall(c)}</span> : null}
              </div>
            ))}
          </div>
          {head.small ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>{head.small}</div> : null}
        </div>
        {model.rows.map(card)}
        {model.empties.length ? <div style={{ textAlign: 'center', fontSize: '0.78rem', padding: 4 }}>{emptiesLine}</div> : null}
        {showEmpties ? model.empties.map(card) : null}
      </div>
    )
  }

  const th: CSSProperties = { padding: '10px 4px 8px', borderBottom: '2px solid var(--border-strong)', verticalAlign: 'top', background: 'var(--bg-subtle)' }
  const row = (r: ScoreboardJob) => {
    const open = openIds.has(r.jobId)
    return (
      <tr key={r.jobId} data-testid={`scoreboard-row-${r.jobId}`} style={{ background: open ? 'var(--bg-subtle)' : undefined }}>
        <td style={{ ...cellPad, textAlign: 'left', paddingLeft: 10, overflow: 'hidden', fontWeight: open ? 700 : undefined }}>
          <JobName row={r} open={open} onToggle={() => toggle(r.jobId)} openJob={() => openJob(r.jobId)} />
        </td>
        {columns.map((c) => (open || folded.has(c.key) ? <Cell key={c.key} col={c} row={r} reads={model.reads} open={open} /> : <td key={c.key} style={{ ...cellPad, borderLeft: c.key === 'earned' ? '1px solid var(--border)' : undefined }} />))}
      </tr>
    )
  }
  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', tableLayout: 'fixed' }} data-testid="scoreboard-table">
        <colgroup>
          <col style={{ width: columns.length > 3 ? '31%' : '46%' }} />
          {columns.map((c) => (
            <col key={c.key} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left', paddingLeft: 14, verticalAlign: 'middle', fontWeight: 400 }}>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-strong)', lineHeight: 1.15 }}>{head.name}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'normal' }}>{head.line}</div>
              {head.small ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'normal', marginTop: 4 }}>{head.small}</div> : null}
            </th>
            {columns.map((c) => (
              <th key={c.key} style={{ ...th, borderLeft: c.key === 'earned' ? '1px solid var(--border)' : undefined }} aria-sort={model.sort.key === c.key ? (model.sort.desc ? 'descending' : 'ascending') : undefined}>
                <Tile col={c} value={tileValue(c)} small={tileSmall(c)} sorted={model.sort.key === c.key} desc={model.sort.desc} onSort={() => onSort(c.key)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.rows.map(row)}
          {model.empties.length ? (
            <tr data-testid="scoreboard-fold-row">
              <td style={{ ...cellPad, textAlign: 'left', paddingLeft: 10 }}>{emptiesLine}</td>
              {columns.map((c) => (
                <td key={c.key} style={{ ...cellPad, ...num, color: 'var(--text-muted)', borderLeft: c.key === 'earned' ? '1px solid var(--border)' : undefined }}>
                  {folded.has(c.key) ? '0' : ''}
                </td>
              ))}
            </tr>
          ) : null}
          {showEmpties ? model.empties.map(row) : null}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ ...cellPad, textAlign: 'left', paddingLeft: 10, fontWeight: 800, color: 'var(--text-strong)', borderTop: '2px solid var(--border-strong)', background: 'var(--bg-subtle)', height: 32 }}>The site · {total} {total === 1 ? 'job' : 'jobs'}</td>
            {columns.map((c) => (
              <td key={c.key} style={{ ...cellPad, ...num, fontWeight: 800, color: 'var(--text-strong)', borderTop: '2px solid var(--border-strong)', background: 'var(--bg-subtle)', height: 32, borderLeft: c.key === 'earned' ? '1px solid var(--border)' : undefined }}>
                {tileValue(c)}
                {c.key === 'profit' && scoreboardCellStands('profit', model.reads) === 'stands' ? <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: 4 }}>{scoreboardPctOf(model.site.profit, model.site.earned)}</span> : null}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      {legend}
    </div>
  )
}
