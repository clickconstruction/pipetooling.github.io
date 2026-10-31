import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core'
import { LegendButton } from '../help/LegendButton'
import { DeskLegendCard } from '../help/LegendCard'
import { SUBS_BOARD_LEGEND } from '../../lib/prospects/subsBoardLegend'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  DRAG_TITLE,
  PIN_CHIP,
  PIN_CHIP_TITLE,
} from '../../lib/prospects/subsRanks'
import type { GcNeeds } from '../../lib/prospects/gcNeeds'
import { NEED_TONE_COLOR_BY_NAME } from '../../lib/prospects/needTones'
import {
  SUB_RECORD_WORDS,
  recordFact,
  recordTone,
  subRecordOf,
  type SubRecord,
} from '../../lib/prospects/subRecord'
import {
  BOARD_EMPTY_COLUMN,
  BOARD_SHOW_LIT,
  PRIORITY_CHOICES,
  boardColumns,
  boardFoldWords,
  callNextId,
  callTopWords,
  cardChips,
  columnHeadLines,
  orderColumn,
  priorityWord,
  topIds,
  type BoardCard,
} from '../../lib/prospects/subsBoard'
import {
  PLANS_PICKER_HINT,
  PLANS_PICKER_LABEL,
  PLANS_PICKER_NONE,
  plansChoiceWords,
  type PlansChoice,
} from '../../lib/prospects/subsStages'
import { tradeKey } from '../../lib/prospects/subsLane'
import { callNumbers, prospectTitle } from '../../lib/prospects/personBlock'
import {
  lastTouchLabel,
  type ProspectLastCall,
} from '../../lib/prospects/prospectListGrouping'
import { telHrefFor } from '../../lib/phoneContact'

/**
 * The board by trade (v2.5808, punch list #153, PR 2): Hiring's columns for the Subs lane. One column a
 * trade in the needs panel's order; For brings the picked project's trades forward and folds the rest;
 * each column orders its cards by the office's priority, the record, never called and coldest (pins
 * over all of it once PR 3 lands), and Call the top 3 → hands the first three to the deck as a run.
 * The call is never logged here: the deck has the lock and the clock. Pure of data: the page feeds
 * it the lane and takes every press.
 */
export interface SubsBoardProspect extends BoardCard {
  company_name: string | null
  contact_name: string | null
  phone_number: string | null
  contact_phone: string | null
  address: string | null
  is_person: boolean
}

export interface SubsBoardProps<T extends SubsBoardProspect> {
  /** The lane's queue: every sub still to call. */
  subs: readonly T[]
  needs: Pick<GcNeeds, 'rows' | 'book'>
  plans: readonly PlansChoice[]
  picked: PlansChoice | null
  onPick: (projectId: string | null) => void
  records: ReadonlyMap<string, SubRecord>
  calledIds: ReadonlySet<string>
  lastCalls: Readonly<Record<string, ProspectLastCall>>
  /** An upcoming callback a card carries, by prospect id, as words. */
  callbacks?: Readonly<Record<string, string>>
  /** Hand-set ranks by trade key, then prospect id (PR 3). Absent: every card flows. */
  pins?: ReadonlyMap<string, ReadonlyMap<string, number>>
  busy?: boolean
  nowMs?: number
  /** The strip over the board, drawn by the page. */
  strip?: ReactNode
  onCall: (ids: string[], trade: string, packageId: string | null) => void
  onBench: (prospect: T) => void
  onPass: (prospect: T) => void
  onEdit: (prospect: T) => void
  onAddSub: (trade: string) => void
  /** Call first · Normal · Later on a card (PR 3). Absent: the picker does not draw. */
  onPriority?: (prospect: T, value: 1 | null | 3) => void
  /** A drop (PR 3): the dragged card pinned at `toIndex` in the trade's column. Absent: no drag. */
  onDrop?: (trade: string, draggedId: string, toIndex: number) => void
  /** The pinned chip pressed: the card flows again. */
  onUnpin?: (trade: string, prospectId: string) => void
}

const boardCollision: CollisionDetection = (args) => {
  const pointer = pointerWithin(args)
  if (pointer.length > 0) return pointer
  const rect = rectIntersection(args)
  if (rect.length > 0) return rect
  return closestCorners(args)
}

/** One card, sortable inside its column when the board drags (v2.5809). The id carries the trade, since a sub sits in two columns. */
function BoardCard({
  id,
  draggable,
  children,
}: {
  id: string
  draggable: boolean
  children: (handle: ReactNode) => ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !draggable })
  const handle = draggable ? (
    <button
      type="button"
      {...attributes}
      {...listeners}
      title={DRAG_TITLE}
      aria-label={DRAG_TITLE}
      style={{
        cursor: 'grab',
        background: 'none',
        border: 'none',
        color: 'var(--text-faint)',
        padding: 0,
        fontSize: '1rem',
        lineHeight: 1.35,
        touchAction: 'none',
        flexShrink: 0,
      }}
    >
      ⠿
    </button>
  ) : null
  return (
    <li
      ref={setNodeRef}
      data-board-card={id.slice(id.indexOf(':') + 1)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
    >
      {children(handle)}
    </li>
  )
}

const COLUMN_WIDTH = 300

const chip: CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  padding: '0.05rem 0.45rem',
  borderRadius: 999,
  whiteSpace: 'nowrap',
}

const RECORD_TONE_STYLE: Record<
  ReturnType<typeof recordTone>,
  { background: string; color: string }
> = {
  green: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  amber: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  red: { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' },
  grey: { background: 'var(--bg-subtle)', color: 'var(--text-muted)' },
}

const smallBtn = (kind: 'primary' | 'plain' | 'bench'): CSSProperties => ({
  font: 'inherit',
  fontSize: '0.75rem',
  fontWeight: 600,
  padding: '0.2rem 0.55rem',
  borderRadius: 6,
  border: `1px solid ${kind === 'primary' ? '#2563eb' : kind === 'bench' ? '#8b5cf6' : 'var(--border-strong)'}`,
  background:
    kind === 'primary'
      ? '#2563eb'
      : kind === 'bench'
        ? 'var(--bg-violet-100)'
        : 'var(--surface)',
  color:
    kind === 'primary'
      ? 'white'
      : kind === 'bench'
        ? 'var(--text-violet-700)'
        : 'var(--text-700)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  textDecoration: 'none',
})

export function SubsBoard<T extends SubsBoardProspect>({
  subs,
  needs,
  plans,
  picked,
  onPick,
  records,
  calledIds,
  lastCalls,
  callbacks = {},
  pins,
  busy = false,
  nowMs = Date.now(),
  strip,
  onCall,
  onBench,
  onPass,
  onEdit,
  onAddSub,
  onPriority,
  onDrop,
  onUnpin,
}: SubsBoardProps<T>) {
  const [showAll, setShowAll] = useState(false)
  // The ? and its card (punch list #187 PR 4): the board's two sentences, behind one press.
  const [legendOpen, setLegendOpen] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState<string | null>(null)
  const { columns, folded, noTrade } = boardColumns(
    subs,
    needs,
    picked,
    showAll,
  )
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )
  const cardKey = (trade: string, id: string) => `${tradeKey(trade)}:${id}`

  // A drop lands on another card of the same column (the sortable ids carry the trade); the index is the card's place there.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || !onDrop) return
    const [fromTrade, draggedId] = String(active.id).split(':', 2)
    const [overTrade, overId] = String(over.id).split(':', 2)
    if (!fromTrade || !draggedId || fromTrade !== overTrade || !overId) return
    const col = columns.find((c) => tradeKey(c.trade) === fromTrade)
    if (!col) return
    const colPins = pins?.get(fromTrade)
    const ordered = orderColumn(col.subs, {
      records,
      calledIds,
      ...(colPins ? { pins: colPins } : {}),
    })
    const toIndex = ordered.findIndex((c) => c.id === overId)
    if (toIndex < 0 || overId === draggedId) return
    onDrop(col.trade, draggedId, toIndex)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollision}
      onDragEnd={handleDragEnd}
    >
      <div data-subs-board>
        {strip}
        <div
          role="group"
          aria-label={PLANS_PICKER_LABEL}
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: '0.5rem',
            fontSize: '0.8125rem',
          }}
        >
          <label
            style={{
              display: 'inline-flex',
              gap: '0.4rem',
              alignItems: 'center',
              fontWeight: 700,
              color: 'var(--text-700)',
            }}
          >
            {PLANS_PICKER_LABEL}
            <select
              value={picked?.id ?? ''}
              onChange={(e) => {
                setShowAll(false)
                onPick(e.target.value || null)
              }}
              disabled={plans.length === 0}
              style={{
                font: 'inherit',
                fontWeight: 400,
                padding: '0.25rem 0.5rem',
                borderRadius: 6,
                border: '1px solid var(--border-strong)',
                background: 'var(--surface)',
                color: 'var(--text-strong)',
                maxWidth: '100%',
              }}
            >
              <option value="">{PLANS_PICKER_NONE}</option>
              {plans.map((c) => (
                <option key={c.id} value={c.id}>
                  {plansChoiceWords(c)}
                </option>
              ))}
            </select>
          </label>
          {picked ? (
            <span style={{ color: 'var(--text-600)' }}>
              {picked.trades.length === 0 ? (
                'every trade on this one is ours'
              ) : (
                <>
                  needs{' '}
                  <b style={{ color: 'var(--text-strong)' }}>
                    {picked.trades.join(', ')}
                  </b>
                </>
              )}
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>
              {plans.length === 0
                ? 'No project is out for a bid right now.'
                : PLANS_PICKER_HINT}
            </span>
          )}
          {picked && folded > 0 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              aria-pressed={showAll}
              style={{ ...smallBtn('plain'), marginLeft: 'auto' }}
            >
              {showAll ? BOARD_SHOW_LIT : boardFoldWords(folded)}
            </button>
          )}
          <LegendButton legend={SUBS_BOARD_LEGEND} open={legendOpen} onToggle={setLegendOpen} style={{ marginLeft: picked && folded > 0 ? undefined : 'auto' }} />
        </div>
        {/* The board's two sentences moved behind the ? (punch list #187 PR 4), as Messages' lane sentences did (v2.5802). */}
        {legendOpen ? <DeskLegendCard legend={SUBS_BOARD_LEGEND} phone={false} onClose={() => setLegendOpen(false)} style={{ margin: '0 0 0.75rem' }} /> : null}
        <div
          className="subsBoardColumns"
          style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start',
            overflowX: 'auto',
            paddingBottom: '0.5rem',
            scrollSnapType: 'x proximity',
          }}
        >
          {columns.map((col) => {
            const colPins = pins?.get(tradeKey(col.trade))
            const ordered = orderColumn(col.subs, {
              records,
              calledIds,
              ...(colPins ? { pins: colPins } : {}),
            })
            const next = callNextId(ordered, calledIds)
            const head = columnHeadLines(col)
            const packageId =
              picked?.packageByTrade[tradeKey(col.trade)] ?? null
            return (
              <section
                key={col.trade}
                data-board-column={col.trade}
                aria-label={col.trade}
                style={{
                  width: COLUMN_WIDTH,
                  minWidth: COLUMN_WIDTH,
                  flexShrink: 0,
                  scrollSnapAlign: 'start',
                  border: `1px solid ${col.lit ? '#3b82f6' : 'var(--border)'}`,
                  borderRadius: 10,
                  background: col.lit
                    ? 'var(--bg-blue-tint)'
                    : 'var(--bg-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <header
                  style={{
                    padding: '0.6rem 0.7rem 0.5rem',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '0.4rem',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '0.9375rem',
                        color: 'var(--text-strong)',
                      }}
                    >
                      {col.trade}
                    </span>
                    {col.lit && (
                      <span
                        aria-label="the picked project needs this trade"
                        style={{ color: 'var(--text-amber-700)' }}
                      >
                        ★
                      </span>
                    )}
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {col.subs.length}
                    </span>
                  </div>
                  {head.ask && (
                    <div style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>
                      {head.ask.map((a, i) => (
                        <span
                          key={i}
                          style={{
                            color:
                              NEED_TONE_COLOR_BY_NAME[a.tone] ??
                              'var(--text-600)',
                            fontWeight: a.tone === 'quiet' ? 400 : 600,
                          }}
                        >
                          {i > 0 && ' · '}
                          {a.text}
                        </span>
                      ))}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      marginTop: '0.15rem',
                    }}
                  >
                    {head.bench}
                  </div>
                  <div style={{ marginTop: '0.45rem' }}>
                    {ordered.length > 0 ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          onCall(topIds(ordered), col.trade, packageId)
                        }
                        style={{
                          ...smallBtn('primary'),
                          width: '100%',
                          padding: '0.35rem 0.6rem',
                        }}
                      >
                        {callTopWords(ordered.length)}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onAddSub(col.trade)}
                        style={{
                          ...smallBtn('plain'),
                          width: '100%',
                          padding: '0.35rem 0.6rem',
                        }}
                      >
                        Add a sub
                      </button>
                    )}
                  </div>
                </header>
                <SortableContext
                  items={ordered.map((p) => cardKey(col.trade, p.id))}
                  strategy={verticalListSortingStrategy}
                >
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: 0,
                      padding: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                    }}
                  >
                    {ordered.length === 0 && (
                      <li
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--text-faint)',
                          padding: '0.25rem',
                        }}
                      >
                        {BOARD_EMPTY_COLUMN}
                      </li>
                    )}
                    {ordered.map((p, i) => {
                      const record = subRecordOf(records, p.id)
                      const chips = cardChips(p, {
                        pinned: !!colPins?.has(p.id),
                        callNext: next === p.id,
                        columnTrade: col.trade,
                      })
                      const nums = callNumbers(p)
                      const city = (p.address ?? '')
                        .split(',')
                        .slice(-2)
                        .join(',')
                        .trim()
                      const callback = callbacks[p.id]
                      const tone = RECORD_TONE_STYLE[recordTone(record.record)]
                      return (
                        <BoardCard
                          key={p.id}
                          id={cardKey(col.trade, p.id)}
                          draggable={!!onDrop && !busy}
                        >
                          {(handle) => (
                            <div
                              style={{
                                padding: '0.5rem 0.6rem',
                                background: 'var(--surface)',
                                borderRadius: 8,
                                border: `1px solid ${chips.pinned ? 'var(--border-amber-soft)' : 'var(--border)'}`,
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '0.4rem',
                                }}
                              >
                                {handle}
                                <span
                                  style={{
                                    fontWeight: 700,
                                    fontVariantNumeric: 'tabular-nums',
                                    lineHeight: 1.35,
                                    flexShrink: 0,
                                  }}
                                >
                                  #{i + 1}
                                </span>
                                <span
                                  style={{
                                    fontWeight: 600,
                                    lineHeight: 1.35,
                                    flex: '1 1 auto',
                                    minWidth: 0,
                                    overflowWrap: 'anywhere',
                                  }}
                                >
                                  {prospectTitle(p)}
                                </span>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => onEdit(p)}
                                  title={`Edit ${prospectTitle(p)}`}
                                  aria-label={`Edit ${prospectTitle(p)}`}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: busy ? 'not-allowed' : 'pointer',
                                    color: 'var(--text-faint)',
                                    padding: '0.15rem 0 0',
                                    fontSize: '0.9375rem',
                                    lineHeight: 1,
                                    flexShrink: 0,
                                  }}
                                >
                                  ⚙
                                </button>
                              </div>
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  margin: '0.25rem 0 0',
                                }}
                              >
                                {chips.priority && (
                                  <span
                                    style={{
                                      ...chip,
                                      background:
                                        chips.priority === 'Call first'
                                          ? 'var(--bg-amber-100)'
                                          : 'var(--bg-subtle)',
                                      color:
                                        chips.priority === 'Call first'
                                          ? 'var(--text-amber-800)'
                                          : 'var(--text-muted)',
                                      border:
                                        chips.priority === 'Later'
                                          ? '1px solid var(--border)'
                                          : 'none',
                                    }}
                                  >
                                    {chips.priority === 'Call first'
                                      ? '★ Call first'
                                      : 'Later'}
                                  </span>
                                )}
                                <span
                                  style={{ ...chip, ...tone }}
                                  title={recordFact(record)}
                                >
                                  {SUB_RECORD_WORDS[record.record]}
                                </span>
                                {chips.pinned &&
                                  (onUnpin ? (
                                    <button
                                      type="button"
                                      onClick={() => onUnpin(col.trade, p.id)}
                                      title={PIN_CHIP_TITLE}
                                      style={{
                                        ...chip,
                                        background: 'var(--bg-amber-100)',
                                        color: 'var(--text-amber-800)',
                                        border: 'none',
                                        cursor: 'pointer',
                                        font: 'inherit',
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {PIN_CHIP} ×
                                    </button>
                                  ) : (
                                    <span
                                      style={{
                                        ...chip,
                                        background: 'var(--bg-amber-100)',
                                        color: 'var(--text-amber-800)',
                                      }}
                                    >
                                      {PIN_CHIP}
                                    </span>
                                  ))}
                                {chips.callNext && (
                                  <span
                                    title="The first card in this column with no call yet"
                                    style={{
                                      ...chip,
                                      background: 'var(--bg-green-tint)',
                                      color: 'var(--text-green-700)',
                                    }}
                                  >
                                    call next
                                  </span>
                                )}
                                {chips.alsoIn.length > 0 && (
                                  <span
                                    title="This company sits in these columns too"
                                    style={{
                                      ...chip,
                                      background: 'var(--bg-indigo-100)',
                                      color: 'var(--text-indigo-800)',
                                    }}
                                  >
                                    also in: {chips.alsoIn.join(', ')}
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--text-muted)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.1rem',
                                  margin: '0.3rem 0 0',
                                }}
                              >
                                <span>
                                  {nums.call ? (
                                    <a
                                      href={telHrefFor(nums.call)}
                                      style={{ color: 'var(--text-link)' }}
                                    >
                                      {nums.call}
                                    </a>
                                  ) : (
                                    'no phone'
                                  )}
                                  {city ? ` · ${city}` : ''}
                                </span>
                                <span>
                                  {lastTouchLabel(p, lastCalls[p.id], nowMs)}
                                  {record.calls > 0
                                    ? ` · ${recordFact(record)}`
                                    : ''}
                                </span>
                                {callback && (
                                  <span
                                    style={{ color: 'var(--text-amber-700)' }}
                                  >
                                    {callback}
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '0.35rem',
                                  flexWrap: 'wrap',
                                  marginTop: '0.45rem',
                                  alignItems: 'center',
                                }}
                              >
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    onCall([p.id], col.trade, packageId)
                                  }
                                  style={smallBtn('primary')}
                                >
                                  Call now →
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => onBench(p)}
                                  title="They will quote for us: the bench's Add a company, filled from this card"
                                  style={smallBtn('bench')}
                                >
                                  To the bench ✓
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => onPass(p)}
                                  title="Not a company we would hire: out of the queue"
                                  style={smallBtn('plain')}
                                >
                                  Pass
                                </button>
                                {onPriority && (
                                  <span
                                    style={{
                                      marginLeft: 'auto',
                                      position: 'relative',
                                    }}
                                  >
                                    <button
                                      type="button"
                                      disabled={busy}
                                      aria-expanded={priorityOpen === p.id}
                                      onClick={() =>
                                        setPriorityOpen((v) =>
                                          v === p.id ? null : p.id,
                                        )
                                      }
                                      title="Call first · Normal · Later: the office's priority, over the record"
                                      style={{
                                        ...smallBtn('plain'),
                                        fontWeight: 500,
                                        color: 'var(--text-muted)',
                                      }}
                                    >
                                      {priorityWord(p.priority)} ▾
                                    </button>
                                    {priorityOpen === p.id && (
                                      <span
                                        role="group"
                                        aria-label="Priority"
                                        style={{
                                          position: 'absolute',
                                          right: 0,
                                          top: '100%',
                                          zIndex: 5,
                                          marginTop: 2,
                                          display: 'flex',
                                          flexDirection: 'column',
                                          background: 'var(--surface)',
                                          border:
                                            '1px solid var(--border-strong)',
                                          borderRadius: 6,
                                          boxShadow:
                                            '0 4px 10px rgba(0,0,0,0.12)',
                                          overflow: 'hidden',
                                        }}
                                      >
                                        {PRIORITY_CHOICES.map((c) => (
                                          <button
                                            key={c.word}
                                            type="button"
                                            aria-pressed={
                                              priorityWord(p.priority) ===
                                              c.word
                                            }
                                            onClick={() => {
                                              setPriorityOpen(null)
                                              onPriority(p, c.value)
                                            }}
                                            style={{
                                              font: 'inherit',
                                              fontSize: '0.75rem',
                                              fontWeight:
                                                priorityWord(p.priority) ===
                                                c.word
                                                  ? 700
                                                  : 500,
                                              textAlign: 'left',
                                              padding: '0.3rem 0.7rem',
                                              border: 'none',
                                              background:
                                                priorityWord(p.priority) ===
                                                c.word
                                                  ? 'var(--bg-blue-tint)'
                                                  : 'var(--surface)',
                                              color: 'var(--text-700)',
                                              cursor: 'pointer',
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            {c.word}
                                          </button>
                                        ))}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </BoardCard>
                      )
                    })}
                  </ul>
                </SortableContext>
              </section>
            )
          })}
        </div>
        {noTrade.length > 0 && (
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              marginTop: '0.5rem',
            }}
          >
            {noTrade.length} {noTrade.length === 1 ? 'sub names' : 'subs name'}{' '}
            no trade yet, so no column holds{' '}
            {noTrade.length === 1 ? 'it' : 'them'}. Edit prospect names the
            trade.{' '}
            <Link
              to="/prospects?kind=subs&tab=prospect-list"
              style={{ color: 'var(--text-link)' }}
            >
              Open the list
            </Link>
            .
          </p>
        )}
      </div>
    </DndContext>
  )
}
