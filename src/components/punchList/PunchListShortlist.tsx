import { useMemo, useState, type CSSProperties } from 'react'
import { GROUP_COLOR } from '../../lib/todos/punchListView'
import {
  SHORTLIST_BLURB,
  bucketLabel,
  bucketTitle,
  countsLine,
  shortlistFrom,
  type ShortlistRow,
} from '../../lib/todos/punchListShortlist'
import type { BoardItem } from '../../lib/todos/todoBoard'

/**
 * The Shortlist at the top of /punch-list (v2.6618): every open row by group, smallest first,
 * one line each — the number (a jump to the row below), the size letter and the name. The
 * letter is read from the card's own `size` words by `sizeBucket`; the rows are the board's.
 * `/punch-list#shortlist` lands on it. Hide folds it to one line and the device remembers.
 */
export function PunchListShortlist({ items, visible }: { items: readonly BoardItem[]; visible: (item: BoardItem) => boolean }) {
  const list = useMemo(() => shortlistFrom(items), [items])
  const [open, setOpen] = useState<boolean>(() => readOpen())
  const toggle = () => {
    const next = !open
    setOpen(next)
    writeOpen(next)
  }
  const groups = list.groups
    .map((g) => ({ ...g, rows: g.rows.filter((r) => visible(r.item)) }))
    .filter((g) => g.rows.length > 0)
  return (
    <section id="shortlist" data-testid="punch-shortlist" style={{ marginTop: '2rem' }}>
      <style>{`
        .punch-short-list { margin: 0; padding: 0; list-style: none; }
        @media (min-width: 860px) { .punch-short-list { columns: 2; column-gap: 2rem; } }
        .punch-short-list li { break-inside: avoid; display: grid; grid-template-columns: 3.25rem 2.25rem minmax(0, 1fr); gap: 0.5rem; align-items: baseline; padding: 0.2rem 0; }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Shortlist</h2>
        <span style={{ ...mono, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {list.open} open · {countsLine(list)}
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls="shortlist-groups"
          style={{
            font: 'inherit',
            fontSize: '0.8rem',
            fontWeight: 500,
            padding: '0.2rem 0.6rem',
            borderRadius: 999,
            border: '1px solid var(--border-strong)',
            background: 'var(--surface)',
            color: 'var(--text-base)',
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          {open ? 'Hide the shortlist' : 'Show the shortlist'}
        </button>
        {open ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', flexBasis: '100%', maxWidth: '72ch' }}>{SHORTLIST_BLURB}</p>
        ) : null}
      </div>
      {open ? (
        <div id="shortlist-groups" style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', padding: '0.25rem 1rem 0.75rem' }}>
          {groups.map((g) => (
            <div key={g.group} data-testid={`punch-shortlist-${g.group}`} style={{ padding: '0.6rem 0 0.25rem' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: GROUP_COLOR[g.group], display: 'inline-block' }} />
                {g.label}
                <span style={{ ...mono, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{g.rows.length}</span>
              </h3>
              <ol className="punch-short-list">
                {g.rows.map((r) => (
                  <ShortRow key={r.item.slug} row={r} />
                ))}
              </ol>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function ShortRow({ row }: { row: ShortlistRow }) {
  const { item, bucket } = row
  return (
    <li>
      <a
        href={`#n${item.number}`}
        title={`Jump to #${item.number}`}
        style={{ ...mono, fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-strong)', textDecoration: 'none', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
      >
        #{item.number}
      </a>
      <span
        title={bucketTitle(bucket, item.size)}
        style={{
          ...mono,
          fontSize: '0.72rem',
          fontWeight: 600,
          color: bucket ? 'var(--text-700)' : 'var(--text-muted)',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 3,
          padding: '0 4px',
          textAlign: 'center',
          justifySelf: 'start',
        }}
      >
        {bucketLabel(bucket)}
      </span>
      <span style={{ fontSize: '0.9rem', minWidth: 0, overflowWrap: 'anywhere' }}>{item.name}</span>
    </li>
  )
}

const OPEN_KEY = 'pt-punch-shortlist'

/** Open unless this device hid it; storage may be blocked, and then it is simply open. */
function readOpen(): boolean {
  try {
    return window.localStorage.getItem(OPEN_KEY) !== 'hidden'
  } catch {
    return true
  }
}

function writeOpen(open: boolean): void {
  try {
    if (open) window.localStorage.removeItem(OPEN_KEY)
    else window.localStorage.setItem(OPEN_KEY, 'hidden')
  } catch {
    // A private window or blocked storage: the press still works for this page.
  }
}

const mono: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
