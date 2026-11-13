import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import { accrualPressLabel, type MoneyLine } from '../../lib/bridge/moneyCard'
import { moveDive, type DiveFacts, type DiveTarget } from '../../lib/bridge/callDive'
import { BridgeMoveTable } from './BridgeMoveTable'
import { TODO_FOOT } from '../../lib/bridge/callTodo'
import type { TodoState } from '../../lib/bridge/callTodoState'
import { WEEK_CALL_MOVES, WEEK_CALL_MOVES_PHONE, type WeekCallModel, type WeekMove, type WeekTile, type WeekTone } from '../../lib/bridge/weekCall'

/**
 * The Bridge's first screen (punch list #303, PR 1): the tiles, then the card *What to do now* with its moves. The
 * tiles read *Made last week*, *Slowest step*, then the two balances (punch list #334, PR 6). The doors to everything
 * behind it are `BridgeDoors`, drawn by the page under this.
 *
 * The page is a pulse (punch list #334, PR 7). The card reads today: the slowest step, or cash in a week it leads,
 * and the moves that would change it. It records nothing, hands nothing to a person and asks nothing on Friday.
 * The words of the card, the step and its moves are `buildWeekCall`'s.
 *
 * Each move names its things (punch list #334, PR 8; `callDive.ts`): a heading line with the move's one press, then
 * its lines as a table (`BridgeMoveTable.tsx`). The card is framed by a rule down its left side, not a box.
 *
 * Every line carries a check (punch list #334, PR 9; `callTodoState.ts`): grey makes a to-do card for that one thing,
 * blue is with someone and shows the card.
 */

const label: CSSProperties = { fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', lineHeight: 1.25 }

const toneText = (t: WeekTone): string => (t === 'red' ? 'var(--text-red-700)' : t === 'green' ? 'var(--text-green-700)' : t === 'amber' ? 'var(--text-amber-800)' : 'var(--text)')

/**
 * The balances (punch list #334, PR 6; `moneyCard.ts` holds the words and the owner's asks): the cash balance and the
 * accrual balance side by side, each with its runway under the number, and one line under both that says what runway
 * counts. It stands in for the red band and the separate cash tile.
 *
 * The owner asked for the slowest step "to the left of the cash section", so the row reads *Made last week*,
 * *Slowest step*, then this card. On a phone those two tiles share a row and this card takes the next one whole.
 * The accrual balance is a press: it opens Money owed, where the waterfall walks from cash to that number.
 */
function BalancesTile({ cash, accrual, foot, narrow, onNote, onAccrual }: { cash: MoneyLine; accrual: MoneyLine; foot: string; narrow: boolean; onNote: () => void; onAccrual: () => void }) {
  const pad = narrow ? '0.5rem 0.55rem' : '0.7rem 0.9rem'
  const balance = narrow ? '1.35rem' : '1.9rem'
  const sub: CSSProperties = { fontSize: narrow ? '0.72rem' : '0.82rem', color: 'var(--text-muted)', lineHeight: 1.3, marginTop: 2 }
  // Runway is the fact to act on, so it reads a step stronger than the sentence under it.
  const runway: CSSProperties = { fontSize: narrow ? '0.74rem' : '0.86rem', fontWeight: 700, color: 'var(--text-700)', lineHeight: 1.3, marginTop: 1 }
  const number = (line: MoneyLine): CSSProperties => ({ fontSize: balance, fontWeight: 800, lineHeight: 1.15, color: toneText(line.tone), fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' })
  return (
    <div data-testid="bridge-week-tile-money" style={{ gridColumn: narrow ? '1 / -1' : undefined, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, minWidth: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', flex: 1 }}>
        <div data-testid="bridge-week-tile-cash" style={{ padding: pad, minWidth: 0 }}>
          <div style={label}>{cash.label}</div>
          <div style={number(cash)}>{cash.value}</div>
          {cash.runway && (
            <div style={runway} data-testid="bridge-week-runway-cash">
              {cash.runway}
            </div>
          )}
          <div style={sub}>{cash.sub}</div>
          {/* The accounts left out of cash on hand (v2.6838): the list and its switches sit behind Money. */}
          {cash.note && (
            <button type="button" onClick={onNote} data-testid="bridge-week-tile-note" style={{ display: 'block', font: 'inherit', textAlign: 'left', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: narrow ? '0.72rem' : '0.8rem', color: 'var(--text-amber-800)', lineHeight: 1.3, marginTop: 2, textDecoration: 'underline' }}>
              {cash.note}
            </button>
          )}
        </div>
        <div style={{ padding: pad, borderLeft: '1px solid var(--border)', minWidth: 0 }}>
          <button type="button" onClick={onAccrual} aria-label={accrualPressLabel(accrual)} data-testid="bridge-week-tile-accrual" style={{ display: 'block', width: '100%', font: 'inherit', textAlign: 'left', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit', minWidth: 0 }}>
            <div style={label}>
              {accrual.label} <span aria-hidden>›</span>
            </div>
            <div style={number(accrual)}>{accrual.value}</div>
            {accrual.runway && (
              <div style={runway} data-testid="bridge-week-runway-accrual">
                {accrual.runway}
              </div>
            )}
            <div style={sub}>{accrual.sub}</div>
          </button>
        </div>
      </div>
      {foot && (
        <div style={{ padding: narrow ? '0.25rem 0.55rem 0.35rem' : '0.3rem 0.9rem 0.45rem', borderTop: '1px solid var(--border)', fontSize: narrow ? '0.68rem' : '0.74rem', color: 'var(--text-muted)', lineHeight: 1.3 }} data-testid="bridge-week-runway-foot">
          {foot}
        </div>
      )}
    </div>
  )
}

/** *Made last week* or *Slowest step*. The cash tile and its red band are the balances' now. */
function Tile({ tile, narrow }: { tile: WeekTile; narrow: boolean }) {
  return (
    <div data-testid={`bridge-week-tile-${tile.id}`} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: narrow ? '0.5rem 0.55rem' : '0.7rem 0.9rem', minWidth: 0 }}>
      <div style={label}>{tile.label}</div>
      <div style={{ fontSize: narrow ? '1.35rem' : '1.9rem', fontWeight: 800, lineHeight: 1.15, color: toneText(tile.tone), fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{tile.value}</div>
      {tile.bars && tile.bars.length > 0 && (
        <div aria-hidden style={{ display: 'flex', alignItems: 'flex-end', gap: narrow ? 2 : 4, height: narrow ? 22 : 30, margin: '4px 0 2px', maxWidth: 280 }}>
          {tile.bars.map((b) => (
            <i
              key={b.label}
              title={b.label}
              style={{
                flex: 1,
                height: `${Math.max(6, Math.round(b.share * 100))}%`,
                borderRadius: 1,
                background: b.waiting ? 'repeating-linear-gradient(135deg, #2563eb 0 3px, transparent 3px 6px)' : '#2563eb',
                opacity: b.current ? 1 : 0.55,
              }}
            />
          ))}
        </div>
      )}
      <div style={{ fontSize: narrow ? '0.72rem' : '0.82rem', color: 'var(--text-muted)', lineHeight: 1.3, marginTop: 2 }}>{tile.sub}</div>
    </div>
  )
}

export function BridgeWeek({
  model,
  onCashNote,
  strip,
  stripSide = false,
  money,
  onAccrual,
  dives = null,
  onDive,
  todoStates = null,
  dayLabel,
  onTodoSee,
}: {
  model: WeekCallModel
  /** Opens Money at the bank's accounts, from the sentence that names what is left out. */
  onCashNote: () => void
  /** The strip of pipe (PR 3): under the tiles in a usual week, under the card in a week cash leads. */
  strip?: ReactNode
  /** At a desk, the standing pipe (punch list #318) sits beside the card instead of over or under it. */
  stripSide?: boolean
  /** The two balances and the line that says what runway counts (`moneyCard.ts`; punch list #334, PR 6). */
  money: { cash: MoneyLine; accrual: MoneyLine; foot: string }
  /** A press on the accrual balance: the page opens Money owed. */
  onAccrual: () => void
  /** What the page has read behind each move (`callDive.ts`). Null while it is not read: a move is then its heading alone. */
  dives?: DiveFacts | null
  /** A press that opens a window or a sheet on the page. A page of the app is a link and needs no handler. */
  onDive?: (target: DiveTarget) => void
  /** Where each line stands as a to-do (`callTodoState.ts`), by the to-do's key. Null while not read: every check is grey. */
  todoStates?: ReadonlyMap<string, TodoState> | null
  /** How the words beside a check say a day. */
  dayLabel: (ymd: string) => string
  /** A blue check was pressed: show the card it stands for. */
  onTodoSee?: (state: Extract<TodoState, { kind: 'open' | 'covered' | 'done' }>) => void
}) {
  const narrow = useIsNarrowScreen()
  const cap = narrow ? WEEK_CALL_MOVES_PHONE : WEEK_CALL_MOVES
  // The card shows the first moves; the step's desk behind The flow lists every one.
  const shown = model.card.moves.slice(0, cap)
  const border = model.card.tone === 'lit' ? '#dc2626' : 'var(--border-strong)'

  // The foot says how a line reaches a person, once some line on the card carries a check.
  const hasChecks = shown.some((m) => (moveDive(m, dives)?.items ?? []).some((item) => item.todo))

  const moveRow = (m: WeekMove, i: number) => {
    // The real things behind the move, and the one press that opens the place to act on them.
    const dive = moveDive(m, dives)
    const movePress: CSSProperties = { marginLeft: 'auto', font: 'inherit', fontSize: '0.84rem', fontWeight: 600, minHeight: narrow ? 44 : 32, display: 'inline-flex', alignItems: 'center', padding: 0, border: 'none', background: 'transparent', color: 'var(--text-link)', textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }
    return (
      <li key={m.title} data-testid="bridge-week-move" style={{ padding: narrow ? '10px 0 6px' : '12px 0 8px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 10px' }}>
          <span aria-hidden style={{ width: 22, height: 22, flex: '0 0 auto', borderRadius: '50%', background: 'var(--bg-muted)', color: 'var(--text)', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {i + 1}
          </span>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.3, minWidth: 0 }}>
            {m.kind === 'cash' && (
              <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: 4, padding: '1px 5px', marginRight: 6, verticalAlign: 2, background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', border: '1px solid var(--border-red)' }}>cash</span>
            )}
            {/* A move the page names nothing for keeps its door on its title. */}
            {m.door && !dive ? (
              <Link to={m.door.to} title={m.door.label} style={{ color: 'inherit', textDecoration: 'none' }}>
                {m.title} <span style={{ color: 'var(--text-link)' }}>›</span>
              </Link>
            ) : (
              m.title
            )}
          </span>
          {m.why && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>{m.why}</span>}
          {/* The move's own press sits on its heading, so no button floats beside the rows. */}
          {dive?.press && dive.target ? (
            dive.target.kind === 'page' ? (
              <Link to={dive.target.to} style={movePress} data-testid="bridge-week-dive-press">
                {dive.press} ›
              </Link>
            ) : (
              <button type="button" onClick={() => dive.target && onDive?.(dive.target)} style={movePress} data-testid="bridge-week-dive-press">
                {dive.press} ›
              </button>
            )
          ) : null}
        </div>
        {dive && dive.items.length > 0 && <BridgeMoveTable dive={dive} narrow={narrow} todoStates={todoStates} dayLabel={dayLabel} onDive={onDive} onTodoSee={onTodoSee} />}
      </li>
    )
  }

  // The side panel *How the week runs* is off the page (punch list #318): the owner could not read it, and chose to take it off.
  const side = !narrow && stripSide && strip != null
  return (
    <section id="bridge-week" aria-label="This week on the Bridge" data-testid="bridge-week" style={{ scrollMarginTop: 'calc(var(--app-top-chrome, 0px) + 3rem)' }}>
      {/* Made last week, the slowest step, then the two balances. On a phone the first two share a row. */}
      <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.8fr)', gap: narrow ? 8 : 12 }}>
        {model.tiles
          .filter((t) => t.id !== 'cash')
          .map((t) => (
            <Tile key={t.id} tile={t} narrow={narrow} />
          ))}
        <BalancesTile cash={money.cash} accrual={money.accrual} foot={money.foot} narrow={narrow} onNote={onCashNote} onAccrual={onAccrual} />
      </div>
      {!side && !model.cashLeads && strip}

      <div style={side ? { display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) minmax(0, 1fr)', gap: 12, alignItems: 'start' } : undefined}>
        {side && <div style={{ minWidth: 0 }}>{strip}</div>}
        <div style={{ marginTop: narrow ? 8 : 12 }}>
          {/* The card is framed quietly: its tone is a rule down the left side, not a box around every line. */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `4px solid ${border}`, borderRadius: 12, padding: narrow ? '0.55rem 0.75rem 0.65rem' : '0.75rem 0.95rem 0.85rem' }} data-testid="bridge-week-card">
            {/* The card is a reading of today, so it is not named a call. */}
            <div style={label} data-testid="bridge-week-label">
              {model.card.label}
            </div>
            <div style={{ fontSize: '1.12rem', fontWeight: 800, lineHeight: 1.25, margin: '2px 0' }} data-testid="bridge-week-lead">
              {model.card.lead}
            </div>
            {model.card.line && (
              <div style={{ fontSize: '0.86rem', color: 'var(--text-700)' }} data-testid="bridge-week-line">
                {model.card.line}
              </div>
            )}
            {shown.length > 0 && <ol style={{ listStyle: 'none', margin: '7px 0 0', padding: 0 }}>{shown.map(moveRow)}</ol>}
            {hasChecks && (
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 7 }} data-testid="bridge-week-foot">
                {TODO_FOOT}
              </div>
            )}
          </div>
        </div>
      </div>
      {!side && model.cashLeads && strip}
    </section>
  )
}
