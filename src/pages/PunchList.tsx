import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRoleGate } from '../hooks/useRoleGate'
import { usePunchListPicks } from '../hooks/usePunchListPicks'
import { canOpenPunchList } from '../lib/todos/punchListAccess'
import {
  GROUP_BLURBS,
  PUNCH_FILTERS,
  byLine,
  countPicks,
  groupRows,
  isOpenItem,
  linkChips,
  fileHref,
  mockupStateLabel,
  waitingOnMockupCount,
  fragmentHref,
  nextPick,
  pickOf,
  rowVisible,
  versionSegments,
  type PickMap,
  type PunchFilter,
  type PunchPick,
} from '../lib/todos/punchListView'
import { parseOpinion, type BoardGroup, type BoardItem, type OpinionVerdict } from '../lib/todos/todoBoard'
import board from 'virtual:punch-list'

/**
 * /punch-list — the to-do board, in the app (v2.3558).
 *
 * The rows are the `virtual:punch-list` module, rendered at build time from each to-do's
 * front matter (`todoBoardPlugin` in vite.config.ts, v2.3623; `npm run check:todos` in CI
 * refuses a to-do it cannot render), so the board is exactly what is on `main` and nothing
 * generated is committed; the mock-ups beside the to-dos are served at `/to-dos/…` by the
 * build (`todoMockupsPlugin`). Anyone with repo access changes the board by changing a to-do
 * file — never this page. Until v2.3558 the board was a hand-published artifact only one
 * account could refresh.
 *
 * Every row opens with the to-do's `number:` (v2.3708) — the handle people use for it; given
 * once, never reused; `#n16` is the row's anchor.
 *
 * The door is `canOpenPunchList` (dev + master); a refused deep link lands on Today with
 * the #29 sentence. Picks are shared rows in `punch_list_picks` (v2.3559), stamped with
 * who made them; until the table is pushed they stay on the device and the page says so.
 */
export default function PunchList() {
  const { user: authUser, role, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { bounce } = useRoleGate(role, authUser?.id)
  const allowed = canOpenPunchList(role)

  useEffect(() => {
    if (authLoading || role === null || allowed) return
    const { to } = bounce('punch-list', `${location.pathname}${location.search}`)
    navigate(to, { replace: true })
  }, [authLoading, role, allowed, bounce, navigate, location.pathname, location.search])

  const { picks, shared, save } = usePunchListPicks(allowed)
  const [filter, setFilter] = useState<PunchFilter>('all')
  const [waitingOnly, setWaitingOnly] = useState(false)
  const waitingCount = useMemo(() => waitingOnMockupCount(board.items), [])

  const counts = useMemo(() => countPicks(board.items, picks), [picks])
  const groups = useMemo(() => groupRows(board.items), [])
  const byGroup = useMemo(() => {
    const out: Partial<Record<BoardGroup, number>> = {}
    for (const g of groups) out[g.group] = g.items.length
    return out
  }, [groups])

  if (authLoading) return <p style={{ padding: '2rem' }}>Loading…</p>
  if (!allowed) return null

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 var(--page-wrap-pad, 1rem) 4rem' }}>
      {/* The row grid stacks on a phone; inline styles cannot carry a media query. */}
      <style>{`
        .punch-row { display: grid; grid-template-columns: 6px 3.75rem minmax(0, 1fr) minmax(160px, 200px) minmax(220px, 260px); }
        .punch-num { border-right: 1px solid var(--border); padding: 0.9rem 0.5rem 0.9rem 0.7rem; }
        .punch-meta, .punch-act { border-left: 1px solid var(--border); }
        @media (max-width: 860px) {
          .punch-row { grid-template-columns: 6px 3.75rem minmax(0, 1fr); }
          .punch-stripe, .punch-num { grid-row: 1 / span 3; }
          .punch-meta, .punch-act { border-left: 0; border-top: 1px solid var(--border); }
        }
      `}</style>
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '1.5rem',
          flexWrap: 'wrap',
          padding: '1.5rem 0 1rem',
          borderBottom: '2px solid var(--text-strong)',
        }}
      >
        <div>
          <p style={{ ...eyebrow, margin: '0 0 0.25rem' }}>to-dos/ · read against main</p>
          <h1 style={{ margin: 0, fontSize: '2rem', lineHeight: 1.1, textWrap: 'balance' }}>Punch list</h1>
        </div>
        <div style={{ ...mono, fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right', lineHeight: 1.6 }}>
          Validated against main <b style={{ color: 'var(--text-strong)', fontWeight: 500 }}>{board.validated.date}</b> at{' '}
          <b style={{ color: 'var(--text-strong)', fontWeight: 500 }}>{board.validated.version}</b>
          <br />
          {board.openItems} open items · shipped work lives in the release notes
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          marginTop: '1.25rem',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        <Tile n={byGroup.ready ?? 0} label="Ready to build" />
        <Tile n={byGroup.close ?? 0} label="Close out" />
        <Tile n={byGroup.gated ?? 0} label="Owner decision" />
        <div style={tileStyle}>
          <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'baseline', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: PICK_COLOR.do }}>{counts.do} do</span>
            <span style={{ color: PICK_COLOR.later }}>{counts.later} later</span>
            <span style={{ color: PICK_COLOR.drop }}>{counts.drop} drop</span>
          </div>
          <div style={tileLabel}>{counts.unsorted} unsorted</div>
        </div>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.6rem 0 0', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: shared ? 'var(--text-green-700)' : 'var(--border-strong)', flexShrink: 0 }} />
        {shared
          ? 'Picks are shared — everyone who opens this board sees the same Do / Later / Drop, with the name beside it.'
          : 'Picks stay on this device until the database catches up with this deploy.'}
        {' '}To change a row, change its to-do file in the repo — this page is rendered from them.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1.25rem', alignItems: 'center' }}>
        <span style={eyebrow}>Show</span>
        {PUNCH_FILTERS.map((f) => {
          const n = f === 'all' ? counts.all : counts[f]
          const active = filter === f
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={active}
              style={{
                font: 'inherit',
                fontSize: '0.85rem',
                fontWeight: 500,
                padding: '0.3rem 0.75rem',
                borderRadius: 999,
                border: `1px solid ${active ? 'var(--text-strong)' : 'var(--border-strong)'}`,
                background: active ? 'var(--text-strong)' : 'var(--surface)',
                color: active ? 'var(--bg-page)' : 'var(--text-base)',
                cursor: 'pointer',
              }}
            >
              {FILTER_LABEL[f]} <span style={{ opacity: 0.7, fontVariantNumeric: 'tabular-nums', marginLeft: 4 }}>{n}</span>
            </button>
          )
        })}
        <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 0.25rem' }} aria-hidden />
        <button
          type="button"
          onClick={() => setWaitingOnly((v) => !v)}
          aria-pressed={waitingOnly}
          title="Only the rows that still need a drawing"
          style={{
            font: 'inherit',
            fontSize: '0.85rem',
            fontWeight: 500,
            padding: '0.3rem 0.75rem',
            borderRadius: 999,
            border: `1px solid ${waitingOnly ? 'var(--text-amber-800)' : 'var(--border-strong)'}`,
            background: waitingOnly ? 'var(--bg-amber-100)' : 'var(--surface)',
            color: waitingOnly ? 'var(--text-amber-900)' : 'var(--text-base)',
            cursor: 'pointer',
          }}
        >
          ▢ Waiting on a mock-up <span style={{ opacity: 0.7, fontVariantNumeric: 'tabular-nums', marginLeft: 4 }}>{waitingCount}</span>
        </button>
      </div>

      {groups.map((g) => {
        const visible = g.items.filter((it) => rowVisible(it, picks, filter, waitingOnly))
        if (visible.length === 0) return null
        return (
          <section key={g.group} style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: GROUP_COLOR[g.group], display: 'inline-block' }} />
                {g.label}
              </h2>
              <span style={{ ...mono, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {g.items.length} item{g.items.length === 1 ? '' : 's'}
              </span>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', flexBasis: '100%', maxWidth: '72ch' }}>
                {GROUP_BLURBS[g.group]}
              </p>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', overflow: 'hidden' }}>
              {visible.map((it, i) => (
                <Row key={it.slug} item={it} group={g.group} picks={picks} onSave={save} first={i === 0} />
              ))}
            </div>
          </section>
        )
      })}

      <footer style={{ marginTop: '2.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '72ch' }}>
        Every row opens with its number — say “#16” and everyone knows which one; a number is given once, when the to-do is
        written, and never reused. Sizes are a working estimate: XS is under an hour, S a sitting, M a day of PRs, L a
        multi-day train. “Next” names the smallest shippable step from the to-do’s own plan. Each row links to its file on
        main; the mock-ups open as pages.
      </footer>
    </div>
  )
}

function Row({
  item,
  group,
  picks,
  onSave,
  first,
}: {
  item: BoardItem
  group: BoardGroup
  picks: PickMap
  onSave: (slug: string, patch: Partial<{ pick: PunchPick | ''; note: string }>) => void | Promise<void>
  first: boolean
}) {
  const pick = pickOf(picks, item.slug)
  const note = picks[item.slug]?.note ?? ''
  const who = byLine(picks[item.slug])
  const open = isOpenItem(item)
  const opinion = parseOpinion(item.opinion)
  const chips = linkChips(item)
  const hasPages = item.mockups.length > 0 || item.artifacts.length > 0
  return (
    <article
      data-slug={item.slug}
      data-number={item.number}
      id={`n${item.number}`}
      className="punch-row"
      style={{ borderTop: first ? 0 : '1px solid var(--border)' }}
    >
      <div className="punch-stripe" style={{ background: GROUP_COLOR[group] }} />
      <div className="punch-num">
        <a
          href={`#n${item.number}`}
          title="This row's number — the handle to use when you refer to it. Given once, never reused."
          style={{ ...mono, fontWeight: 700, fontSize: '1rem', color: 'var(--text-strong)', textDecoration: 'none', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
        >
          #{item.number}
        </a>
      </div>
      <div className="punch-main" style={{ padding: '0.9rem 1rem', minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.98rem', display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <a href={fileHref(item)} target="_blank" rel="noopener" style={{ color: 'var(--text-link)' }}>
            {item.name}
          </a>
          {item.ver && (
            <code style={verChip}>
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
          )}
        </div>
        <p style={{ margin: '0.25rem 0 0', maxWidth: '68ch', fontSize: '0.9rem' }}>{item.summary}</p>
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '68ch' }}>
          <b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>Next:</b> {item.next}
        </p>
        <p style={{ margin: '0.5rem 0 0', display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center' }}>
          <span style={{ ...eyebrow, marginRight: 2 }}>{hasPages ? 'Mock-ups' : 'Links'}</span>
          {item.mockup !== 'has' && !item.pointer && (
            <span
              title={item.mockup === 'waiting' ? 'No .html beside this to-do yet — drop one in its folder' : 'The to-do says so in its front matter'}
              style={{
                display: 'inline-block',
                fontSize: '0.78rem',
                fontWeight: 500,
                borderRadius: 999,
                padding: '2px 10px',
                ...(item.mockup === 'waiting'
                  ? { color: 'var(--text-amber-900)', background: 'var(--bg-amber-100)', border: '1px dashed var(--text-amber-800)' }
                  : { color: 'var(--text-muted)', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }),
              }}
            >
              {item.mockup === 'waiting' ? '▢ ' : '— '}
              {mockupStateLabel(item)}
            </span>
          )}
          {chips.map((c) => (
            <a key={c.href} href={c.href} target="_blank" rel="noopener" title={c.title ?? (c.kind === 'history' ? 'Every PR that touched this to-do' : undefined)} style={chipStyle(c.kind)}>
              {c.kind === 'mockup' ? '▣ ' : c.kind === 'artifact' ? '◇ ' : ''}
              {c.label}
            </a>
          ))}
        </p>
      </div>
      <div className="punch-meta" style={{ padding: '0.9rem 0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)', background: 'var(--bg-subtle)' }}>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 8px' }}>
          <dt style={eyebrow}>Size</dt>
          <dd style={{ margin: 0, ...mono, color: 'var(--text-base)' }}>{item.size}</dd>
          <dt style={eyebrow}>Blocks</dt>
          <dd style={{ margin: 0 }}>{item.blocker}</dd>
          {opinion && (
            <>
              <dt style={eyebrow} title="A reviewer's call — the opinion: line in the to-do's front matter; anyone with repo access can change it">Opinion</dt>
              <dd style={{ margin: 0 }}>
                {opinion.verdict && (
                  <span
                    style={{
                      display: 'inline-block',
                      marginRight: 6,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      borderRadius: 999,
                      padding: '1px 8px',
                      color: OPINION_STYLE[opinion.verdict].color,
                      background: OPINION_STYLE[opinion.verdict].background,
                      border: `1px solid ${OPINION_STYLE[opinion.verdict].border}`,
                    }}
                  >
                    {opinion.verdict}
                  </span>
                )}
                <span style={{ color: 'var(--text-base)' }}>{opinion.note}</span>
              </dd>
            </>
          )}
        </dl>
      </div>
      <div className="punch-act" style={{ padding: '0.75rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {open ? (
          <>
            <div role="group" aria-label={`Pick for ${item.name}`} style={{ display: 'flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
              {(['do', 'later', 'drop'] as const).map((p, i) => {
                const pressed = pick === p
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => onSave(item.slug, { pick: nextPick(pick, p) })}
                    style={{
                      flex: 1,
                      font: 'inherit',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      padding: '0.4rem 0',
                      border: 0,
                      borderRight: i < 2 ? '1px solid var(--border-strong)' : 0,
                      background: pressed ? PICK_COLOR[p] : 'var(--surface)',
                      color: pressed ? 'var(--text-on-bright-solid)' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {PICK_LABEL[p]}
                  </button>
                )
              })}
            </div>
            <input
              id={`punch-note-${item.slug}`}
              key={note}
              type="text"
              placeholder="A note for the session…"
              defaultValue={note}
              onBlur={(e) => {
                const v = e.currentTarget.value.trim()
                if (v !== note) onSave(item.slug, { note: v })
              }}
              style={{
                font: 'inherit',
                fontSize: '0.82rem',
                padding: '0.35rem 0.5rem',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
                color: 'var(--text-base)',
                width: '100%',
              }}
            />
            {who && (
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <b style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{who.split(' · ')[0]}</b>
                {who.includes(' · ') ? ` · ${who.split(' · ')[1]}` : ''}
              </p>
            )}
          </>
        ) : (
          <span style={{ alignSelf: 'flex-start', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 999, padding: '3px 10px' }}>
            standing list
          </span>
        )}
      </div>
    </article>
  )
}

function Tile({ n, label }: { n: number; label: string }) {
  return (
    <div style={tileStyle}>
      <div style={{ fontWeight: 700, fontSize: '1.75rem', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
      <div style={tileLabel}>{label}</div>
    </div>
  )
}

const FILTER_LABEL: Record<PunchFilter, string> = { all: 'All', unsorted: 'Unsorted', do: 'Do', later: 'Later', drop: 'Drop' }
const PICK_LABEL: Record<PunchPick, string> = { do: 'Do', later: 'Later', drop: 'Drop' }

// Status colors stay saturated tokens; the group swatches are the same family the app uses
// for chips, so they read on both themes.
const GROUP_COLOR: Record<BoardGroup, string> = {
  ready: 'var(--text-green-700)',
  close: 'var(--text-muted)',
  gated: 'var(--text-amber-800)',
  waiting: 'var(--text-sky-700)',
  residual: 'var(--text-violet-700)',
}
const OPINION_STYLE: Record<OpinionVerdict, { color: string; background: string; border: string }> = {
  build: { color: 'var(--text-green-800)', background: 'var(--bg-green-100)', border: 'var(--border-green)' },
  later: { color: 'var(--text-amber-900)', background: 'var(--bg-amber-100)', border: 'var(--border-amber)' },
  drop: { color: 'var(--text-red-800)', background: 'var(--bg-red-100)', border: 'var(--border-red)' },
  'your call': { color: 'var(--text-700)', background: 'var(--bg-subtle)', border: 'var(--border-strong)' },
}

const PICK_COLOR: Record<PunchPick, string> = {
  do: 'var(--text-green-700)',
  later: 'var(--text-amber-800)',
  drop: 'var(--text-red-700)',
}

const mono: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
const eyebrow: CSSProperties = { fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const tileStyle: CSSProperties = { padding: '0.75rem 1rem', borderRight: '1px solid var(--border)', minWidth: 0 }
const tileLabel: CSSProperties = { ...eyebrow, marginTop: 4 }
const verChip: CSSProperties = {
  ...mono,
  fontSize: '0.72rem',
  fontWeight: 400,
  color: 'var(--text-muted)',
  background: 'var(--bg-subtle)',
  border: '1px solid var(--border)',
  borderRadius: 3,
  padding: '0 5px',
}
function chipStyle(kind: 'mockup' | 'artifact' | 'history' | 'folder'): CSSProperties {
  const quiet = kind === 'history' || kind === 'folder'
  return {
    display: 'inline-block',
    fontSize: '0.78rem',
    fontWeight: 500,
    textDecoration: 'none',
    color: kind === 'mockup' ? 'var(--text-link)' : quiet ? 'var(--text-muted)' : 'var(--text-base)',
    background: 'var(--bg-subtle)',
    border: `1px ${quiet ? 'dashed' : 'solid'} ${kind === 'mockup' ? 'var(--text-link)' : 'var(--border)'}`,
    borderRadius: 999,
    padding: '2px 10px',
  }
}
