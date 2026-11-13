import { Fragment, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { DiveCell, DiveItem, DiveProject, DiveRow, DiveTarget, MoveDive } from '../../lib/bridge/callDive'

/**
 * A move's lines as a table (punch list #334, PR 8). The owner, of the card: "Visually, I don't like how this looks,
 * but I like how it functions." Every press is the one the line had; what changed is where things sit:
 *
 *   - each fact has a column with a heading, so amounts line up and can be read down;
 *   - a line is one row, with the customer's projects behind a press in its own column;
 *   - a row's action is a blue word, so the name leads the row.
 *
 * On a phone there is no room for columns: a line is its name and its figure, then the rest with its press.
 */

type Props = {
  dive: MoveDive
  narrow: boolean
  onDive?: (target: DiveTarget) => void
}

/**
 * One grid for the whole table, so every row's columns line up: name, two figures, words, the row's press.
 * A column no line fills takes no room. The gap between columns is padding inside the cells, so a row's rule runs
 * unbroken under all of them.
 */
const deskColumns = (has: { a: boolean; b: boolean; text: boolean }): string => `minmax(0, 1.6fr) ${has.a ? 'minmax(64px, auto)' : '0px'} ${has.b ? 'minmax(64px, auto)' : '0px'} ${has.text ? 'minmax(0, 1.1fr)' : '0px'} auto`
const GAP = 16
const cell: CSSProperties = { padding: '5px 0', borderTop: '1px solid var(--border)', fontSize: '0.82rem', lineHeight: 1.3, minHeight: 46, display: 'flex', alignItems: 'center', minWidth: 0, fontVariantNumeric: 'tabular-nums' }
const heading: CSSProperties = { fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '2px 0 4px', whiteSpace: 'nowrap', overflow: 'hidden' }
/** Room to the left of a cell that is not the first, in place of a grid gap. None for a column that is not used. */
const lead = (used: boolean): CSSProperties => (used ? { paddingLeft: GAP } : { paddingLeft: 0, overflow: 'hidden' })
const right: CSSProperties = { justifyContent: 'flex-end', textAlign: 'right', whiteSpace: 'nowrap' }
/** A word that acts: the app's link blue, no box. */
const wordPress = (narrow: boolean): CSSProperties => ({ font: 'inherit', fontSize: '0.82rem', fontWeight: 600, minHeight: narrow ? 44 : 36, padding: 0, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'left' })
const cellColor = (c: DiveCell): string | undefined => (c.warn ? 'var(--text-amber-800)' : c.muted ? 'var(--text-muted)' : undefined)

export function BridgeMoveTable({ dive, narrow, onDive }: Props) {
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  const items = all ? dive.items : dive.items.slice(0, dive.shown)
  const cols = dive.columns ?? { name: '', a: '', b: '', text: '' }
  // Which columns any line fills, over every line and project, so the table does not jump when the rest are shown.
  const rows = dive.items.flatMap((i) => [i.row, ...(i.projects ?? []).map((p) => p.row)])
  const has = { a: rows.some((r) => r?.a), b: rows.some((r) => r?.b), text: rows.some((r) => r?.text) }
  const toggle = (title: string) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })

  const cellWords = (c: DiveCell | undefined, phone: boolean): ReactNode => (c ? <span style={{ color: cellColor(c) }}>{phone ? (c.phone ?? c.text) : c.text}</span> : null)
  const nameOf = (item: DiveItem): ReactNode => {
    const style: CSSProperties = { font: 'inherit', fontSize: '0.84rem', fontWeight: 700, padding: 0, border: 'none', background: 'transparent', color: 'var(--text-link)', textDecoration: 'none', cursor: 'pointer', textAlign: 'left', minWidth: 0, ...(narrow ? {} : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }) }
    return item.target.kind === 'page' ? (
      <Link to={item.target.to} title={item.title} style={style} data-testid="bridge-week-dive-name">
        {item.title}
      </Link>
    ) : (
      <button type="button" onClick={() => onDive?.(item.target)} title={item.title} style={style} data-testid="bridge-week-dive-name">
        {item.title}
      </button>
    )
  }
  /** The row's own press: *Set the percent*, *Set a pay date*, or the press that opens a customer's projects. */
  const actionOf = (item: DiveItem): ReactNode => {
    if (item.press) {
      const target = item.press.target
      return (
        <button type="button" onClick={() => onDive?.(target)} data-testid="bridge-week-dive-item-press" style={wordPress(narrow)}>
          {item.press.label}
        </button>
      )
    }
    if (item.projects && item.projects.length > 0) {
      const isOpen = open.has(item.title)
      return (
        <button type="button" aria-expanded={isOpen} onClick={() => toggle(item.title)} data-testid="bridge-week-dive-projects-toggle" style={wordPress(narrow)}>
          {item.projects.length === 1 ? '1 project' : `${item.projects.length} projects`} <span aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
        </button>
      )
    }
    return null
  }
  const projectAction = (p: DiveProject): ReactNode => {
    if (!p.press) return null
    const target = p.press.target
    return (
      <button type="button" onClick={() => onDive?.(target)} data-testid="bridge-week-dive-project-press" style={wordPress(narrow)}>
        {p.press.label}
      </button>
    )
  }
  const showAll =
    dive.items.length > dive.shown ? (
      <button type="button" onClick={() => setAll((a) => !a)} data-testid="bridge-week-dive-all" style={{ ...wordPress(narrow), fontWeight: 400, fontSize: '0.8rem' }}>
        {all ? `Show the first ${dive.shown}` : `Show all ${dive.items.length}`}
      </button>
    ) : null

  // ── a phone: no columns ────────────────────────────────────────────────────
  if (narrow) {
    const phoneRow = (key: string, name: ReactNode, row: DiveRow | undefined, action: ReactNode, testId: string, indent: boolean) => {
      const rest = [row?.b, row?.text].filter((c): c is DiveCell => !!c)
      return (
        <li key={key} data-testid={testId} style={{ padding: '6px 0 2px', borderTop: '1px solid var(--border)', ...(indent ? { paddingLeft: 10, borderLeft: '2px solid var(--border)' } : {}) }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ minWidth: 0, lineHeight: 1.3 }}>{name}</span>
            {row?.a && <span style={{ flex: '0 0 auto', fontSize: '0.84rem', fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{cellWords(row.a, true)}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
            <span style={{ flex: '1 1 auto', minWidth: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
              {rest.map((c, i) => (
                <Fragment key={i}>
                  {i > 0 && ' · '}
                  <span style={{ color: cellColor(c) ?? 'var(--text-700)' }}>{c.phone ?? c.text}</span>
                </Fragment>
              ))}
            </span>
            {action}
          </div>
        </li>
      )
    }
    return (
      <div data-testid="bridge-week-dive" style={{ marginTop: 4 }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((item) => (
            <Fragment key={item.title}>
              {phoneRow(item.title, nameOf(item), item.row, actionOf(item), 'bridge-week-dive-item', false)}
              {item.projects && open.has(item.title) && (
                <li style={{ listStyle: 'none' }}>
                  <ul style={{ listStyle: 'none', margin: '0 0 6px', padding: 0 }} data-testid="bridge-week-dive-projects">
                    {item.projects.map((p) => phoneRow(p.key, <b style={{ fontSize: '0.82rem', color: 'var(--text-strong)' }}>{p.title}</b>, p.row, projectAction(p), 'bridge-week-dive-project', true))}
                  </ul>
                </li>
              )}
            </Fragment>
          ))}
        </ul>
        {showAll}
      </div>
    )
  }

  // ── a desk: one grid, so every row's columns line up ───────────────────────
  return (
    <div data-testid="bridge-week-dive" style={{ marginTop: 6 }}>
      <div role="table" aria-label={cols.name ? `${cols.name}s` : undefined} style={{ display: 'grid', gridTemplateColumns: deskColumns(has), alignItems: 'stretch' }}>
        <div role="row" style={{ display: 'contents' }}>
          <span role="columnheader" style={heading}>
            {cols.name}
          </span>
          <span role="columnheader" style={{ ...heading, textAlign: 'right', ...lead(has.a) }}>
            {has.a ? cols.a : ''}
          </span>
          <span role="columnheader" style={{ ...heading, textAlign: 'right', ...lead(has.b) }}>
            {has.b ? cols.b : ''}
          </span>
          <span role="columnheader" style={{ ...heading, ...lead(has.text) }}>
            {has.text ? cols.text : ''}
          </span>
          <span style={heading} />
        </div>
        {items.map((item) => (
          <Fragment key={item.title}>
            <div role="row" style={{ display: 'contents' }} data-testid="bridge-week-dive-item">
              <span role="cell" style={cell}>
                {nameOf(item)}
              </span>
              <span role="cell" style={{ ...cell, ...right, fontWeight: 600, ...lead(has.a) }}>
                {cellWords(item.row?.a, false)}
              </span>
              <span role="cell" style={{ ...cell, ...right, ...lead(has.b) }}>
                {cellWords(item.row?.b, false)}
              </span>
              <span role="cell" style={{ ...cell, ...lead(has.text) }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.row?.text?.text}>
                  {cellWords(item.row?.text, false)}
                </span>
              </span>
              <span role="cell" style={{ ...cell, justifyContent: 'flex-end', paddingLeft: GAP }}>
                {actionOf(item)}
              </span>
            </div>
            {item.projects &&
              open.has(item.title) &&
              item.projects.map((p, i) => {
                const sub: CSSProperties = { ...cell, minHeight: 42, borderTop: i === 0 ? '1px solid var(--border)' : '1px dashed var(--border)' }
                return (
                  <Fragment key={p.key}>
                    <div role="row" style={{ display: 'contents' }} data-testid="bridge-week-dive-project">
                      <span role="cell" style={{ ...sub, paddingLeft: 12, borderLeft: '2px solid var(--border)' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-strong)' }} title={p.title}>
                          {p.title}
                        </span>
                      </span>
                      <span role="cell" style={{ ...sub, ...right, ...lead(has.a) }}>
                        {cellWords(p.row?.a, false)}
                      </span>
                      <span role="cell" style={{ ...sub, ...right, ...lead(has.b) }}>
                        {cellWords(p.row?.b, false)}
                      </span>
                      <span role="cell" style={{ ...sub, ...lead(has.text) }}>
                        {cellWords(p.row?.text, false)}
                      </span>
                      <span role="cell" style={{ ...sub, justifyContent: 'flex-end', paddingLeft: GAP }}>
                        {projectAction(p)}
                      </span>
                    </div>
                  </Fragment>
                )
              })}
          </Fragment>
        ))}
      </div>
      {showAll}
    </div>
  )
}
