/**
 * The card an item of the Plans look's By date view answers a pointer with (punch list #367, PR 2): its
 * details and the presses that act on it. The words and the presses are `lib/plans/plansByDateCards.ts`;
 * this file is the box, where it stands and how it comes and goes.
 *
 * With a pointer the card opens after a beat on a hover or a keyboard focus, and stays while the pointer is
 * on the item or on the card, so its presses can be reached. A press on the item, or Enter, pins it: then it
 * stays until Escape, its ×, or a press anywhere else. Unlike the job number's card (`JobChip.tsx`), which
 * takes no pointer events because it only reads, this one is pressed, so it stands beside the item, never
 * under the pointer's path to it. On a narrow screen nothing hovers: a press opens the same card as a sheet
 * from the bottom. A row of a card can lead to another card, with *‹ Back* to return.
 */
import { useLayoutEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { dayWords } from '../../lib/plans/plansByDate'
import type { PbdCard, PbdCardAction } from '../../lib/plans/plansByDateCards'
import { PBD_CARD_MARGIN, PBD_CARD_WIDTH, PBD_CARD_Z, placeItemCard } from '../../hooks/usePlansByDateItemCard'
import { capStyle } from './developmentPageBits'

const pressStyle: CSSProperties = { border: '1px solid var(--border-strong)', borderRadius: 6, padding: '4px 10px', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-block' }
const linkStyle: CSSProperties = { border: 0, background: 'none', padding: 0, font: 'inherit', fontSize: '0.78rem', color: 'var(--text-link)', cursor: 'pointer' }

export function PlansByDateItemCard({
  card,
  glyph,
  anchor,
  cardRef,
  pinned,
  sheet,
  canBack,
  onBack,
  onGo,
  onAct,
  onClose,
  hover,
}: {
  card: PbdCard
  /** The item's own mark, drawn by the chart's paint. */
  glyph: ReactNode
  anchor: Element | null
  cardRef: { current: HTMLDivElement | null }
  pinned: boolean
  sheet: boolean
  canBack: boolean
  onBack: () => void
  onGo: (key: string) => void
  onAct: (action: PbdCardAction) => void
  onClose: () => void
  hover: { onMouseEnter: () => void; onMouseLeave: () => void }
}) {
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null)
  // The card stands beside its item, and follows it when the page scrolls or the window changes.
  useLayoutEffect(() => {
    if (sheet) return
    const stand = () => {
      const el = cardRef.current
      if (!el || !anchor) return
      const a = anchor.getBoundingClientRect()
      const next = placeItemCard(a, { width: el.offsetWidth, height: el.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }, anchor.getAttribute('data-pbd-align') === 'end' ? 'end' : 'centre')
      setPlace((prev) => (prev && prev.left === next.left && prev.top === next.top ? prev : next))
    }
    stand()
    window.addEventListener('scroll', stand, true)
    window.addEventListener('resize', stand)
    return () => {
      window.removeEventListener('scroll', stand, true)
      window.removeEventListener('resize', stand)
    }
  }, [sheet, anchor, cardRef, card.key])

  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {glyph ? <span style={{ paddingTop: 3, flex: 'none' }}>{glyph}</span> : null}
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }} data-testid="pbd-card-title">
            {card.title}
          </strong>
          {card.kicker ? (
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }} data-testid="pbd-card-kicker">
              {card.kicker}
            </div>
          ) : null}
        </div>
        {pinned || sheet ? (
          <button type="button" onClick={onClose} aria-label="Close" title="Close" style={{ ...linkStyle, fontSize: '1.05rem', lineHeight: 1, color: 'var(--text-muted)', padding: '0 2px' }} data-testid="pbd-card-close">
            ×
          </button>
        ) : null}
      </div>
      {canBack ? (
        <button type="button" onClick={onBack} style={{ ...linkStyle, marginTop: 4 }} data-testid="pbd-card-back">
          ‹ Back
        </button>
      ) : null}
      {card.facts.length ? (
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: 10, rowGap: 2, margin: '8px 0 0', fontSize: '0.78rem' }} data-testid="pbd-card-facts">
          {card.facts.map((f) => (
            <div key={f.label} style={{ display: 'contents' }}>
              <dt style={{ color: 'var(--text-muted)' }}>{f.label}</dt>
              <dd style={{ margin: 0, color: 'var(--text-700)', overflowWrap: 'anywhere' }}>{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {card.words ? (
        <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--text-700)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} data-testid="pbd-card-words">
          {card.words}
        </p>
      ) : null}
      {card.rows.length ? (
        <div style={{ marginTop: 8 }} data-testid="pbd-card-rows">
          {card.rowsTitle ? <div style={{ ...capStyle, marginBottom: 2 }}>{card.rowsTitle}</div> : null}
          {card.rows.map((r) => {
            const inner = (
              <>
                <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.day ? dayWords(r.day) : ''}</span>
                <span style={{ minWidth: 0, overflowWrap: 'anywhere', color: r.to ? 'var(--text-link)' : 'var(--text-700)' }}>
                  {r.text}
                  {r.soft ? <span style={{ color: 'var(--text-muted)' }}> · {r.soft}</span> : null}
                </span>
              </>
            )
            const rowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: r.day ? '5.6rem minmax(0, 1fr)' : '0 minmax(0, 1fr)', columnGap: r.day ? 8 : 0, alignItems: 'baseline', width: '100%', textAlign: 'left', padding: '3px 0', borderTop: '1px solid var(--border)', fontSize: '0.78rem' }
            return r.to ? (
              <button key={r.key} type="button" onClick={() => onGo(r.to as string)} style={{ ...linkStyle, ...rowStyle }} title="See this one" data-testid={`pbd-card-row-${r.key}`}>
                {inner}
              </button>
            ) : (
              <div key={r.key} style={rowStyle} data-testid={`pbd-card-row-${r.key}`}>
                {inner}
              </div>
            )
          })}
          {card.rowsMore ? (
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', paddingTop: 3, borderTop: '1px solid var(--border)' }} data-testid="pbd-card-more">
              and {card.rowsMore} more in the list under the chart
            </div>
          ) : null}
        </div>
      ) : null}
      {card.actions.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }} data-testid="pbd-card-actions">
          {card.actions.map((a) =>
            a.kind === 'open-link' ? (
              <a key={a.kind} href={a.href} target="_blank" rel="noreferrer" style={pressStyle} data-testid="pbd-card-act-open-link">
                {a.label}
              </a>
            ) : (
              <button key={a.kind} type="button" onClick={() => onAct(a)} style={pressStyle} data-testid={`pbd-card-act-${a.kind}`}>
                {a.label}
              </button>
            ),
          )}
        </div>
      ) : null}
      {card.quiet ? (
        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 8 }} data-testid="pbd-card-quiet">
          {card.quiet}
        </div>
      ) : null}
    </>
  )

  if (sheet) {
    return createPortal(
      <div role="dialog" aria-modal="true" aria-label={card.title} data-testid="pbd-sheet" style={{ position: 'fixed', inset: 0, zIndex: PBD_CARD_Z, background: 'rgba(17, 24, 39, 0.35)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingTop: 'var(--app-top-chrome, 0px)', boxSizing: 'border-box' }} onClick={(e) => (e.target === e.currentTarget ? onClose() : undefined)}>
        <div
          ref={cardRef}
          tabIndex={-1}
          style={{ width: 'min(520px, 100%)', maxHeight: 'min(72vh, 100%)', overflowY: 'auto', background: 'var(--surface)', borderTop: '1px solid var(--border-strong)', borderRadius: '12px 12px 0 0', boxShadow: '0 -8px 24px rgba(0,0,0,.18)', padding: '12px 14px calc(14px + env(safe-area-inset-bottom, 0px))', outline: 'none' }}
        >
          {body}
        </div>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div
      ref={cardRef}
      role="dialog"
      aria-label={card.title}
      tabIndex={-1}
      data-testid="pbd-card"
      data-pinned={pinned ? 'true' : 'false'}
      {...hover}
      style={{
        position: 'fixed',
        left: place?.left ?? 0,
        top: place?.top ?? 0,
        visibility: place ? 'visible' : 'hidden',
        zIndex: PBD_CARD_Z,
        width: `min(${PBD_CARD_WIDTH}px, calc(100vw - ${PBD_CARD_MARGIN * 2}px))`,
        maxHeight: 'min(70vh, 460px)',
        overflowY: 'auto',
        background: 'var(--surface)',
        border: `1px solid ${pinned ? 'var(--text-700)' : 'var(--border-strong)'}`,
        borderRadius: 10,
        boxShadow: '0 10px 30px rgba(0,0,0,.18)',
        padding: '10px 12px',
        outline: 'none',
      }}
    >
      {body}
    </div>,
    document.body,
  )
}
