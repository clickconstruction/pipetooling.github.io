/**
 * The sheet of a filled builder, as one printed page (punch list #404, step 3): the name at the top, the title, the
 * opening lines, the box saying who the certificate must name and for work where, the certificate holder, the table
 * of coverage beside its least amount, and the line at the foot. The page is always light, as a printed page is.
 *
 * `SheetPaperRead` draws a resolved sheet as someone outside reads it: a sub, their insurance agent, the printer.
 * `SheetPaperEdit` draws the same page as the editor: every piece of words is a field (`BuilderField`), and each list
 * has its own small presses, which nobody outside ever sees. It edits the standing sheet, or one job's sheet laid
 * over it. Every rule is `lib/documentBuilder/sheet.ts`: this file only draws and hands back the next value.
 */
import type { CSSProperties, ReactNode } from 'react'
import {
  SHEET_FIELD_NAMES,
  SHEET_JOB_BLANK,
  coverPath,
  fieldMark,
  fieldPath,
  openPath,
  pathName,
  sheetWords,
  subtitleWith,
  usualWords,
  withJobCoverOff,
  withJobExtra,
  withJobExtraWords,
  withJobInsured,
  withJobInsuredAdded,
  withJobWords,
  withUsualCover,
  withUsualOpenLine,
  withUsualWords,
  withoutJobExtra,
  withoutJobInsured,
  withoutUsualCover,
  withoutUsualOpenLine,
  type JobSheet,
  type ResolvedSheet,
  type SheetDef,
  type SheetFieldKey,
} from '../../lib/documentBuilder/sheet'
import { BuilderField } from './BuilderField'

const PAGE: CSSProperties = { background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border-strong)', borderRadius: 4, padding: '26px 28px 20px', display: 'grid', gap: 12, fontSize: '0.8125rem', lineHeight: 1.5, minWidth: 0 }
const HEAD: CSSProperties = { textAlign: 'center', display: 'grid', gap: 1, justifyItems: 'center', paddingBottom: 10, borderBottom: '2px solid var(--text-strong)' }
const HEAD_NAME: CSSProperties = { fontSize: '1rem', letterSpacing: '0.02em', color: 'var(--text-strong)' }
const HEAD_LINE: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const TITLE: CSSProperties = { textAlign: 'center', display: 'grid', gap: 2, justifyItems: 'center' }
const TITLE_NAME: CSSProperties = { fontSize: '1rem', letterSpacing: '0.04em', color: 'var(--text-strong)' }
const TITLE_SUB: CSSProperties = { fontWeight: 600, color: 'var(--text-strong)' }
const ROW: CSSProperties = { display: 'flex', gap: 6, alignItems: 'baseline', justifyContent: 'space-between', margin: 0 }
const MUST: CSSProperties = { border: '1.5px solid var(--text-strong)', borderRadius: 4, padding: '10px 12px', display: 'grid', gap: 4, textAlign: 'center', justifyItems: 'center' }
const HOLDER: CSSProperties = { display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '2px 14px', alignItems: 'start' }
const TH: CSSProperties = { textAlign: 'left', fontSize: '0.6875rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '4px 0', borderBottom: '1px solid var(--border-strong)', fontWeight: 600 }
const TD: CSSProperties = { padding: '7px 0', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }
const TD_NAME: CSSProperties = { ...TD, fontWeight: 700, color: 'var(--text-strong)', width: '46%', paddingRight: 12 }
const FOOT: CSSProperties = { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }
const STAMP: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }
const STILL: CSSProperties = { borderRadius: 4, padding: '0 4px', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', fontWeight: 600 }
const CTL: CSSProperties = { border: '1px dashed var(--border-strong)', background: 'none', color: 'var(--text-link)', borderRadius: 6, fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', minHeight: 28, cursor: 'pointer', flex: '0 0 auto' }

type Line = { key: string; node: ReactNode; ctl?: ReactNode }
type Slots = {
  co: ReactNode
  addr1: ReactNode
  addr2: ReactNode
  title: ReactNode
  subtitle: ReactNode
  open: Line[]
  openFoot?: ReactNode
  lead: ReactNode
  insured: Line[]
  insuredFoot?: ReactNode
  at: ReactNode
  place: ReactNode
  holder: ReactNode
  hName: ReactNode
  hAddr1: ReactNode
  hAddr2: ReactNode
  colA: ReactNode
  colB: ReactNode
  cover: Array<{ key: string; label: ReactNode; limit: ReactNode; ctl?: ReactNode }>
  coverFoot?: ReactNode
  foot: ReactNode
  stamp: string
}

function Ctl({ words, label, onPress }: { words: string; label: string; onPress: () => void }) {
  return (
    <button type="button" aria-label={label} style={CTL} onClick={onPress}>
      {words}
    </button>
  )
}

/** The page itself. Light whatever the app's theme, since it is the page that prints and the page a sub reads. */
function SheetFrame({ slots }: { slots: Slots }) {
  return (
    <div data-theme="light" data-sheet-paper="" style={PAGE}>
      <div style={HEAD}>
        <div style={HEAD_NAME}>{slots.co}</div>
        <div style={HEAD_LINE}>{slots.addr1}</div>
        <div style={HEAD_LINE}>{slots.addr2}</div>
      </div>
      <div style={TITLE}>
        <div style={TITLE_NAME}>{slots.title}</div>
        <div style={TITLE_SUB}>{slots.subtitle}</div>
      </div>
      {slots.open.map((line) => (
        <p key={line.key} style={ROW}>
          <span>{line.node}</span>
          {line.ctl}
        </p>
      ))}
      {slots.openFoot ? <div>{slots.openFoot}</div> : null}
      <div style={MUST}>
        <div>{slots.lead}</div>
        {slots.insured.map((line) => (
          <div key={line.key} style={{ ...ROW, justifyContent: 'center', fontSize: '0.875rem', color: 'var(--text-strong)' }}>
            <span>{line.node}</span>
            {line.ctl}
          </div>
        ))}
        {slots.insuredFoot}
        <div>
          {slots.at} {slots.place}
        </div>
      </div>
      <div style={HOLDER}>
        <div>{slots.holder}</div>
        <div>
          <div style={{ color: 'var(--text-strong)' }}>{slots.hName}</div>
          <div>{slots.hAddr1}</div>
          <div>{slots.hAddr2}</div>
        </div>
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={TH}>{slots.colA}</th>
            <th style={TH}>{slots.colB}</th>
          </tr>
        </thead>
        <tbody>
          {slots.cover.map((line) => (
            <tr key={line.key}>
              <td style={TD_NAME}>{line.label}</td>
              <td style={TD}>
                <div style={ROW}>
                  <span>{line.limit}</span>
                  {line.ctl}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {slots.coverFoot ? <div>{slots.coverFoot}</div> : null}
      <p style={FOOT}>* {slots.foot}</p>
      <div style={STAMP}>{slots.stamp}</div>
    </div>
  )
}

/** A resolved sheet as someone outside reads it. */
export function SheetPaperRead({ sheet, stamp }: { sheet: ResolvedSheet; stamp: string }) {
  return (
    <SheetFrame
      slots={{
        co: <b>{sheet.co}</b>,
        addr1: sheet.addr1,
        addr2: sheet.addr2,
        title: <b>{sheet.title}</b>,
        subtitle: sheet.subtitle,
        open: sheet.open.map((text, i) => ({ key: String(i), node: text })),
        lead: sheet.lead,
        insured: sheet.insured.map((name, i) => ({ key: String(i), node: <b>{name}</b> })),
        at: sheet.at,
        place: sheet.place,
        holder: sheet.holder,
        hName: <b>{sheet.hName}</b>,
        hAddr1: sheet.hAddr1,
        hAddr2: sheet.hAddr2,
        colA: sheet.colA,
        colB: sheet.colB,
        cover: sheet.cover.map((c, i) => ({ key: String(i), label: c.label, limit: c.limit })),
        foot: sheet.foot,
        stamp,
      }}
    />
  )
}

type EditProps =
  | { mode: 'usual'; def: SheetDef; stamp: string; onUsual: (next: SheetDef) => void }
  | { mode: 'job'; def: SheetDef; job: JobSheet; stamp: string; onJob: (next: JobSheet) => void }

/** The same page as the editor: the standing sheet, or one job's sheet laid over it. */
export function SheetPaperEdit(props: EditProps) {
  const { def, stamp } = props
  const job = props.mode === 'job' ? props.job : null

  /** A field of the standing sheet's own words, by path: typed on the usual, or typed over for this job. */
  const F = (path: string, tag?: 'span' | 'b') => (
    <BuilderField
      editing
      tag={tag}
      text={props.mode === 'usual' ? (usualWords(def, path) ?? '') : sheetWords(def, props.job, path)}
      mark={props.mode === 'usual' ? 'usual' : fieldMark(props.job, path)}
      label={pathName(def, path)}
      onType={(words) => (props.mode === 'usual' ? props.onUsual(withUsualWords(def, path, words)) : props.onJob(withJobWords(def, props.job, path, words)))}
    />
  )
  const field = (key: SheetFieldKey, tag?: 'span' | 'b') => F(fieldPath(key), tag)
  /** A blank filled from the job: the job's own, with nothing on the usual to go back to. */
  const blank = (text: string, label: string, onType: (words: string) => void, tag?: 'span' | 'b') => <BuilderField editing tag={tag} text={text} mark="blank" label={label} onType={onType} />

  const subtitle: ReactNode =
    props.mode === 'usual' ? (
      // A usual line that writes the blank out shows it in its own words. One that does not takes the name at its end.
      def.fields.sub.includes(SHEET_JOB_BLANK) ? (
        field('sub')
      ) : (
        <>
          {field('sub')} <span style={STILL}>the job's name</span>
        </>
      )
    ) : props.job.over[fieldPath('sub')] != null ? (
      field('sub')
    ) : (
      // Typed back to what the usual reads on this job, the line is not kept as the job's own.
      blank(subtitleWith(def.fields.sub, props.job.name), SHEET_FIELD_NAMES.sub, (words) => props.onJob(withJobWords(def, props.job, fieldPath('sub'), words)))
    )

  const open: Line[] = def.open.map((line, i) => ({
    key: line.key,
    node: F(openPath(line.key)),
    ctl: props.mode === 'usual' ? <Ctl words="×" label={`Remove opening line ${i + 1}`} onPress={() => props.onUsual(withoutUsualOpenLine(def, line.key))} /> : undefined,
  }))

  const insured: Line[] =
    props.mode === 'usual'
      ? [{ key: 'blank', node: <b style={STILL}>The property's owner, from each job</b> }]
      : props.job.insured.map((name, i) => ({
          key: String(i),
          node: blank(name, `Additional insured, name ${i + 1}`, (words) => props.onJob(withJobInsured(props.job, i, words)), 'b'),
          ctl: <Ctl words="×" label={`Remove name ${i + 1}`} onPress={() => props.onJob(withoutJobInsured(props.job, i))} />,
        }))

  const usualCover = def.cover
    .filter((c) => !job || !job.off.includes(c.key))
    .map((c) => ({
      key: c.key,
      label: F(coverPath(c.key, 'label')),
      limit: F(coverPath(c.key, 'limit')),
      ctl:
        props.mode === 'usual' ? (
          <Ctl words="×" label={`Remove ${c.label}`} onPress={() => props.onUsual(withoutUsualCover(def, c.key))} />
        ) : (
          <Ctl words="×" label={`Do not ask for ${c.label}`} onPress={() => props.onJob(withJobCoverOff(props.job, c.key, true))} />
        ),
    }))
  const extraCover =
    props.mode === 'job'
      ? props.job.extra.map((x) => ({
          key: `extra-${x.key}`,
          label: blank(x.label, 'An added line, its name', (words) => props.onJob(withJobExtraWords(props.job, x.key, 'label', words))),
          limit: blank(x.limit, 'An added line, its amount', (words) => props.onJob(withJobExtraWords(props.job, x.key, 'limit', words))),
          ctl: <Ctl words="×" label={`Take off ${x.label}`} onPress={() => props.onJob(withoutJobExtra(props.job, x.key))} />,
        }))
      : []

  return (
    <SheetFrame
      slots={{
        co: field('co', 'b'),
        addr1: field('addr1'),
        addr2: field('addr2'),
        title: field('title', 'b'),
        subtitle,
        open,
        openFoot: props.mode === 'usual' ? <Ctl words="Add an opening line" label="Add an opening line" onPress={() => props.onUsual(withUsualOpenLine(def))} /> : undefined,
        lead: field('lead'),
        insured,
        insuredFoot: props.mode === 'job' ? <Ctl words="Add a name" label="Add a name" onPress={() => props.onJob(withJobInsuredAdded(props.job))} /> : undefined,
        at: field('at'),
        place: props.mode === 'usual' ? <span style={STILL}>the job's address</span> : blank(props.job.place, 'The place', (words) => props.onJob({ ...props.job, place: words })),
        holder: field('holder'),
        hName: field('hName', 'b'),
        hAddr1: field('hAddr1'),
        hAddr2: field('hAddr2'),
        colA: field('colA'),
        colB: field('colB'),
        cover: [...usualCover, ...extraCover],
        coverFoot:
          props.mode === 'usual' ? (
            <Ctl words="Add a coverage line" label="Add a coverage line" onPress={() => props.onUsual(withUsualCover(def))} />
          ) : (
            <Ctl words="Add a coverage line for this job" label="Add a coverage line for this job" onPress={() => props.onJob(withJobExtra(props.job))} />
          ),
        foot: field('foot'),
        stamp,
      }}
    />
  )
}
