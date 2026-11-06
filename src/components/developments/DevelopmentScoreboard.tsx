/**
 * The Scoreboard, the Money look's second view (v2.6407, punch list #250). One grid: the site's
 * flag block over the Job column and the nine tiles with the site's totals as the column heads; a
 * row per job, folded to Earned · Cost · Profit, opened to the nine; the jobs with nothing on them
 * folded under one line; the foot the site again. A tile press sorts. Green tiles are effort, red
 * what it cost, gold the money; a job's number is the page's JobChip with the Pipeline's status dot.
 * On a phone the rows are cards and an open card shows the nine as a labelled grid. *Cut by* and *Window*
 * (v2.6558, PR 4) sit above the board: the cut by part of the site draws each part as a row that opens to
 * its jobs, the cut by person each person as a row that opens to their jobs with their share of earned
 * (≈); the window cuts every figure to its days. Draws what `lib/developments/scoreboard.ts` and
 * `scoreboardCuts.ts` built; reads nothing.
 */
import { Fragment, useLayoutEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { EmptyState } from '../EmptyState'
import { jobsLedgerStatusDotColor, labelJobsLedgerStatus } from '../../lib/jobsLedgerStatusPipeline'
import {
  SCOREBOARD_FLAG_WORDS,
  SCOREBOARD_MEMBER_ROLE,
  scoreboardNoMembersWords,
  scoreboardPendingWords,
  scoreboardCellStands,
  scoreboardCellWords,
  scoreboardCompactWords,
  SCOREBOARD_COMPACT_QUERY,
  SCOREBOARD_NARROW_BELOW_PX,
  scoreboardColumnWidths,
  scoreboardFoldWords,
  scoreboardFoldedKeys,
  scoreboardHeadline,
  scoreboardPctOf,
  scoreboardWorkWords,
  type ScoreboardColumn,
  type ScoreboardColumnKey,
  type ScoreboardHeadline,
  type ScoreboardJob,
  type ScoreboardMember,
  type ScoreboardMembers,
  type ScoreboardModel,
  type ScoreboardReads,
} from '../../lib/developments/scoreboard'
import {
  personJobsWords,
  SCOREBOARD_CUTS,
  SCOREBOARD_PERSON_EARNED_TITLE,
  SCOREBOARD_PERSON_NOTE,
  SCOREBOARD_WINDOW_NOTE,
  SCOREBOARD_WINDOWS,
  scoreboardWindowWords,
  type ScoreboardCut,
  type ScoreboardPartGroup,
  type ScoreboardPersonMeasures,
  type ScoreboardPersonRow,
  type ScoreboardWindowKey,
} from '../../lib/developments/scoreboardCuts'
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
  /**
   * The cost summary print (v2.6534): the press under the board for a dev or a controller, and the note the last
   * press left (the costs still reading, the window blocked). Null for a reader the costs are closed to.
   */
  print?: { onPress: () => void; note: string | null } | null
  /** The rows under an open job (v2.6457): who put what in. Absent, an open job shows its nine alone. */
  membersOf?: (row: ScoreboardJob) => ScoreboardMembers
  /** The cuts and the window (v2.6558, punch list #250 PR 4). Absent, the board by job over the site's whole life, with no chips. */
  cuts?: {
    cut: ScoreboardCut
    onCut: (cut: ScoreboardCut) => void
    window: ScoreboardWindowKey
    onWindow: (key: ScoreboardWindowKey) => void
    /** The window chips need the clock's days; a read without them (the man-hours fallback) offers no window. */
    windowOffered: boolean
    /** The parts with their jobs, when the cut is by part. */
    parts: ReadonlyArray<ScoreboardPartGroup> | null
    /** The people with their jobs, when the cut is by person. */
    people: ReadonlyArray<ScoreboardPersonRow> | null
  }
}

/** The three groups' solid tiles: saturated colours stay literal, white glyphs on them (the mock-up's pick). */
const TILE_FILL: Record<ScoreboardColumn['group'], string> = { effort: '#15803d', cost: '#b91c1c', money: '#b45309' }

/** How a cell writes a figure: whole dollars, or the short words when the columns are narrow. */
type Fmt = (key: ScoreboardColumnKey, value: number) => string

const num: CSSProperties = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right' }
const cellPad: CSSProperties = { padding: '0 6px', height: 30, borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
/** The percent beside a Profit figure, a job's and the site's. */
const pc: CSSProperties = { fontSize: '0.64rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: 3 }

function Tile({ col, value, small, sorted, desc, onSort, narrow = false }: { col: ScoreboardColumn; value: string; small: ReactNode; sorted: boolean; desc: boolean; onSort: () => void; narrow?: boolean }) {
  return (
    <button
      type="button"
      onClick={onSort}
      title={`${col.title}. Press to sort by ${col.label.toLowerCase()}${sorted ? (desc ? ', smallest first' : ', biggest first') : ''}`}
      aria-pressed={sorted}
      data-testid={`scoreboard-tile-${col.key}`}
      style={{ display: 'grid', justifyItems: 'center', gap: 2, width: '100%', border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit' }}
    >
      <span aria-hidden style={{ width: '100%', maxWidth: narrow ? 42 : 54, height: narrow ? 30 : 34, borderRadius: 7, display: 'grid', placeItems: 'center', fontSize: 17, fontWeight: 700, color: 'white', background: TILE_FILL[col.group], boxShadow: sorted ? '0 0 0 2px var(--surface), 0 0 0 4px var(--border-strong)' : undefined }}>
        {col.glyph}
      </span>
      <span style={{ ...num, textAlign: 'center', fontWeight: 800, color: 'var(--text-strong)', fontSize: narrow ? '0.76rem' : '0.86rem', lineHeight: 1.1, marginTop: 2 }}>{value}</span>
      {small ? <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', lineHeight: 1.2, textAlign: 'center' }}>{small}</span> : null}
      <span style={narrow ? { fontSize: '0.62rem', lineHeight: 1.2, color: 'var(--text-faint)', fontWeight: 700 } : { ...capStyle, fontSize: '0.62rem', lineHeight: 1.2 }}>
        {col.label}
        {sorted ? <span aria-hidden> {desc ? '▾' : '▴'}</span> : null}
      </span>
    </button>
  )
}

/** A figure for a cell, or what stands in for it while its read is out: … reading, *not read* failed, nothing when the role does not read it. */
function Cell({ col, row, reads, open, fmt, narrow }: { col: ScoreboardColumn; row: ScoreboardJob; reads: ScoreboardReads; open: boolean; fmt: Fmt; narrow: boolean }) {
  const stands = scoreboardCellStands(col.key, reads)
  const firstMoney = col.key === 'earned' ? { borderLeft: '1px solid var(--border)' } : undefined
  const style: CSSProperties = { ...cellPad, ...num, ...firstMoney, ...(narrow ? { padding: '0 4px' } : null) }
  if (stands === 'off') return <td style={style} />
  if (stands === 'reading') return <td style={{ ...style, color: 'var(--text-faint)' }} title="Still reading">…</td>
  if (stands === 'failed')
    return (
      <td style={{ ...style, color: 'var(--text-faint)', fontSize: '0.72rem' }} title="A source would not read; the Job window has the figure">
        not read
      </td>
    )
  const v = row.m[col.key]
  const words = fmt(col.key, v)
  const exact = scoreboardCellWords(col.key, v)
  const whole = words !== exact ? exact : undefined
  if (col.key === 'profit') {
    if (row.flags.includes('assumed-50'))
      return (
        <td style={{ ...style, color: 'var(--text-faint)' }} title="Half the price counted, nothing spent: not a profit yet">
          {words}
          {narrow ? null : <span style={pc}>≈</span>}
        </td>
      )
    const tone = v < 0 ? 'var(--text-red-700)' : v > 0 ? 'var(--text-green-700)' : undefined
    const share = scoreboardPctOf(v, row.m.earned)
    return (
      <td style={{ ...style, color: tone, fontWeight: tone ? 700 : undefined }} title={narrow ? `${whole ?? words} · ${share} of earned` : whole}>
        {words}
        {narrow ? null : <span style={pc}>{share}</span>}
      </td>
    )
  }
  if (col.key === 'earned') {
    const note = row.flags.includes('assumed-50') ? (narrow ? '≈' : '≈ 50%') : row.pct != null && !row.finished && !narrow ? `${row.pct}%` : null
    return (
      <td style={style} title={row.flags.includes('assumed-50') ? SCOREBOARD_FLAG_WORDS['assumed-50'].title : whole}>
        {words}
        {note ? <span style={pc}>{note}</span> : null}
      </td>
    )
  }
  return (
    <td style={{ ...style, fontWeight: open ? 700 : undefined }} title={whole}>
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

function Flags({ row, short = false }: { row: ScoreboardJob; short?: boolean }) {
  const shown = row.flags.filter((f) => f !== 'no-pct' || !row.flags.includes('assumed-50'))
  return (
    <>
      {shown.map((f) => {
        const w = SCOREBOARD_FLAG_WORDS[f]
        const label = short && f === 'assumed-50' ? '≈ 50%' : short && f === 'materials-only' ? 'materials' : w.label
        const tone = f === 'no-price' ? { background: 'var(--bg-red-100)', color: 'var(--text-red-800)' } : f === 'materials-only' ? { background: 'var(--bg-muted)', color: 'var(--text-700)' } : { background: 'var(--bg-amber-100)', color: 'var(--text-amber-900)' }
        return (
          <span key={f} title={w.title} style={{ ...tone, display: 'inline-block', padding: '0 6px', borderRadius: 9999, fontSize: '0.64rem', fontWeight: 700, lineHeight: '16px', whiteSpace: 'nowrap' }}>
            {label}
          </span>
        )
      })}
    </>
  )
}

function JobName({ row, open, onToggle, openJob, narrow = false }: { row: ScoreboardJob; open: boolean; onToggle: () => void; openJob: () => void; narrow?: boolean }) {
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
      {narrow ? null : <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{stateWords(row)}</span>}
      <Flags row={row} short={narrow} />
    </span>
  )
}

/** The role tag in the margin: Lead, Crew, Sub, Supplier, Card, Tally, Other, Overhead, Office. */
function RoleTag({ kind, width = 64 }: { kind: ScoreboardMember['kind']; width?: number }) {
  return (
    <span style={{ display: 'inline-block', width, flex: 'none', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '0.6rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-faint)', fontStyle: 'italic' }}>
      {SCOREBOARD_MEMBER_ROLE[kind]}
    </span>
  )
}

/** The match headline under *Right now* (v2.6467, punch list #250 PR 3): one line about the site, its job's number a press that opens the job, as on its row. */
function Headline({ headline, openJob }: { headline: ScoreboardHeadline; openJob: (jobId: string) => void }) {
  return (
    <div data-testid="scoreboard-headline" style={{ marginTop: 6, fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-strong)', lineHeight: 1.35, whiteSpace: 'normal' }}>
      <span style={{ fontSize: '0.6rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-amber-800)', fontWeight: 800, marginRight: 6 }}>Right now</span>
      <JobChip jobId={headline.jobId} onOpen={() => openJob(headline.jobId)} strong nowrap>
        {headline.label}
      </JobChip>
      {headline.after}
    </div>
  )
}

function YouChip() {
  return (
    <span style={{ display: 'inline-block', padding: '0 6px', borderRadius: 9999, background: 'var(--bg-amber-200)', color: 'var(--text-amber-900)', fontSize: '0.6rem', fontWeight: 800, marginLeft: 6, lineHeight: '15px' }} data-testid="scoreboard-you">
      You
    </span>
  )
}

/** A row's share of the job's cost, as a thin bar under its Cost figure. */
function ShareBar({ share, style }: { share: number | null; style?: CSSProperties }) {
  if (share == null) return null
  return (
    <span aria-hidden style={{ display: 'block', height: 3, borderRadius: 2, background: 'var(--bg-200)', overflow: 'hidden', ...style }}>
      <i style={{ display: 'block', height: '100%', width: `${Math.max(1, Math.round(share * 100))}%`, background: 'var(--border-strong)' }} />
    </span>
  )
}

const youRow = (you: boolean): CSSProperties => (you ? { background: 'var(--bg-amber-tint)' } : { background: 'var(--surface)' })

function MemberName({ member, narrow }: { member: ScoreboardMember; narrow: boolean }) {
  const quiet = member.kind === 'overhead'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, maxWidth: '100%', minWidth: 0 }} title={narrow && member.kit ? `${member.name} · ${member.kit}` : undefined}>
      <RoleTag kind={member.kind} width={narrow ? 60 : 64} />
      <span style={{ fontWeight: 600, fontStyle: quiet ? 'italic' : undefined, color: member.you ? 'var(--text-amber-900)' : quiet ? 'var(--text-muted)' : 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={member.name}>
        {member.name}
      </span>
      {member.you ? <YouChip /> : null}
      {member.kit && !narrow ? <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{member.kit}</span> : null}
    </span>
  )
}

/** One row under an open job on the desk: its own cells, and Cost with its share of the job. */
function MemberRow({ member, columns, fmt, narrow }: { member: ScoreboardMember; columns: ReadonlyArray<ScoreboardColumn>; fmt: Fmt; narrow: boolean }) {
  const bg = youRow(member.you)
  const nameCell = (
    <td style={{ ...cellPad, ...bg, height: 28, textAlign: 'left', paddingLeft: narrow ? 14 : 28, overflow: 'hidden', boxShadow: member.you ? 'inset 3px 0 0 var(--bg-amber-200)' : undefined }}>
      <MemberName member={member} narrow={narrow} />
    </td>
  )
  if (member.words != null) {
    return (
      <tr data-testid={`scoreboard-member-${member.key}`} data-you={member.you ? 'true' : undefined}>
        {nameCell}
        <td colSpan={columns.length} style={{ ...cellPad, ...bg, height: 28, color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.74rem' }}>
          {member.words}
        </td>
      </tr>
    )
  }
  return (
    <tr data-testid={`scoreboard-member-${member.key}`} data-you={member.you ? 'true' : undefined}>
      {nameCell}
      {columns.map((c) => {
        const base: CSSProperties = { ...cellPad, ...num, ...bg, height: 28, fontSize: '0.76rem', color: 'var(--text-700)', borderLeft: c.key === 'earned' ? '1px solid var(--border)' : undefined, ...(narrow ? { padding: '0 4px' } : null) }
        if (c.key === 'cost' && member.cost != null) {
          return (
            <td key={c.key} style={{ ...base, position: 'relative' }} title={`${scoreboardCellWords('cost', member.cost)}${member.share != null ? ` · ${Math.round(member.share * 100)}% of the job’s cost` : ''}`}>
              {fmt('cost', member.cost)}
              <ShareBar share={member.share} style={{ position: 'absolute', left: 6, right: 6, bottom: 3 }} />
            </td>
          )
        }
        const v = member.m[c.key as keyof ScoreboardMember['m']]
        return (
          <td key={c.key} style={base}>
            {v == null ? '' : fmt(c.key, v)}
          </td>
        )
      })}
    </tr>
  )
}

/** The figure a member shows on a phone: its cost first, then a person's hours and days. */
function memberFigure(m: ScoreboardMember): string {
  const bits: string[] = []
  if (m.cost != null) bits.push(scoreboardCellWords('cost', m.cost))
  if (m.m.hours != null) bits.push(scoreboardCellWords('hours', m.m.hours))
  if (m.m.days != null) bits.push(scoreboardCellWords('days', m.m.days))
  return bits.join(' · ')
}

/** The rows under an open job in a phone's card, each a line with its share bar. */
function MemberLines({ list, seesCosts }: { list: ScoreboardMembers; seesCosts: boolean }) {
  const words = scoreboardPendingWords(list.pending) ?? (list.members.length === 0 ? scoreboardNoMembersWords(seesCosts) : null)
  return (
    <div style={{ marginTop: 8, borderTop: '1px solid var(--border)' }} data-testid="scoreboard-member-lines">
      {list.members.map((m) => (
        <div
          key={m.key}
          data-testid={`scoreboard-member-${m.key}`}
          data-you={m.you ? 'true' : undefined}
          style={{
            display: 'grid',
            gridTemplateColumns: '58px minmax(0, 1fr) auto',
            columnGap: 8,
            alignItems: 'baseline',
            padding: m.you ? '5px 10px 6px' : '5px 0 6px',
            margin: m.you ? '0 -10px' : undefined,
            borderBottom: '1px solid var(--border)',
            fontSize: '0.74rem',
            ...(m.you ? { background: 'var(--bg-amber-tint)', boxShadow: 'inset 3px 0 0 var(--bg-amber-200)' } : null),
          }}
        >
          <RoleTag kind={m.kind} width={58} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: m.you ? 'var(--text-amber-900)' : 'var(--text-strong)' }} title={m.name}>
            {m.name}
            {m.you ? <YouChip /> : null}
            {m.kit ? <small style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>{m.kit}</small> : null}
          </span>
          <span style={{ ...num, color: 'var(--text-700)' }}>{m.words == null ? memberFigure(m) : ''}</span>
          {m.words != null ? <span style={{ gridColumn: '2 / 4', color: 'var(--text-muted)', fontStyle: 'italic' }}>{m.words}</span> : null}
          {m.share != null ? <ShareBar share={m.share} style={{ gridColumn: '2 / 4', marginTop: 2 }} /> : null}
        </div>
      ))}
      {words ? <div style={{ padding: '6px 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>{words}</div> : null}
    </div>
  )
}

/** One chip in the Cut by or Window row: the Money card's view chips' shape. */
function Chip({ on, label, title, onPress, testId }: { on: boolean; label: string; title: string; onPress: () => void; testId: string }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={on}
      title={title}
      data-testid={testId}
      style={{ border: `1px solid ${on ? 'var(--border-strong)' : 'transparent'}`, borderRadius: 9999, padding: '1px 9px', font: 'inherit', fontSize: '0.74rem', lineHeight: 1.2, cursor: 'pointer', background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--text-strong)' : 'var(--text-700)', fontWeight: on ? 700 : 500, whiteSpace: 'nowrap' }}
    >
      {label}
    </button>
  )
}

/** The Cut by and Window rows above the board (v2.6558), with the window's two days after its chips. */
function CutChips({ cuts, window }: { cuts: NonNullable<DevelopmentScoreboardProps['cuts']>; window: ScoreboardModel['window'] }) {
  const group: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', padding: '2px 4px 2px 8px', borderRadius: 9999, background: 'var(--bg-subtle)' }
  const lead: CSSProperties = { ...capStyle, fontSize: '0.62rem', marginRight: 4 }
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingBottom: 8 }} data-testid="scoreboard-cuts">
      <span style={group} role="group" aria-label="Cut by">
        <span style={lead}>Cut by</span>
        {SCOREBOARD_CUTS.map((c) => (
          <Chip key={c.key} on={cuts.cut === c.key} label={c.label} title={c.title} onPress={() => cuts.onCut(c.key)} testId={`scoreboard-cut-${c.key}`} />
        ))}
      </span>
      {cuts.windowOffered ? (
        <span style={group} role="group" aria-label="Window">
          <span style={lead}>Window</span>
          {SCOREBOARD_WINDOWS.map((w) => (
            <Chip key={w.key} on={cuts.window === w.key} label={w.label} title={`${w.title}: ${SCOREBOARD_WINDOW_NOTE}`} onPress={() => cuts.onWindow(w.key)} testId={`scoreboard-window-${w.key}`} />
          ))}
        </span>
      ) : null}
      {window ? (
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }} title={SCOREBOARD_WINDOW_NOTE} data-testid="scoreboard-window-words">
          {scoreboardWindowWords(window)}
        </span>
      ) : null}
    </div>
  )
}

/** A figure for a group's cell (a part, a person): the sum's words, Profit toned with its percent of earned, the read's standing when it is out. */
function SumCell({ col, value, earned, reads, fmt, narrow, bold = true, title, blank = false }: { col: ScoreboardColumn; value: number; earned: number; reads: ScoreboardReads; fmt: Fmt; narrow: boolean; bold?: boolean; title?: string; blank?: boolean }) {
  const stands = scoreboardCellStands(col.key, reads)
  const style: CSSProperties = { ...cellPad, ...num, borderLeft: col.key === 'earned' ? '1px solid var(--border)' : undefined, fontWeight: bold ? 700 : undefined, ...(narrow ? { padding: '0 4px' } : null) }
  if (blank || stands === 'off') return <td style={style} />
  if (stands === 'reading') return <td style={{ ...style, color: 'var(--text-faint)' }} title="Still reading">…</td>
  if (stands === 'failed')
    return (
      <td style={{ ...style, color: 'var(--text-faint)', fontSize: '0.72rem' }} title="A source would not read">
        not read
      </td>
    )
  const words = fmt(col.key, value)
  const exact = scoreboardCellWords(col.key, value)
  const whole = words !== exact ? exact : undefined
  if (col.key === 'profit') {
    const tone = value < 0 ? 'var(--text-red-700)' : value > 0 ? 'var(--text-green-700)' : undefined
    return (
      <td style={{ ...style, color: tone }} title={title ?? whole}>
        {words}
        {narrow ? null : <span style={pc}>{scoreboardPctOf(value, earned)}</span>}
      </td>
    )
  }
  return (
    <td style={style} title={title ?? whole}>
      {words}
      {col.key === 'earned' && title ? <span style={pc}>≈</span> : null}
    </td>
  )
}

/** The value a person's row or line shows for a column, or null for a cell that is not a person's to fill. */
function personValue(m: ScoreboardPersonMeasures, key: ScoreboardColumnKey): number | null {
  if (key === 'hours') return m.hours
  if (key === 'days') return m.days
  if (key === 'labor') return m.labor
  if (key === 'cost') return m.cost
  if (key === 'earned') return m.earned
  return null
}

/** The figure a person shows on a phone: hours, then their share of earned, then their labor. */
function personFigure(m: ScoreboardPersonMeasures): string {
  const bits = [scoreboardCellWords('hours', m.hours), `≈ ${scoreboardCellWords('earned', m.earned)}`]
  if (m.labor != null) bits.push(scoreboardCellWords('labor', m.labor))
  return bits.join(' · ')
}

export function DevelopmentScoreboard({ model, columns, phone, onSort, openJob, head, membersOf, print, cuts }: DevelopmentScoreboardProps) {
  const seesCosts = columns.some((c) => c.key === 'cost')
  // The middle widths read short on the full board only: the leader's board has room for whole dollars. The board's
  // own width decides once it is measured; the window's query guesses for the first paint (and in a test, which has no layout).
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [boxWidth, setBoxWidth] = useState(0)
  useLayoutEffect(() => {
    if (!box) return
    setBoxWidth(box.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(() => setBoxWidth(box.clientWidth))
    watch.observe(box)
    return () => watch.disconnect()
  }, [box])
  const narrowWindow = useMatchMedia(SCOREBOARD_COMPACT_QUERY)
  const narrow = !phone && seesCosts && (boxWidth > 0 ? boxWidth < SCOREBOARD_NARROW_BELOW_PX : narrowWindow)
  const fmt: Fmt = narrow ? scoreboardCompactWords : scoreboardCellWords
  const widths = scoreboardColumnWidths(columns, narrow)
  const headline = scoreboardHeadline(model, seesCosts)
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set())
  // The parts and the people opened on the cuts (v2.6558); a group folds to its three like a job.
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set())
  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const cut: ScoreboardCut = cuts?.cut ?? 'job'
  const partGroups = cut === 'part' ? (cuts?.parts ?? []) : null
  const people = cut === 'person' ? (cuts?.people ?? []) : null
  const chips = cuts ? <CutChips cuts={cuts} window={model.window} /> : null
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
    return (
      <div>
        {chips}
        <EmptyState main="No job on this site yet." next={{ label: 'Bid Board', to: '/bids' }} tail="makes a job from a won bid, and the board fills from it." compact />
      </div>
    )
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
    if (col.key === 'days') return 'once each'
    if (col.key === 'earned') return `${model.rows.length} ${model.rows.length === 1 ? 'job' : 'jobs'}`
    return null
  }
  const tileValue = (col: ScoreboardColumn): string => {
    const stands = scoreboardCellStands(col.key, model.reads)
    if (stands === 'reading') return '…'
    if (stands === 'failed') return 'not read'
    return fmt(col.key, model.site[col.key])
  }
  const emptiesLine = (
    <span style={{ color: 'var(--text-muted)' }} data-testid="scoreboard-fold">
      {scoreboardFoldWords(model.empties.length)} ·{' '}
      <LinkButton onClick={() => setShowEmpties((v) => !v)} title={showEmpties ? 'Fold the jobs with nothing on them' : 'Show the jobs with nothing on them yet'}>
        {showEmpties ? 'Hide them' : 'Show them'}
      </LinkButton>
    </span>
  )
  // The print (v2.6534): the board's figures and the rows behind them on paper, the way the Timeline prints.
  const printLine = print ? (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline', fontSize: '0.78rem', paddingTop: 6 }} data-testid="scoreboard-print">
      <LinkButton onClick={print.onPress} title="Opens the site’s cost summary in a print window; the print window saves it as a PDF too">
        Print cost summary
      </LinkButton>
      {print.note ? <span style={{ color: 'var(--text-muted)' }} data-testid="scoreboard-print-note">{print.note}</span> : null}
    </div>
  ) : null
  const legend = (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)', paddingTop: 6 }}>
      {(['effort', 'cost', 'money'] as const).filter((g) => columns.some((c) => c.group === g)).map((g) => (
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, marginTop: 8 }}>
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
          {open && membersOf ? <MemberLines list={membersOf(row)} seesCosts={seesCosts} /> : null}
        </div>
      )
    }
    // The cuts on a phone (v2.6558): a part is a heading with its three over its cards; a person is a card with their figures, opening to their jobs.
    const partSections = partGroups
      ? partGroups.map((g) => (
          <Fragment key={g.key}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 2px 0', fontSize: '0.8rem' }} data-testid={`scoreboard-part-${g.key}`}>
              <b style={{ color: 'var(--text-strong)', flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</b>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{personJobsWords(g.rows.length)}</span>
              {three.map((c) => (
                <span key={c.key} style={{ ...num, fontSize: '0.74rem', color: c.key === 'profit' ? (g.m.profit < 0 ? 'var(--text-red-700)' : 'var(--text-green-700)') : 'var(--text-700)' }} title={c.label}>
                  {scoreboardCellStands(c.key, model.reads) === 'stands' ? scoreboardCellWords(c.key, g.m[c.key]) : '…'}
                </span>
              ))}
            </div>
            {g.rows.map(card)}
          </Fragment>
        ))
      : null
    const personCards = people
      ? people.map((p) => {
          const open = openGroups.has(p.key)
          const keys: ScoreboardColumnKey[] = seesCosts ? ['hours', 'earned', 'cost'] : ['hours', 'days', 'earned']
          return (
            <div key={p.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: p.you ? 'var(--bg-amber-tint)' : open ? 'var(--bg-subtle)' : 'var(--surface)', boxShadow: p.you ? 'inset 3px 0 0 var(--bg-amber-200)' : undefined }} data-testid={`scoreboard-person-${p.key}`} data-you={p.you ? 'true' : undefined}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ fontWeight: 700, color: p.you ? 'var(--text-amber-900)' : 'var(--text-strong)', flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                  {p.you ? <YouChip /> : null}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{personJobsWords(p.lines.length)}</span>
                <button type="button" onClick={() => toggleGroup(p.key)} aria-expanded={open} aria-label={open ? `Fold ${p.name}'s jobs` : `Open ${p.name}'s jobs`} data-testid={`scoreboard-open-person-${p.key}`} style={{ border: 'none', background: 'none', padding: '0 2px', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.6rem' }}>
                  <span aria-hidden>{open ? '▼' : '▶'}</span>
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, marginTop: 8 }}>
                {keys.map((k) => {
                  const c = columns.find((x) => x.key === k)!
                  const v = personValue(p.m, k) ?? 0
                  return (
                    <div key={k} style={{ padding: '5px 6px', borderRadius: 6, background: 'var(--surface)', borderTop: `3px solid ${TILE_FILL[c.group]}` }} title={k === 'earned' ? SCOREBOARD_PERSON_EARNED_TITLE : undefined}>
                      <span style={{ ...capStyle, display: 'block', fontSize: '0.6rem' }}>{c.label}</span>
                      <b style={{ ...num, display: 'block', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-strong)' }}>
                        {k === 'earned' ? '≈ ' : ''}
                        {scoreboardCellWords(k, v)}
                      </b>
                    </div>
                  )
                })}
              </div>
              {open ? (
                <div style={{ marginTop: 8, borderTop: '1px solid var(--border)' }} data-testid={`scoreboard-person-lines-${p.key}`}>
                  {p.lines.map((l) => (
                    <div key={l.row.jobId} style={{ display: 'grid', gridTemplateColumns: '58px minmax(0, 1fr) auto', columnGap: 8, alignItems: 'baseline', padding: '5px 0 6px', borderBottom: '1px solid var(--border)', fontSize: '0.74rem' }}>
                      <RoleTag kind={l.lead ? 'lead' : 'crew'} width={58} />
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-strong)' }}>
                        <JobChip jobId={l.row.jobId} onOpen={() => openJob(l.row.jobId)} strong nowrap>
                          {l.row.label}
                        </JobChip>{' '}
                        {l.row.name}
                      </span>
                      <span style={{ ...num, color: 'var(--text-700)' }}>{personFigure(l.m)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })
      : null
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }} data-testid="scoreboard-phone">
        {chips}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--surface)' }}>
          <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-strong)' }}>{head.name}</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{head.line}</div>
          {headline ? <Headline headline={headline} openJob={openJob} /> : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 8 }}>
            {three.map((c) => (
              <div key={c.key} style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 7, background: 'var(--bg-subtle)', borderTop: `3px solid ${TILE_FILL[c.group]}` }}>
                <b style={{ ...num, display: 'block', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-strong)' }}>{tileValue(c)}</b>
                <span style={{ ...capStyle, fontSize: '0.6rem' }}>{c.label}</span>
                {c.key === 'profit' ? <span style={{ display: 'block', fontSize: '0.64rem', color: 'var(--text-muted)' }}>{tileSmall(c)}</span> : null}
              </div>
            ))}
          </div>
          {head.small ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>{head.small}</div> : null}
        </div>
        {personCards ?? partSections ?? model.rows.map(card)}
        {personCards ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0 2px' }}>{SCOREBOARD_PERSON_NOTE}</div> : null}
        {!personCards && model.empties.length ? <div style={{ textAlign: 'center', fontSize: '0.78rem', padding: 4 }}>{emptiesLine}</div> : null}
        {!personCards && showEmpties ? model.empties.map(card) : null}
        {printLine}
      </div>
    )
  }

  const th: CSSProperties = { padding: '10px 4px 8px', borderBottom: '2px solid var(--border-strong)', verticalAlign: 'top', background: 'var(--bg-subtle)' }
  const row = (r: ScoreboardJob) => {
    const open = openIds.has(r.jobId)
    const list = open && membersOf ? membersOf(r) : null
    const note = list ? (scoreboardPendingWords(list.pending) ?? (list.members.length === 0 ? scoreboardNoMembersWords(seesCosts) : null)) : null
    return (
      <Fragment key={r.jobId}>
        <tr data-testid={`scoreboard-row-${r.jobId}`} style={{ background: open ? 'var(--bg-subtle)' : undefined }}>
          <td style={{ ...cellPad, textAlign: 'left', paddingLeft: 10, overflow: 'hidden', fontWeight: open ? 700 : undefined }}>
            <JobName row={r} open={open} onToggle={() => toggle(r.jobId)} openJob={() => openJob(r.jobId)} narrow={narrow} />
          </td>
          {columns.map((c) => (open || folded.has(c.key) ? <Cell key={c.key} col={c} row={r} reads={model.reads} open={open} fmt={fmt} narrow={narrow} /> : <td key={c.key} style={{ ...cellPad, borderLeft: c.key === 'earned' ? '1px solid var(--border)' : undefined }} />))}
        </tr>
        {list ? list.members.map((m) => <MemberRow key={m.key} member={m} columns={columns} fmt={fmt} narrow={narrow} />) : null}
        {note ? (
          <tr data-testid={`scoreboard-members-note-${r.jobId}`}>
            <td colSpan={columns.length + 1} style={{ ...cellPad, height: 28, paddingLeft: 28, fontSize: '0.74rem', color: 'var(--text-muted)', background: 'var(--surface)' }}>
              {note}
            </td>
          </tr>
        ) : null}
      </Fragment>
    )
  }
  // The cut by part (v2.6558): a part is a row that folds to its three and opens to its nine and its jobs.
  const partRow = (g: ScoreboardPartGroup) => {
    const open = openGroups.has(g.key)
    return (
      <Fragment key={g.key}>
        <tr data-testid={`scoreboard-part-${g.key}`} style={{ background: 'var(--bg-subtle)' }}>
          <td style={{ ...cellPad, textAlign: 'left', paddingLeft: 10, overflow: 'hidden', fontWeight: 800, color: 'var(--text-strong)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, maxWidth: '100%', minWidth: 0 }}>
              <button type="button" onClick={() => toggleGroup(g.key)} aria-expanded={open} aria-label={open ? `Fold ${g.name}` : `Open ${g.name}'s jobs`} data-testid={`scoreboard-open-part-${g.key}`} style={{ border: 'none', background: 'none', padding: 0, width: 14, color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.6rem' }}>
                <span aria-hidden>{open ? '▼' : '▶'}</span>
              </button>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, fontStyle: g.key === 'none' ? 'italic' : undefined }} title={g.name}>
                {g.name}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 500, whiteSpace: 'nowrap' }}>{personJobsWords(g.rows.length)}</span>
            </span>
          </td>
          {columns.map((c) => (
            <SumCell key={c.key} col={c} value={g.m[c.key]} earned={g.m.earned} reads={model.reads} fmt={fmt} narrow={narrow} blank={!open && !folded.has(c.key)} />
          ))}
        </tr>
        {open ? g.rows.map(row) : null}
      </Fragment>
    )
  }
  // The cut by person (v2.6558): a person is a row with their hours and their share of earned (≈), opening to their jobs.
  const personRow = (p: ScoreboardPersonRow) => {
    const open = openGroups.has(p.key)
    const bg = youRow(p.you)
    const cell = (c: ScoreboardColumn, m: ScoreboardPersonMeasures, bold: boolean, show: boolean) => {
      const v = personValue(m, c.key)
      return <SumCell key={c.key} col={c} value={v ?? 0} earned={m.earned} reads={model.reads} fmt={fmt} narrow={narrow} bold={bold} blank={v == null || !show} title={c.key === 'earned' ? SCOREBOARD_PERSON_EARNED_TITLE : undefined} />
    }
    return (
      <Fragment key={p.key}>
        <tr data-testid={`scoreboard-person-${p.key}`} data-you={p.you ? 'true' : undefined} style={{ ...bg, ...(open && !p.you ? { background: 'var(--bg-subtle)' } : null) }}>
          <td style={{ ...cellPad, textAlign: 'left', paddingLeft: 10, overflow: 'hidden', fontWeight: 700, boxShadow: p.you ? 'inset 3px 0 0 var(--bg-amber-200)' : undefined }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, maxWidth: '100%', minWidth: 0 }}>
              <button type="button" onClick={() => toggleGroup(p.key)} aria-expanded={open} aria-label={open ? `Fold ${p.name}'s jobs` : `Open ${p.name}'s jobs`} data-testid={`scoreboard-open-person-${p.key}`} style={{ border: 'none', background: 'none', padding: 0, width: 14, color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.6rem' }}>
                <span aria-hidden>{open ? '▼' : '▶'}</span>
              </button>
              <span style={{ color: p.you ? 'var(--text-amber-900)' : 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={p.name}>
                {p.name}
              </span>
              {p.you ? <YouChip /> : null}
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 500, whiteSpace: 'nowrap' }}>{personJobsWords(p.lines.length)}</span>
            </span>
          </td>
          {columns.map((c) => cell(c, p.m, true, open || folded.has(c.key) || c.key === 'hours'))}
        </tr>
        {open
          ? p.lines.map((l) => (
              <tr key={l.row.jobId} data-testid={`scoreboard-person-line-${p.key}-${l.row.jobId}`}>
                <td style={{ ...cellPad, height: 28, textAlign: 'left', paddingLeft: narrow ? 14 : 28, overflow: 'hidden', background: 'var(--surface)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', minWidth: 0 }}>
                    <RoleTag kind={l.lead ? 'lead' : 'crew'} width={narrow ? 60 : 64} />
                    <StatusDot row={l.row} />
                    <JobChip jobId={l.row.jobId} onOpen={() => openJob(l.row.jobId)} strong nowrap>
                      {l.row.label}
                    </JobChip>
                    <span style={{ fontWeight: 600, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={l.row.name}>
                      {l.row.name}
                    </span>
                  </span>
                </td>
                {columns.map((c) => cell(c, l.m, false, true))}
              </tr>
            ))
          : null}
      </Fragment>
    )
  }
  return (
    <div>
      {chips}
      <div ref={setBox} style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', tableLayout: 'fixed' }} data-testid="scoreboard-table">
        <colgroup>
          <col style={{ width: widths.job }} />
          {columns.map((c, i) => (
            <col key={c.key} style={widths.columns[i] ? { width: widths.columns[i] } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left', paddingLeft: 14, verticalAlign: 'middle', fontWeight: 400 }}>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-strong)', lineHeight: 1.15 }}>{head.name}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'normal' }}>{head.line}</div>
              {headline && !narrow ? <Headline headline={headline} openJob={openJob} /> : null}
              {head.small ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'normal', marginTop: 4 }}>{head.small}</div> : null}
            </th>
            {columns.map((c) => (
              <th key={c.key} style={{ ...th, borderLeft: c.key === 'earned' ? '1px solid var(--border)' : undefined }} aria-sort={model.sort.key === c.key ? (model.sort.desc ? 'descending' : 'ascending') : undefined}>
                <Tile col={c} value={tileValue(c)} small={tileSmall(c)} sorted={model.sort.key === c.key} desc={model.sort.desc} onSort={() => onSort(c.key)} narrow={narrow} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {headline && narrow ? (
            // The middle widths: the flag block's column is a quarter of the board, so the headline takes the board's width.
            <tr data-testid="scoreboard-headline-row">
              <td colSpan={columns.length + 1} style={{ ...cellPad, height: 'auto', padding: '0 10px 8px', background: 'var(--surface)' }}>
                <Headline headline={headline} openJob={openJob} />
              </td>
            </tr>
          ) : null}
          {people ? people.map(personRow) : partGroups ? partGroups.map(partRow) : model.rows.map(row)}
          {!people && model.empties.length ? (
            <tr data-testid="scoreboard-fold-row">
              <td style={{ ...cellPad, textAlign: 'left', paddingLeft: 10 }}>{emptiesLine}</td>
              {columns.map((c) => (
                <td key={c.key} style={{ ...cellPad, ...num, color: 'var(--text-muted)', borderLeft: c.key === 'earned' ? '1px solid var(--border)' : undefined }}>
                  {folded.has(c.key) ? '0' : ''}
                </td>
              ))}
            </tr>
          ) : null}
          {!people && showEmpties ? model.empties.map(row) : null}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ ...cellPad, textAlign: 'left', paddingLeft: 10, fontWeight: 800, color: 'var(--text-strong)', borderTop: '2px solid var(--border-strong)', background: 'var(--bg-subtle)', height: 32 }}>The site · {total} {total === 1 ? 'job' : 'jobs'}</td>
            {columns.map((c) => (
              <td key={c.key} style={{ ...cellPad, ...num, fontWeight: 800, color: 'var(--text-strong)', borderTop: '2px solid var(--border-strong)', background: 'var(--bg-subtle)', height: 32, borderLeft: c.key === 'earned' ? '1px solid var(--border)' : undefined }}>
                {tileValue(c)}
                {c.key === 'profit' && !narrow && scoreboardCellStands('profit', model.reads) === 'stands' ? <span style={pc}>{scoreboardPctOf(model.site.profit, model.site.earned)}</span> : null}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      </div>
      {people ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', paddingTop: 6 }} data-testid="scoreboard-person-note">{SCOREBOARD_PERSON_NOTE}</div> : null}
      {legend}
      {printLine}
    </div>
  )
}
