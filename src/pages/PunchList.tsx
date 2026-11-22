import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRoleGate } from '../hooks/useRoleGate'
import { usePunchListPicks } from '../hooks/usePunchListPicks'
import { usePunchListTicks } from '../hooks/usePunchListTicks'
import { isImpersonationSessionActive } from '../lib/impersonationSession'
import { canOpenPunchList } from '../lib/todos/punchListAccess'
import { TICKED_FILTER_LABEL, TICKS_READ_FAILED_REST, TICK_BLURB } from '../lib/todos/punchListTicks'
import {
  FLAGGED_BLURB,
  GROUP_BLURBS,
  GROUP_COLOR,
  PUNCH_FILTERS,
  byLine,
  countPicks,
  flaggedRows,
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
import { PunchListBurndown } from '../components/punchList/PunchListBurndown'
import { PunchListByNumber } from '../components/punchList/PunchListByNumber'
import { PunchListShortlist } from '../components/punchList/PunchListShortlist'
import { PunchListTick } from '../components/punchList/PunchListTick'
import { PunchListClaim } from '../components/punchList/PunchListClaim'
import type { CardClaims } from '../lib/todos/punchListClaims'
import OfflineRetryPanel from '../components/OfflineRetryPanel'
import {
  ORDER_KEY,
  ORDER_PARAM,
  PUNCH_VIEWS,
  VIEW_KEY,
  VIEW_LABEL,
  VIEW_PARAM,
  flipOrder,
  orderFrom,
  searchFor,
  viewFrom,
  type NumberOrder,
  type PunchView,
} from '../lib/todos/punchListByNumber'
import { cardMatchesSearch, searchFromAddress, withSearch } from '../lib/todos/punchListSearch'
import { unpackHistory } from '../lib/todos/punchListHistory'
import packedHistory from '../lib/todos/punchListHistoryData'
import { EmptyState } from '../components/EmptyState'
import { emptyWords, emptyWordsWithPress } from '../lib/emptyWords'
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
 *
 * Two views: **By group** (the Shortlist, the flagged rows, then each group) and **By number**
 * (`PunchListByNumber`: every card in one list, the highest number first). The address names
 * the view (`?view=number`, `&order=oldest`), the device remembers the last press, and a bare
 * address reads the device (`lib/todos/punchListByNumber.ts`).
 *
 * One search field beside the View choice (v2.7263) narrows the cards in both views as the person
 * types: the number, the name, the summary, the Next line, the shipped versions and the group's
 * name (`lib/todos/punchListSearch.ts`). The address carries it as `?q=`, the device does not.
 *
 * A checkbox beside every card means "I am working on this" (Taunya's ask of 2026-11-21). A tick is
 * the person's own row in `punch_list_ticks`, so it is on their phone and their desk. It shows only
 * while the card is in the section it was ticked in, so a card that moves to another section loses
 * its tick (`lib/todos/punchListTicks.ts`, `usePunchListTicks`). The **Working on** pill narrows
 * both views to the ticked cards and carries their count.
 *
 * Since v2.8226 a tick is a claim (her ask of the same day): everyone who opens the board sees who
 * is working on a card, on a line under its name. A claim goes quiet 12 hours after the newest of
 * the tick, a **Still on it** press and the card file's last change on main, which the build ships
 * in the history (`history.touched`). A quiet card reads as free to pick up to everyone else; its
 * claimer keeps their own tick, marked as gone quiet (`lib/todos/punchListClaims.ts`).
 */
/** The board's history as the build replayed it from git; the burndown reads it. */
const history = unpackHistory(packedHistory)

export default function PunchList() {
  const { user: authUser, role, profileName, loading: authLoading } = useAuth()
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
  // The page's clock, for a claim's quiet hours: it moves once a minute and when the tab comes back to the front.
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const tick = (): void => setNowMs(Date.now())
    const timer = window.setInterval(tick, 60_000)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', tick)
    }
  }, [])
  // Every person's ticks, each a claim. The person's own stale row is deleted with no press only on the built site
  // (a branch's board on a dev server can be behind main) and never under View as, where a look writes nothing by itself.
  const ticks = usePunchListTicks({
    enabled: allowed,
    userId: authUser?.id,
    userName: profileName,
    cards: board.items,
    boardVersion: board.validated.version,
    mayClear: import.meta.env.PROD && !isImpersonationSessionActive(),
    touched: history.touched,
    nowMs,
  })
  const claimOf = (it: BoardItem): CardClaims | undefined => ticks.claims.byCard.get(it.number)
  const [filter, setFilter] = useState<PunchFilter>('all')
  const [waitingOnly, setWaitingOnly] = useState(false)
  const [tickedOnly, setTickedOnly] = useState(false)
  // The view and the sort: the address first, then the last press on this device, then the groups.
  const [remembered, setRemembered] = useState(() => ({ view: readChoice(VIEW_KEY), order: readChoice(ORDER_KEY) }))
  const params = new URLSearchParams(location.search)
  const view = viewFrom(params.get(VIEW_PARAM), remembered.view)
  const order = orderFrom(params.get(ORDER_PARAM), remembered.order)
  const choose = (nextView: PunchView, nextOrder: NumberOrder) => {
    writeChoice(VIEW_KEY, nextView === 'number' ? nextView : null)
    writeChoice(ORDER_KEY, nextOrder === 'oldest' ? nextOrder : null)
    setRemembered({ view: nextView, order: nextOrder })
    navigate({ pathname: location.pathname, search: searchFor(location.search, nextView, nextOrder), hash: location.hash }, { replace: true })
  }
  // The search lives in the address alone (`?q=`), so a link carries it and a cleared field leaves it bare.
  const query = searchFromAddress(location.search)
  const setQuery = (next: string) =>
    navigate({ pathname: location.pathname, search: withSearch(location.search, next), hash: location.hash }, { replace: true })
  const clearSearch = () => setQuery('')
  // One rule for both views: the Show filter, the mock-up toggle, the person's ticks, then the search.
  const visible = (it: BoardItem) =>
    rowVisible(it, picks, filter, waitingOnly) && (!tickedOnly || ticks.ticked.has(it.number)) && cardMatchesSearch(it, query)
  const clearFilters = () => {
    setFilter('all')
    setWaitingOnly(false)
    setTickedOnly(false)
  }
  const anyVisible = board.items.some(visible)
  const waitingCount = useMemo(() => waitingOnMockupCount(board.items), [])

  const counts = useMemo(() => countPicks(board.items, picks), [picks])
  const groups = useMemo(() => groupRows(board.items), [])
  const flagged = useMemo(() => flaggedRows(board.items), [])
  // Every row counts toward its group, flagged ones included — they left the group's section, not the group (v2.4196).
  const byGroup = useMemo(() => {
    const out: Partial<Record<BoardGroup, number>> = {}
    for (const it of board.items as BoardItem[]) out[it.group] = (out[it.group] ?? 0) + 1
    return out
  }, [])

  if (authLoading) return <p style={{ padding: '2rem' }}>Loading…</p>
  if (!allowed) return null

  return (
    // v2.6131: a flex item in Layout's column with auto side margins is sized by its content, so the page drew
    // narrower than the screen when its lines were short and moved as each load landed (v2.6117, Job Parts
    // Tally). Pin it to its container like `.pageWrap` (v2.1003); border-box is global, so the max width
    // is already the outer width and stays.
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 var(--page-wrap-pad, 1rem) 4rem', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* The row grid stacks on a phone; inline styles cannot carry a media query. */}
      <style>{`
        .punch-row { display: grid; grid-template-columns: 6px 3.75rem minmax(0, 1fr) minmax(160px, 200px) minmax(220px, 260px); }
        .punch-num { border-right: 1px solid var(--border); padding: 0.9rem 0.5rem 0.9rem 0.7rem; }
        /* The tick under the number: the label takes the cell's whole width, 44 px tall, for a thumb. */
        .punch-num .punch-tick { width: calc(100% + 1.2rem); margin: 0.3rem -0.5rem -0.5rem -0.7rem; }
        /* Who is on the card, under its name. Still on it is a thumb's size on a phone. */
        .punch-main .punch-claim { margin-top: 0.35rem; }
        @media (max-width: 860px) { .punch-still { min-height: 44px; min-width: 44px; } }
        .punch-meta, .punch-act { border-left: 1px solid var(--border); }
        @media (max-width: 860px) {
          .punch-row { grid-template-columns: 6px 3.75rem minmax(0, 1fr); }
          .punch-stripe, .punch-num { grid-row: 1 / span 3; }
          .punch-meta, .punch-act { border-left: 0; border-top: 1px solid var(--border); }
        }
        /* The search sits beside the View choice; on a phone it takes its own line under it. */
        .punch-search { position: relative; display: flex; align-items: center; flex: 1 1 12rem; min-width: 0; max-width: 24rem; }
        .punch-search input::-webkit-search-cancel-button, .punch-search input::-webkit-search-decoration { -webkit-appearance: none; appearance: none; }
        @media (max-width: 760px) {
          .punch-search { flex-basis: 100%; max-width: none; }
          .punch-divider { display: none; }
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
      {/* The ticks are the person's own. A failed read says so here and leaves every card on the page. */}
      <p data-testid="punch-tick-blurb" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.35rem 0 0', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, border: '1.5px solid var(--border-strong)', flexShrink: 0 }} />
        {TICK_BLURB}
      </p>
      {ticks.failure ? (
        <div data-testid="punch-ticks-failed" style={{ marginTop: '0.5rem' }}>
          <OfflineRetryPanel failure={ticks.failure} onRetry={ticks.reload} surface="punch-list-ticks" idempotent busy={ticks.loading} />
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>{TICKS_READ_FAILED_REST}</p>
        </div>
      ) : null}

      {/* The burndown: the open cards hour by hour, replayed from the folder's own history, and when the list clears. */}
      <PunchListBurndown history={history} items={board.items} />

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1.25rem', alignItems: 'center' }}>
        <span style={eyebrow}>View</span>
        {PUNCH_VIEWS.map((v) => (
          <button key={v} type="button" onClick={() => choose(v, order)} aria-pressed={view === v} style={pillStyle(view === v)}>
            {VIEW_LABEL[v]}
          </button>
        ))}
        <div className="punch-search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return
              e.preventDefault()
              clearSearch()
            }}
            placeholder="Search the cards: a number, a name, a word"
            aria-label="Search the cards"
            autoComplete="off"
            enterKeyHint="search"
            data-testid="punch-search"
            style={{
              font: 'inherit',
              fontSize: '0.85rem',
              width: '100%',
              padding: query ? '0.3rem 2rem 0.3rem 0.75rem' : '0.3rem 0.75rem',
              borderRadius: 999,
              border: `1px solid ${query ? 'var(--text-strong)' : 'var(--border-strong)'}`,
              background: 'var(--surface)',
              color: 'var(--text-base)',
            }}
          />
          {query ? (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear the search"
              title="Clear the search (Escape)"
              style={{
                position: 'absolute',
                right: 4,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 24,
                height: 24,
                border: 0,
                borderRadius: '50%',
                background: 'var(--bg-subtle)',
                color: 'var(--text-muted)',
                font: 'inherit',
                fontSize: '0.9rem',
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          ) : null}
        </div>
        <span className="punch-divider" style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 0.25rem' }} aria-hidden />
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
              style={pillStyle(active)}
            >
              {FILTER_LABEL[f]} <span style={{ opacity: 0.7, fontVariantNumeric: 'tabular-nums', marginLeft: 4 }}>{n}</span>
            </button>
          )
        })}
        <span className="punch-divider" style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 0.25rem' }} aria-hidden />
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
        {/* The person's own ticks: the count stands apart from the words, and the press narrows both views to those cards. */}
        <button
          type="button"
          onClick={() => setTickedOnly((v) => !v)}
          aria-pressed={tickedOnly}
          title="Only the cards you ticked as working on"
          data-testid="punch-ticked-only"
          style={pillStyle(tickedOnly)}
        >
          ☑ {TICKED_FILTER_LABEL}{' '}
          <b data-testid="punch-ticked-count" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginLeft: 4 }}>
            {ticks.ticked.size}
          </b>
        </button>
      </div>

      {/* By number: every card in one list, the highest number first. It stands in for the Shortlist and the groups. */}
      {view === 'number' ? (
        <PunchListByNumber
          items={board.items}
          visible={visible}
          query={query}
          onClearSearch={clearSearch}
          order={order}
          onFlip={() => choose('number', flipOrder(order))}
          onClearFilters={clearFilters}
          renderTick={(it) => <PunchListTick item={it} ticked={ticks.ticked.has(it.number)} onToggle={ticks.toggle} />}
          renderClaim={(it) => (claimOf(it) ? <PunchListClaim item={it} claims={claimOf(it)} nowMs={nowMs} onStillOn={ticks.stillOn} /> : null)}
          // The opened card draws no box of its own: the row above it carries the card's one.
          renderCard={(it) => <Row item={it} group={it.group} picks={picks} onSave={save} first anchor={false} />}
        />
      ) : !anyVisible ? (
        // The search or the filters left nothing in any group: one sentence names the way out, the search first.
        <div data-testid="punch-group-empty" style={{ marginTop: '2rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}>
          <EmptyState
            {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'cards', query }), {
              onPress: () => {
                if (query) clearSearch()
                else clearFilters()
              },
            })}
          />
        </div>
      ) : (
      <>
      {/* v2.6618 · the Shortlist: every open row by group, smallest first, from the cards' own size words. */}
      <PunchListShortlist items={board.items} visible={visible} />

      {/* v2.4196 · the owner's flagged rows, above every group. */}
      {(() => {
        const shown = flagged.filter(visible)
        if (shown.length === 0) return null
        return (
          <section data-testid="punch-flagged" style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-red-700)' }}>
                <span aria-hidden>⚑</span>
                Flagged
              </h2>
              <span style={{ ...mono, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {flagged.length} item{flagged.length === 1 ? '' : 's'}
              </span>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', flexBasis: '100%', maxWidth: '72ch' }}>{FLAGGED_BLURB}</p>
            </div>
            <div style={{ border: '1px solid var(--border-red)', borderRadius: 6, background: 'var(--surface)', overflow: 'hidden' }}>
              {shown.map((it, i) => (
                <Row key={it.slug} item={it} group={it.group} picks={picks} onSave={save} first={i === 0} tick={{ ticked: ticks.ticked.has(it.number), onToggle: ticks.toggle, claims: claimOf(it), nowMs, onStillOn: ticks.stillOn }} />
              ))}
            </div>
          </section>
        )
      })()}

      {groups.map((g) => {
        const shown = g.items.filter(visible)
        if (shown.length === 0) return null
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
              {shown.map((it, i) => (
                <Row key={it.slug} item={it} group={g.group} picks={picks} onSave={save} first={i === 0} tick={{ ticked: ticks.ticked.has(it.number), onToggle: ticks.toggle, claims: claimOf(it), nowMs, onStillOn: ticks.stillOn }} />
              ))}
            </div>
          </section>
        )
      })}
      </>
      )}

      <footer style={{ marginTop: '2.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '72ch' }}>
        Every row opens with its number — say “#16” and everyone knows which one; a number is given once, when the to-do is
        written, and never reused. Sizes are a working estimate: XS is under an hour, S a sitting, M a day of PRs, L a
        multi-day train; the Shortlist at the top sorts each group by them. “Next” names the smallest shippable step from the to-do’s own plan. Each row links to its file on
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
  anchor = true,
  tick,
}: {
  item: BoardItem
  group: BoardGroup
  picks: PickMap
  onSave: (slug: string, patch: Partial<{ pick: PunchPick | ''; note: string }>) => void | Promise<void>
  first: boolean
  /** False under a By number row, which carries the `#n<N>` anchor itself. */
  anchor?: boolean
  /** The person's "working on it" box under the number and the card's claim line; left out under a By number row, which carries both itself. */
  tick?: {
    ticked: boolean
    onToggle: (item: Pick<BoardItem, 'number' | 'group'>, next: boolean) => void | Promise<void>
    claims: CardClaims | undefined
    nowMs: number
    onStillOn: (item: Pick<BoardItem, 'number' | 'group'>) => void | Promise<void>
  }
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
      id={anchor ? `n${item.number}` : undefined}
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
        {item.flagged ? (
          <span title="Flagged — the owner put this at the top" aria-label="Flagged" style={{ display: 'block', color: 'var(--text-red-700)', fontSize: '0.95rem', lineHeight: 1.1 }}>
            ⚑
          </span>
        ) : null}
        {tick ? <PunchListTick item={item} ticked={tick.ticked} onToggle={tick.onToggle} className="punch-tick" /> : null}
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
        {tick ? <PunchListClaim item={item} claims={tick.claims} nowMs={tick.nowMs} onStillOn={tick.onStillOn} className="punch-claim" /> : null}
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
                      background: pressed ? PICK_FILL[p] : 'var(--surface)',
                      color: pressed ? '#fff' : 'var(--text-muted)',
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

/** A pressed pick's fill under its white word: each colour's light value, deep in both themes (v2.6190). */
const PICK_FILL: Record<PunchPick, string> = {
  do: '#15803d',
  later: '#92400e',
  drop: '#b91c1c',
}

/** The View and Show pills: dark when it is the one chosen. */
function pillStyle(active: boolean): CSSProperties {
  return {
    font: 'inherit',
    fontSize: '0.85rem',
    fontWeight: 500,
    padding: '0.3rem 0.75rem',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--text-strong)' : 'var(--border-strong)'}`,
    background: active ? 'var(--text-strong)' : 'var(--surface)',
    color: active ? 'var(--bg-page)' : 'var(--text-base)',
    cursor: 'pointer',
  }
}

/** What this device remembered for a choice; storage may be blocked, and then it remembers nothing. */
function readChoice(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** The default is remembered as nothing, so a device that never chose reads like one that chose the default. */
function writeChoice(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // A private window or blocked storage: the press still works for this page.
  }
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
