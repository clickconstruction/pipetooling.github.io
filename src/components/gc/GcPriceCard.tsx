import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type KeyboardEvent, type ReactNode } from 'react'
import type { PriceCardHandle } from './usePriceCard'
import { createPortal } from 'react-dom'
import { aboutMoney, isHole, money, priceStanding, type GcAction, type GcProject, type GcState, type TradeStanding, type TradeStandingRow } from '../../lib/gcMode/gcModel'
import { Btn } from './gcUi'
import { GcFollowUpSheet } from './GcFollowUpSheet'
import { useMatchMedia } from '../../hooks/useMatchMedia'

/**
 * GC mode design spike: the card behind a bidding job's price on the Project Board (the owner's
 * pick B, 2026-10-04). The red coverage chip and the "so far, with holes" line open it: every trade
 * by what happens next, with the button to do it, and what the price comes to once every trade is
 * in. Hover or focus opens it, a click keeps it open, Escape or a click outside closes it. On a
 * phone it rises from the bottom. Kernel: `priceStanding` (gcPriceStanding.ts).
 */

/** The project tabs the card can open. */
export type PriceCardTab = 'packages' | 'number'

const GROUPS: Record<TradeStanding, { words: string; dot: string }> = {
  pick: { words: 'Pick a quote to carry', dot: 'var(--text-red-700)' },
  waiting: { words: 'Waiting on an answer', dot: 'var(--text-amber-800)' },
  notAsked: { words: 'Nobody asked yet', dot: 'var(--border-strong)' },
  ownBid: { words: 'Our own bid to price', dot: 'var(--text-amber-800)' },
  gap: { words: 'A number with a gap', dot: 'var(--text-amber-800)' },
  ranOut: { words: 'A quote that ran out', dot: 'var(--text-amber-800)' },
  guess: { words: 'Our guess', dot: 'var(--text-amber-800)' },
  real: { words: 'A real number', dot: 'var(--text-green-700)' },
}

/**
 * Something on the row that opens the card: the chip or the price line. It keeps the row's own
 * click (which opens the project) from firing.
 */
export function GcPriceTrigger({ card, label, children, style }: { card: PriceCardHandle; label: string; children: ReactNode; style?: CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null)
  const open = card.anchor !== null && card.anchor === ref.current
  return (
    <span
      ref={ref}
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={label}
      onMouseEnter={(e) => card.enter(e.currentTarget)}
      onMouseLeave={card.leave}
      onFocus={(e) => card.enter(e.currentTarget)}
      onClick={(e) => {
        e.stopPropagation()
        card.toggle(e.currentTarget)
      }}
      onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          card.toggle(e.currentTarget)
        }
      }}
      style={{ cursor: 'help', textDecoration: 'underline dotted', textUnderlineOffset: 3, borderRadius: 4, ...style }}
    >
      {children}
    </span>
  )
}

/** "about $1.42M with every trade in", under the price line. Nothing when no trade is a hole. */
export function GcPriceLikely({ state, project }: { state: GcState; project: GcProject }) {
  const p = priceStanding(state, project)
  if (p.holes === 0) return null
  return (
    <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-base)' }}>
      {aboutMoney(p.likely)} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>with every trade in</span>
    </span>
  )
}

/** The card itself, hung under the trigger that opened it; a sheet from the bottom on a phone. */
export function GcPriceCard({
  card,
  state,
  project,
  dispatch,
  onTab,
  onFollowUp,
}: {
  card: PriceCardHandle
  state: GcState
  project: GcProject
  dispatch: Dispatch<GcAction>
  onTab: (tab: PriceCardTab) => void
  onFollowUp: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const phone = useMatchMedia('(max-width: 720px)')
  const [, redraw] = useState(0)
  // The Follow up sheet on a company (the owner, 2026-10-04): it outlives the card, which closes as it opens.
  const [sheetFor, setSheetFor] = useState<string | null>(null)
  const anchor = card.anchor
  useEffect(() => {
    if (!anchor) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') card.close()
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || anchor.contains(t)) return
      card.close()
    }
    const onMove = () => redraw((n) => n + 1)
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [anchor, card])
  const sheet = sheetFor ? <GcFollowUpSheet state={state} dispatch={dispatch} startPartnerId={sheetFor} onClose={() => setSheetFor(null)} /> : null
  if (!anchor) return sheet
  const p = priceStanding(state, project)
  const rect = anchor.getBoundingClientRect()
  const width = Math.min(460, window.innerWidth - 24)
  const below = rect.bottom + 6
  const roomBelow = window.innerHeight - below - 12
  const place: CSSProperties = phone
    ? { left: 8, right: 8, bottom: 8, maxHeight: '75vh' }
    : {
        width,
        left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
        ...(roomBelow >= 320 ? { top: below, maxHeight: roomBelow } : { bottom: window.innerHeight - rect.top + 6, maxHeight: rect.top - 18 }),
      }
  const go = (fn: () => void) => () => {
    fn()
    card.close()
  }
  const days = (n: number) => `${n} ${n === 1 ? 'trade' : 'trades'}`
  const groups = (Object.keys(GROUPS) as TradeStanding[]).filter((st) => p.counts[st] > 0)
  const cardEl = createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`What the price of ${project.name} is made of`}
      onMouseEnter={card.holdOpen}
      onMouseLeave={card.leave}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        zIndex: 1200,
        ...place,
        overflowY: 'auto',
        background: 'var(--surface)',
        color: 'var(--text-base)',
        border: '1px solid var(--border-strong)',
        borderRadius: 10,
        boxShadow: '0 12px 32px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)',
        padding: '0.85rem 1rem 0.75rem',
        display: 'grid',
        gap: '0.65rem',
        fontSize: '0.85rem',
        textAlign: 'left',
        fontWeight: 400,
      }}
    >
      <div style={{ display: 'grid', gap: '0.25rem' }}>
        <strong style={{ fontSize: '0.95rem' }}>
          {p.holes > 0 ? `About ${money(Math.round(p.likely))} once every trade is in` : `What ${money(p.soFar)} is made of`}
        </strong>
        <span style={{ color: 'var(--text-muted)' }}>
          {p.holes > 0
            ? `${money(p.soFar)} so far. ${days(p.holes)} ${p.holes === 1 ? 'has' : 'have'} no number and count as $0. The estimate uses the lowest quote, or our budget where there is none.`
            : 'Every trade has a number. Some are not final yet.'}
        </span>
      </div>
      {groups.map((st) => (
        <div key={st} style={{ display: 'grid', gap: '0.15rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: GROUPS[st].dot, display: 'inline-block' }} />
            {GROUPS[st].words} · {p.counts[st]}
          </div>
          {p.rows
            .filter((r) => r.standing === st)
            .map((r, i) => (
              <TradeLine key={r.pkg.id} row={r} first={i === 0} project={project} dispatch={dispatch} go={go} onTab={onTab} onFollowUp={onFollowUp} onSheet={setSheetFor} />
            ))}
        </div>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.1rem 0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-strong)', fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ color: 'var(--text-muted)' }}>Trades with a number</span>
        <span style={{ textAlign: 'right' }}>{money(p.trades)}</span>
        <span style={{ color: 'var(--text-muted)' }}>General conditions</span>
        <span style={{ textAlign: 'right' }}>{money(p.generalConditions)}</span>
        <span style={{ color: 'var(--text-muted)' }}>
          Contingency {p.contingencyPct}% and fee {p.feePct}%
        </span>
        <span style={{ textAlign: 'right' }}>{money(p.markups)}</span>
        <strong>Price so far</strong>
        <strong style={{ textAlign: 'right' }}>{money(p.soFar)}</strong>
        {p.holes > 0 && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>The {days(p.holes)} with no number, estimated, with contingency and fee</span>
            <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{money(Math.round(p.likely - p.soFar))}</span>
            <strong>About, once every trade is in</strong>
            <strong style={{ textAlign: 'right' }}>{money(Math.round(p.likely))}</strong>
          </>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <span>{card.pinned ? 'Escape or a click outside closes this.' : 'Click the line to keep this open.'}</span>
        <Btn kind="quiet" onClick={go(() => onTab('packages'))}>
          Open Trades
        </Btn>
      </div>
    </div>,
    document.body,
  )
  return (
    <>
      {sheet}
      {cardEl}
    </>
  )
}

function TradeLine({
  row,
  first,
  project,
  dispatch,
  go,
  onTab,
  onFollowUp,
  onSheet,
}: {
  row: TradeStandingRow
  first: boolean
  project: GcProject
  dispatch: Dispatch<GcAction>
  go: (fn: () => void) => () => void
  onTab: (tab: PriceCardTab) => void
  onFollowUp: () => void
  /** Open the Follow up sheet on a company. */
  onSheet: (partnerId: string) => void
}) {
  const { pkg, standing, lowest } = row
  const who = row.followUp
  const carry = (carried: string) => dispatch({ type: 'carry', projectId: project.id, packageId: pkg.id, carried })
  const amount = isHole(standing) ? row.estimate : row.carried
  let actions: ReactNode = null
  if (standing === 'pick' && lowest) {
    actions = (
      <>
        <Btn kind="primary" onClick={() => carry(lowest.invite.id)}>
          Carry {lowest.company}
        </Btn>
        <Btn kind="quiet" onClick={go(() => onTab('packages'))}>
          Compare quotes
        </Btn>
      </>
    )
  } else if (standing === 'waiting') {
    actions = (
      <>
        {who ? <Btn onClick={go(() => onSheet(who.partnerId))}>Follow up with {who.company}</Btn> : <Btn onClick={go(onFollowUp)}>Open Follow up</Btn>}
        <Btn kind="quiet" onClick={go(() => onTab('packages'))}>
          Ask someone else
        </Btn>
      </>
    )
  } else if (standing === 'notAsked') {
    actions = (
      <>
        <Btn onClick={go(() => onTab('packages'))}>Who to ask</Btn>
        <Btn kind="quiet" onClick={() => carry('plug')}>
          Use our budget
        </Btn>
      </>
    )
  } else if (standing === 'ownBid') {
    actions = <Btn onClick={go(() => onTab('packages'))}>Price our own bid</Btn>
  } else if (standing === 'gap') {
    actions = <Btn onClick={go(() => onTab('packages'))}>Set the cost in Compare quotes</Btn>
  } else if (standing === 'ranOut') {
    actions = who ? <Btn onClick={go(() => onSheet(who.partnerId))}>Follow up with {who.company}</Btn> : <Btn onClick={go(onFollowUp)}>Open Follow up</Btn>
  } else if (standing === 'guess') {
    actions = lowest ? (
      <Btn kind="primary" onClick={() => carry(lowest.invite.id)}>
        Carry {lowest.company}
      </Btn>
    ) : (
      <Btn onClick={go(() => onTab('packages'))}>Ask for quotes</Btn>
    )
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.1rem 0.75rem', padding: '0.35rem 0', borderTop: first ? 'none' : '1px solid var(--border)' }}>
      <span style={{ fontWeight: 600 }}>
        {pkg.trade}
        {row.company ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {row.company}</span> : pkg.selfPerform ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · our own crew</span> : null}
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: isHole(standing) ? 'var(--text-muted)' : undefined, whiteSpace: 'nowrap' }} title={isHole(standing) ? 'An estimate. It is not in the price yet.' : undefined}>
        {amount === null ? '' : money(amount)}
      </span>
      {row.words && <span style={{ gridColumn: '1 / -1', color: 'var(--text-muted)' }}>{row.words}</span>}
      {actions && <span style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>{actions}</span>}
    </div>
  )
}
