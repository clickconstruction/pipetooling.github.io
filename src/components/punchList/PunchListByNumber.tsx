import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { EmptyState } from '../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import {
  ORDER_LABEL,
  byNumber,
  groupCounts,
  hasNumber,
  hasShippedVersion,
  mockupDoor,
  numberLabel,
  orderTitle,
  rowAnchor,
  shownLine,
  type NumberOrder,
} from '../../lib/todos/punchListByNumber'
import { bucketLabel, bucketTitle, sizeBucket } from '../../lib/todos/punchListShortlist'
import { GROUP_COLOR, fileHref, fragmentHref, versionSegments } from '../../lib/todos/punchListView'
import { GROUP_LABELS, type BoardGroup, type BoardItem } from '../../lib/todos/todoBoard'

/**
 * The punch list's **By number** view (`/punch-list?view=number`): every card the page renders in
 * one flat list, the highest number on top, so the owner can work from the newest card down. One
 * press flips it to the oldest first. Each card is a short row: its number, its name, a chip for
 * its group in the grouped view's colour, its size letter, the versions it shipped, its mock-up,
 * and its Next line cut to one line. A press on the Next line opens the card as the grouped view
 * draws it, with the whole text and Do / Later / Drop; the page hands that card in as `renderCard`.
 *
 * The page's Show filters and the mock-up toggle narrow it through `visible`; the group chips here
 * narrow it to one group. The order and the sort are the page's (the address and the device);
 * the rules are in `lib/todos/punchListByNumber.ts`.
 */
export function PunchListByNumber({
  items,
  visible,
  order,
  onFlip,
  onClearFilters,
  renderCard,
}: {
  items: readonly BoardItem[]
  /** The page's own filters: Show, and Waiting on a mock-up. */
  visible: (item: BoardItem) => boolean
  order: NumberOrder
  onFlip: () => void
  /** Clears the page's filters; the group chip here clears with it. */
  onClearFilters: () => void
  /** The card as the grouped view draws it, shown under an opened row. */
  renderCard: (item: BoardItem) => ReactNode
}) {
  const [groupOnly, setGroupOnly] = useState<BoardGroup | null>(null)
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set())
  const sorted = useMemo(() => byNumber(items, order), [items, order])
  const passing = sorted.filter(visible)
  const groups = groupCounts(passing)
  // A group the page's filters emptied cannot stay chosen, or the list would be empty with no chip lit.
  const group = groupOnly !== null && groups.some((g) => g.group === groupOnly) ? groupOnly : null
  const shown = group === null ? passing : passing.filter((i) => i.group === group)

  const toggle = (slug: string) =>
    setOpened((prior) => {
      const next = new Set(prior)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })

  return (
    <section id="by-number" data-testid="punch-by-number" style={{ marginTop: '2rem' }}>
      {/* The row is a grid that restacks on a phone; inline styles cannot carry a media query. */}
      <style>{`
        .punch-n-list { margin: 0; padding: 0; list-style: none; }
        .punch-n-row {
          display: grid;
          grid-template-columns: 4.75rem minmax(0, 1fr) auto;
          grid-template-areas: "num name meta" "num next next" "card card card";
          column-gap: 0.75rem;
          row-gap: 0.2rem;
          align-items: start;
          padding: 0.6rem 0.9rem 0.6rem 0.8rem;
        }
        .punch-n-num { grid-area: num; }
        .punch-n-name { grid-area: name; min-width: 0; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; }
        .punch-n-meta { grid-area: meta; display: flex; flex-wrap: wrap; gap: 0.375rem; align-items: center; justify-content: flex-end; max-width: 30rem; }
        .punch-n-next { grid-area: next; min-width: 0; }
        .punch-n-card { grid-area: card; min-width: 0; margin-top: 0.4rem; }
        @media (max-width: 760px) {
          .punch-n-row { grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "num name" "meta meta" "next next" "card card"; column-gap: 0.6rem; }
          .punch-n-meta { justify-content: flex-start; max-width: none; }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>By number</h2>
        <span data-testid="punch-number-shown" style={{ ...mono, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {shownLine(shown.length, items.length)}
        </span>
        <button type="button" onClick={onFlip} title={orderTitle(order)} data-testid="punch-number-order" style={{ ...pill(false), marginLeft: 'auto' }}>
          {ORDER_LABEL[order]}
        </button>
      </div>
      <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '72ch' }}>
        Every card on the board in one list, by its number. A number is given once, so the highest is the newest card. Press a card’s Next line to
        open it.
      </p>

      {groups.length > 1 || group !== null ? (
        <div role="group" aria-label="Narrow to one group" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.6rem 0 0.75rem' }}>
          <button type="button" aria-pressed={group === null} onClick={() => setGroupOnly(null)} style={pill(group === null)}>
            Every group <span style={pillCount}>{passing.length}</span>
          </button>
          {groups.map((g) => (
            <button
              key={g.group}
              type="button"
              aria-pressed={group === g.group}
              onClick={() => setGroupOnly(group === g.group ? null : g.group)}
              style={pill(group === g.group)}
            >
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: GROUP_COLOR[g.group], display: 'inline-block', marginRight: 6 }} />
              {g.label} <span style={pillCount}>{g.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', overflow: 'hidden' }}>
        {shown.length === 0 ? (
          <EmptyState
            {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'cards', query: '' }), {
              onPress: () => {
                setGroupOnly(null)
                onClearFilters()
              },
            })}
          />
        ) : (
          <ol className="punch-n-list">
            {shown.map((item, i) => (
              <NumberRow key={item.slug} item={item} first={i === 0} open={opened.has(item.slug)} onToggle={() => toggle(item.slug)} renderCard={renderCard} />
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

function NumberRow({
  item,
  first,
  open,
  onToggle,
  renderCard,
}: {
  item: BoardItem
  first: boolean
  open: boolean
  onToggle: () => void
  renderCard: (item: BoardItem) => ReactNode
}) {
  const anchor = rowAnchor(item)
  const bucket = sizeBucket(item.size)
  const door = mockupDoor(item)
  const cardId = `punch-card-${item.slug}`
  return (
    <li
      id={anchor}
      data-testid="punch-number-row"
      data-slug={item.slug}
      data-number={hasNumber(item) ? item.number : ''}
      className="punch-n-row"
      style={{ borderTop: first ? 0 : '1px solid var(--border)' }}
    >
      <div className="punch-n-num">
        <a
          href={`#${anchor}`}
          title={hasNumber(item) ? "This card's number — the handle to use when you refer to it. Given once, never reused." : 'This card has no number yet; check:todos names the next free one.'}
          style={{ ...mono, fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-strong)', textDecoration: 'none', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
        >
          {numberLabel(item)}
        </a>
        {item.flagged ? (
          <span title="Flagged — the owner put this at the top" aria-label="Flagged" style={{ marginLeft: 4, color: 'var(--text-red-700)', fontSize: '0.9rem' }}>
            ⚑
          </span>
        ) : null}
      </div>
      <div className="punch-n-name" style={{ fontWeight: 600, fontSize: '0.96rem', lineHeight: 1.35 }}>
        <a href={fileHref(item)} target="_blank" rel="noopener" title={item.name} style={{ color: 'var(--text-link)' }}>
          {item.name}
        </a>
      </div>
      <div className="punch-n-meta">
        <span
          data-testid="punch-number-group"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: '0.74rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            color: GROUP_COLOR[item.group],
            background: 'var(--surface)',
            border: `1px solid ${GROUP_COLOR[item.group]}`,
            borderRadius: 999,
            padding: '1px 9px',
          }}
        >
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: 2, background: GROUP_COLOR[item.group], display: 'inline-block' }} />
          {GROUP_LABELS[item.group]}
        </span>
        {item.pointer ? (
          <span style={quietChip} title="A standing list, not an open item: it takes no pick">
            standing list
          </span>
        ) : (
          <span title={bucketTitle(bucket, item.size)} style={{ ...quietChip, ...mono, fontWeight: 600, borderRadius: 3, padding: '0 5px', color: bucket ? 'var(--text-700)' : 'var(--text-muted)' }}>
            {bucketLabel(bucket)}
          </span>
        )}
        {hasShippedVersion(item.ver) ? (
          <code
            title={item.ver}
            style={{ ...quietChip, ...mono, fontSize: '0.72rem', borderRadius: 3, padding: '0 5px', maxWidth: '11rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {versionSegments(item.ver).map((seg, i) =>
              seg.version ? (
                <a key={i} href={fragmentHref(seg.version)} target="_blank" rel="noopener" style={{ color: 'inherit', textDecoration: 'underline dotted' }}>
                  {seg.text}
                </a>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </code>
        ) : null}
        {door ? (
          <a
            href={door.href}
            target="_blank"
            rel="noopener"
            title={door.title}
            style={{ fontSize: '0.76rem', fontWeight: 500, textDecoration: 'none', whiteSpace: 'nowrap', color: 'var(--text-link)', background: 'var(--bg-subtle)', border: '1px solid var(--text-link)', borderRadius: 999, padding: '1px 9px' }}
          >
            ▣ {door.label}
          </a>
        ) : item.mockup === 'waiting' && !item.pointer ? (
          <span
            title="No .html beside this to-do yet — drop one in its folder"
            style={{ fontSize: '0.76rem', fontWeight: 500, whiteSpace: 'nowrap', color: 'var(--text-amber-900)', background: 'var(--bg-amber-100)', border: '1px dashed var(--text-amber-800)', borderRadius: 999, padding: '1px 9px' }}
          >
            ▢ waiting on a mock-up
          </span>
        ) : null}
      </div>
      <button
        type="button"
        className="punch-n-next"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={cardId}
        title={open ? 'Close the card' : `${item.next} — press to open the card`}
        style={{
          font: 'inherit',
          fontSize: '0.85rem',
          textAlign: 'left',
          display: 'flex',
          gap: '0.4rem',
          alignItems: 'baseline',
          width: '100%',
          padding: '0.1rem 0',
          border: 0,
          background: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
        }}
      >
        <span aria-hidden style={{ flexShrink: 0, width: '0.8rem', color: 'var(--text-strong)' }}>
          {open ? '▾' : '▸'}
        </span>
        <b style={{ flexShrink: 0, color: 'var(--text-strong)', fontWeight: 600 }}>Next:</b>
        <span data-testid="punch-number-next" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.next}
        </span>
      </button>
      {open ? (
        <div id={cardId} className="punch-n-card" style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', background: 'var(--surface)' }}>
          {renderCard(item)}
        </div>
      ) : null}
    </li>
  )
}

const mono: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }

const quietChip: CSSProperties = {
  display: 'inline-block',
  fontSize: '0.74rem',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  color: 'var(--text-muted)',
  background: 'var(--bg-subtle)',
  border: '1px solid var(--border)',
  borderRadius: 999,
  padding: '1px 9px',
}

const pillCount: CSSProperties = { opacity: 0.7, fontVariantNumeric: 'tabular-nums', marginLeft: 4 }

/** The page's own filter pill: dark when it is the one chosen. */
function pill(active: boolean): CSSProperties {
  return {
    font: 'inherit',
    fontSize: '0.82rem',
    fontWeight: 500,
    padding: '0.25rem 0.7rem',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--text-strong)' : 'var(--border-strong)'}`,
    background: active ? 'var(--text-strong)' : 'var(--surface)',
    color: active ? 'var(--bg-page)' : 'var(--text-base)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
  }
}
